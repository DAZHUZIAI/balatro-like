import { getBossForAnte, randomSkipReward } from './BossBlind.ts';
import type { BossEffect, SkipReward } from './BossBlind.ts';

export enum BlindType {
  Small = 'small',
  Big = 'big',
  Boss = 'boss',
}

export interface BlindConfig {
  type: BlindType;
  name: string;
  targetScore: number;
  rewardGold: number;
  /** Boss effect if this is a boss blind, null otherwise */
  bossEffect?: BossEffect | null;
}

export enum GamePhase {
  Start,
  Playing,
  Shop,
  GameOver,
}

// Score targets that roughly double each ante (Balatro-inspired)
const ANTE_SCORES: Record<BlindType, number[]> = {
  [BlindType.Small]: [300, 800, 2000, 5000, 11000, 20000, 35000, 50000],
  [BlindType.Big]:   [450, 1200, 3000, 7500, 16000, 30000, 50000, 75000],
  [BlindType.Boss]:  [600, 1600, 4000, 10000, 22000, 40000, 65000, 100000],
};

const BLIND_GOLD: Record<BlindType, number> = {
  [BlindType.Small]: 3,
  [BlindType.Big]: 4,
  [BlindType.Boss]: 5,
};

const BLIND_NAMES: Record<BlindType, string> = {
  [BlindType.Small]: 'Small Blind',
  [BlindType.Big]: 'Big Blind',
  [BlindType.Boss]: 'Boss Blind',
};

export const MAX_HANDS_PER_BLIND = 4;
export const MAX_DISCARDS_PER_BLIND = 3;

export class RoundManager {
  ante = 1;
  /** 3 blinds per ante: Small, Big, Boss */
  private blindOrder: BlindType[] = [BlindType.Small, BlindType.Big, BlindType.Boss];
  private blindIdx = 0;

  currentScore = 0;
  handsRemaining = MAX_HANDS_PER_BLIND;
  discardsRemaining = MAX_DISCARDS_PER_BLIND;
  phase: GamePhase = GamePhase.Start;

  /** Active boss effect for the current blind (if boss) */
  private activeBoss: BossEffect | null = null;
  /** Pending skip reward from previous blind (applied later) */
  private pendingSkipReward: SkipReward | null = null;
  /** Whether current blind was skipped */
  isSkipped = false;

  /** Start a new game */
  newGame(): void {
    this.ante = 1;
    this.blindIdx = 0;
    this.phase = GamePhase.Playing;
    this.activeBoss = null;
    this.pendingSkipReward = null;
    this.isSkipped = false;
    this.resetRound();
  }

  /** Reset per-blind counters */
  resetRound(): void {
    this.currentScore = 0;
    this.handsRemaining = MAX_HANDS_PER_BLIND;
    this.discardsRemaining = MAX_DISCARDS_PER_BLIND;
    this.isSkipped = false;
  }

  get currentBlind(): BlindType {
    return this.blindOrder[this.blindIdx];
  }

  /** Get all 3 blind configs for the current ante (for blind selection UI) */
  getAvailableBlinds(): BlindConfig[] {
    return this.blindOrder.map(type => this.getBlindConfigFor(type));
  }

  private getBlindConfigFor(type: BlindType): BlindConfig {
    const anteIdx = Math.min(this.ante - 1, ANTE_SCORES[type].length - 1);
    let targetScore = ANTE_SCORES[type][anteIdx];

    const boss = type === BlindType.Boss ? getBossForAnte(this.ante) : null;
    if (boss?.targetMultiplier) {
      targetScore = Math.round(targetScore * boss.targetMultiplier);
    }

    // Use boss name if applicable
    let name = BLIND_NAMES[type];
    if (boss) {
      name = `${boss.name} (${BLIND_NAMES[type]})`;
    }

    return {
      type,
      name,
      targetScore,
      rewardGold: BLIND_GOLD[type],
      bossEffect: boss,
    };
  }

  getBlindConfig(): BlindConfig {
    return this.getBlindConfigFor(this.currentBlind);
  }

  /** Select a blind by type (called from blind selection UI) */
  selectBlind(type: BlindType): BlindConfig {
    const idx = this.blindOrder.indexOf(type);
    if (idx === -1) return this.getBlindConfig();

    // If we're selecting a blind from the available list, update idx
    // But we also need to handle the case where we've advanced past some blinds
    this.blindIdx = idx;
    this.resetRound();

    // Apply boss effects
    const config = this.getBlindConfig();
    if (type === BlindType.Boss) {
      this.activeBoss = getBossForAnte(this.ante);
      // Apply boss overrides
      if (this.activeBoss?.handsOverride != null) {
        this.handsRemaining = this.activeBoss.handsOverride;
      }
      if (this.activeBoss?.discardsOverride != null) {
        this.discardsRemaining = this.activeBoss.discardsOverride;
      }
    } else {
      this.activeBoss = null;
    }

    return config;
  }

  /** Skip the current blind, get reward, and advance */
  skipBlind(): SkipReward {
    this.isSkipped = true;
    const reward = randomSkipReward();
    this.pendingSkipReward = reward;
    // Advance past this blind
    this.advanceBlind();
    return reward;
  }

  /** Apply pending skip reward to the game state */
  applySkipReward(): { gold: number; extraHands: number; extraDiscards: number } {
    const reward = this.pendingSkipReward;
    this.pendingSkipReward = null;
    if (!reward) return { gold: 0, extraHands: 0, extraDiscards: 0 };

    switch (reward.type) {
      case 'gold_small':
      case 'gold_medium':
        return { gold: reward.goldAmount ?? 0, extraHands: 0, extraDiscards: 0 };
      case 'bonus_hand':
        return { gold: 0, extraHands: 1, extraDiscards: 0 };
      case 'bonus_discard':
        return { gold: 0, extraHands: 0, extraDiscards: 1 };
    }
    return { gold: 0, extraHands: 0, extraDiscards: 0 };
  }

  /** Get current boss effect (null if not boss blind or ante < 2) */
  getBossEffect(): BossEffect | null {
    return this.activeBoss;
  }

  /** Record a played hand's score. Returns true if the blind is beaten. */
  playHand(score: number): boolean {
    this.handsRemaining--;
    this.currentScore += score;
    return this.currentScore >= this.getBlindConfig().targetScore;
  }

  get isBlindBeaten(): boolean {
    return this.currentScore >= this.getBlindConfig().targetScore;
  }

  get isOutOfHands(): boolean {
    return this.handsRemaining <= 0;
  }

  /** Advance to the next blind in the sequence */
  advanceBlind(): boolean {
    this.blindIdx++;
    if (this.blindIdx >= this.blindOrder.length) {
      this.ante++;
      this.blindIdx = 0;
      return true; // ante complete
    }
    return false;
  }

  /** Get gold reward for beating the current blind */
  collectReward(): number {
    return this.getBlindConfig().rewardGold;
  }

  /** Blind label string for display */
  get blindLabel(): string {
    const b = this.getBlindConfig();
    return `Ante ${this.ante} — ${b.name}`;
  }
}
