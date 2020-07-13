const { credentials, makeid, sleep } = require('./util');
const fft = require('firebase-functions-test')(
  {
    projectId: credentials.projectId,
  },
  credentials.serviceAccountKeyFile
);
const test = require('ava');
const { integrify } = require('../lib');
const { replaceReferenceWithFields } = require('../lib/common');
const { getState, setState } = require('./functions/stateMachine');

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(credentials.certificate),
});
const db = admin.firestore();

async function clearFirestore() {
  const collections = ['detail1', 'detail2', 'somecoll'];
  for (const collection of collections) {
    const { docs } = await admin
      .firestore()
      .collectionGroup(collection)
      .get();
    for (const doc of docs) {
      doc.ref.delete();
    }
  }
  await fft.cleanup();
}

let unsubscribe = null;
test.after(async () => {
  if (unsubscribe) {
    unsubscribe();
  }
  await clearFirestore();
});

const testsuites = [
  ['rules-in-situ', require('./functions')],
  ['rules-in-file', require('./functions/rules-from-file.index')],
];

testsuites.forEach(testsuite => {
  const name = testsuite[0];
  const sut = testsuite[1];

  test(`[${name}] test basic characteristics`, async t => {
    t.true(sut.replicateMasterToDetail.name === 'cloudFunction');
    t.truthy(sut.replicateMasterToDetail.run);
  });
  test(`[${name}] test target collection parameter swap`, async t =>
    testVariableSwap(sut, t, name));
  test(`[${name}] test replicate attributes`, async t =>
    testReplicateAttributes(sut, t, name));
  test(`[${name}] test delete references`, async t =>
    testDeleteReferences(sut, t, name));
  test(`[${name}] test maintain count`, async t =>
    testMaintainCount(sut, t));

  test(`[${name}] test delete with masterId in target reference`, async t =>
    testDeleteParamReferences(sut, t, name));
  test(`[${name}] test delete with snapshot fields in target reference`, async t =>
    testDeleteSnapshotFieldReferences(sut, t, name));
  test(`[${name}] test delete with missing snapshot fields in target reference`, async t =>
    testDeleteMissingFieldsReferences(sut, t, name));
});

async function testVariableSwap(sut, t, name) {
  // test no fields
  let collectionId = makeid();
  let targetCollection = 'collection';
  let doc = {
    collectionId,
  };

  let result = replaceReferenceWithFields(doc, targetCollection);

  t.false(result.hasFields);
  t.is(result.targetCollection, 'collection');

  // Test one field
  targetCollection = 'collection/$collectionId/some_detail';

  result = replaceReferenceWithFields(doc, targetCollection);

  t.true(result.hasFields);
  t.is(result.targetCollection, `collection/${collectionId}/some_detail`);

  // Test multiple fields
  const testId = makeid();
  const userId = makeid();
  targetCollection = 'collection/$testId/some_detail/$userId';
  doc = {
    collectionId,
    testId,
    userId,
  };

  result = replaceReferenceWithFields(doc, targetCollection);

  t.true(result.hasFields);
  t.is(result.targetCollection, `collection/${testId}/some_detail/${userId}`);

  // Test missing field
  targetCollection = 'collection/$collectionId/some_detail';

  const error = t.throws(() => {
    replaceReferenceWithFields({}, targetCollection);
  });
  t.is(error.message, 'integrify: Missing dynamic reference: [$collectionId]');

  await t.pass();
}

async function testReplicateAttributes(sut, t, name) {
  // Add a couple of detail documents to follow master
  const masterId = makeid();
  await db.collection('detail1').add({
    masterId: masterId,
  });
  const nestedDocRef = db.collection('somecoll').doc('somedoc');
  await nestedDocRef.set({
    x: 1,
  });
  await nestedDocRef.collection('detail2').add({
    masterId: masterId,
  });

  // Call trigger to replicate attributes from master
  const beforeSnap = fft.firestore.makeDocumentSnapshot(
    {},
    `master/${masterId}`
  );
  const afterSnap = fft.firestore.makeDocumentSnapshot(
    {
      masterField1: 'after1',
      masterField3: 'after3',
    },
    `master/${masterId}`
  );
  const change = fft.makeChange(beforeSnap, afterSnap);
  const wrapped = fft.wrap(sut.replicateMasterToDetail);
  setState({
    change: null,
    context: null,
  });
  await wrapped(change, {
    params: {
      masterId: masterId,
    },
  });

  // Assert pre-hook was called (only for rules-in-situ)
  if (name === 'rules-in-situ') {
    const state = getState();
    t.truthy(state.change);
    t.truthy(state.context);
    t.is(state.context.params.masterId, masterId);
  }

  // Assert that attributes get replicated to detail documents
  await assertQuerySizeEventually(
    db
      .collection('detail1')
      .where('masterId', '==', masterId)
      .where('detail1Field1', '==', 'after1'),
    1
  );
  await assertQuerySizeEventually(
    nestedDocRef
      .collection('detail2')
      .where('masterId', '==', masterId)
      .where('detail2Field3', '==', 'after3'),
    1
  );

  // Assert irrelevant update is safely ignored
  const irrelevantAfterSnap = fft.firestore.makeDocumentSnapshot(
    {
      masterFieldIrrelevant: 'whatever',
    },
    `master/${masterId}`
  );
  const irreleventChange = fft.makeChange(beforeSnap, irrelevantAfterSnap);
  await wrapped(irreleventChange, {
    params: {
      masterId: masterId,
    },
  });

  await t.pass();
}

async function testDeleteReferences(sut, t, name) {
  // Create some docs referencing master doc
  const masterId = makeid();
  await db.collection('detail1').add({
    masterId: masterId,
  });
  const nestedDocRef = db.collection('somecoll').doc('somedoc');
  await nestedDocRef.set({
    x: 1,
  });
  await nestedDocRef.collection('detail2').add({
    masterId: masterId,
  });
  await assertQuerySizeEventually(
    db
      .collection('somecoll')
      .doc('somedoc')
      .collection('detail2')
      .where('masterId', '==', masterId),
    1
  );

  // Trigger function to delete references
  const snap = fft.firestore.makeDocumentSnapshot({}, `master/${masterId}`);
  const wrapped = fft.wrap(sut.deleteReferencesToMaster);
  setState({
    snap: null,
    context: null,
  });
  await wrapped(snap, {
    params: {
      masterId: masterId,
    },
  });

  // Assert pre-hook was called (only for rules-in-situ)
  if (name === 'rules-in-situ') {
    const state = getState();
    t.truthy(state.snap);
    t.truthy(state.context);
    t.is(state.context.params.masterId, masterId);
  }

  // Assert referencing docs were deleted
  await assertQuerySizeEventually(
    db.collection('detail1').where('masterId', '==', masterId),
    0
  );
  await assertQuerySizeEventually(
    db
      .collection('somecoll')
      .doc('somedoc')
      .collection('detail2')
      .where('masterId', '==', masterId),
    0
  );

  t.pass();
}

async function testDeleteParamReferences(sut, t, name) {
  // Create some docs referencing master doc
  const masterId = makeid();
  await db.collection('detail1').add({
    masterId: masterId,
  });
  const nestedDocRef = db.collection('somecoll').doc(masterId);
  await nestedDocRef.set({
    x: 1,
  });
  await nestedDocRef.collection('detail2').add({
    masterId: masterId,
  });
  await assertQuerySizeEventually(
    db
      .collection('somecoll')
      .doc(masterId)
      .collection('detail2')
      .where('masterId', '==', masterId),
    1
  );

  // Trigger function to delete references
  const snap = fft.firestore.makeDocumentSnapshot({}, `master/${masterId}`);
  const wrapped = fft.wrap(sut.deleteReferencesWithMasterParam);
  setState({
    snap: null,
    context: null,
  });
  await wrapped(snap, {
    params: {
      masterId: masterId,
    },
  });

  // Assert pre-hook was called (only for rules-in-situ)
  if (name === 'rules-in-situ') {
    const state = getState();
    t.truthy(state.snap);
    t.truthy(state.context);
    t.is(state.context.params.masterId, masterId);
  }

  // Assert referencing docs were deleted
  await assertQuerySizeEventually(
    db.collection('detail1').where('masterId', '==', masterId),
    0
  );
  await assertQuerySizeEventually(
    db
      .collection('somecoll')
      .doc(masterId)
      .collection('detail2')
      .where('masterId', '==', masterId),
    0
  );

  t.pass();
}

async function testDeleteSnapshotFieldReferences(sut, t, name) {
  // Create some docs referencing master doc
  const masterId = makeid();
  const testId = makeid();
  await db.collection('detail1').add({
    masterId: masterId,
  });
  const nestedDocRef = db.collection('somecoll').doc(testId);
  await nestedDocRef.set({
    x: 1,
  });
  await nestedDocRef.collection('detail2').add({
    masterId: masterId,
  });
  await assertQuerySizeEventually(
    db
      .collection('somecoll')
      .doc(testId)
      .collection('detail2')
      .where('masterId', '==', masterId),
    1
  );

  // Trigger function to delete references
  const snap = fft.firestore.makeDocumentSnapshot(
    {
      testId,
    },
    `master/${masterId}`
  );
  const wrapped = fft.wrap(sut.deleteReferencesWithSnapshotFields);
  setState({
    snap: null,
    context: null,
  });
  await wrapped(snap, {
    params: {
      masterId: masterId,
      testId: testId,
    },
  });

  // Assert pre-hook was called (only for rules-in-situ)
  if (name === 'rules-in-situ') {
    const state = getState();
    t.truthy(state.snap);
    t.truthy(state.context);
    t.is(state.context.params.masterId, masterId);
  }

  // Assert referencing docs were deleted
  await assertQuerySizeEventually(
    db.collection('detail1').where('masterId', '==', masterId),
    0
  );
  await assertQuerySizeEventually(
    db
      .collection('somecoll')
      .doc(testId)
      .collection('detail2')
      .where('masterId', '==', masterId),
    0
  );

  t.pass();
}

async function testDeleteMissingFieldsReferences(sut, t, name) {
  // Create some docs referencing master doc
  const masterId = makeid();
  const testId = makeid();
  await db.collection('detail1').add({
    masterId: masterId,
  });
  const nestedDocRef = db.collection('somecoll').doc(testId);
  await nestedDocRef.set({
    x: 1,
  });
  await nestedDocRef.collection('detail2').add({
    masterId: masterId,
  });
  await assertQuerySizeEventually(
    db
      .collection('somecoll')
      .doc(testId)
      .collection('detail2')
      .where('masterId', '==', masterId),
    1
  );

  // Trigger function to delete references
  const snap = fft.firestore.makeDocumentSnapshot({}, `master/${masterId}`);
  const wrapped = fft.wrap(sut.deleteReferencesWithMissingFields);
  setState({
    snap: null,
    context: null,
  });

  const error = await t.throwsAsync(async () => {
    await wrapped(snap, {
      params: {
        masterId: masterId,
      },
    });
  });

  t.is(error.message, 'Error: integrify: Missing dynamic reference: [$testId]');

  // Assert pre-hook was called (only for rules-in-situ)
  if (name === 'rules-in-situ') {
    const state = getState();
    t.truthy(state.snap);
    t.truthy(state.context);
    t.is(state.context.params.masterId, masterId);
  }

  // Assert referencing docs were deleted
  await assertQuerySizeEventually(
    db.collection('detail1').where('masterId', '==', masterId),
    0
  );
  await assertQuerySizeEventually(
    db
      .collection('somecoll')
      .doc(testId)
      .collection('detail2')
      .where('masterId', '==', masterId),
    1
  );

  t.pass();
}

async function testMaintainCount(sut, t) {
  // Create an article to be favorited
  const articleId = makeid();
  await db
    .collection('articles')
    .doc(articleId)
    .set({
      favoritesCount: 0,
    });

  // Favorite the article a few times
  const NUM_TIMES_TO_FAVORITE = 5;
  const wrappedUpdater = fft.wrap(sut.maintainFavoritesCount);
  const promises = [];
  const emptySnap = fft.firestore.makeDocumentSnapshot({});
  const snap = fft.firestore.makeDocumentSnapshot(
    {
      articleId: articleId,
    },
    `favorites/${makeid()}`
  );
  for (let i = 1; i <= NUM_TIMES_TO_FAVORITE; ++i) {
    promises.push(wrappedUpdater(fft.makeChange(emptySnap, snap)));
    await sleep(500);
  }

  // Unfavorite the article a few times
  const NUM_TIMES_TO_UNFAVORITE = 3;
  for (let i = 1; i <= NUM_TIMES_TO_UNFAVORITE; ++i) {
    promises.push(wrappedUpdater(fft.makeChange(snap, emptySnap)));
    await sleep(500);
  }
  await Promise.all(promises);

  // Assert article has expected number of favoritesCount
  await assertDocumentValueEventually(
    db.collection('articles').doc(articleId),
    'favoritesCount',
    NUM_TIMES_TO_FAVORITE - NUM_TIMES_TO_UNFAVORITE
  );

  // Ensure warning is printed if triggered by an actual update
  await wrappedUpdater(fft.makeChange(snap, snap));

  // Delete article and ensure favoritesCount is not updated on decrement or
  // increment
  await db
    .collection('articles')
    .doc(articleId)
    .delete();
  await wrappedUpdater(fft.makeChange(snap, emptySnap));
  await wrappedUpdater(fft.makeChange(emptySnap, snap));
  await assertQuerySizeEventually(
    db
      .collection('articles')
      .where(admin.firestore.FieldPath.documentId(), '==', articleId),
    0
  );

  t.pass();
}

test('test error conditions', async t => {
  t.throws(() => integrify({}), {
    message: /Input must be rule or config/i,
  });
  t.throws(
    () =>
      integrify({
        rule: 'UNKNOWN_RULE_4a4e261a2e37',
      }),
    {
      message: /Unknown rule/i,
    }
  );
  t.throws(() => require('./functions-bad-rules-file'), {
    message: /Unknown rule/i,
  });
  t.throws(() => require('./functions-absent-rules-file'), {
    message: /Rules file not found/i,
  });

  t.pass();
});

async function assertDocumentValueEventually(
  docRef,
  fieldPath,
  expectedValue,
  log = console.log
) {
  log(
    `Asserting doc [${docRef.path}] field [${fieldPath}] has value [${expectedValue}] ... `
  );
  await sleep(1000);
  await new Promise(res => {
    unsubscribe = docRef.onSnapshot(snap => {
      if (snap.exists) {
        const newValue = snap.get(fieldPath);
        log(`Current value: [${newValue.toString()}] `);
        if (newValue === expectedValue) {
          log('Matched!');
          unsubscribe();
          res();
        }
      }
    });
  });
}

async function assertQuerySizeEventually(
  query,
  expectedResultSize,
  log = console.log
) {
  log(`Asserting query result to have [${expectedResultSize}] entries ... `);
  await sleep(1000);
  const docs = await new Promise(res => {
    unsubscribe = query.onSnapshot(snap => {
      log(`Current result size: [${snap.size}]`);
      if (snap.size === expectedResultSize) {
        log('Matched!');
        unsubscribe();
        res(snap.docs);
      }
    });
  });
  return docs;
}
