import { sanitizeSettings } from './defaults';
import type { Settings } from './types';

export const SETTINGS_KEY = 'hcu-rishu-color-settings';

/** 拡張を読み直したあとは chrome.runtime.id の参照自体が例外になる。 */
export function extensionContextAlive(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function isContextInvalidated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /context invalidated/i.test(message);
}

export function hasChromeStorage(): boolean {
  try {
    return extensionContextAlive() && !!chrome.storage?.local;
  } catch {
    return false;
  }
}

export async function loadSettings(): Promise<Settings> {
  if (hasChromeStorage()) {
    try {
      const data = await chrome.storage.local.get(SETTINGS_KEY);
      return sanitizeSettings(data[SETTINGS_KEY]);
    } catch (error) {
      if (!isContextInvalidated(error)) throw error;
      return sanitizeSettings(null);
    }
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
    try {
      await chrome.storage.local.set({ [SETTINGS_KEY]: clean });
    } catch (error) {
      if (!isContextInvalidated(error)) throw error;
    }
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
    return () => {
      try {
        chrome.storage.onChanged.removeListener(listener);
      } catch (error) {
        if (!isContextInvalidated(error)) throw error;
      }
    };
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
