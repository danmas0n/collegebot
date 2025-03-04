export type WizardStage = 
  | 'student-selection'
  | 'student-profile'
  | 'college-interests'
  | 'budget'
  | 'data-collection'
  | 'recommendations'
  | 'map'
  | 'calendar';

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
}
