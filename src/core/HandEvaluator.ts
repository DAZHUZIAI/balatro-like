import type { Card } from './Card.ts';
import { HandType, Suit, Rank } from './CardType.ts';
import { HAND_BASE_CHIPS, HAND_BASE_MULT } from '../utils/Constants.ts';
import type { HandScore } from './CardType.ts';

export interface HandResult {
  handType: HandType;
  score: HandScore;
  /** Primary scoring cards (e.g., the pair in a pair, the straight cards) */
  scoringCards: Card[];
}

/**
 * Evaluate up-to-5 selected cards and return the best hand.
 * Cards must be unique (no duplicates).
 */
export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length === 0) {
    return {
      handType: HandType.HighCard,
      score: { handType: HandType.HighCard, chips: 0, mult: 1 },
      scoringCards: [],
    };
  }

  const n = cards.length;

  // 1 card → always High Card
  if (n === 1) {
    return makeResult(HandType.HighCard, cards);
  }

  // Group by rank
  const groups = groupByRank(cards);

  // Check special hands based on group counts
  const counts = groups.map(g => g.cards.length).sort((a, b) => b - a);
  const maxCount = counts[0];

  // 2 cards
  if (n === 2) {
    if (maxCount === 2) return makeResult(HandType.Pair, cards);
    return makeResult(HandType.HighCard, cards);
  }

  // 3 cards
  if (n === 3) {
    if (maxCount === 3) return makeResult(HandType.ThreeOfAKind, cards);
    if (maxCount === 2) return makeResult(HandType.Pair, cards);
    return makeResult(HandType.HighCard, cards);
  }

  // 4 cards
  if (n === 4) {
    if (maxCount === 4) return makeResult(HandType.FourOfAKind, cards);
    if (maxCount === 3) return makeResult(HandType.ThreeOfAKind, cards);
    if (maxCount === 2 && counts.filter(c => c === 2).length === 2) {
      return makeResult(HandType.TwoPair, cards);
    }
    if (maxCount === 2) return makeResult(HandType.Pair, cards);
    return makeResult(HandType.HighCard, cards);
  }

  // 5 cards — full poker evaluation
  const isFlush = checkFlush(cards);
  const straightRank = findStraightRank(cards);
  const isStraight = straightRank !== null;

  // Five of a kind (with wilds/enhancers)
  if (maxCount === 5) {
    return makeResult(HandType.FiveOfAKind, cards);
  }

  // Straight flush
  if (isStraight && isFlush) {
    return makeResult(HandType.StraightFlush, cards);
  }

  // Four of a kind
  if (maxCount === 4) {
    return makeResult(HandType.FourOfAKind, cards);
  }

  // Full house (3 + 2)
  if (counts.length === 2 && counts[0] === 3 && counts[1] === 2) {
    return makeResult(HandType.FullHouse, cards);
  }

  // Flush
  if (isFlush) {
    return makeResult(HandType.Flush, cards);
  }

  // Straight
  if (isStraight) {
    return makeResult(HandType.Straight, cards);
  }

  // Three of a kind
  if (maxCount === 3) {
    return makeResult(HandType.ThreeOfAKind, cards);
  }

  // Two pair
  if (counts.filter(c => c === 2).length === 2) {
    return makeResult(HandType.TwoPair, cards);
  }

  // Pair
  if (maxCount === 2) {
    return makeResult(HandType.Pair, cards);
  }

  return makeResult(HandType.HighCard, cards);
}

function makeResult(handType: HandType, cards: Card[]): HandResult {
  return {
    handType,
    score: {
      handType,
      chips: HAND_BASE_CHIPS[handType] ?? 0,
      mult: HAND_BASE_MULT[handType] ?? 1,
    },
    scoringCards: cards,
  };
}

interface RankGroup {
  rank: Rank;
  cards: Card[];
}

function groupByRank(cards: Card[]): RankGroup[] {
  const map = new Map<Rank, Card[]>();
  for (const c of cards) {
    if (!map.has(c.rank)) map.set(c.rank, []);
    map.get(c.rank)!.push(c);
  }
  return [...map.entries()]
    .map(([rank, cards]) => ({ rank, cards }))
    .sort((a, b) => b.cards.length - a.cards.length || b.rank - a.rank);
}

function checkFlush(cards: Card[]): boolean {
  if (cards.length < 5) return false;
  const suit = cards[0].suit;
  return cards.every(c => c.suit === suit);
}

/**
 * Check if cards form a straight. Returns the high rank of the straight,
 * or null if not a straight.
 */
function findStraightRank(cards: Card[]): Rank | null {
  if (cards.length < 5) return null;

  const uniqueRanks = [...new Set(cards.map(c => c.rank))];
  if (uniqueRanks.length < 5) return null;

  const sorted = uniqueRanks.sort((a, b) => b - a);

  // Normal straight: 5 consecutive ranks
  for (let i = 0; i <= sorted.length - 5; i++) {
    if (sorted[i] - sorted[i + 4] === 4) {
      return sorted[i];
    }
  }

  // Wheel: A-2-3-4-5 (A=14, but straight uses A as low)
  if (sorted.includes(Rank.Ace) &&
      sorted.includes(Rank.Two) &&
      sorted.includes(Rank.Three) &&
      sorted.includes(Rank.Four) &&
      sorted.includes(Rank.Five)) {
    return Rank.Five; // 5 is the high card of the wheel
  }

  return null;
}

/** String label for a hand type (for console display) */
export function handTypeLabel(ht: HandType): string {
  const labels: Record<HandType, string> = {
    [HandType.HighCard]: 'High Card',
    [HandType.Pair]: 'Pair',
    [HandType.TwoPair]: 'Two Pair',
    [HandType.ThreeOfAKind]: 'Three of a Kind',
    [HandType.Straight]: 'Straight',
    [HandType.Flush]: 'Flush',
    [HandType.FullHouse]: 'Full House',
    [HandType.FourOfAKind]: 'Four of a Kind',
    [HandType.StraightFlush]: 'Straight Flush',
    [HandType.FiveOfAKind]: 'Five of a Kind',
  };
  return labels[ht];
}
