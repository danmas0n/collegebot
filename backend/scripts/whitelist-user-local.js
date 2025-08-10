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
    // First, try to get the user from Firebase Auth to get their UID
    let userId = null;
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      userId = userRecord.uid;
      console.log('Found existing user with UID:', userId);
    } catch (authError) {
      console.log('User not found in Firebase Auth, they will need to sign in first');
      console.log('Creating whitelist entry without userId - it will be updated when they first sign in');
    }

    const whitelistData = {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system'
    };

    // Only add userId if we found the user in Firebase Auth
    if (userId) {
      whitelistData.userId = userId;
    }

    await admin.firestore().collection('whitelisted_users').doc(email).set(whitelistData);
    console.log('Successfully whitelisted user:', email);
    
    if (!userId) {
      console.log('Note: User will need to sign in once to complete the setup');
    }
  } catch (error) {
    console.error('Error whitelisting user:', error);
    process.exit(1);
  }
}

// Execute the function
whitelistUser(email);
