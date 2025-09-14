import { Timestamp } from 'firebase-admin/firestore';

// Clean separation of user types

export interface WhitelistedUser {
  email: string;
  userId: string;  // The Firebase auth UID of this user
  createdAt: Timestamp;
  createdBy: string; // Admin who granted access
  reason?: string; // Optional reason for whitelist access
}

export interface SubscriptionUser {
  email: string;
  userId: string;  // The Firebase auth UID of this user (set when they first sign in)
  
  // Stripe integration
  stripeCustomerId: string;
  subscriptionId: string;
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  
  // Account management
  isMainAccount: boolean;
  trialUsed: boolean;
  familyMemberEmails?: string[]; // Only for main accounts
  parentAccountEmail?: string; // Only for family members
  
  // Access control
  accessSuspended?: boolean;
  suspendedAt?: Timestamp;
  suspendedBy?: string; // Admin who suspended
  restoredAt?: Timestamp;
  restoredBy?: string; // Admin who restored
  
  // Grace period tracking
  gracePeriodStarted?: Timestamp;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  createdBy: string; // Email of user who created this student
  subscriptionOwner: string; // Email of the subscription holder
  data: {
    studentProfile: {
      graduationYear?: number;
      highSchool?: string;
      highSchoolZip?: string;
      gpa?: number;
      satScore?: number;
      actScore?: number;
      extracurriculars?: string[];
      sports?: string[];
      
      // Enhanced structured data
      awards?: {
        academic?: Array<{
          name: string;
          level: 'school' | 'district' | 'state' | 'national' | 'international';
          year: number;
          description?: string;
        }>;
        extracurricular?: Array<{
          name: string;
          organization: string;
          level: 'local' | 'regional' | 'state' | 'national' | 'international';
          year: number;
          description?: string;
        }>;
      };
      
      publications?: Array<{
        title: string;
        type: 'research_paper' | 'article' | 'creative_writing' | 'art' | 'music' | 'other';
        venue?: string;
        date: string;
        url?: string;
        description?: string;
        role: 'author' | 'co-author' | 'contributor' | 'creator';
      }>;
      
      volunteerWork?: Array<{
        organization: string;
        role: string;
        startDate: string;
        endDate?: string;
        hoursPerWeek?: number;
        totalHours?: number;
        description: string;
        impact?: string;
        skills?: string[];
      }>;
      
      leadership?: Array<{
        position: string;
        organization: string;
        startDate: string;
        endDate?: string;
        description: string;
        achievements?: string[];
        teamSize?: number;
      }>;
      
      workExperience?: Array<{
        company: string;
        position: string;
        startDate: string;
        endDate?: string;
        hoursPerWeek?: number;
        description: string;
        skills?: string[];
        supervisor?: {
          name: string;
          email?: string;
          phone?: string;
        };
      }>;
      
      personalNarrative?: {
        essayAngles?: Array<{
          theme: string;
          personalStory: string;
          strengths: string[];
          examples: string[];
          notes?: string;
        }>;
        coreValues?: string[];
        uniquePerspective?: string;
        overcomingChallenges?: Array<{
          challenge: string;
          howOvercome: string;
          lessonsLearned: string;
          growth: string;
        }>;
        passions?: Array<{
          area: string;
          description: string;
          howPursued: string;
          futureGoals: string;
        }>;
      };
    };
    collegeInterests?: {
      colleges?: string[];
      majors?: string[];
      fieldsOfStudy?: string[];
      locationPreferences?: {
        regions?: string[];
        states?: string[];
        minDistanceFromHome?: number;
        maxDistanceFromHome?: number;
        urbanSettings?: ('urban' | 'suburban' | 'rural')[];
      };
    };
    budgetInfo?: {
      yearlyBudget?: number;
      willingness?: {
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
  planId?: string; // Links task to parent plan (for strategic planning tasks)
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
  planId?: string; // Links item to parent plan (for strategic planning items)
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

// LLM Cost Tracking Types
export interface LLMPricingConfig {
  id: string;
  provider: 'claude' | 'gemini' | 'openai';
  model: string;
  pricing: {
    input: number;           // per 1M tokens
    output: number;          // per 1M tokens
    cacheCreation?: number;  // Claude-specific: per 1M tokens
    cacheRead?: number;      // Claude-specific: per 1M tokens
  };
  updatedAt: Timestamp;
  updatedBy: string; // admin user ID
}

export interface LLMFlowCost {
  id: string;
  chatId: string;           // Links to the chat that represents this flow
  studentId: string;
  userId: string;
  stage: 'recommendations' | 'map' | 'plan' | 'research' | 'other';
  
  // Aggregated metrics for the entire flow
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;  // Claude-specific
  totalCacheReadTokens: number;      // Claude-specific
  totalEstimatedCost: number;        // in USD
  
  // Provider breakdown (in case we use multiple providers in one flow)
  providerBreakdown: {
    [provider: string]: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens?: number;
      cacheReadTokens?: number;
      estimatedCost: number;
    }
  };
  
  // Flow timing
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface LLMRequestLog {
  id: string;
  flowCostId: string;       // Links to the parent flow
  chatId: string;
  requestSequence: number;  // 1st, 2nd, 3rd request in the flow
  
  provider: 'claude' | 'gemini' | 'openai';
  model: string;
  
  // Raw token counts from API
  inputTokens: number;              // Total input
  outputTokens: number;             // Output
  cacheCreationTokens?: number;     // Cache creation (Claude)
  cacheReadTokens?: number;         // Cache read (Claude)
  
  // Calculated for cost breakdown
  regularInputTokens: number;       // inputTokens - cacheCreationTokens - cacheReadTokens
  
  estimatedCost: number;
  timestamp: Timestamp;
}
