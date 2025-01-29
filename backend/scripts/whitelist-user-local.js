import admin from 'firebase-admin';

// Initialize Firebase Admin with emulator configuration
admin.initializeApp({
  projectId: 'collegebot-dev-52f43',
  credential: admin.credential.applicationDefault()
});

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const email = process.argv[2];
if (!email) {
  console.error('Please provide an email address as an argument');
  process.exit(1);
}

async function whitelistUser(email) {
  try {
    await admin.firestore().collection('whitelisted_users').doc(email).set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system'
    });
    console.log('Successfully whitelisted user:', email);
  } catch (error) {
    console.error('Error whitelisting user:', error);
    process.exit(1);
  }
}

// Execute the function
whitelistUser(email); 