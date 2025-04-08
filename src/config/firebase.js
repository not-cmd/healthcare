const admin = require('firebase-admin');
require('dotenv').config();

// Get values from environment variables
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Initialize Firebase Admin
let db;
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
    console.log('Firebase Admin initialized successfully');
  }
  db = admin.firestore();
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

module.exports = { admin, db };