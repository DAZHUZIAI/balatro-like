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
  private blindOrder: BlindType[] = [BlindType.Small, BlindType.Big, BlindType.Boss];
  private blindIdx = 0;

  currentScore = 0;
  handsRemaining = MAX_HANDS_PER_BLIND;
  discardsRemaining = MAX_DISCARDS_PER_BLIND;
  phase: GamePhase = GamePhase.Start;

  /** Start a new game */
  newGame(): void {
    this.ante = 1;
    this.blindIdx = 0;
    this.phase = GamePhase.Playing;
    this.resetRound();
  }

  /** Reset per-blind counters */
  resetRound(): void {
    this.currentScore = 0;
    this.handsRemaining = MAX_HANDS_PER_BLIND;
    this.discardsRemaining = MAX_DISCARDS_PER_BLIND;
  }

  get currentBlind(): BlindType {
    return this.blindOrder[this.blindIdx];
  }

  getBlindConfig(): BlindConfig {
    const type = this.currentBlind;
    const anteIdx = Math.min(this.ante - 1, ANTE_SCORES[type].length - 1);
    return {
      type,
      name: BLIND_NAMES[type],
      targetScore: ANTE_SCORES[type][anteIdx],
      rewardGold: BLIND_GOLD[type],
    };
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

  /** Advance to the next blind. Returns true if ante is complete. */
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
