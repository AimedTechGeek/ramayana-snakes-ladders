import en from './en.json';
import hi from './hi.json';

export type Locale = 'en' | 'hi';
export type LocaleTable = Record<string, string | string[]>;

const STORAGE_KEY = 'rsl.locale';

const tables: Partial<Record<Locale, LocaleTable>> = { en, hi };
let current: Locale = 'en';

export function registerLocale(locale: Locale, table: LocaleTable): void {
  tables[locale] = table;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage may be unavailable (private mode, blocked site data); keep the in-memory locale.
  }
}

export function getLocale(): Locale {
  return current;
}

/** Restores the locale saved by setLocale. Call once at startup, before any text is built. */
export function initLocale(): void {
  let saved: string | null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    return;
  }
  if (saved === 'en' || saved === 'hi') current = saved;
}

/** Lines for a key in the current locale, falling back to English; empty when neither has it. */
function linesFor(key: string): string[] {
  for (const table of [tables[current], tables.en]) {
    const value = table?.[key];
    if (value === undefined) continue;
    const lines = Array.isArray(value) ? value : [value];
    if (lines.length > 0) return lines;
  }
  return [];
}

export function t(key: string, params?: Record<string, string | number>): string {
  const text = linesFor(key)[0] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}

/** One random line for `${hero}.${role}.${event}`, or null when no line exists. */
export function speech(
  hero: string,
  role: 'self' | 'other',
  event: string,
  random: () => number = Math.random,
): string | null {
  const lines = linesFor(`${hero}.${role}.${event}`);
  if (lines.length === 0) return null;
  const index = Math.min(lines.length - 1, Math.floor(random() * lines.length));
  return lines[index] ?? null;
}
