export interface College {
  name: string;
  url?: string;
  description?: string;
  sections?: {
    admissions?: string;
    enrollment?: string;
    expenses?: string;
    financialAid?: string;
  };
  isConsidered?: boolean;
  addedToConsiderationAt?: string;
}

export interface SearchResult {
  query: string;
  results: College[];
}

export interface WordCloudWord {
  text: string;
  value: number;
}

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'thinking' | 'system' | 'answer' | 'question';
  content: string;
  timestamp: string;
  toolData?: string; // Optional tool data for thinking messages
}

export interface AiChat {
  id: string;
  studentId: string;
  messages: AiChatMessage[];
  processed: boolean;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  title?: string;
}

// Chat history is now handled through StudentWithChats interface in wizard.ts
