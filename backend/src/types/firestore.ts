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

export interface Chat {
  id: string;
  studentId: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Timestamp;
  }[];
  processed: boolean;
  processedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
