export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
}

const ALL_ITEMS: ShopItem[] = [
  { id: 'add_hand', name: '+1 Hand', description: '+1 hand per round', cost: 4 },
  { id: 'add_discard', name: '+1 Discard', description: '+1 discard per round', cost: 2 },
  { id: 'remove_card', name: 'Remove Card', description: 'Remove a card from your deck', cost: 3 },
  { id: 'bonus_gold', name: 'Bonus Gold', description: 'Gain $3 now', cost: 0 },
];

export class ShopManager {
  gold = 0;
  items: ShopItem[] = [];

  /** Generate new shop items */
  generate(): void {
    const shuffled = [...ALL_ITEMS].sort(() => Math.random() - 0.5);
    // Pick 3 random items, but always include bonus gold if ante is tough
    this.items = shuffled.slice(0, 3);
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
