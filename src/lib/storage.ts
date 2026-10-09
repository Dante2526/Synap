import { get, set, clear } from 'idb-keyval';
import { Conversation, AppSettings } from './types';

const CONVERSATIONS_KEY = 'nim_chat_conversations_v1';
const SETTINGS_KEY = 'nim_chat_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  saveHistoryLocally: true,
  voiceEnabled: true,
  darkMode: true,
  speechVoice: 'pt-BR-FranciscaNeural',
  speechRate: 1.0,
};

export async function loadConversations(): Promise<Conversation[]> {
  try {
    const data = await get<Conversation[]>(CONVERSATIONS_KEY);
    return data || [];
  } catch (error) {
    console.error('Failed to load conversations from IndexedDB:', error);
    return [];
  }
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  try {
    await set(CONVERSATIONS_KEY, conversations);
  } catch (error) {
    console.error('Failed to save conversations to IndexedDB:', error);
  }
}

export async function clearAllConversations(): Promise<void> {
  try {
    await clear();
  } catch (error) {
    console.error('Failed to clear conversations:', error);
  }
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    if (!parsed.speechVoice) {
      parsed.speechVoice = 'pt-BR-FranciscaNeural';
    }
    return parsed;
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function exportConversationsToJSON(conversations: Conversation[]): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(conversations, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const date = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('download', `conversas-nim-chat-${date}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
