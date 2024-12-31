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
}

export interface SearchResult {
  query: string;
  results: College[];
}
