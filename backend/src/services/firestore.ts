import { db } from '../config/firebase.js';
import { WhitelistedUser, Student, Chat, ChatDTO, MapLocation, AdminUser } from '../types/firestore.js';
import { Timestamp, DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

// Collection references
const whitelistedUsersRef = db.collection('whitelisted_users');
const studentsRef = db.collection('students');
const chatsRef = db.collection('chats');
const mapLocationsRef = db.collection('map_locations');
const adminUsersRef = db.collection('admin_users');
const userChatsRef = db.collection('user_chats');

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

export const getSharedUsers = async (userId: string): Promise<WhitelistedUser[]> => {
  const snapshot = await whitelistedUsersRef.where('parentUserId', '==', userId).get();
  return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ ...doc.data(), email: doc.id } as WhitelistedUser));
};

export const addWhitelistedUser = async (email: string, userId: string, createdBy: string, parentUserId?: string): Promise<void> => {
  // Check sharing limit if this is a shared user
  if (parentUserId) {
    const sharedUsers = await getSharedUsers(parentUserId);
    if (sharedUsers.length >= 5) {
      throw new Error('Maximum number of shared users (5) reached');
    }
  }

  await whitelistedUsersRef.doc(email).set({
    createdAt: Timestamp.now(),
    createdBy,
    userId,
    ...(parentUserId && { parentUserId })
  });
};

export const removeWhitelistedUser = async (email: string): Promise<void> => {
  await whitelistedUsersRef.doc(email).delete();
};

export const removeSharedAccess = async (email: string, parentUserId: string): Promise<void> => {
  const doc = await whitelistedUsersRef.doc(email).get();
  if (!doc.exists || doc.data()?.parentUserId !== parentUserId) {
    throw new Error('User not found or not shared by you');
  }
  await doc.ref.delete();
};

// Student operations
export const getStudents = async (userId: string): Promise<Student[]> => {
  // Get all users in the family group (including the current user)
  const familyUsers = new Set<string>([userId]);
  
  // Get users who were invited by this user
  const invitedSnapshot = await whitelistedUsersRef
    .where('parentUserId', '==', userId)
    .get();
  invitedSnapshot.forEach(doc => {
    const invitedUserId = doc.data().userId;
    if (invitedUserId) familyUsers.add(invitedUserId);
  });

  // Get the user who invited this user (if any)
  const userDoc = await whitelistedUsersRef.doc(userId).get();
  if (userDoc.exists) {
    const parentId = userDoc.data()?.parentUserId;
    if (parentId) {
      familyUsers.add(parentId);
      // Also get other users invited by the same parent
      const siblingsSnapshot = await whitelistedUsersRef
        .where('parentUserId', '==', parentId)
        .get();
      siblingsSnapshot.forEach(doc => {
        const siblingUserId = doc.data().userId;
        if (siblingUserId) familyUsers.add(siblingUserId);
      });
    }
  }

  // Get all students owned by any user in the family group
  const studentsPromises = Array.from(familyUsers).map(async familyUserId => {
    const snapshot = await studentsRef.where('userId', '==', familyUserId).get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student));
  });

  const allStudents = await Promise.all(studentsPromises);
  return allStudents.flat();
};

// Helper function to get all users in a family group
const getFamilyGroupUsers = async (userId: string): Promise<Set<string>> => {
  const familyUsers = new Set<string>([userId]);
  
  // Get users who were invited by this user
  const invitedSnapshot = await whitelistedUsersRef
    .where('parentUserId', '==', userId)
    .get();
  invitedSnapshot.forEach(doc => {
    const invitedUserId = doc.data().userId;
    if (invitedUserId) familyUsers.add(invitedUserId);
  });

  // Get the user who invited this user (if any)
  const userDoc = await whitelistedUsersRef.doc(userId).get();
  if (userDoc.exists) {
    const parentId = userDoc.data()?.parentUserId;
    if (parentId) {
      familyUsers.add(parentId);
      // Also get other users invited by the same parent
      const siblingsSnapshot = await whitelistedUsersRef
        .where('parentUserId', '==', parentId)
        .get();
      siblingsSnapshot.forEach(doc => {
        const siblingUserId = doc.data().userId;
        if (siblingUserId) familyUsers.add(siblingUserId);
      });
    }
  }

  return familyUsers;
};

export const getStudent = async (id: string, userId: string): Promise<Student | null> => {
  if (!id || typeof id !== 'string') {
    console.error('Invalid student ID:', id);
    return null;
  }

  const doc = await studentsRef.doc(id).get();
  if (!doc.exists) {
    console.error('Student not found:', { id });
    return null;
  }

  const studentData = doc.data();
  const studentUserId = studentData?.userId;

  // Check if student belongs to anyone in the family group
  const familyUsers = await getFamilyGroupUsers(userId);
  if (familyUsers.has(studentUserId)) {
    return { ...studentData, id: doc.id } as Student;
  }

  console.error('Unauthorized access:', { id, userId, studentUserId });
  return null;
};

export const saveStudent = async (student: Omit<Student, 'createdAt' | 'updatedAt'>, userId: string): Promise<void> => {
  const now = Timestamp.now();
  const doc = studentsRef.doc(student.id);
  const exists = (await doc.get()).exists;

  if (exists) {
    const studentData = (await doc.get()).data();
    const studentUserId = studentData?.userId;

    // Check if student belongs to anyone in the family group
    const familyUsers = await getFamilyGroupUsers(userId);
    if (!familyUsers.has(studentUserId)) {
      throw new Error('Unauthorized to modify this student');
    }
  }

  await doc.set({
    ...student,
    userId: exists ? (await doc.get()).data()?.userId : userId, // Preserve original owner
    createdAt: exists ? (await doc.get()).data()?.createdAt : now,
    updatedAt: now
  });
};

export const deleteStudent = async (id: string, userId: string): Promise<void> => {
  const doc = await studentsRef.doc(id).get();
  if (!doc.exists) return;

  const studentData = doc.data();
  const studentUserId = studentData?.userId;

  // Check if student belongs to anyone in the family group
  const familyUsers = await getFamilyGroupUsers(userId);
  if (familyUsers.has(studentUserId)) {
    await doc.ref.delete();
  }
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
    updatedAt: now,
    // Automatically mark all chats as processed
    processed: true,
    processedAt: now
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

// User operations
export const getUserEmails = async (userIds: string[]): Promise<Record<string, string>> => {
  const emailMap: Record<string, string> = {};
  
  // Get all users in batches of 10 (Firestore limit)
  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    const snapshot = await db.collection('users')
      .where('uid', 'in', batch)
      .select('email')
      .get();
      
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        emailMap[doc.id] = data.email;
      }
    });
  }
  
  return emailMap;
};

// Admin operations
export const isAdmin = async (email: string): Promise<boolean> => {
  const doc = await adminUsersRef.doc(email).get();
  return doc.exists;
};

export const addAdmin = async (email: string): Promise<void> => {
  await adminUsersRef.doc(email).set({
    email,
    role: 'admin',
    createdAt: Timestamp.now()
  });
};
