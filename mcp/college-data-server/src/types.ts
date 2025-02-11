export interface YearData {
  url: string | null;
  sourceType: 'spreadsheet' | 'pdf' | null;
  downloaded: boolean;
  downloadPath?: string;
}

export interface CDSEntry {
  unitId: string;
  name: string;
  years: {
    [key: string]: YearData;
  };
}

export interface ScrapedData {
  colleges: CDSEntry[];
  lastUpdated: string;
  totalPages: number;
  completedPages: number[];
}

export interface CDSDataResult {
  college: string;
  year?: string;
  content?: string;
  available_years?: string[];
  error?: string;
}
