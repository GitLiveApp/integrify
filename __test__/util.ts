import Test from 'firebase-functions-test';
import axios from 'axios';

const projectId = 'integrify-emulator';

const testSdk = Test({
  projectId,
  databaseURL: `https://${projectId}.firebaseio.com`,
});

const cleanFirestore = async () => {
  return axios.delete(`http://localhost:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`);
};

export {
  testSdk,
  cleanFirestore,
};
