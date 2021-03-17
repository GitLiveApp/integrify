import * as admin from 'firebase-admin';
import { Config, Rule } from '../common';

export interface MaintainCountRule extends Rule {
  source: {
    collection: string;
    foreignKey: string;
  };
  target: {
    collection: string;
    attribute: string;
  };
}

export function isMaintainCountRule(arg: Rule): arg is MaintainCountRule {
  return arg.rule === 'MAINTAIN_COUNT';
}

// TODO: Provide MAINTAIN_SHARDED_COUNT implementing distributed counters.
//       See: https://firebase.google.com/docs/firestore/solutions/counters

export function integrifyMaintainCount(
  rule: MaintainCountRule,
  config: Config
) {
  const functions = config.config.functions;
  const db = config.config.db;
  const logger = functions.logger;

  return functions.firestore
    .document(`${rule.source.collection}/{docId}`)
    .onWrite(async change => {
      logger.debug(
        `integrify: Maintain count of [${rule.source.collection}] with foreign key [${rule.source.foreignKey}] into [${rule.target.collection}].[${rule.target.attribute}]`
      );

      // Determine if document has been added or deleted
      const documentWasAdded = change.after.exists && !change.before.exists;
      const documentWasDeleted = !change.after.exists && change.before.exists;

      if (documentWasAdded) {
        await updateCount(change.after, Delta.Increment);
      } else if (documentWasDeleted) {
        await updateCount(change.before, Delta.Decrement);
      } else {
        logger.debug(
          `integrify: WARNING: Ignoring update trigger for MAINTAIN_COUNT on collection: [${rule.source.collection}]`
        );
      }
    });

  async function updateCount(
    snap: FirebaseFirestore.DocumentSnapshot,
    delta: Delta
  ) {
    const targetId = snap.get(rule.source.foreignKey);
    const targetRef = db.collection(rule.target.collection).doc(targetId);
    const targetSnap = await targetRef.get();

    // No-op if target does not exist
    if (!targetSnap.exists) {
      logger.debug(
        `integrify: WARNING: Target document does not exist in [${rule.target.collection}], id [${targetId}]`
      );
      return;
    }

    const update = {};
    update[rule.target.attribute] = admin.firestore.FieldValue.increment(delta);
    logger.debug(
      `integrify: Applying ${toString(delta).toLowerCase()} to [${
        rule.target.collection
      }].[${rule.target.attribute}], id: [${targetId}], update: `,
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
