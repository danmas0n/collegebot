import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin with emulator configuration
admin.initializeApp({
  projectId: 'collegebot-dev-52f43',
  credential: admin.credential.applicationDefault()
});

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

async function migrateData() {
  try {
    const db = admin.firestore();
    
    // Read existing data
    console.log('Reading data files...');
    const studentsPath = path.join(__dirname, '../.collegebot/students.json');
    const chatsPath = path.join(__dirname, '../.collegebot/chats.json');
    
    console.log('Loading students from:', studentsPath);
    const studentsData = JSON.parse(readFileSync(studentsPath, 'utf8'));
    console.log(`Found ${studentsData.students.length} students`);
    
    console.log('Loading chats from:', chatsPath);
    const chatsData = JSON.parse(readFileSync(chatsPath, 'utf8'));
    console.log(`Found ${chatsData.chats.length} chats`);

    console.log('\nStarting migration...');
    const batch = db.batch();

    // Migrate students data and collect map locations
    console.log('Migrating students...');
    const allMapLocations = [];
    for (const student of studentsData.students) {
      // Extract map locations before removing them from student data
      if (student.data.map?.locations) {
        for (const location of student.data.map.locations) {
          const { metadata, ...locationData } = location;
          allMapLocations.push({
            ...locationData,
            studentId: student.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            metadata: metadata || {}
          });
        }
      }

      // Create a clean copy of student data without map locations
      const { map, ...restData } = student.data;
      const { locations, ...restMap } = map || {};
      const studentData = {
        name: student.name,
        lastUpdated: new Date(student.lastUpdated),
        data: {
          ...restData,
          map: restMap
        }
      };

      const studentDoc = db.collection('students').doc(student.id);
      batch.set(studentDoc, studentData);
    }

    // Create template from first student (if exists)
    if (studentsData.students.length > 0) {
      console.log('Creating template from first student...');
      const templateDoc = db.collection('templates').doc('student-data');
      // Create template without locations
      const { map, ...restData } = studentsData.students[0].data;
      const { locations, ...restMap } = map || {};
      const templateData = {
        ...restData,
        map: restMap
      };
      batch.set(templateDoc, {
        data: templateData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Migrate chats data
    console.log('Migrating chats...');
    for (const chat of chatsData.chats) {
      const chatDoc = db.collection('chats').doc(chat.id);
      batch.set(chatDoc, {
        ...chat,
        messages: chat.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
        processedAt: chat.processedAt ? new Date(chat.processedAt) : null
      });
    }

    // Migrate map locations to separate collection
    console.log(`Migrating ${allMapLocations.length} map locations...`);
    for (const location of allMapLocations) {
      const locationDoc = db.collection('map_locations').doc(location.id);
      batch.set(locationDoc, location);
    }

    console.log('\nCommitting batch...');
    await batch.commit();
    console.log('Successfully migrated all data to Firestore emulator');

  } catch (error) {
    console.error('Error migrating data:', error);
    console.error('Error details:', error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Execute the migration
migrateData();
