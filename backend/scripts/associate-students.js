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

async function associateStudents(email) {
  try {
    const db = admin.firestore();
    
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log('Found user:', userRecord.uid);

    // Get all students
    const studentsSnapshot = await db.collection('students').get();
    console.log(`Found ${studentsSnapshot.docs.length} students`);

    // Update each student with the user ID
    const batch = db.batch();
    studentsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { userId: userRecord.uid });
    });

    await batch.commit();
    console.log('Successfully associated all students with user:', email);

  } catch (error) {
    console.error('Error associating students:', error);
    process.exit(1);
  }
}

// Execute the function
associateStudents(email); 