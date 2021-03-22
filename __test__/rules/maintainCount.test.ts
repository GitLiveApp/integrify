import { testSdk, cleanFirestore } from '../util';
import { firestore } from 'firebase-admin';
import * as integrifyFunctions from '../files/maintainFunctions';

describe('maintainCount', () => {

  const articleId = 'article_one';

  beforeEach(() => {
    return cleanFirestore();
  });

  it('should increment the favoritesCount in the document matching the article ID', async () => {
    // Setup articles count doc
    const articleRef = firestore().collection('articles').doc(articleId);
    await articleRef.set({ favoritesCount: 0 });

    const articleBeforeDoc = await articleRef.get();
    expect(articleBeforeDoc.get('favoritesCount')).toBe(0);

    const wrapped = testSdk.wrap(integrifyFunctions.maintainFavoritesCount);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({}, `favorites/${articleId}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({ articleId }, `favorites/${articleId}`);

    // Add 3 favorites
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));

    const articleAfterDoc = await articleRef.get();
    expect(articleAfterDoc.get('favoritesCount')).toBe(3);
  });

  it('should decrement the favoritesCount in the document matching the article ID', async () => {
    // Setup articles count doc
    const articleRef = firestore().collection('articles').doc(articleId);
    await articleRef.set({ favoritesCount: 3 });

    const articleBeforeDoc = await articleRef.get();
    expect(articleBeforeDoc.get('favoritesCount')).toBe(3);

    const wrapped = testSdk.wrap(integrifyFunctions.maintainFavoritesCount);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ articleId }, `favorites/${articleId}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({}, `favorites/${articleId}`);

    // Remove 3 favorites
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));

    const articleAfterDoc = await articleRef.get();
    expect(articleAfterDoc.get('favoritesCount')).toBe(0);
  });

  it('should increment the favoritesCount in the document with the formatted article ID', async () => {
    // Setup articles count doc
    const articleRef = firestore().collection('articles').doc(`updated_${articleId}`);
    await articleRef.set({ formattedFavoritesCount: 0 });

    const articleBeforeDoc = await articleRef.get();
    expect(articleBeforeDoc.get('formattedFavoritesCount')).toBe(0);

    const wrapped = testSdk.wrap(integrifyFunctions.maintainFavoritesCountWithPreHook);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({}, `favorites/${articleId}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({ articleId }, `favorites/${articleId}`);

    // Add 2 favorites
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));

    const articleAfterDoc = await articleRef.get();
    expect(articleAfterDoc.get('formattedFavoritesCount')).toBe(2);
  });

  it('should decrement the favoritesCount in the document with the formatted article ID', async () => {
    // Setup articles count doc
    const articleRef = firestore().collection('articles').doc(`updated_${articleId}`);
    await articleRef.set({ formattedFavoritesCount: 3 });

    const articleBeforeDoc = await articleRef.get();
    expect(articleBeforeDoc.get('formattedFavoritesCount')).toBe(3);

    const wrapped = testSdk.wrap(integrifyFunctions.maintainFavoritesCountWithPreHook);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ articleId }, `favorites/${articleId}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({}, `favorites/${articleId}`);

    // Remove 2 favorites
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));

    const articleAfterDoc = await articleRef.get();
    expect(articleAfterDoc.get('formattedFavoritesCount')).toBe(1);
  });

  it('should increment the favoritesCount in the deep document with the formatted article ID', async () => {
    // Setup articles count doc
    const articleRef = firestore().collection('articles').doc(`updated_${articleId}`).collection('private').doc('counts');
    await articleRef.set({ deepFavoritesCount: 0 });

    const articleBeforeDoc = await articleRef.get();
    expect(articleBeforeDoc.get('deepFavoritesCount')).toBe(0);

    const wrapped = testSdk.wrap(integrifyFunctions.maintainFavoritesCountWithDeepPreHook);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({}, `favorites/${articleId}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({ articleId }, `favorites/${articleId}`);

    // Add 4 favorites
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));

    const articleAfterDoc = await articleRef.get();
    expect(articleAfterDoc.get('deepFavoritesCount')).toBe(4);
  });

  it('should decrement the favoritesCount in the deep document with the formatted article ID', async () => {
    // Setup articles count doc
    const articleRef = firestore().collection('articles').doc(`updated_${articleId}`).collection('private').doc('counts');
    await articleRef.set({ deepFavoritesCount: 4 });

    const articleBeforeDoc = await articleRef.get();
    expect(articleBeforeDoc.get('deepFavoritesCount')).toBe(4);

    const wrapped = testSdk.wrap(integrifyFunctions.maintainFavoritesCountWithDeepPreHook);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ articleId }, `favorites/${articleId}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({}, `favorites/${articleId}`);

    // Add 4 favorites
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));

    const articleAfterDoc = await articleRef.get();
    expect(articleAfterDoc.get('deepFavoritesCount')).toBe(1);
  });

  it('should ignore an update to a favorite doc and not increment or decrement should happen', async () => {
    // Setup articles count doc
    const articleRef = firestore().collection('articles').doc(articleId);
    await articleRef.set({ favoritesCount: 4 });

    const articleBeforeDoc = await articleRef.get();
    expect(articleBeforeDoc.get('favoritesCount')).toBe(4);

    const wrapped = testSdk.wrap(integrifyFunctions.maintainUpdateFavorite);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ articleId }, `favorites/${articleId}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({ articleId }, `favorites/${articleId}`);

    // Update 2 favorites
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));

    const articleAfterDoc = await articleRef.get();
    expect(articleAfterDoc.get('favoritesCount')).toBe(4);
  });

  it('should ignore an update to a favorite doc and not increment or decrement should happen', async () => {
    // Setup articles count doc
    const articleRef = firestore().collection('articles').doc(articleId);

    const articleBeforeDoc = await articleRef.get();
    expect(articleBeforeDoc.exists).toBeFalsy();

    const wrapped = testSdk.wrap(integrifyFunctions.maintainUpdateFavoriteWithNoTarget);
    const beforeSnap = testSdk.firestore.makeDocumentSnapshot({ articleId }, `favorites/${articleId}`);
    const afterSnap = testSdk.firestore.makeDocumentSnapshot({}, `favorites/${articleId}`);

    // Update 2 favorites
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));
    await wrapped(testSdk.makeChange(beforeSnap, afterSnap));

    const articleAfterDoc = await articleRef.get();
    expect(articleAfterDoc.exists).toBeFalsy();
  });

});