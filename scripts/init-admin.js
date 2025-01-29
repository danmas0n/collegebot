import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../frontend/.env' });

// Set emulator environment variables
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to emulator
connectFirestoreEmulator(db, 'localhost', 8080);

// Your actual email
const ADMIN_EMAIL = 'dan.mason@gmail.com';

async function initializeAdmin() {
  try {
    console.log('Initializing admin user:', ADMIN_EMAIL);
    
    // Add admin user
    await setDoc(doc(db, 'admin_users', ADMIN_EMAIL), {
      createdAt: new Date().toISOString(),
      email: ADMIN_EMAIL
    });
    console.log('Created admin user document');

    // Also whitelist the admin
    await setDoc(doc(db, 'whitelisted_users', ADMIN_EMAIL), {
      createdAt: new Date().toISOString(),
      email: ADMIN_EMAIL
    });
    console.log('Created whitelist document');

    console.log('Successfully initialized admin user:', ADMIN_EMAIL);
  } catch (error) {
    console.error('Error initializing admin:', error);
  }
}

initializeAdmin(); 