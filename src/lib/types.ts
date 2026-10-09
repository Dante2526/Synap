export type Role = 'user' | 'assistant' | 'system';

export interface AttachedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  images?: string[]; // base64 data URLs
  documents?: AttachedDocument[];
  createdAt: number;
  reasoning?: string; // conteúdo do thinking (se vier separado ou extraído)
  reasoningEffort?: ReasoningEffort; // 'low' | 'high' | 'max'
  isPlanMode?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model: string;
  reasoningEffort: 'low' | 'high' | 'max';
  isPlanMode?: boolean;
}

export type ModelId = 'z-ai/glm-5.3' | 'z-ai/glm-5.3-flash';
export type ReasoningEffort = 'low' | 'high' | 'max';

export interface AppSettings {
  saveHistoryLocally: boolean;
  voiceEnabled: boolean;
  darkMode: boolean;
  speechVoice?: string;
  speechRate?: number;
}
