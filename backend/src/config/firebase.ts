import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
const app = initializeApp({
  projectId: 'collegebot-dev-52f43',
  credential: process.env.NODE_ENV === 'development' 
    ? applicationDefault()
    : cert(
        process.env.FIREBASE_CREDENTIALS 
          ? JSON.parse(Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString())
          : undefined
      )
});

// Initialize Firestore
const db = getFirestore(app);

// Connect to emulator in development
if (process.env.NODE_ENV === 'development') {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  
  db.settings({
    host: 'localhost:8080',
    ssl: false
  });
}

// Initialize Auth
const auth = getAuth(app);

export { db, auth }; 