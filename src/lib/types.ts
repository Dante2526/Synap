export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface AttachedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
}

export type ChangeType = 'modified' | 'added' | 'deleted';

export interface PendingChange {
  id: string;
  path: string;
  repo: string; // owner/repo
  branch: string;
  type: ChangeType;
  originalContent?: string; // undefined se added
  newContent: string; // novo conteúdo
  createdAt: number;
  staged: boolean;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string; // owner/repo
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string | null;
  private: boolean;
}

export interface GitHubFileItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

export interface ActiveRepoState {
  owner: string;
  repo: string;
  fullName: string;
  branch: string;
  defaultBranch: string;
}

export interface MessageEditedFile {
  path: string;
  type: ChangeType;
  changeId?: string;
}

export interface MessageToolCall {
  id: string;
  name: string;
  arguments: string;
  status: 'running' | 'waiting' | 'pending' | 'completed' | 'error';
  result?: string;
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
  editedFiles?: MessageEditedFile[]; // arquivos editados pela IA nesta mensagem
  toolCalls?: MessageToolCall[]; // histórico e status das chamadas de ferramentas executadas
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
  activeRepo?: ActiveRepoState | null;
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
