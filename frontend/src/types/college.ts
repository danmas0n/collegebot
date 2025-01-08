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
  role: 'user' | 'assistant' | 'thinking';
  content: string;
}
