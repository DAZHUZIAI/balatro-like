import { Suit, Rank } from './CardType.ts';

/** Card enhancement type (applied by tarot cards) */
export type Enhancement = 'diamond_bonus' | 'heart_bonus' | 'spade_bonus' | 'club_bonus' | 'stone' | 'glass' | null;

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
  enhancement?: Enhancement;
}

let nextId = 0;

export function createCard(suit: Suit, rank: Rank): Card {
  return { suit, rank, enhancement: undefined, id: `${suit}-${rank}-${nextId++}` };
}

export function isEnhanced(card: Card): boolean {
  return card.enhancement != null;
}

export function applyEnhancement(card: Card, enhancement: Enhancement): Card {
  return { ...card, enhancement };
}

export function isStone(card: Card): boolean {
  return card.enhancement === 'stone';
}

export function isGlass(card: Card): boolean {
  return card.enhancement === 'glass';
}
