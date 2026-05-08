import { HandType } from '../core/CardType.ts';
import { HAND_BASE_CHIPS, HAND_BASE_MULT } from '../utils/Constants.ts';

interface LevelScale {
  chipsBonus: number;
  multBonus: number;
}

const LEVEL_SCALES: Record<string, LevelScale> = {
  high_card: { chipsBonus: 5, multBonus: 1 },
  pair: { chipsBonus: 5, multBonus: 1 },
  two_pair: { chipsBonus: 5, multBonus: 1 },
  three_of_a_kind: { chipsBonus: 5, multBonus: 1 },
  straight: { chipsBonus: 10, multBonus: 2 },
  flush: { chipsBonus: 15, multBonus: 2 },
  full_house: { chipsBonus: 10, multBonus: 2 },
  four_of_a_kind: { chipsBonus: 10, multBonus: 2 },
  straight_flush: { chipsBonus: 15, multBonus: 3 },
  five_of_a_kind: { chipsBonus: 15, multBonus: 3 },
};

export class HandLevelManager {
  private levels: Record<string, number> = {};

  getLevel(handType: HandType): number {
    return this.levels[handType] ?? 1;
  }

  getBaseChips(handType: HandType): number {
    const base = HAND_BASE_CHIPS[handType] ?? 0;
    const lvl = this.getLevel(handType);
    const scale = LEVEL_SCALES[handType] ?? { chipsBonus: 5, multBonus: 1 };
    return base + scale.chipsBonus * (lvl - 1);
  }

  getBaseMult(handType: HandType): number {
    const base = HAND_BASE_MULT[handType] ?? 1;
    const lvl = this.getLevel(handType);
    const scale = LEVEL_SCALES[handType] ?? { chipsBonus: 5, multBonus: 1 };
    return base + scale.multBonus * (lvl - 1);
  }

  levelUp(handType: HandType): number {
    const cur = this.getLevel(handType);
    this.levels[handType] = cur + 1;
    return cur + 1;
  }

  reduceLevel(handType: HandType): number {
    const cur = this.getLevel(handType);
    const newLevel = Math.max(1, cur - 1);
    this.levels[handType] = newLevel;
    return newLevel;
  }

  reset(): void {
    this.levels = {};
  }
}
