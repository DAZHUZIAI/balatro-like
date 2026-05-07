import { Suit, HandType, Rank } from '../core/CardType.ts';
import type { Card } from '../core/Card.ts';
import { JokerTrigger } from './JokerData.ts';
import type { JokerDefinition } from './JokerData.ts';

export class JokerManager {
  slots: (JokerDefinition | null)[] = [null, null, null, null, null];
  private state = new Map<string, number>();

  add(joker: JokerDefinition): boolean {
    const idx = this.slots.indexOf(null);
    if (idx === -1) return false;
    this.slots[idx] = joker;

    // Initialize runtime state for special jokers
    if (joker.id === 'egg') this.state.set('egg_gold', 0);
    if (joker.id === 'ice_cream') this.state.set('ice_cream_mult', 20);
    if (joker.id === 'ride_the_bus') this.state.set('ride_streak', 0);
    if (joker.id === 'supernova') this.state.set('supernova_counts', 0);
    if (joker.id === 'ramen') this.state.set('ramen_mult', 20);
    if (joker.id === 'matador') this.state.set('hands_this_round', 0);

    return true;
  }

  remove(index: number): JokerDefinition | null {
    const joker = this.slots[index];
    this.slots[index] = null;
    return joker;
  }

  clear(): void {
    this.slots.fill(null);
    this.state.clear();
  }

  get activeJokers(): JokerDefinition[] {
    return this.slots.filter((j): j is JokerDefinition => j !== null);
  }

  /** Get runtime value for a joker state key */
  getState(key: string): number {
    return this.state.get(key) ?? 0;
  }

  setState(key: string, value: number): void {
    this.state.set(key, value);
  }

  // ─── Scoring pipeline ───

  /**
   * Apply joker effects during hand scoring.
   * Called once per hand with the aggregated hand type result.
   */
  applyHandResult(
    handType: HandType,
    chips: number,
    mult: number,
    playedCards: Card[],
    discardsRemaining: number,
  ): { chips: number; mult: number } {
    let c = chips;
    let m = mult;

    // Consume any chips accumulated from discards (Faceless Joker)
    const discardChips = this.state.get('pending_discard_chips') ?? 0;
    this.state.set('pending_discard_chips', 0);
    c += discardChips;

    for (const joker of this.activeJokers) {
      switch (joker.effect.trigger) {
        case JokerTrigger.Passive:
          if (passCondition(joker.effect.condition, { discardsRemaining })) {
            c += joker.effect.chips;
            m = joker.effect.isXMult ? m * Math.max(1, 1 + joker.effect.mult) : m + joker.effect.mult;
          }
          break;

        case JokerTrigger.OnHandScored:
          if (joker.effect.condition === 'per_hand_this_round') {
            const handCount = this.state.get('hands_this_round') ?? 0;
            c += joker.effect.chips * handCount;
            m += joker.effect.mult * handCount;
          } else if (handCondition(joker.effect.condition, handType, { discardsRemaining }, playedCards)) {
            c += joker.effect.chips;
            m += joker.effect.mult;
          }
          break;
      }
    }

    return { chips: c, mult: m };
  }

  /**
   * Apply per-card joker effects. Called for each card in the played hand.
   */
  applyCardScored(
    card: Card,
    chips: number,
    mult: number,
  ): { chips: number; mult: number; gold: number } {
    let c = chips;
    let m = mult;
    let gold = 0;

    for (const joker of this.activeJokers) {
      if (joker.effect.trigger !== JokerTrigger.OnCardScored) continue;

      if (cardCondition(joker.effect.condition, card)) {
        c += joker.effect.chips;
        m += joker.effect.mult;

        // Gold chance (e.g., Business Card)
        if (joker.effect.gold > 0 && Math.random() < 0.5) {
          gold += joker.effect.gold;
        }
      }
    }

    return { chips: c, mult: m, gold };
  }

  /** Called after each hand is played */
  onHandPlayed(): void {
    for (const joker of this.activeJokers) {
      if (joker.effect.trigger === JokerTrigger.OnHandPlayed) {
        if (joker.id === 'ice_cream') {
          const cur = this.state.get('ice_cream_mult') ?? 20;
          this.state.set('ice_cream_mult', Math.max(0, cur - 2));
        }
      }
    }
    // Increment hand counter for per_hand_this_round (Matador)
    const cur = this.state.get('hands_this_round') ?? 0;
    this.state.set('hands_this_round', cur + 1);
  }

  /** Get Ice Cream's current mult value */
  get iceCreamMult(): number {
    return this.state.get('ice_cream_mult') ?? 20;
  }

  /** Get Ramen's current mult value */
  get ramenMult(): number {
    return this.state.get('ramen_mult') ?? 20;
  }

  /** Reset round-scoped state (called when entering a new blind) */
  resetRound(): void {
    this.state.set('hands_this_round', 0);
  }

  /** Called after discarding. Returns gold earned and stores chip bonuses. */
  onDiscard(cardCount: number): { gold: number } {
    let gold = 0;
    for (const joker of this.activeJokers) {
      if (joker.effect.trigger === JokerTrigger.OnDiscard) {
        if (joker.id === 'faceless_joker' && cardCount >= 3) {
          const pending = this.state.get('pending_discard_chips') ?? 0;
          this.state.set('pending_discard_chips', pending + joker.effect.chips);
        }
        if (joker.id === 'trading_card') {
          gold += joker.effect.gold;
        }
        if (joker.id === 'ramen') {
          const cur = this.state.get('ramen_mult') ?? 20;
          this.state.set('ramen_mult', Math.max(0, cur + joker.effect.mult)); // mult is -3
        }
      }
    }
    return { gold };
  }

  /** Called at end of round. Returns gold earned. */
  onRoundEnd(): number {
    let gold = 0;
    for (const joker of this.activeJokers) {
      if (joker.effect.trigger === JokerTrigger.OnRoundEnd) {
        if (joker.id === 'egg') {
          const cur = this.state.get('egg_gold') ?? 0;
          this.state.set('egg_gold', cur + 3);
          gold += 3;
        }
      }
    }
    return gold;
  }
}

// ─── Condition evaluators ───

function passCondition(cond: string, ctx: { discardsRemaining: number }): boolean {
  if (cond === 'always') return true;
  if (cond === 'discards=0') return ctx.discardsRemaining === 0;
  return false;
}

function handCondition(
  cond: string,
  handType: HandType,
  ctx: { discardsRemaining: number },
  playedCards: Card[],
): boolean {
  if (cond === 'always') return true;

  // hand=xyz
  const handMatch = cond.match(/^hand=(.+)$/);
  if (handMatch) return handType === handMatch[1];

  // per_discard_remaining
  if (cond === 'per_discard_remaining') return ctx.discardsRemaining > 0;

  // all_black (Blackboard)
  if (cond === 'all_black') return playedCards.length > 0 && playedCards.every(c => c.suit === Suit.Spades || c.suit === Suit.Clubs);

  // hand=straight_or_flush (Crazy Joker)
  if (cond === 'hand=straight_or_flush') return handType === HandType.Straight || handType === HandType.Flush || handType === HandType.StraightFlush;

  // hand=5cards (Droll Joker)
  if (cond === 'hand=5cards') return playedCards.length === 5;

  // has_stone (Stone Joker)
  if (cond === 'has_stone') return playedCards.some(c => c.enhancement === 'stone');

  return false;
}

function cardCondition(cond: string, card: Card): boolean {
  // suit=xyz
  const suitMatch = cond.match(/^suit=(.+)$/);
  if (suitMatch) return card.suit === suitMatch[1];

  // rank=xyz
  const rankMatch = cond.match(/^rank=(.+)$/);
  if (rankMatch) {
    const rankName = rankMatch[1].toLowerCase();
    const rankNames: Record<string, Rank> = {
      'ace': Rank.Ace, 'jack': Rank.Jack, 'queen': Rank.Queen, 'king': Rank.King,
      '2': Rank.Two, '3': Rank.Three, '4': Rank.Four, '5': Rank.Five,
      '6': Rank.Six, '7': Rank.Seven, '8': Rank.Eight, '9': Rank.Nine, '10': Rank.Ten,
    };
    return card.rank === rankNames[rankName];
  }

  if (cond === 'rank_is_even') return card.rank % 2 === 0;

  if (cond === 'is_enhanced') return card.enhancement != null;

  if (cond === 'no_face_cards') return !isFaceCard(card);

  if (cond === 'is_glass') return card.enhancement === 'glass';

  return false;
}

export function isFaceCard(card: Card): boolean {
  return card.rank >= Rank.Jack && card.rank <= Rank.King;
}
