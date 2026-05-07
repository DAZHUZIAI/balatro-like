/** Joker effect trigger timing */
export enum JokerTrigger {
  /** Always active, flat bonus */
  Passive = 'passive',
  /** Triggers when scoring a specific hand type */
  OnHandScored = 'on_hand_scored',
  /** Triggers for each scored card matching a condition */
  OnCardScored = 'on_card_scored',
  /** Triggers when discarding */
  OnDiscard = 'on_discard',
  /** Triggers on each hand played (regardless of score) */
  OnHandPlayed = 'on_hand_played',
  /** Triggers at end of round */
  OnRoundEnd = 'on_round_end',
}

export interface JokerEffect {
  /** When does this trigger? */
  trigger: JokerTrigger;
  /** Condition: optional string description (evaluated at runtime) */
  condition: string;
  /** Chips added */
  chips: number;
  /** Mult added */
  mult: number;
  /** If true, these are xMult (multiply) instead of +Mult */
  isXMult: boolean;
  /** Gold per trigger */
  gold: number;
}

export interface JokerDefinition {
  id: string;
  name: string;
  description: string;
  effect: JokerEffect;
  /** Cost in shop */
  cost: number;
  /** Rarity: 1=common, 2=uncommon, 3=rare */
  rarity: 1 | 2 | 3;
}

export const MVP_JOKERS: JokerDefinition[] = [
  {
    id: 'joker',
    name: 'Joker',
    description: '+4 Mult',
    cost: 4,
    rarity: 1,
    effect: { trigger: JokerTrigger.Passive, condition: 'always', chips: 0, mult: 4, isXMult: false, gold: 0 },
  },
  {
    id: 'sly_joker',
    name: 'Sly Joker',
    description: '+10 Chips if hand is a Pair',
    cost: 5,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnHandScored, condition: 'hand=pair', chips: 10, mult: 0, isXMult: false, gold: 0 },
  },
  {
    id: 'jolly_joker',
    name: 'Jolly Joker',
    description: '+8 Chips and +8 Mult if hand is a Straight',
    cost: 6,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnHandScored, condition: 'hand=straight', chips: 8, mult: 8, isXMult: false, gold: 0 },
  },
  {
    id: 'greedy_joker',
    name: 'Greedy Joker',
    description: 'Played Diamond cards give +3 Chips',
    cost: 5,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnCardScored, condition: 'suit=diamonds', chips: 3, mult: 0, isXMult: false, gold: 0 },
  },
  {
    id: 'lusty_joker',
    name: 'Lusty Joker',
    description: 'Played Heart cards give +3 Chips',
    cost: 5,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnCardScored, condition: 'suit=hearts', chips: 3, mult: 0, isXMult: false, gold: 0 },
  },
  {
    id: 'wrathful_joker',
    name: 'Wrathful Joker',
    description: 'Played Spade cards give +3 Chips',
    cost: 5,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnCardScored, condition: 'suit=spades', chips: 3, mult: 0, isXMult: false, gold: 0 },
  },
  {
    id: 'gluttonous_joker',
    name: 'Gluttonous Joker',
    description: 'Played Club cards give +3 Chips',
    cost: 5,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnCardScored, condition: 'suit=clubs', chips: 3, mult: 0, isXMult: false, gold: 0 },
  },
  {
    id: 'even_steven',
    name: 'Even Steven',
    description: 'Played cards with even rank give +4 Chips',
    cost: 5,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnCardScored, condition: 'rank_is_even', chips: 4, mult: 0, isXMult: false, gold: 0 },
  },
  {
    id: 'scholar',
    name: 'Scholar',
    description: 'Played Aces give +4 Chips and +4 Mult',
    cost: 5,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnCardScored, condition: 'rank=ace', chips: 4, mult: 4, isXMult: false, gold: 0 },
  },
  {
    id: 'business_card',
    name: 'Business Card',
    description: 'Played Jacks have a 1 in 2 chance to give +$2',
    cost: 6,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnCardScored, condition: 'rank=jack', chips: 0, mult: 0, isXMult: false, gold: 2 },
  },
  {
    id: 'banner',
    name: 'Banner',
    description: '+10 Chips for each remaining discard',
    cost: 6,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnHandScored, condition: 'per_discard_remaining', chips: 10, mult: 0, isXMult: false, gold: 0 },
  },
  {
    id: 'mystic_summit',
    name: 'Mystic Summit',
    description: '+15 Mult when 0 discards remaining',
    cost: 7,
    rarity: 1,
    effect: { trigger: JokerTrigger.Passive, condition: 'discards=0', chips: 0, mult: 15, isXMult: false, gold: 0 },
  },
  {
    id: 'hone',
    name: 'Hone',
    description: 'Played enhanced cards give +3 Chips and +3 Mult',
    cost: 6,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnCardScored, condition: 'is_enhanced', chips: 3, mult: 3, isXMult: false, gold: 0 },
  },
  {
    id: 'egg',
    name: 'Egg',
    description: 'Gains $3 at end of round. Sell to collect accumulated gold.',
    cost: 5,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnRoundEnd, condition: 'always', chips: 0, mult: 0, isXMult: false, gold: 3 },
  },
  {
    id: 'ice_cream',
    name: 'Ice Cream',
    description: '+20 Mult, loses 2 Mult per hand played',
    cost: 5,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnHandPlayed, condition: 'always', chips: 0, mult: -2, isXMult: false, gold: 0 },
  },
  {
    id: 'faceless_joker',
    name: 'Faceless Joker',
    description: '+15 Chips if 3 or more cards are discarded',
    cost: 6,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnDiscard, condition: 'discard_count>=3', chips: 15, mult: 0, isXMult: false, gold: 0 },
  },
  {
    id: 'supernova',
    name: 'Supernova',
    description: '+1 Mult for each time this hand type has been played this run',
    cost: 7,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnHandScored, condition: 'times_hand_played', chips: 0, mult: 1, isXMult: false, gold: 0 },
  },
  {
    id: 'ride_the_bus',
    name: 'Ride the Bus',
    description: '+1 Mult per consecutive hand without a scoring face card, resets on face card scored',
    cost: 6,
    rarity: 1,
    effect: { trigger: JokerTrigger.OnCardScored, condition: 'no_face_cards', chips: 0, mult: 1, isXMult: false, gold: 0 },
  },
];
