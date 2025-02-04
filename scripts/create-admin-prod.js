import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin with service account
const app = initializeApp({
  credential: cert('./service-account.json'),
  projectId: 'collegebot-dev-52f43'
});

const db = getFirestore(app);

// Your actual email
const ADMIN_EMAIL = 'dan.mason@gmail.com';

async function initializeAdmin() {
  try {
    console.log('Initializing admin user:', ADMIN_EMAIL);
    
    // Add admin user
    await db.doc(`admin_users/${ADMIN_EMAIL}`).set({
      createdAt: new Date().toISOString(),
      email: ADMIN_EMAIL
    });
    console.log('Created admin user document');

    // Also whitelist the admin
    await db.doc(`whitelisted_users/${ADMIN_EMAIL}`).set({
      createdAt: new Date().toISOString(),
      email: ADMIN_EMAIL
    });
    console.log('Created whitelist document');

    console.log('Successfully initialized admin user:', ADMIN_EMAIL);
    process.exit(0);
  } catch (error) {
    console.error('Error initializing admin:', error);
    process.exit(1);
  }
}

initializeAdmin();
