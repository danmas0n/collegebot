export interface Message {
  role: 'user' | 'assistant' | 'answer' | 'question' | 'thinking';
  content: string;
}
