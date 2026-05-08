import { MVP_JOKERS } from './JokerData.ts';
import type { JokerDefinition } from './JokerData.ts';
import { TAROT_CARDS } from './TarotData.ts';
import type { TarotDef } from './TarotData.ts';
import { PLANET_CARDS } from './PlanetData.ts';
import type { PlanetDef } from './PlanetData.ts';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** If this is a joker card, reference to its JokerDefinition */
  jokerDef?: JokerDefinition;
  /** If this is a tarot card, reference to its TarotDef */
  tarotDef?: TarotDef;
  /** If this is a planet card, reference to its PlanetDef */
  planetDef?: PlanetDef;
}

const UTILITY_ITEMS: ShopItem[] = [
  { id: 'add_hand', name: '+1 Hand', description: '+1 hand this round', cost: 4 },
  { id: 'add_discard', name: '+1 Discard', description: '+1 discard this round', cost: 2 },
  { id: 'remove_card', name: 'Remove Card', description: 'Reset deck (remove all) remove_card', cost: 3 },
  { id: 'bonus_gold', name: 'Bonus Gold', description: 'Gain $3 now', cost: 0 },
];

export class ShopManager {
  gold = 0;
  items: ShopItem[] = [];

  /** Generate new shop items — mix of jokers, tarots, planets, and utilities */
  generate(): void {
    const jokerPool = [...MVP_JOKERS].sort(() => Math.random() - 0.5);
    const tarotPool = [...TAROT_CARDS].sort(() => Math.random() - 0.5);
    const planetPool = [...PLANET_CARDS].sort(() => Math.random() - 0.5);
    const utilPool = [...UTILITY_ITEMS].sort(() => Math.random() - 0.5);

    // Pick 2 jokers + 1 consumable (tarot or planet) + 1 utility
    const jokers = jokerPool.slice(0, 2).map(j => ({
      id: j.id,
      name: j.name,
      description: j.description,
      cost: j.cost,
      jokerDef: j,
    }));

    // Randomly pick tarot or planet for the consumable slot
    const consumable = Math.random() < 0.5
      ? tarotPool.slice(0, 1).map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          cost: t.cost,
          tarotDef: t,
        }))
      : planetPool.slice(0, 1).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          cost: p.cost,
          planetDef: p,
        }));

    const oneUtil = utilPool.slice(0, 1);

    this.items = [...jokers, ...consumable, ...oneUtil].sort(() => Math.random() - 0.5);
  }

  /** Try to buy item at index. Returns true if purchased. */
  purchase(index: number): boolean {
    const item = this.items[index];
    if (!item) return false;
    if (this.gold < item.cost) return false;
    this.gold -= item.cost;
    this.items.splice(index, 1);
    return true;
  }

  /** Reroll shop items (costs 1 gold) */
  reroll(): boolean {
    if (this.gold < 1) return false;
    this.gold--;
    this.generate();
    return true;
  }

  /** Add gold (from blind rewards) */
  earn(amount: number): void {
    this.gold += amount;
  }
}
