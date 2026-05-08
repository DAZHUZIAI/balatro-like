/** Boss blind debuff that applies during the round */
export interface BossEffect {
  id: string;
  name: string;
  description: string;
  minAnte: number;
  /** Modify target score multiplier (e.g. 1.5 = 50% harder) */
  targetMultiplier?: number;
  /** Override hands per blind (e.g. 2 for fewer) */
  handsOverride?: number;
  /** Override discards per blind */
  discardsOverride?: number;
  /** Suits that are debuffed (score 0 chips) */
  debuffedSuits?: string[];
  /** If true, must play exactly 5 cards */
  requireExactFive?: boolean;
  /** If true, after each hand discard 1 random card from hand */
  randomDiscardAfterPlay?: boolean;
  /** If true, reduces hand level by 1 after each played hand */
  reduceHandLevel?: boolean;
}

export const BOSS_POOL: BossEffect[] = [
  {
    id: 'the_hook',
    name: 'The Hook',
    description: 'After each hand, discard 1 random card from hand',
    minAnte: 2,
    randomDiscardAfterPlay: true,
  },
  {
    id: 'the_wall',
    name: 'The Wall',
    description: 'Score target increased 2×',
    minAnte: 3,
    targetMultiplier: 2,
  },
  {
    id: 'the_flint',
    name: 'The Flint',
    description: '-1 hand, -1 discard per round',
    minAnte: 4,
    handsOverride: 3,
    discardsOverride: 2,
  },
  {
    id: 'the_mark',
    name: 'The Mark',
    description: '♥ and ♦ cards score 0 chips',
    minAnte: 6,
    debuffedSuits: ['hearts', 'diamonds'],
  },
  {
    id: 'the_arm',
    name: 'The Arm',
    description: 'Reduce hand level by 1 after each played hand',
    minAnte: 7,
    reduceHandLevel: true,
  },
  {
    id: 'the_mouth',
    name: 'The Mouth',
    description: 'Must play exactly 5 cards',
    minAnte: 8,
    requireExactFive: true,
  },
];

/** Get boss effect for a given ante number. Returns null if ante < 2 */
export function getBossForAnte(ante: number): BossEffect | null {
  if (ante < 2) return null;
  // Cycle through bosses, picking one based on ante
  const eligible = BOSS_POOL.filter(b => ante >= b.minAnte);
  if (eligible.length === 0) return null;
  // Use deterministic selection based on ante to avoid changing boss on reload
  const idx = (ante - 2) % eligible.length;
  return eligible[idx];
}

/** Skip reward types */
export type SkipRewardType = 'gold_small' | 'gold_medium' | 'bonus_hand' | 'bonus_discard';

export interface SkipReward {
  type: SkipRewardType;
  label: string;
  goldAmount?: number;
}

const SKIP_REWARDS: SkipReward[] = [
  { type: 'gold_small', label: '+$3', goldAmount: 3 },
  { type: 'gold_medium', label: '+$5', goldAmount: 5 },
  { type: 'bonus_hand', label: '+1 Hand next round' },
  { type: 'bonus_discard', label: '+1 Discard next round' },
];

export function randomSkipReward(): SkipReward {
  return SKIP_REWARDS[Math.floor(Math.random() * SKIP_REWARDS.length)];
}
