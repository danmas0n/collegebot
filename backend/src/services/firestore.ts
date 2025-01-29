import { db } from '../config/firebase.js';
import { WhitelistedUser, Student, Chat, MapLocation, AdminUser } from '../types/firestore.js';
import { Timestamp, DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

// Collection references
const whitelistedUsersRef = db.collection('whitelisted-users');
const studentsRef = db.collection('students');
const chatsRef = db.collection('chats');
const mapLocationsRef = db.collection('map_locations');
const adminUsersRef = db.collection('admin-users');
const userChatsRef = db.collection('user-chats');

// Types for chat operations
export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatThread {
  id: string;
  title: string;
  lastMessageTimestamp: number;
}

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
  const doc = await studentsRef.doc(id).get();
  if (!doc.exists || doc.data()?.userId !== userId) return null;
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

// Chat operations
export const getChats = async (studentId: string): Promise<Chat[]> => {
  const snapshot = await chatsRef.where('studentId', '==', studentId).get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Chat));
};

export const saveChat = async (chat: Omit<Chat, 'createdAt' | 'updatedAt'>): Promise<void> => {
  const now = Timestamp.now();
  const doc = chatsRef.doc(chat.id);
  const exists = (await doc.get()).exists;

  await doc.set({
    ...chat,
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
  console.log('Adding map location:', location);
  
  // First verify the student exists and belongs to this user
  const student = await getStudent(location.studentId, userId);
  console.log('Found student:', student ? 'yes' : 'no');
  
  if (!student) {
    console.log('No student found with ID:', location.studentId);
    throw new Error('Student not found');
  }

  // Create a new document in the map_locations collection
  const newLocation = {
    ...location,
    createdAt: Timestamp.now()
  };
  
  const docRef = mapLocationsRef.doc();
  await docRef.set(newLocation);
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

// New chat operations
export const getChatThreads = async (userId: string): Promise<ChatThread[]> => {
  const snapshot = await userChatsRef.doc(userId).collection('threads').get();
  return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as ChatThread));
};

export const getChatHistory = async (userId: string, threadId: string): Promise<ChatMessage[]> => {
  const snapshot = await userChatsRef
    .doc(userId)
    .collection('threads')
    .doc(threadId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .get();
  return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as ChatMessage));
};

export const addChatMessage = async (userId: string, message: ChatMessage): Promise<void> => {
  await userChatsRef
    .doc(userId)
    .collection('threads')
    .doc(message.threadId)
    .collection('messages')
    .doc(message.id)
    .set(message);

  // Update thread metadata
  await userChatsRef
    .doc(userId)
    .collection('threads')
    .doc(message.threadId)
    .set({
      lastMessageTimestamp: message.timestamp,
      title: message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
    }, { merge: true });
};
