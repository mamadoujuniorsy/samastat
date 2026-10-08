import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Conversation } from './types';

/**
 * Persistance locale des conversations (sur l'appareil uniquement). Aucune donnée n'est
 * envoyée ailleurs qu'à l'API SamaStat, qui ne journalise que la question, anonymement.
 */
const KEY = 'samastat.conversations.v1';
const SETTINGS_KEY = 'samastat.settings.v1';

export interface Settings {
  autoRead: boolean; // lire à voix haute chaque nouvelle réponse
  autoSendAfterDictation: boolean; // envoyer dès que la dictée est terminée
  voiceLanguage: 'auto' | 'fr' | 'wo';
}

export const defaultSettings: Settings = { autoRead: false, autoSendAfterDictation: true, voiceLanguage: 'auto' };

export async function loadConversations(): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveConversations(list: Conversation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    // Le stockage local est un confort ; son échec ne doit pas bloquer l'usage.
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // idem
  }
}
