import { getPrimaryKey, replaceReferencesWith } from "../src/common";

describe("common - getPrimaryKey", () => {

  it('should return a single primary key', async () => {
    let targetCollection = 'collection/{collectionId}';
    let result = getPrimaryKey(targetCollection);

    expect(result.hasPrimaryKey).toBeTruthy();
    expect(result.primaryKey).toBe('collectionId');
  });

  it('should return the last key if there is more than one', async () => {
    let targetCollection = 'collection/{collectionId}/some_detail/{detailId}';
    let result = getPrimaryKey(targetCollection);

    expect(result.hasPrimaryKey).toBeTruthy();
    expect(result.primaryKey).toBe('detailId');
  });

  it('should return the default masterId for missing primary key', async () => {
    let targetCollection = 'collection';
    let result = getPrimaryKey(targetCollection);

    expect(result.hasPrimaryKey).toBeFalsy();
    expect(result.primaryKey).toBe('masterId');
  });

});

describe("common - replaceReferencesWith", () => {

  it('should return false for hasFields and unchanged targetCollection', async () => {
    let collectionId = makeId();
    let targetCollection = 'collection';
    let documentData = {
      collectionId,
    };

    let result = replaceReferencesWith(documentData, targetCollection);

    expect(result.hasFields).toBeFalsy();
    expect(result.targetCollection).toBe('collection');
  });

  it('should return true for hasFields and the collectionId in the targetCollection', async () => {
    let collectionId = makeId();
    let targetCollection = 'collection/$collectionId/some_detail';
    let documentData = {
      collectionId,
    };

    let result = replaceReferencesWith(documentData, targetCollection);

    expect(result.hasFields).toBeTruthy();
    expect(result.targetCollection).toBe(`collection/${collectionId}/some_detail`);
  });

  it('should return true for hasFields and the testId and userId in the targetCollection', async () => {
    let collectionId = makeId();
    let testId = makeId();
    let userId = makeId();
    let targetCollection = 'collection/$testId/some_detail/$userId';
    let documentData = {
      collectionId,
      testId,
      userId,
    };

    let result = replaceReferencesWith(documentData, targetCollection);

    expect(result.hasFields).toBeTruthy();
    expect(result.targetCollection).toBe(`collection/${testId}/some_detail/${userId}`);
  });

  it('should throw an error if the targetCollection uses a field that does not exist', async () => {
    let targetCollection = 'collection/$collectionId/some_detail';
    let documentData = {};

    const error = () => {
      replaceReferencesWith(documentData, targetCollection);
    };

    expect(error).toThrow('integrify: Missing dynamic reference: [$collectionId]');
  });

  const makeId = () => {
    return Math.random()
      .toString(36)
      .substr(2);
  }

});
