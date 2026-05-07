export enum Suit {
  Spades = 'spades',
  Hearts = 'hearts',
  Clubs = 'clubs',
  Diamonds = 'diamonds',
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: '♠',
  [Suit.Hearts]: '♥',
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
};

export const SUIT_COLORS: Record<Suit, string> = {
  [Suit.Spades]: '#1a1a2e',
  [Suit.Hearts]: '#e63946',
  [Suit.Clubs]: '#1a1a2e',
  [Suit.Diamonds]: '#e63946',
};

/** Rank: 2-10, J, Q, K, A */
export enum Rank {
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
}

export const RANK_LABELS: Record<Rank, string> = {
  [Rank.Two]: '2',
  [Rank.Three]: '3',
  [Rank.Four]: '4',
  [Rank.Five]: '5',
  [Rank.Six]: '6',
  [Rank.Seven]: '7',
  [Rank.Eight]: '8',
  [Rank.Nine]: '9',
  [Rank.Ten]: '10',
  [Rank.Jack]: 'J',
  [Rank.Queen]: 'Q',
  [Rank.King]: 'K',
  [Rank.Ace]: 'A',
};

/** Chip value contributed when scoring */
export const RANK_CHIPS: Record<Rank, number> = {
  [Rank.Two]: 2,
  [Rank.Three]: 3,
  [Rank.Four]: 4,
  [Rank.Five]: 5,
  [Rank.Six]: 6,
  [Rank.Seven]: 7,
  [Rank.Eight]: 8,
  [Rank.Nine]: 9,
  [Rank.Ten]: 10,
  [Rank.Jack]: 10,
  [Rank.Queen]: 10,
  [Rank.King]: 10,
  [Rank.Ace]: 11,
};

export const ALL_SUITS = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];
export const ALL_RANKS = [
  Rank.Two, Rank.Three, Rank.Four, Rank.Five,
  Rank.Six, Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
  Rank.Jack, Rank.Queen, Rank.King, Rank.Ace,
];

export enum HandType {
  HighCard = 'high_card',
  Pair = 'pair',
  TwoPair = 'two_pair',
  ThreeOfAKind = 'three_of_a_kind',
  Straight = 'straight',
  Flush = 'flush',
  FullHouse = 'full_house',
  FourOfAKind = 'four_of_a_kind',
  StraightFlush = 'straight_flush',
  FiveOfAKind = 'five_of_a_kind',
}

export interface HandScore {
  handType: HandType;
  chips: number;
  mult: number;
}
