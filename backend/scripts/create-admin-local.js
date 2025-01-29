import admin from 'firebase-admin';

// Initialize Firebase Admin for local development
admin.initializeApp({
  projectId: 'collegebot-dev-52f43',
  credential: admin.credential.applicationDefault()
});

// Connect to Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
// Connect to Auth emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const email = process.argv[2];
if (!email) {
  console.error('Please provide an email address as an argument');
  process.exit(1);
}

async function createAdminUser(email) {
  try {
    // Create or get the user
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('User already exists:', userRecord.uid);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({
          email,
          emailVerified: true,
        });
        console.log('Created new user:', userRecord.uid);
      } else {
        throw error;
      }
    }

    // Set admin claim
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: true
    });
    console.log('Successfully set admin claim for user:', email);

    // Create admin document in admin_users collection using email as the document ID
    await admin.firestore().collection('admin_users').doc(email).set({
      email,
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Created/updated admin document in Firestore');

    // Also add to whitelisted_users collection
    await admin.firestore().collection('whitelisted_users').doc(email).set({
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Added user to whitelist');

  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Execute the function
createAdminUser(email);
