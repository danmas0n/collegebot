export type NodeStatus = 'todo' | 'doing' | 'done' | null;

export type NodeType = 'student' | 'college' | 'major' | 'interest' | 'topic' | 'requirement' | 'achievement' | 'goal' | 'scholarship' | 'benefit' | 'activity';

export interface CustomNodeData {
  label: string;
  nodeType: NodeType;
  metadata?: Record<string, any>;
  status?: NodeStatus;
  [key: string]: unknown;
}

export const nodeColors: Record<string, string> = {
  student: '#e91e63',      // Pink
  college: '#2196f3',      // Blue
  major: '#4caf50',        // Green
  interest: '#ff9800',     // Orange
  topic: '#9c27b0',        // Purple
  requirement: '#f44336',  // Red
  achievement: '#795548',  // Brown
  goal: '#607d8b',        // Blue-grey
  scholarship: '#ffd700',  // Gold
  benefit: '#00bcd4',     // Cyan
  activity: '#8bc34a'     // Light green
};
