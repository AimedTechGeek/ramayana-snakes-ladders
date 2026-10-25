import type { Hero } from '../core/types';

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
  hanuman: { label: 'Hanuman', color: 0xe4572e, cssColor: '#E4572E' },
};

export const HERO_ORDER: readonly Hero[] = ['rama', 'sita', 'lakshmana', 'hanuman'];
