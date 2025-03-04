export interface ResearchFinding {
  timestamp: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ResearchTaskUpdate {
  status?: ResearchTask['status'];
  progress?: number;
  currentOperation?: string;
  findings?: ResearchFinding[];
}
