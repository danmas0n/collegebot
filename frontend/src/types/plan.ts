export interface Plan {
  id: string;
  studentId: string;
  schoolId: string;
  schoolName: string;
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
  lastModified: string;
  sourceChats: string[];
  sourcePins: string[];
  description?: string;
  timeline: PlanItem[];
}

export interface PlanItem {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  category: 'application' | 'testing' | 'scholarship' | 'visit' | 'financial' | 'other';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  schoolSpecific: boolean;
  relatedSchools: string[]; // Can apply to multiple schools
  sourceChat?: string; // Chat where this item was created/modified
}

export interface PlanCreationRequest {
  studentId: string;
  schoolId: string | 'general';
  schoolName: string | 'General';
  description?: string;
}

export interface PlanUpdateRequest {
  planId: string;
  updates: Partial<Omit<Plan, 'id' | 'studentId' | 'createdAt'>>;
}
