// Player settings that outlive a game (T45.4): saved in localStorage like the language (i18n.ts). Fast and Mute stay
// session state in App.tsx; this holds what the owner asked to be remembered.

export interface Settings {
  /** "Bite close-ups": the staged, camera-led snake bite (T45.4). On by default. */
  biteCloseUps: boolean;
}

export const DEFAULT_SETTINGS: Settings = { biteCloseUps: true };
const STORAGE_KEY = 'rsl.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      biteCloseUps: typeof parsed.biteCloseUps === 'boolean' ? parsed.biteCloseUps : DEFAULT_SETTINGS.biteCloseUps,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Writes the settings; a full or unavailable storage is not an error (the setting then lasts the session). */
export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode, quota): the choice still applies until the page is closed
  }
}
