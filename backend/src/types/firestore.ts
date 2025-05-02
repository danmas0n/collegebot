import { Timestamp } from 'firebase-admin/firestore';

export interface WhitelistedUser {
  email: string;
  createdAt: Timestamp | null;
  createdBy: string;
  userId: string;  // The Firebase auth UID of this user
  parentUserId?: string;  // The user who shared access
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
export interface BaseChatMessage {
  role: 'user' | 'assistant' | 'thinking' | 'system' | 'answer' | 'question';
  content: string;
}

export interface FirestoreChatMessage extends BaseChatMessage {
  timestamp: Timestamp;
}

export interface DTOChatMessage extends BaseChatMessage {
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
  sourceChats?: string[]; // IDs of chats that mentioned this location
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

export interface ResearchFinding {
  timestamp: Timestamp;
  detail: string;
  source?: string;
  confidence: 'high' | 'medium' | 'low';
  category: 'deadline' | 'requirement' | 'contact' | 'financial' | 'other';
}

export interface ResearchTask {
  id: string;
  studentId: string;
  userId: string;
  entityType: 'college' | 'scholarship';
  entityId: string;
  entityName: string;
  status: 'queued' | 'in-progress' | 'complete';
  progress: number;
  currentOperation: string;
  findings: ResearchFinding[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Task {
  id: string;
  studentId: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  category: 'application' | 'scholarship' | 'financial' | 'other';
  sourcePins: string[]; // IDs of map pins this task is related to
  priority?: 'high' | 'medium' | 'low';
  tags?: string[]; // For custom categorization
  reminderDates?: string[]; // Additional dates for reminders before the due date
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CalendarItem {
  id: string;
  studentId: string;
  title: string;
  description?: string;
  date: string; // ISO date string
  type: 'deadline' | 'event' | 'reminder';
  sourcePins: string[]; // IDs of map pins this calendar item is related to
  completed?: boolean; // For items that can be marked complete
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PinResearchRequest {
  id: string;
  studentId: string;
  pinIds: string[]; // The map pins to research
  status: 'pending' | 'in-progress' | 'complete';
  progress: number;
  findings: {
    pinId: string;
    deadlines: Array<{
      date: string;
      description: string;
      source?: string;
    }>;
    requirements: Array<{
      description: string;
      source?: string;
    }>;
  }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AISettings {
  id: string;
  serviceType: 'claude' | 'gemini' | 'openai';
  model: string;
  claudeModel?: string;
  geminiModel?: string;
  openaiModel?: string;
  claudeApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  updatedAt: Timestamp;
  updatedBy: string;
}
