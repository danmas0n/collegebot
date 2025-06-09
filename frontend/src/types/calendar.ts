import { Timestamp } from 'firebase/firestore';

export interface CalendarItem {
  id: string;
  studentId: string;
  title: string;
  description: string;
  date: string; // ISO date string
  type: 'deadline' | 'event' | 'reminder' | 'appointment' | 'task';
  sourcePins: string[]; // IDs of map pins this calendar item is related to
  completed?: boolean; // For items that can be marked complete
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface Task {
  id: string;
  studentId: string;
  title: string;
  description: string;
  dueDate: string | null; // ISO date string or null
  completed: boolean;
  category: 'application' | 'scholarship' | 'financial' | 'testing' | 'visit' | 'other' | 'deadline';
  sourcePins: string[]; // IDs of map pins this task is related to
  priority: 'high' | 'medium' | 'low';
  tags: string[]; // For custom categorization
  reminderDates: string[]; // Additional dates for reminders before the due date
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  // Plan-related fields
  planId?: string; // Links task to specific plan
  schoolId?: string | 'general'; // For filtering by school
  sourceChat?: string; // Traceability to conversation
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
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// DTO to Firestore conversion helpers
export const isoToTimestamp = (isoString: string | null | undefined): Timestamp | null => {
  if (!isoString) return null;
  return Timestamp.fromDate(new Date(isoString));
};

export const timestampToIso = (timestamp: Timestamp | null | undefined): string | null => {
  if (!timestamp) return null;
  return timestamp.toDate().toISOString();
};
