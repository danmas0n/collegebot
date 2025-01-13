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
  role: 'user' | 'assistant' | 'thinking' | 'system' | 'answer';
  content: string;
}

export interface AiChat {
  id: string;
  messages: AiChatMessage[];
  createdAt: string;
  updatedAt: string;
  studentId?: string;
}

// Update Student interface to include chat history
declare module './wizard' {
  interface Student {
    currentChat?: AiChat;
    chats?: AiChat[];
  }
}
