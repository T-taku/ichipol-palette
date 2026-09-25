import { sanitizeSettings } from './defaults';
import type { Settings } from './types';

export const SETTINGS_KEY = 'hcu-rishu-color-settings';

export function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export async function loadSettings(): Promise<Settings> {
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    return sanitizeSettings(data[SETTINGS_KEY]);
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeSettings(null);
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const clean = sanitizeSettings(settings);
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: clean });
    return;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean));
}

export function watchSettings(onChange: (settings: Settings) => void): () => void {
  if (hasChromeStorage()) {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local' || !changes[SETTINGS_KEY]) return;
      onChange(sanitizeSettings(changes[SETTINGS_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  const listener = (event: StorageEvent) => {
    if (event.key !== SETTINGS_KEY) return;
    try {
      onChange(sanitizeSettings(event.newValue ? JSON.parse(event.newValue) : null));
    } catch {
      onChange(sanitizeSettings(null));
    }
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
