import admin from 'firebase-admin';

export class StudentData {
  constructor() {
    this.db = admin.firestore();
  }

  async getStudentData(userId) {
    const doc = await this.db.collection('students').doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data();
  }

  async updateStudentData(userId, data) {
    await this.db.collection('students').doc(userId).set({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return await this.getStudentData(userId);
  }

  async createStudentData(userId, data) {
    const studentData = {
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await this.db.collection('students').doc(userId).set(studentData);
    return studentData;
  }

  async deleteStudentData(userId) {
    await this.db.collection('students').doc(userId).delete();
  }

  // Migration helper to move data from memory to Firestore
  async migrateStudentData(userId, data) {
    const existingData = await this.getStudentData(userId);
    if (!existingData) {
      return await this.createStudentData(userId, data);
    }
    return await this.updateStudentData(userId, data);
  }
} 