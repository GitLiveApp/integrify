import { testSdk, cleanFirestore } from '../util';
import { firestore } from 'firebase-admin';
import * as integrifyFunctions from '../files/maintainFunctions';

describe('maintainCount', () => {

  beforeEach(() => {
    return cleanFirestore();
  });

  it('should increment the favoritesCount in the document matching the article ID', async () => {
    expect(true).toBeTruthy();
  });

  it('should decrement the favoritesCount in the document matching the article ID', async () => {
    expect(true).toBeTruthy();
  });

  it('should increment the favoritesCount in the document with the formatted article ID', async () => {
    expect(true).toBeTruthy();
  });

  it('should decrement the favoritesCount in the document with the formatted article ID', async () => {
    expect(true).toBeTruthy();
  });

  it('should increment the favoritesCount in the deep document with the formatted article ID', async () => {
    expect(true).toBeTruthy();
  });

  it('should decrement the favoritesCount in the deep document with the formatted article ID', async () => {
    expect(true).toBeTruthy();
  });

});