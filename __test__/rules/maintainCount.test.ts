import { testSdk, cleanFirestore } from '../util';

describe('maintainCount', () => {

  beforeEach(() => {
    return cleanFirestore();
  });

  it('initial test', async () => {
    expect(true).toBeTruthy();
  });

});