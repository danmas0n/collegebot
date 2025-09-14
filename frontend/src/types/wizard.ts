export type WizardStage = 
  | 'student-selection'
  | 'student-profile'
  | 'college-interests'
  | 'budget'
  | 'data-collection'
  | 'recommendations'
  | 'map'
  | 'calendar'
  | 'collaboration';

export interface Student {
  id: string;
  name: string;
  lastUpdated: string;
  data: WizardData;
  userId: string;  // The owner of the student
}

export interface StudentProfile {
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
}

export interface CollegeInterests {
  colleges?: string[];
  majors?: string[];
  fieldsOfStudy?: string[];
  locationPreferences?: {
    regions?: string[];
    minDistanceFromHome?: number;
    maxDistanceFromHome?: number;
    states?: string[];
    urbanSettings?: ('urban' | 'suburban' | 'rural')[];
  };
}

export interface BudgetInfo {
  yearlyBudget?: number;
  willingness?: {
    loans?: boolean;
    workStudy?: boolean;
    scholarships?: boolean;
  };
}

export interface DataSource {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  message?: string;
}

export interface MapLocation {
  id: string;
  type: 'college' | 'scholarship';
  name: string;
  latitude: number;
  longitude: number;
  sourceChats?: string[]; // IDs of chats that mentioned this location
  metadata: {
    website?: string;
    description?: string;
    address?: string;
    distanceFromHome?: number;
    matchesPreferences?: {
      region: boolean;
      state: boolean;
      distance: boolean;
      setting: boolean;
    };
    referenceLinks?: {
      url: string;
      title: string;
      category: string;
      source: 'official' | 'semi-official' | 'unofficial';
      platform: string;
      notes?: string;
      dateFound: string;
      credibilityNotes?: string;
    }[];
    showLinks?: boolean;
    
    // College-specific fields
    fitScore?: number;
    reason?: string;
    // CDS Academic Data
    studentFacultyRatio?: string;
    classSize?: {
      under20: number;
      under50: number;
      over50: number;
    };
    graduationRate?: {
      fourYear: number;
      sixYear: number;
    };
    retentionRate?: number;
    popularMajors?: {
      name: string;
      enrollment: number;
    }[];
    // CDS Admissions Data
    acceptanceRate?: number;
    testScores?: {
      sat?: {
        math: [number, number]; // 25th and 75th percentile
        reading: [number, number];
      };
      act?: {
        composite: [number, number];
      };
    };
    averageGpa?: number;
    // CDS Financial Data
    costOfAttendance?: {
      tuition: number;
      roomAndBoard: number;
      booksAndSupplies: number;
      otherExpenses: number;
      total: number;
    };
    financialAid?: {
      averagePackage: number;
      percentNeedMet: number;
      percentReceivingAid: number;
    };
    meritScholarships?: {
      minAmount: number;
      maxAmount: number;
      percentReceiving: number;
    };
    
    // Scholarship-specific fields
    amount?: number;
    deadline?: string;
    eligibility?: string;
    applicationUrl?: string;
    sponsorWebsite?: string;
    // Historical Data
    historicalData?: {
      annualAwards: number;
      averageAwardTrend: number[];
      recipientStats?: {
        averageGpa?: number;
        typicalMajors?: string[];
        commonCharacteristics?: string[];
      };
    };
    // Competition Data
    competitionData?: {
      annualApplicants: number;
      successRate: number;
      winnerProfile?: {
        academicStrengths?: string[];
        extracurricularFocus?: string[];
        essayThemes?: string[];
      };
    };
  };
}

export interface WizardData {
  studentProfile: StudentProfile;
  collegeInterests: CollegeInterests;
  budgetInfo: BudgetInfo;
  dataCollection?: {
    status: 'pending' | 'in-progress' | 'complete';
    progress?: number;
    sources?: DataSource[];
  };
  recommendations?: {
    colleges: Array<{
      name: string;
      reason: string;
      fitScore: number;
    }>;
    scholarships?: Array<{
      name: string;
      amount: number;
      deadline: string;
      eligibility: string;
    }>;
  };
  map?: {
    locations: MapLocation[];
  };
}

export interface LLMOperation {
  id: string;
  stage: WizardStage;
  type: 'research' | 'map-processing' | 'chat' | 'recommendations';
  description: string;
  startTime: Date;
}

export interface WizardContextType {
  currentStage: WizardStage;
  currentStudent: Student | null;
  students: Student[];
  data: WizardData;
  goToStage: (stage: WizardStage) => void;
  updateData: (updates: Partial<WizardData>) => void;
  selectStudent: (student: Student) => void;
  createStudent: (name: string) => void;
  deleteStudent: (id: string) => void;
  canProceed: boolean;
  nextStage: () => void;
  previousStage: () => void;
  // LLM operation tracking
  activeLLMOperations: LLMOperation[];
  startLLMOperation: (operation: Omit<LLMOperation, 'id' | 'startTime'>) => string;
  endLLMOperation: (operationId: string) => void;
  isNavigationBlocked: boolean;
}
