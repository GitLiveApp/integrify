import * as admin from 'firebase-admin';
import { EventContext } from 'firebase-functions';
import {
  Config,
  FormatKeyFunction,
  getPrimaryKey,
  replaceReferencesWith,
  Rule,
} from '../common';

export interface MaintainCountRule extends Rule {
  source: {
    collection: string;
  };
  target: {
    collection: string;
    attribute: string;
  };
  hooks?: {
    pre: FormatKeyFunction;
  };
}

export function isMaintainCountRule(arg: Rule): arg is MaintainCountRule {
  return arg.rule === 'MAINTAIN_COUNT';
}

export function integrifyMaintainCount(
  rule: MaintainCountRule,
  config: Config
) {
  const functions = config.config.functions;
  const db = config.config.db;
  const logger = functions.logger;

  return functions.firestore
    .document(rule.source.collection)
    .onWrite(async (change, context) => {
      const { hasPrimaryKey, primaryKey } = getPrimaryKey(
        rule.source.collection
      );
      if (!hasPrimaryKey) {
        rule.source.collection = `${rule.source.collection}/{${primaryKey}}`;
      }

      // Determine if document has been added or deleted
      const documentWasAdded = change.after.exists && !change.before.exists;
      const documentWasDeleted = !change.after.exists && change.before.exists;

      if (documentWasAdded) {
        await updateCount(context, change.after, Delta.Increment);
      } else if (documentWasDeleted) {
        await updateCount(context, change.before, Delta.Decrement);
      } else {
        logger.debug(
          `integrify: WARNING: Ignoring update trigger for MAINTAIN_COUNT on collection: [${rule.source.collection}]`
        );
      }
    });

  async function updateCount(
    context: EventContext,
    snap: FirebaseFirestore.DocumentSnapshot,
    delta: Delta
  ) {
    // Replace the context.params and snapshot fields in the target collection
    const fieldSwap = replaceReferencesWith(
      { source: snap.data() || {}, ...context.params },
      rule.target.collection,
      rule?.hooks?.pre
    );

    // For maintain it must reference a doc
    const targetRef = db.doc(fieldSwap.targetCollection);
    const targetSnap = await targetRef.get();

    // No-op if target does not exist
    if (!targetSnap.exists) {
      logger.debug(
        `integrify: WARNING: Target document does not exist in [${fieldSwap.targetCollection}]`
      );
      return;
    }

    const update = {
      [rule.target.attribute]: admin.firestore.FieldValue.increment(delta),
    };
    logger.debug(
      `integrify: Applying ${toString(delta).toLowerCase()} to [${
        rule.target.collection
      }].[${rule.target.attribute}], update: `,
      update
    );
    await targetRef.update(update);
  }
}

const enum Delta {
  Increment = +1,
  Decrement = -1,
}

function toString(delta: Delta): string {
  if (delta === Delta.Increment) {
    return 'Increment';
  } else {
    return 'Decrement';
  }
}
