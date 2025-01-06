export type WizardStage = 
  | 'student-selection'
  | 'student-profile'
  | 'college-interests'
  | 'budget'
  | 'data-collection'
  | 'recommendations';

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
}

export interface BudgetInfo {
  yearlyBudget?: number;
  willingness?: {
    loans?: boolean;
    workStudy?: boolean;
    scholarships?: boolean;
  };
}

export interface WizardData {
  studentProfile: StudentProfile;
  collegeInterests: CollegeInterests;
  budgetInfo: BudgetInfo;
  dataCollection?: {
    status: 'pending' | 'in-progress' | 'complete';
    progress?: number;
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
