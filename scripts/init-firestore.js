import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Set production environment
process.env.NODE_ENV = 'production';

// Initialize Firebase Admin with service account
const app = initializeApp({
  credential: cert('./service-account.json'),
  projectId: 'collegebot-dev-52f43',
  databaseURL: 'https://collegebot-dev-52f43.firebaseio.com'
});

// Initialize Firestore with settings
const db = getFirestore(app);
db.settings({
  ignoreUndefinedProperties: true,
  preferRest: true
});

async function initializeFirestore() {
  try {
    console.log('Creating initial collections...');
    
    // Create admin_users collection with a dummy document that we'll delete
    const adminRef = db.collection('admin_users').doc('init');
    await adminRef.set({
      temp: true,
      createdAt: new Date().toISOString()
    }, { merge: true });
    await adminRef.delete();
    console.log('Created admin_users collection');

    // Create whitelisted_users collection with a dummy document that we'll delete
    const whitelistRef = db.collection('whitelisted_users').doc('init');
    await whitelistRef.set({
      temp: true,
      createdAt: new Date().toISOString()
    }, { merge: true });
    await whitelistRef.delete();
    console.log('Created whitelisted_users collection');

    console.log('Successfully initialized Firestore collections');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing Firestore:', error);
    console.error('Error details:', error.details);
    console.error('Error code:', error.code);
    process.exit(1);
  }
}

initializeFirestore();
