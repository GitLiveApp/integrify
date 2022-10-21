// this module will be automatically mocked no need to call it in your test files
import admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.GOOGLE_CLOUD_PROJECT = 'integrify-emulator';
process.env.PUBSUB_PROJECT_ID = 'integrify-emulator';

// initializeApp takes the environment variables into account
admin.initializeApp();

const firestore = admin.firestore;

module.exports = {
  ...admin,
  firestore,
  initializeApp: jest.fn()
}