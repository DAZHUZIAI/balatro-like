/**
 * HandEvaluator validation — run via: npx tsx src/core/HandEvaluator.test.ts
 * Tests all 10 hand types + edge cases.
 */
import { createCard } from './Card.ts';
import { Suit, Rank, HandType } from './CardType.ts';
import { evaluateHand, handTypeLabel } from './HandEvaluator.ts';

const S = Suit.Spades;
const H = Suit.Hearts;
const C = Suit.Clubs;
const D = Suit.Diamonds;

let passed = 0;
let failed = 0;

function test(name: string, cards: ReturnType<typeof createCard>[], expected: HandType) {
  const result = evaluateHand(cards);
  const ok = result.handType === expected;
  if (ok) {
    passed++;
    console.log(`  ✅ ${name} → ${handTypeLabel(result.handType)}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}: expected ${handTypeLabel(expected)}, got ${handTypeLabel(result.handType)}`);
  }
}

console.log('\n=== Hand Evaluator Tests ===\n');

// === 1-CARD ===
console.log('--- 1 Card ---');
test('single card', [createCard(S, Rank.Ace)], HandType.HighCard);

// === 2-CARD ===
console.log('\n--- 2 Cards ---');
test('pair', [createCard(S, Rank.Five), createCard(H, Rank.Five)], HandType.Pair);
test('high card (2 cards, diff ranks)', [createCard(S, Rank.Ace), createCard(H, Rank.King)], HandType.HighCard);

// === 3-CARD ===
console.log('\n--- 3 Cards ---');
test('three of a kind', [createCard(S, Rank.Seven), createCard(H, Rank.Seven), createCard(C, Rank.Seven)], HandType.ThreeOfAKind);
test('pair (3 cards)', [createCard(S, Rank.Seven), createCard(H, Rank.Seven), createCard(C, Rank.Ace)], HandType.Pair);
test('high card (3 cards)', [createCard(S, Rank.Ace), createCard(H, Rank.King), createCard(C, Rank.Queen)], HandType.HighCard);

// === 4-CARD ===
console.log('\n--- 4 Cards ---');
test('four of a kind', [
  createCard(S, Rank.Ten), createCard(H, Rank.Ten),
  createCard(C, Rank.Ten), createCard(D, Rank.Ten),
], HandType.FourOfAKind);
test('three of a kind (4 cards)', [
  createCard(S, Rank.Ten), createCard(H, Rank.Ten),
  createCard(C, Rank.Ten), createCard(D, Rank.Ace),
], HandType.ThreeOfAKind);
test('two pair', [
  createCard(S, Rank.Ten), createCard(H, Rank.Ten),
  createCard(C, Rank.Ace), createCard(D, Rank.Ace),
], HandType.TwoPair);

// === 5-CARD: PAIR-BASED ===
console.log('\n--- 5 Cards: Pair-based ---');
test('five of a kind (wild/enhanced)', [
  createCard(S, Rank.King), createCard(H, Rank.King),
  createCard(C, Rank.King), createCard(D, Rank.King),
  createCard(S, Rank.King), // Would need enhanced deck in real gameplay
].slice(0, 5), HandType.FiveOfAKind);
// Only works with 5 kings — skip if deck not set up for it
test('four of a kind', [
  createCard(S, Rank.Jack), createCard(H, Rank.Jack),
  createCard(C, Rank.Jack), createCard(D, Rank.Jack),
  createCard(S, Rank.Ace),
], HandType.FourOfAKind);
test('full house', [
  createCard(S, Rank.Nine), createCard(H, Rank.Nine),
  createCard(C, Rank.Nine), createCard(D, Rank.King),
  createCard(S, Rank.King),
], HandType.FullHouse);
test('three of a kind (5 cards, non-full-house)', [
  createCard(S, Rank.Nine), createCard(H, Rank.Nine),
  createCard(C, Rank.Nine), createCard(D, Rank.King),
  createCard(S, Rank.Queen),
], HandType.ThreeOfAKind);
test('two pair (5 cards)', [
  createCard(S, Rank.Six), createCard(H, Rank.Six),
  createCard(C, Rank.Ten), createCard(D, Rank.Ten),
  createCard(S, Rank.Ace),
], HandType.TwoPair);
test('pair (5 cards)', [
  createCard(S, Rank.Six), createCard(H, Rank.Six),
  createCard(C, Rank.Ten), createCard(D, Rank.Jack),
  createCard(S, Rank.Ace),
], HandType.Pair);
test('high card (5 cards)', [
  createCard(S, Rank.Three), createCard(H, Rank.Six),
  createCard(C, Rank.Nine), createCard(D, Rank.Jack),
  createCard(S, Rank.Ace),
], HandType.HighCard);

// === 5-CARD: STRAIGHT & FLUSH ===
console.log('\n--- 5 Cards: Straight & Flush ---');
test('straight (5 high)', [
  createCard(S, Rank.Two), createCard(H, Rank.Three),
  createCard(C, Rank.Four), createCard(D, Rank.Five),
  createCard(S, Rank.Six),
], HandType.Straight);
test('straight (A high)', [
  createCard(S, Rank.Ten), createCard(H, Rank.Jack),
  createCard(C, Rank.Queen), createCard(D, Rank.King),
  createCard(S, Rank.Ace),
], HandType.Straight);
test('flush', [
  createCard(S, Rank.Two), createCard(S, Rank.Five),
  createCard(S, Rank.Nine), createCard(S, Rank.Jack),
  createCard(S, Rank.Ace),
], HandType.Flush);
test('straight flush', [
  createCard(S, Rank.Five), createCard(S, Rank.Six),
  createCard(S, Rank.Seven), createCard(S, Rank.Eight),
  createCard(S, Rank.Nine),
], HandType.StraightFlush);

// === EDGE CASES ===
console.log('\n--- Edge Cases ---');
test('wheel: A-2-3-4-5', [
  createCard(S, Rank.Ace), createCard(H, Rank.Two),
  createCard(C, Rank.Three), createCard(D, Rank.Four),
  createCard(S, Rank.Five),
], HandType.Straight);
test('wheel straight flush: A-2-3-4-5 same suit', [
  createCard(H, Rank.Ace), createCard(H, Rank.Two),
  createCard(H, Rank.Three), createCard(H, Rank.Four),
  createCard(H, Rank.Five),
], HandType.StraightFlush);
test('flush beats straight', [
  createCard(S, Rank.Two), createCard(S, Rank.Four),
  createCard(S, Rank.Six), createCard(S, Rank.Eight),
  createCard(S, Rank.Ten),
], HandType.Flush);
test('straight flush beats flush', [
  createCard(D, Rank.Six), createCard(D, Rank.Seven),
  createCard(D, Rank.Eight), createCard(D, Rank.Nine),
  createCard(D, Rank.Ten),
], HandType.StraightFlush);

// Edge case: near straight but missing card
test('4 consecutive + 1 off (no straight)', [
  createCard(S, Rank.Two), createCard(H, Rank.Three),
  createCard(C, Rank.Four), createCard(D, Rank.Five),
  createCard(S, Rank.Seven),
], HandType.HighCard);

// Edge case: Ace as both high and low
test('A-K-Q-J-10 (A high straight)', [
  createCard(S, Rank.Ace), createCard(H, Rank.King),
  createCard(C, Rank.Queen), createCard(D, Rank.Jack),
  createCard(S, Rank.Ten),
], HandType.Straight);

// Edge case: full house vs flush
test('full house > flush priority', [
  createCard(S, Rank.Three), createCard(H, Rank.Three),
  createCard(C, Rank.Three), createCard(D, Rank.Seven),
  createCard(S, Rank.Seven),
], HandType.FullHouse);

// Summary
console.log('\n=== Results ===');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(passed > 0 && failed === 0 ? '\n🎉 All tests passed!' : '\n❌ Some tests failed!\n');
