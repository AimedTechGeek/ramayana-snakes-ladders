import type { Hero } from '../core/types';
import { t } from '../i18n/i18n';

export interface HeroLook {
  label: string;
  color: number;
  cssColor: string;
}

/** Seat and token colours are the hero accents of the style guide (T02). */
export const HEROES: Record<Hero, HeroLook> = {
  rama: { label: 'Rama', color: 0x3f6fc2, cssColor: '#3F6FC2' },
  sita: { label: 'Sita', color: 0xd15587, cssColor: '#D15587' },
  lakshmana: { label: 'Lakshmana', color: 0x2e9e6b, cssColor: '#2E9E6B' },
  bharata: { label: 'Bharata', color: 0x6e4bb5, cssColor: '#6E4BB5' },
  shatrughna: { label: 'Shatrughna', color: 0x1f9e95, cssColor: '#1F9E95' },
  hanuman: { label: 'Hanuman', color: 0xe4572e, cssColor: '#E4572E' },
};

/** Setup's hero cycle and the Gallery's rows: the four brothers, then Hanuman and Sita (T46). */
export const HERO_ORDER: readonly Hero[] = ['rama', 'lakshmana', 'bharata', 'shatrughna', 'hanuman', 'sita'];

/** The hero's name in the current language; `label` stays English for code and saves. */
export function heroName(hero: Hero): string {
  return t(`hero.${hero}`);
}
