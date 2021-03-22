import { integrify } from '../../src/index';
import { firestore } from 'firebase-admin';
import * as functions from 'firebase-functions';

integrify({ config: { db: firestore(), functions, verbose: true } });

export const replicateMasterToDetail = integrify({
  rule: 'REPLICATE_ATTRIBUTES',
  source: {
    collection: 'master',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'someKey',
      attributeMapping: {
        masterField1: 'detail1Field1',
        masterField2: 'detail1Field2',
      },
    },
    {
      collection: 'detail2',
      foreignKey: 'someKey',
      attributeMapping: {
        masterField1: 'detail2Field1',
        masterField3: 'detail2Field3',
      },
      isCollectionGroup: true,
    },
  ],
});

export const replicateMasterToDetailWithNoTrackedChange = integrify({
  rule: 'REPLICATE_ATTRIBUTES',
  source: {
    collection: 'master',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'someKey',
      attributeMapping: {
        masterField1: 'detail1Field1',
        masterField2: 'detail1Field2',
      },
    },
  ],
});

export const replicateMasterDeleteWhenEmpty = integrify({
  rule: 'REPLICATE_ATTRIBUTES',
  source: {
    collection: 'master/{primaryKey}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'tempId',
      attributeMapping: {
        masterDetail1: 'foreignDetail1',
        masterDetail2: 'foreignDetail2',
      },
    },
  ],
});

export const replicateReferencesWithMissingKey = integrify({
  rule: 'REPLICATE_ATTRIBUTES',
  source: {
    collection: 'master/{masterId}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'randomId',
      attributeMapping: {
        masterDetail1: 'foreignDetail1',
      },
    },
  ],
});

export const deleteMissingPrimaryKey = integrify({
  rule: 'REPLICATE_ATTRIBUTES',
  source: {
    collection: 'master/{noKey}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'someKey',
      attributeMapping: {
        masterField1: 'detail1Field1',
      },
    },
  ],
});

export const replicateMasterToDetailWithPreHook = integrify({
  rule: 'REPLICATE_ATTRIBUTES',
  source: {
    collection: 'master/{masterId}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'someKey',
      attributeMapping: {
        masterField1: 'detail1Field1',
      },
    },
  ],
  hooks: {
    pre: (snap, context) => {
      firestore().collection('pre').doc('test').set({ pre: true });
    },
  }
});

export const replicateMasterToDetailWithPostHook = integrify({
  rule: 'REPLICATE_ATTRIBUTES',
  source: {
    collection: 'master/{masterId}',
  },
  targets: [
    {
      collection: 'detail1',
      foreignKey: 'someKey',
      attributeMapping: {
        masterField1: 'detail1Field1',
      },
    },
  ],
  hooks: {
    post: (snap, context) => {
      firestore().collection('post').doc('test').set({ post: true });
    },
  }
});