import { integrify } from '../../src/index';
import { firestore } from 'firebase-admin';
import * as functions from 'firebase-functions';

integrify({ config: { db: firestore(), functions, verbose: true } });

export const deleteReferencesInCollectionUsingDefault = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'someKey',
    }
  ]
});

export const deleteReferencesInCollection = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master/{masterId}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'masterId',
    }
  ]
});

export const deleteReferencesInCollectionGroup = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master/{masterId}',
  },
  targets: [
    {
      collection: 'detail2',
      foreignKey: 'masterId',
      isCollectionGroup: true,
    }
  ]
});

export const deleteReferencesWithRenamedSourceParam = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master/{primaryKey}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'primaryKey',
    }
  ],
});

export const deleteReferencesWithSnapshotFieldsInSource = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master/{anotherKey}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'anotherKey',
    },
  ],
});

export const deleteAllReferencesInCollectionU = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master',
  },
  targets: [
    {
      collection: 'detail1',
      deleteAll: true,
    }
  ]
});

export const deleteMissingPrimaryKey = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master/{noKey}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'someKey',
    }
  ]
});

export const deleteMissingForeignKeyAndDeleteAll = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master/{anotherKey}',
  },
  targets: [
    {
      collection: 'detail1',
    }
  ]
});

export const deleteReferencesInCollectionWithPreHook = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master/{masterId}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'masterId',
    }
  ],
  hooks: {
    pre: (snap, context) => {
      firestore().collection('pre').doc('test').set({ pre: true });
    },
  }
});

export const deleteReferencesInCollectionWithPostHook = integrify({
  rule: 'DELETE_REFERENCES',
  source: {
    collection: 'master/{masterId}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'masterId',
    }
  ],
  hooks: {
    post: (snap, context) => {
      firestore().collection('post').doc('test').set({ post: true });
    },
  }
});