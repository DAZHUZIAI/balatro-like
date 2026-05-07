import { Suit, Rank } from './CardType.ts';

export interface Card {
  suit: Suit;
  rank: Rank;
  /** Unique id for rendering/selection tracking */
  id: string;
}

let nextId = 0;

export function createCard(suit: Suit, rank: Rank): Card {
  return { suit, rank, id: `${suit}-${rank}-${nextId++}` };
}
