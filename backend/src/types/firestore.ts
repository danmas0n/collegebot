import { Timestamp } from 'firebase-admin/firestore';

export interface WhitelistedUser {
  email: string;
  createdAt: Timestamp | null;
  createdBy: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  data: {
    studentProfile: {
      gpa: number;
      satScore?: number;
      actScore?: number;
      extracurriculars: string[];
      achievements: string[];
    };
    collegeInterests?: {
      majors: string[];
      fieldsOfStudy: string[];
      locationPreferences: {
        regions: string[];
        states: string[];
        minDistanceFromHome?: number;
        maxDistanceFromHome?: number;
        urbanSettings: string[];
      };
    };
    budgetInfo?: {
      yearlyBudget: number;
      willingness: {
        loans?: boolean;
        workStudy?: boolean;
        scholarships?: boolean;
      };
    };
    map?: {
      locations: MapLocation[];
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Common chat message types
interface BaseChatMessage {
  role: 'user' | 'assistant' | 'thinking' | 'system' | 'answer' | 'question';
  content: string;
}

interface FirestoreChatMessage extends BaseChatMessage {
  timestamp: Timestamp;
}

interface DTOChatMessage extends BaseChatMessage {
  timestamp: string;
}

// Firestore Chat type with Timestamps
export interface Chat {
  id: string;
  studentId: string;
  title?: string;
  messages: FirestoreChatMessage[];
  processed: boolean;
  processedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Frontend Chat type with ISO strings
export interface ChatDTO {
  id: string;
  studentId: string;
  title?: string;
  messages: DTOChatMessage[];
  processed: boolean;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MapLocation {
  id: string;
  studentId: string;
  name: string;
  type: 'college' | 'scholarship';
  latitude: number;
  longitude: number;
  createdAt: Timestamp;
  metadata?: {
    website?: string;
    description?: string;
    address?: string;
    fitScore?: number;
    reason?: string;
    distanceFromHome?: number;
    matchesPreferences?: {
      region?: boolean;
      state?: boolean;
      distance?: boolean;
      setting?: boolean;
    };
    referenceLinks?: Array<{
      url: string;
      title: string;
      category: string;
      source: string;
      platform: string;
      notes?: string;
      dateFound: string;
    }>;
    showLinks?: boolean;
  };
}

export interface AdminUser {
  email: string;
  role: 'admin';
  createdAt: Timestamp;
}
