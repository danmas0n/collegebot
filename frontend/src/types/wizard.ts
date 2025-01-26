export type WizardStage = 
  | 'student-selection'
  | 'student-profile'
  | 'college-interests'
  | 'budget'
  | 'data-collection'
  | 'recommendations'
  | 'map';

export interface Student {
  id: string;
  name: string;
  lastUpdated: string;
  data: WizardData;
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
    referenceLinks?: Array<{
      url: string;
      title: string;
      category: 'admissions' | 'financial' | 'academic' | 'campus' | 'career' | 'research' | 'application' | 'student-life' | 'social';
      source: 'official' | 'semi-official' | 'unofficial';
      platform: 'website' | 'reddit' | 'youtube' | 'twitter' | 'instagram' | 'linkedin' | 'blog' | 'news' | 'other';
      notes?: string;
      dateFound: string;
      credibilityNotes?: string;
    }>;
    showLinks?: boolean;
    // For colleges
    fitScore?: number;
    reason?: string;
    // For scholarships
    amount?: number;
    deadline?: string;
    eligibility?: string;
    applicationUrl?: string;
    sponsorWebsite?: string;
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
