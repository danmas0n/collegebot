import { db } from '../config/firebase.js';
import { WhitelistedUser, Student, Chat, ChatDTO, MapLocation, AdminUser } from '../types/firestore.js';
import { Timestamp, DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

// Collection references
const whitelistedUsersRef = db.collection('whitelisted-users');
const studentsRef = db.collection('students');
const chatsRef = db.collection('chats');
const mapLocationsRef = db.collection('map_locations');
const adminUsersRef = db.collection('admin-users');
const userChatsRef = db.collection('user-chats');

// Thread types
export interface ChatThread {
  id: string;
  title: string;
  lastMessageTimestamp: number;
}

// Helper functions for safe type conversions
const safeToTimestamp = (value: any): Timestamp | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (typeof value === 'string') {
    try {
      return Timestamp.fromDate(new Date(value));
    } catch (e) {
      return null;
    }
  }
  return null;
};

const safeToISOString = (value: any): string | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
};

// Whitelist operations
export const getWhitelistedUsers = async (): Promise<WhitelistedUser[]> => {
  const snapshot = await whitelistedUsersRef.get();
  return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ ...doc.data(), email: doc.id } as WhitelistedUser));
};

export const addWhitelistedUser = async (email: string, createdBy: string): Promise<void> => {
  await whitelistedUsersRef.doc(email).set({
    createdAt: Timestamp.now(),
    createdBy
  });
};

export const removeWhitelistedUser = async (email: string): Promise<void> => {
  await whitelistedUsersRef.doc(email).delete();
};

// Student operations
export const getStudents = async (userId: string): Promise<Student[]> => {
  const snapshot = await studentsRef.where('userId', '==', userId).get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student));
};

export const getStudent = async (id: string, userId: string): Promise<Student | null> => {
  if (!id || typeof id !== 'string') {
    console.error('Invalid student ID:', id);
    return null;
  }
  const doc = await studentsRef.doc(id).get();
  if (!doc.exists || doc.data()?.userId !== userId) {
    console.error('Student not found or unauthorized:', { id, userId, exists: doc.exists, docUserId: doc.data()?.userId });
    return null;
  }
  return { ...doc.data(), id: doc.id } as Student;
};

export const saveStudent = async (student: Omit<Student, 'createdAt' | 'updatedAt'>, userId: string): Promise<void> => {
  const now = Timestamp.now();
  const doc = studentsRef.doc(student.id);
  const exists = (await doc.get()).exists;

  await doc.set({
    ...student,
    userId,
    createdAt: exists ? (await doc.get()).data()?.createdAt : now,
    updatedAt: now
  });
};

export const deleteStudent = async (id: string, userId: string): Promise<void> => {
  const doc = await studentsRef.doc(id).get();
  if (!doc.exists || doc.data()?.userId !== userId) return;
  await doc.ref.delete();
};

// Conversion functions
const chatToDTO = (chat: Chat): ChatDTO => ({
  ...chat,
  createdAt: safeToISOString(chat.createdAt) ?? new Date().toISOString(),
  updatedAt: safeToISOString(chat.updatedAt) ?? new Date().toISOString(),
  processedAt: safeToISOString(chat.processedAt),
  messages: chat.messages.map(msg => ({
    ...msg,
    timestamp: safeToISOString(msg.timestamp) ?? new Date().toISOString()
  }))
});

const dtoToChat = (dto: Omit<ChatDTO, 'createdAt' | 'updatedAt'>): Omit<Chat, 'createdAt' | 'updatedAt'> => ({
  ...dto,
  messages: dto.messages.map(msg => ({
    ...msg,
    timestamp: safeToTimestamp(msg.timestamp) ?? Timestamp.now()
  })),
  processedAt: safeToTimestamp(dto.processedAt)
});

// Chat operations
export const getChats = async (studentId: string): Promise<ChatDTO[]> => {
  const snapshot = await chatsRef.where('studentId', '==', studentId).get();
  return snapshot.docs.map(doc => {
    const data = doc.data() as Chat;
    return chatToDTO({
      ...data,
      id: doc.id,
      studentId: data.studentId,
      processed: data.processed ?? false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      processedAt: data.processedAt,
      messages: data.messages || []
    });
  });
};

export const saveChat = async (chat: ChatDTO): Promise<void> => {
  const now = Timestamp.now();
  const doc = chatsRef.doc(chat.id);
  const exists = (await doc.get()).exists;

  const firestoreChat = dtoToChat(chat);

  await doc.set({
    ...firestoreChat,
    createdAt: exists ? (await doc.get()).data()?.createdAt : now,
    updatedAt: now
  });
};

export const deleteChat = async (id: string): Promise<void> => {
  await chatsRef.doc(id).delete();
};

// Map location operations
export const getMapLocations = async (studentId: string, userId: string): Promise<MapLocation[]> => {
  console.log('Getting map locations for student:', studentId);
  
  // First verify the student exists and belongs to this user
  const student = await getStudent(studentId, userId);
  console.log('Found student:', student ? 'yes' : 'no');
  
  if (!student) {
    console.log('No student found with ID:', studentId);
    return [];
  }

  // Query the map_locations collection for this student's locations
  console.log('Querying map_locations collection with studentId:', studentId);
  const snapshot = await mapLocationsRef.where('studentId', '==', studentId).get();
  console.log('Query returned docs:', snapshot.docs.length);
  console.log('First few docs:', snapshot.docs.slice(0, 3).map(doc => ({
    id: doc.id,
    data: doc.data()
  })));
  const locations = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MapLocation));
  console.log('Found locations:', locations.length);
  return locations;
};

export const addMapLocation = async (location: Omit<MapLocation, 'id' | 'createdAt'>, userId: string): Promise<void> => {
  console.log('Adding map location:', JSON.stringify(location, null, 2));
  
  if (!location.studentId || typeof location.studentId !== 'string') {
    console.error('Invalid student ID in location:', location.studentId);
    throw new Error('Invalid student ID');
  }

  // First verify the student exists and belongs to this user
  const student = await getStudent(location.studentId, userId);
  console.log('Found student:', student ? 'yes' : 'no');
  
  if (!student) {
    console.error('No student found with ID:', location.studentId);
    throw new Error('Student not found');
  }

  // Create a new document in the map_locations collection
  const newLocation = {
    ...location,
    createdAt: Timestamp.now()
  };
  
  console.log('Creating new location document:', JSON.stringify(newLocation, null, 2));
  const docRef = mapLocationsRef.doc();
  await docRef.set(newLocation);
  console.log('Location document created with ID:', docRef.id);
};

export const deleteMapLocation = async (studentId: string, locationId: string, userId: string): Promise<void> => {
  // First verify the student exists and belongs to this user
  const student = await getStudent(studentId, userId);
  if (!student) {
    throw new Error('Student not found');
  }

  // Delete the location document
  await mapLocationsRef.doc(locationId).delete();
};

export const clearMapLocations = async (studentId: string, userId: string): Promise<void> => {
  // First verify the student exists and belongs to this user
  const student = await getStudent(studentId, userId);
  if (!student) {
    throw new Error('Student not found');
  }

  // Delete all locations for this student
  const snapshot = await mapLocationsRef.where('studentId', '==', studentId).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

// Admin operations
export const isAdmin = async (uid: string): Promise<boolean> => {
  const doc = await adminUsersRef.doc(uid).get();
  return doc.exists;
};

export const addAdmin = async (email: string, uid: string): Promise<void> => {
  await adminUsersRef.doc(uid).set({
    email,
    role: 'admin',
    createdAt: Timestamp.now()
  });
};
