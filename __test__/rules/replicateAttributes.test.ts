import { testSdk, cleanFirestore } from '../util';

describe('replicateAttributes', () => {

  beforeEach(() => {
    return cleanFirestore();
  });

  it('initial test', async () => {
    expect(true).toBeTruthy();
  });

});