import {
  Config,
  Rule,
  HookFunction,
  replaceReferencesWith,
  getPrimaryKey,
} from '../common';
import { WriteBatch } from '../utils/WriteBatch';
import { QueryDocumentSnapshot } from '@google-cloud/firestore';
import { CloudFunction } from 'firebase-functions';

export interface DeleteReferencesRule extends Rule {
  source: {
    collection: string;
  };
  targets: {
    collection: string;
    foreignKey?: string;
    isCollectionGroup?: boolean;
    deleteAll?: boolean;
  }[];
  hooks?: {
    pre?: HookFunction<QueryDocumentSnapshot>;
    post?: HookFunction<QueryDocumentSnapshot>;
  };
}

export function isDeleteReferencesRule(arg: Rule): arg is DeleteReferencesRule {
  return arg.rule === 'DELETE_REFERENCES';
}

export function integrifyDeleteReferences(
  rule: DeleteReferencesRule,
  config: Config
): CloudFunction<QueryDocumentSnapshot> {
  const functions = config.config.functions;
  const logger = functions.logger;

  return functions.firestore
    .document(rule.source.collection)
    .onDelete(async (snap, context) => {
      rule.targets.forEach(target =>
        logger.debug(
          `integrify: Delete all references to source [${rule.source.collection}] from [${target.collection}] linked by key [${target.foreignKey}]`
        )
      );

      const { hasPrimaryKey, primaryKey } = getPrimaryKey(
        rule.source.collection
      );
      if (!hasPrimaryKey) {
        rule.source.collection = `${rule.source.collection}/{${primaryKey}}`;
      }

      // Get the last {...} in the source collection
      const primaryKeyValue = context.params[primaryKey];
      if (!primaryKeyValue) {
        throw new Error(
          `integrify: Missing a primary key [${primaryKey}] in the source params`
        );
      }

      logger.debug(
        `integrify: Detected delete in [${rule.source.collection}], id [${primaryKeyValue}]`
      );

      // Call "pre" hook if defined
      if (rule.hooks && rule.hooks.pre) {
        await rule.hooks.pre(snap, context);
        // logger.debug(`integrify: Running pre-hook: ${rule.hooks.pre}`);
      }

      // Loop over each target
      const db = config.config.db;
      for (const target of rule.targets) {
        // Check delete all flag
        if (!target.deleteAll) {
          target.deleteAll = false;
        }
        // CHeck the foreign key
        if (!target.foreignKey) {
          target.foreignKey = '';
        }

        if (!target.deleteAll && target.foreignKey.trim().length === 0) {
          throw new Error(
            `integrify: missing foreign key or set deleteAll to true`
          );
        }

        // Replace the context.params and snapshot fields in the target collection
        const fieldSwap = replaceReferencesWith(
          { source: snap.data() || {}, ...context.params },
          target.collection
        );
        target.collection = fieldSwap.targetCollection;

        // Delete all docs in this target corresponding to deleted master doc
        let whereable: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = null;
        if (target.isCollectionGroup) {
          whereable = db.collectionGroup(target.collection);
        } else {
          whereable = db.collection(target.collection);
        }

        if (target.deleteAll) {
          logger.debug(
            `integrify: Deleting all docs in sub-collection [${target.collection}]`
          );
        } else {
          logger.debug(
            `integrify: Deleting all docs in collection ${
              target.isCollectionGroup ? 'group ' : ''
            }[${target.collection}] where foreign key [${
              target.foreignKey
            }] matches [${primaryKeyValue}]`
          );

          whereable = whereable.where(target.foreignKey, '==', primaryKeyValue);
        }

        const batchDelete = new WriteBatch();
        const querySnap = await whereable.get();
        for (const doc of querySnap.docs) {
          logger.debug(
            `integrify: Deleting [${target.collection}]${
              target.isCollectionGroup ? ' (group)' : ''
            }, id [${doc.id}]`
          );
          batchDelete.delete(doc.ref);
        }
        await batchDelete.commit();
      }

      // Call "post" hook if defined
      if (rule.hooks && rule.hooks.post) {
        await rule.hooks.post(snap, context);
        // logger.debug(`integrify: Running post-hook: ${rule.hooks.post}`);
      }
    });
}
