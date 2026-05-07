import { createCard } from '../core/Card.ts';
import type { Card } from '../core/Card.ts';
import { ALL_SUITS, ALL_RANKS } from '../core/CardType.ts';

export class DeckManager {
  private cards: Card[] = [];
  private discards: Card[] = [];

  /** Create a fresh standard 52-card deck */
  init(): void {
    this.cards = [];
    this.discards = [];
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        this.cards.push(createCard(suit, rank));
      }
    }
  }

  /** Fisher-Yates shuffle */
  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /** Deal n cards from top */
  deal(count: number): Card[] {
    return this.cards.splice(0, count);
  }

  /** Return cards to discard pile */
  discard(...cards: Card[]): void {
    this.discards.push(...cards);
  }

  /** Return cards to bottom of deck */
  returnToDeck(...cards: Card[]): void {
    this.cards.push(...cards);
  }

  get remaining(): number {
    return this.cards.length;
  }

  get discardedCount(): number {
    return this.discards.length;
  }

  /** Shuffle discards back into deck */
  recycle(): void {
    this.cards.push(...this.discards);
    this.discards = [];
    this.shuffle();
  }
}
