import { testSdk, cleanFirestore } from '../util';
import { firestore } from 'firebase-admin';
import * as integrifyFunctions from '../files/replicateFunctions';

describe('replicateAttributes', () => {

  beforeEach(() => {
    return cleanFirestore();
  });

  it('should replicate the changes in the master doc to the two detail docs with one being a collection group', async () => {
    const someKey = 'some_id';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ someKey: someKey, detail1Field1: 'before1' });
    const nestedDetailRef = firestore().collection('detail1').doc('sub_detail').collection('detail2');
    await nestedDetailRef.add({ someKey: someKey, detail2Field3: 'before3' });

    // Test that test is before
    const { docs: detailDocsBefore } = await detailRef.get();
    expect(detailDocsBefore.length).toBe(1);
    expect(detailDocsBefore[0].get('detail1Field1')).toBe('before1');

    const { docs: nestedDetailDocsBefore } = await nestedDetailRef.get();
    expect(nestedDetailDocsBefore.length).toBe(1);
    expect(nestedDetailDocsBefore[0].get('detail2Field3')).toBe('before3');

    // Trigger function to update references
    const wrapped = testSdk.wrap(integrifyFunctions.replicateMasterToDetail);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ masterField1: 'before1', masterField3: 'before3' }, `master/${someKey}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({ masterField1: 'after1', masterField3: 'after3' }, `master/${someKey}`);
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap), { params: { masterId: someKey } });

    // Test that test is after
    const { docs: detailDocsAfter } = await detailRef.get();
    expect(detailDocsAfter.length).toBe(1);
    expect(detailDocsAfter[0].get('detail1Field1')).toBe('after1');

    const { docs: nestedDetailDocsAfter } = await nestedDetailRef.get();
    expect(nestedDetailDocsAfter.length).toBe(1);
    expect(nestedDetailDocsAfter[0].get('detail2Field3')).toBe('after3');
  });

  it('should not replicate the changes in the master doc to the detail doc as it\'s not a tracked field', async () => {
    const someKey = 'some_id';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ someKey: someKey, detail1Field1: 'before1' });

    // Test that test is before
    const { docs: detailDocsBefore } = await detailRef.get();
    expect(detailDocsBefore.length).toBe(1);
    expect(detailDocsBefore[0].get('detail1Field1')).toBe('before1');

    // Trigger function to update references
    const wrapped = testSdk.wrap(integrifyFunctions.replicateMasterToDetail);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ notMasterField1: 'before1' }, `master/${someKey}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({ notMasterField1: 'after1' }, `master/${someKey}`);
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap), { params: { masterId: someKey } });

    // Test that test is after
    const { docs: detailDocsAfter } = await detailRef.get();
    expect(detailDocsAfter.length).toBe(1);
    expect(detailDocsAfter[0].get('detail1Field1')).toBe('before1');
  });

  it('should replicate the changes in the master doc to the two detail docs adn remove fields that aren\'t there anymore', async () => {
    const someKey = 'some_id';

    const detailRef = firestore().collection('detail1');
    await detailRef.add({
      tempId: someKey,
      foreignDetail1: 'foreign_detail_1',
      foreignDetail2: 'foreign_detail_2',
    });

    // Test that test is before
    const { docs: detailDocsBefore } = await detailRef.get();
    expect(detailDocsBefore.length).toBe(1);
    expect(detailDocsBefore[0].get('foreignDetail1')).toBe('foreign_detail_1');
    expect(detailDocsBefore[0].get('foreignDetail2')).toBe('foreign_detail_2');

    // Trigger function to update references
    const wrapped = testSdk.wrap(integrifyFunctions.replicateMasterDeleteWhenEmpty);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ masterField1: 'before1', masterField2: 'before2' }, `master/${someKey}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({ masterDetail2: 'after2' }, `master/${someKey}`);
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap), { params: { primaryKey: someKey } });

    // Test that test is after
    const { docs: detailDocsAfter } = await detailRef.get();
    expect(detailDocsAfter.length).toBe(1);
    expect(detailDocsAfter[0].get('detail1Field1')).toBeUndefined();
    expect(detailDocsAfter[0].get('foreignDetail2')).toBe('after2');
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

  it('should replicate the changes in the master doc to the detail doc and run pre hook', async () => {
    const someKey = 'some_id';
    const preRef = firestore().collection('pre');

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ someKey: someKey, detail1Field1: 'before1' });

    // Make sure the pre docs is empty
    const { docs: preDocsBefore } = await preRef.get();
    expect(preDocsBefore.length).toBe(0);

    // Test that test is before
    const { docs: detailDocsBefore } = await detailRef.get();
    expect(detailDocsBefore.length).toBe(1);
    expect(detailDocsBefore[0].get('detail1Field1')).toBe('before1');

    // Trigger function to update references
    const wrapped = testSdk.wrap(integrifyFunctions.replicateMasterToDetailWithPreHook);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ masterField1: 'before1', masterField3: 'before3' }, `master/${someKey}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({ masterField1: 'after1', masterField3: 'after3' }, `master/${someKey}`);
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap), { params: { masterId: someKey } });

    // Test that test is after
    const { docs: detailDocsAfter } = await detailRef.get();
    expect(detailDocsAfter.length).toBe(1);
    expect(detailDocsAfter[0].get('detail1Field1')).toBe('after1');

    // Make sure the pre hook ran
    const { docs: preDocsAfter } = await preRef.get();
    expect(preDocsAfter.length).toBe(1);
  });

  it('should replicate the changes in the master doc to the detail doc and run post hook', async () => {
    const someKey = 'some_id';
    const postRef = firestore().collection('post');

    const detailRef = firestore().collection('detail1');
    await detailRef.add({ someKey: someKey, detail1Field1: 'before1' });

    // Test that test is before
    const { docs: detailDocsBefore } = await detailRef.get();
    expect(detailDocsBefore.length).toBe(1);
    expect(detailDocsBefore[0].get('detail1Field1')).toBe('before1');

    // Make sure the post docs is empty
    const { docs: postDocsBefore } = await postRef.get();
    expect(postDocsBefore.length).toBe(0);

    // Trigger function to update references
    const wrapped = testSdk.wrap(integrifyFunctions.replicateMasterToDetailWithPostHook);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ masterField1: 'before1', masterField3: 'before3' }, `master/${someKey}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({ masterField1: 'after1', masterField3: 'after3' }, `master/${someKey}`);
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap), { params: { masterId: someKey } });

    // Test that test is after
    const { docs: detailDocsAfter } = await detailRef.get();
    expect(detailDocsAfter.length).toBe(1);
    expect(detailDocsAfter[0].get('detail1Field1')).toBe('after1');

    // Make sure the post hook ran
    const { docs: postDocsAfter } = await postRef.get();
    expect(postDocsAfter.length).toBe(1);
  });

});