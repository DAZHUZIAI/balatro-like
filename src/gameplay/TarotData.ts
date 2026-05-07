import type { Enhancement } from '../core/Card.ts';

export interface TarotDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  enhancement: Enhancement;
}

export const TAROT_CARDS: TarotDef[] = [
  { id: 'magician', name: 'The Magician', description: 'Make a card Glass', cost: 3, enhancement: 'glass' },
  { id: 'empress', name: 'The Empress', description: 'Make a card Stone', cost: 3, enhancement: 'stone' },
  { id: 'justice', name: 'Justice', description: 'Make a card Diamond bonus', cost: 2, enhancement: 'diamond_bonus' },
  { id: 'hierophant', name: 'The Hierophant', description: 'Make a card Heart bonus', cost: 2, enhancement: 'heart_bonus' },
  { id: 'lovers', name: 'The Lovers', description: 'Make a card Spade bonus', cost: 2, enhancement: 'spade_bonus' },
  { id: 'chariot', name: 'The Chariot', description: 'Make a card Club bonus', cost: 2, enhancement: 'club_bonus' },
];
