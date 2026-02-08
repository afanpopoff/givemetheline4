
export type Role = 'ME' | 'PARTNER';

export interface ScriptLine {
  id: string;
  character: string;
  text: string;
  direction?: string;
  role: Role;
  audioKey?: string; // Key in IndexedDB
}

export interface Scene {
  id: string;
  title: string;
  rawText: string;
  lines: ScriptLine[];
  createdAt: number;
}

export type Language = 'en' | 'ru' | 'es';
export type Theme = 'light' | 'dark' | 'system';

export interface AppState {
  scenes: Scene[];
  currentSceneId: string | null;
  language: Language;
  theme: Theme;
}
