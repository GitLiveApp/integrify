export interface ReplicateAttributesRule extends Rule {
  source: {
    collection: string;
  };
  targets: Array<{
    collection: string;
    foreignKey: string;
    attributeMapping: {
      [sourceAttribute: string]: string;
    };
  }>;
}

export interface DeleteReferencesRule extends Rule {
  source: {
    collection: string;
  };
  targets: Array<{
    collection: string;
    foreignKey: string;
  }>;
}

interface Rule {
  rule: 'REPLICATE_ATTRIBUTES' | 'DELETE_REFERENCES' | 'TODO';
}

export interface Config {
  config: {
    db: FirebaseFirestore.Firestore;
    functions: typeof import('firebase-functions');
  };
}

const config: Config = {
  config: { db: null, functions: null },
};

export function integrify(config: Config): null;
export function integrify(rule: ReplicateAttributesRule): any;
export function integrify(ruleOrConfig: Rule | Config) {
  if (isRule(ruleOrConfig)) {
    if (isReplicateAttributesRule(ruleOrConfig)) {
      return integrifyReplicateAttributes(ruleOrConfig);
    } else if (isDeleteReferencesRule(ruleOrConfig)) {
      return integrifyDeleteReferences(ruleOrConfig);
    } else {
      // TODO: Throw error
    }
  } else if (isConfig) {
    setConfig(ruleOrConfig);
  } else {
    // TODO: Throw error
  }
}

function integrifyReplicateAttributes(rule: ReplicateAttributesRule) {
  const functions = config.config.functions;

  console.log(
    `integrify: Creating function to replicate source collection [${
      rule.source.collection
    }]`
  );
  rule.targets.forEach(target => {
    Object.keys(target.attributeMapping).forEach(sourceAttribute => {
      console.log(
        `integrify: Replicating [${
          rule.source.collection
        }].[${sourceAttribute}] => [${target.collection}].[${
          target.attributeMapping[sourceAttribute]
        }]`
      );
    });
  });

  return functions.firestore
    .document(`${rule.source.collection}/{masterId}`)
    .onUpdate((change, context) => {
      const masterId = context.params.masterId;
      const newValue = change.after.data();
      console.log(
        `integrify: Detected update in [${
          rule.source.collection
        }], id [${masterId}], new value:`,
        newValue
      );

      // Check if atleast one of the attributes to be replicated was changed
      const trackedMasterAttributes = {};
      rule.targets.forEach(target => {
        Object.keys(target.attributeMapping).forEach(masterAttribute => {
          trackedMasterAttributes[masterAttribute] = true;
        });
      });
      let relevantUpdate = false;
      Object.keys(newValue).forEach(changedAttribute => {
        if (trackedMasterAttributes[changedAttribute]) {
          relevantUpdate = true;
        }
      });
      if (!relevantUpdate) {
        console.log(
          `integrify: No relevant updates found for replication:`,
          newValue
        );
        return null;
      }

      // Loop over each target specification to replicate atributes
      const db = config.config.db;
      const promises = [];
      rule.targets.forEach(target => {
        const targetCollection = target.collection;
        const update = {};

        // Create "update" mapping each changed attribute from source => target
        Object.keys(newValue).forEach(changedAttribute => {
          if (target.attributeMapping[changedAttribute]) {
            update[target.attributeMapping[changedAttribute]] =
              newValue[changedAttribute];
          }
        });
        console.log(
          `integrify: On collection [${target.collection}], applying update:`,
          update
        );

        // For each doc in targetCollection where foreignKey matches master.id,
        // apply "update" computed above
        promises.push(
          db
            .collection(targetCollection)
            .where(target.foreignKey, '==', masterId)
            .get()
            .then(detailDocs => {
              detailDocs.forEach(detailDoc => {
                console.log(
                  `integrify: On collection [${target.collection}], id [${
                    detailDoc.id
                  }], applying update:`,
                  update
                );
                promises.push(
                  db
                    .collection(target.collection)
                    .doc(detailDoc.id)
                    .update(update)
                );
              });
            })
        );
      });

      return Promise.all(promises);
    });
}

function integrifyDeleteReferences(rule: DeleteReferencesRule) {
  const functions = config.config.functions;

  rule.targets.forEach(target =>
    console.log(
      `integrify: Creating function to delete all references to source [${
        rule.source.collection
      }] from [${target.collection}] linked by key [${target.foreignKey}]`
    )
  );

  return functions.firestore
    .document(`${rule.source.collection}/{masterId}`)
    .onDelete((snap, context) => {
      const masterId = context.params.masterId;
      console.log(
        `integrify: Detected delete in [${
          rule.source.collection
        }], id [${masterId}]`
      );

      // Loop over each target
      const db = config.config.db;
      const promises = [];
      rule.targets.forEach(target => {
        console.log(
          `integrify: Deleting all docs in [${
            target.collection
          }] where foreign key [${target.foreignKey}] matches [${masterId}]`
        );
        // Delete all docs in this target corresponding to deleted master doc
        promises.push(
          db
            .collection(target.collection)
            .where(target.foreignKey, '==', masterId)
            .get()
            .then(querySnap => {
              querySnap.forEach(doc => {
                console.log(
                  `integrify: Deleting [${target.collection}], id [${doc.id}]`
                );
                promises.push(
                  db
                    .collection(target.collection)
                    .doc(doc.id)
                    .delete()
                );
              });
            })
        );
      });
      return Promise.all(promises);
    });
}

function setConfig(aConfig: Config) {
  config.config.db = aConfig.config.db;
  config.config.functions = aConfig.config.functions;
}

function isRule(arg: Rule | Config): arg is Rule {
  return (arg as Rule).rule !== undefined;
}

function isConfig(arg: Rule | Config): arg is Config {
  return (arg as Config).config !== undefined;
}

function isReplicateAttributesRule(arg: Rule): arg is ReplicateAttributesRule {
  return arg.rule === 'REPLICATE_ATTRIBUTES';
}

function isDeleteReferencesRule(arg: Rule): arg is ReplicateAttributesRule {
  return arg.rule === 'DELETE_REFERENCES';
}
