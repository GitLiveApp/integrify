import { testSdk, cleanFirestore } from '../util';
import { firestore } from 'firebase-admin';
import * as integrifyFunctions from '../files/deleteFunctions';

describe('deleteReference', () => {

  beforeEach(() => {
    return cleanFirestore();
  });

  it('should delete the docs in the collection with the foreign key matching the default source key', async () => {
    const someKey = 'some_id';
    const notSomeKey = 'not_some_id';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ someKey: someKey });
    await detailRef.add({ someKey: notSomeKey });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({}, `master/${someKey}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteReferencesInCollectionUsingDefault);
    await wrapped(snap, { params: { masterId: someKey } });

    const { docs: nestedDocsAfter } = await detailRef.get();
    expect(nestedDocsAfter.length).toBe(1);
    const doc = nestedDocsAfter[0].data();
    expect(doc.someKey).toBe(notSomeKey);
  });

  it('should delete all the docs in the collection', async () => {
    const someKey = 'some_id';
    const notSomeKey = 'not_some_id';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ someKey: someKey });
    await detailRef.add({ someKey: notSomeKey });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({}, `master/${someKey}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteAllReferencesInCollectionU);
    await wrapped(snap, { params: { masterId: someKey } });

    const { docs: nestedDocsAfter } = await detailRef.get();
    expect(nestedDocsAfter.length).toBe(0);
  });

  it('should delete the docs in the collection with the matching foreign key', async () => {
    const masterId = 'master_id';
    const notMasterId = 'not_master_id';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ masterId: masterId });
    await detailRef.add({ masterId: notMasterId });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({}, `master/${masterId}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteReferencesInCollection);
    await wrapped(snap, { params: { masterId } });

    const { docs: nestedDocsAfter } = await detailRef.get();
    expect(nestedDocsAfter.length).toBe(1);
    const doc = nestedDocsAfter[0].data();
    expect(doc.masterId).toBe(notMasterId);
  });

  it('should delete the docs in the collection group with the matching foreign key', async () => {
    const masterId = 'master_id';
    const notMasterId = 'not_master_id';

    const detailRef = firestore().collection('detail1').doc('sub_detail').collection('detail2');
    await detailRef.add({ masterId: masterId });
    await detailRef.add({ masterId: notMasterId });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({}, `master/${masterId}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteReferencesInCollectionGroup);
    await wrapped(snap, { params: { masterId } });

    const { docs: nestedDocsAfter } = await detailRef.get();
    expect(nestedDocsAfter.length).toBe(1);
    const doc = nestedDocsAfter[0].data();
    expect(doc.masterId).toBe(notMasterId);
  });

  it('should delete the docs in the collection using the parameter specified in the collection source', async () => {
    const primaryKey = 'primary_key';
    const notPrimaryKey = 'not_primary_key';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ primaryKey: primaryKey });
    await detailRef.add({ primaryKey: notPrimaryKey });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({}, `master/${primaryKey}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteReferencesWithRenamedSourceParam);
    await wrapped(snap, { params: { primaryKey } });

    const { docs: nestedDocsAfter } = await detailRef.get();
    expect(nestedDocsAfter.length).toBe(1);
    const doc = nestedDocsAfter[0].data();
    expect(doc.primaryKey).toBe(notPrimaryKey);
  });

  it('should delete the docs in the collection using the snapshot fields specified in the collection source', async () => {
    const anotherKey = 'another_key';
    const notAnotherKey = 'not_another_key';
    const testId = 'test_id';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ anotherKey: anotherKey });
    await detailRef.add({ anotherKey: notAnotherKey });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({ testId }, `master/${anotherKey}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteReferencesWithSnapshotFieldsInSource);
    await wrapped(snap, { params: { anotherKey } });

    const { docs: nestedDocsAfter } = await detailRef.get();
    expect(nestedDocsAfter.length).toBe(1);
    const doc = nestedDocsAfter[0].data();
    expect(doc.anotherKey).toBe(notAnotherKey);
  });

  it('should throw an error for missing primary key', async () => {
    const anotherKey = 'another_key';
    const notAnotherKey = 'not_another_key';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ anotherKey: anotherKey });
    await detailRef.add({ anotherKey: notAnotherKey });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({}, `master/${anotherKey}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteMissingPrimaryKey);

    await expect(wrapped(snap, { params: {} }))
      .rejects
      .toThrow('integrify: Missing a primary key [noKey] in the source params');
  });

  it('should throw an error for missing foreign key and delete all', async () => {
    const anotherKey = 'another_key';
    const notAnotherKey = 'not_another_key';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ anotherKey: anotherKey });
    await detailRef.add({ anotherKey: notAnotherKey });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({}, `master/${anotherKey}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteMissingForeignKeyAndDeleteAll);

    await expect(wrapped(snap, { params: { anotherKey } }))
      .rejects
      .toThrow('integrify: missing foreign key or set deleteAll to true');
  });

  it('should delete the docs in the collection with the matching foreign key and run the pre hook', async () => {
    const masterId = 'master_id';
    const notMasterId = 'not_master_id';
    const preRef = firestore().collection('pre');

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ masterId: masterId });
    await detailRef.add({ masterId: notMasterId });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Make sure the pre docs is empty
    const { docs: preDocsBefore } = await preRef.get();
    expect(preDocsBefore.length).toBe(0);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({}, `master/${masterId}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteReferencesInCollectionWithPreHook);
    await wrapped(snap, { params: { masterId } });

    const { docs: nestedDocsAfter } = await detailRef.get();
    expect(nestedDocsAfter.length).toBe(1);
    const doc = nestedDocsAfter[0].data();
    expect(doc.masterId).toBe(notMasterId);

    // Make sure the pre hook ran
    const { docs: preDocsAfter } = await preRef.get();
    expect(preDocsAfter.length).toBe(1);
  });

  it('should delete the docs in the collection with the matching foreign key and run the post hook', async () => {
    const masterId = 'master_id';
    const notMasterId = 'not_master_id';
    const postRef = firestore().collection('post');

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ masterId: masterId });
    await detailRef.add({ masterId: notMasterId });

    const { docs: nestedDocsBefore } = await detailRef.get();
    expect(nestedDocsBefore.length).toBe(2);

    // Make sure the post docs is empty
    const { docs: postDocsBefore } = await postRef.get();
    expect(postDocsBefore.length).toBe(0);

    // Trigger function to delete references
    const snap = testSdk.firestore.makeDocumentSnapshot({}, `master/${masterId}`);
    const wrapped = testSdk.wrap(integrifyFunctions.deleteReferencesInCollectionWithPostHook);
    await wrapped(snap, { params: { masterId } });

    const { docs: nestedDocsAfter } = await detailRef.get();
    expect(nestedDocsAfter.length).toBe(1);
    const doc = nestedDocsAfter[0].data();
    expect(doc.masterId).toBe(notMasterId);

    // Make sure the post hook ran
    const { docs: postDocsAfter } = await postRef.get();
    expect(postDocsAfter.length).toBe(1);
  });

});