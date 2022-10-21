import { Config, Rule, HookFunction, getPrimaryKey } from '../common';
import { firestore } from 'firebase-admin';
import { CloudFunction, Change } from 'firebase-functions';
import { WriteBatch } from '../utils/WriteBatch';
import { QueryDocumentSnapshot } from '@google-cloud/firestore';
const FieldValue = firestore.FieldValue;

export interface ReplicateAttributesRule extends Rule {
  source: {
    collection: string;
  };
  targets: {
    collection: string;
    foreignKey: string;
    attributeMapping: {
      [sourceAttribute: string]: string;
    };
    isCollectionGroup?: boolean;
  }[];
  hooks?: {
    pre?: HookFunction<Change<QueryDocumentSnapshot>>;
    post?: HookFunction<Change<QueryDocumentSnapshot>>;
  };
}

export function isReplicateAttributesRule(
  arg: Rule
): arg is ReplicateAttributesRule {
  return arg.rule === 'REPLICATE_ATTRIBUTES';
}

export function integrifyReplicateAttributes(
  rule: ReplicateAttributesRule,
  config: Config
): CloudFunction<Change<QueryDocumentSnapshot>> {
  const functions = config.config.functions;
  const logger = functions.logger;

  return functions.firestore
    .document(rule.source.collection)
    .onUpdate(async (change, context) => {
      logger.debug(
        `integrify: Replicate source collection [${rule.source.collection}]`
      );
      rule.targets.forEach((target) => {
        Object.keys(target.attributeMapping).forEach((sourceAttribute) => {
          logger.debug(
            `integrify: Replicating [${rule.source.collection}].[${sourceAttribute}] => [${target.collection}].[${target.attributeMapping[sourceAttribute]}]`
          );
        });
      });

      const { hasPrimaryKey, primaryKey } = getPrimaryKey(
        rule.source.collection
      );
      if (!hasPrimaryKey) {
        rule.source.collection = `${rule.source.collection}/{${primaryKey}}`;
      }

      // Create map of master attributes to track for replication
      const trackedMasterAttributes = {};
      rule.targets.forEach((target) => {
        Object.keys(target.attributeMapping).forEach((masterAttribute) => {
          trackedMasterAttributes[masterAttribute] = true;
        });
      });

      // Get the last {...} in the source collection
      const primaryKeyValue = context.params[primaryKey];
      if (!primaryKeyValue) {
        throw new Error(
          `integrify: Missing a primary key [${primaryKey}] in the source params`
        );
      }
      const newValue = change.after.data();
      logger.debug(
        `integrify: Detected update in [${rule.source.collection}], id [${primaryKeyValue}], new value:`,
        newValue
      );

      // Call "pre" hook if defined
      if (rule.hooks && rule.hooks.pre) {
        await rule.hooks.pre(change, context);
      }

      // Check if at least one of the attributes to be replicated was changed
      let relevantUpdate = false;
      Object.keys(newValue).forEach((changedAttribute) => {
        if (trackedMasterAttributes[changedAttribute]) {
          relevantUpdate = true;
        }
      });
      if (!relevantUpdate) {
        logger.debug(
          `integrify: No relevant updates found for replication:`,
          newValue
        );
        return null;
      }

      // Loop over each target specification to replicate attributes
      const db = config.config.db;
      for (const target of rule.targets) {
        const targetCollection = target.collection;
        const update = {};

        // Create "update" mapping each changed attribute from source => target,
        // if delete is set delete field
        Object.keys(target.attributeMapping).forEach((changedAttribute) => {
          update[target.attributeMapping[changedAttribute]] =
            newValue[changedAttribute] || FieldValue.delete();
        });

        logger.debug(
          `integrify: On collection ${
            target.isCollectionGroup ? 'group ' : ''
          }[${target.collection}], applying update:`,
          update
        );

        // For each doc in targetCollection where foreignKey matches master.id,
        // apply "update" computed above
        let whereable = null;
        if (target.isCollectionGroup) {
          whereable = db.collectionGroup(targetCollection);
        } else {
          whereable = db.collection(targetCollection);
        }

        const batchUpdate = new WriteBatch();
        const detailDocs = await whereable
          .where(target.foreignKey, '==', primaryKeyValue)
          .get();

        for (const doc of detailDocs.docs) {
          logger.debug(
            `integrify: On collection ${
              target.isCollectionGroup ? 'group ' : ''
            }[${target.collection}], id [${doc.id}], applying update:`,
            update
          );
          batchUpdate.update(doc.ref, update);
        }
        await batchUpdate.commit();
      }

      // Call "post" hook if defined
      if (rule.hooks && rule.hooks.post) {
        await rule.hooks.post(change, context);
      }
    });
}
