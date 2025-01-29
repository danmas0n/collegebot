import admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString()
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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

    // Create admin document in admin-users collection using UID as the document ID
    await admin.firestore().collection('admin-users').doc(userRecord.uid).set({
      email,
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Created/updated admin document in Firestore');

  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Execute the function
createAdminUser(email); 