import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// Function to get Firebase credentials
const getCredentials = () => {
  if (process.env.NODE_ENV === 'development') {
    return applicationDefault();
  }

  // Try to read from file first
  const credentialsPath = process.env.FIREBASE_CREDENTIALS_FILE;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    try {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      return cert(credentials);
    } catch (error) {
      console.error('Error reading Firebase credentials file:', error);
    }
  }

  // Fall back to environment variable if file not available
  if (process.env.FIREBASE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString());
      return cert(credentials);
    } catch (error) {
      console.error('Error parsing Firebase credentials from environment variable:', error);
    }
  }

  throw new Error('No valid Firebase credentials found');
};

// Initialize Firebase Admin
const app = initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credential: getCredentials()
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
