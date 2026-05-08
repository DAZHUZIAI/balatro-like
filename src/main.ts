import { CANVAS_WIDTH, CANVAS_HEIGHT, CARD_WIDTH, CARD_HEIGHT } from './utils/Constants.ts';
import { DeckManager } from './gameplay/DeckManager.ts';
import { RoundManager, MAX_HANDS_PER_BLIND, MAX_DISCARDS_PER_BLIND, BlindType } from './gameplay/RoundManager.ts';
import { ShopManager } from './gameplay/ShopManager.ts';
import { JokerManager, isFaceCard } from './gameplay/JokerManager.ts';
import { drawCardFaceAt, getFanPosition, roundRect } from './ui/CardRenderer.ts';
import { evaluateHand, handTypeLabel } from './core/HandEvaluator.ts';
import { startPlayAnimation, update, renderAnimations, isAnimating } from './ui/Animations.ts';
import type { Card } from './core/Card.ts';
import type { TarotDef } from './gameplay/TarotData.ts';
import { RANK_LABELS, SUIT_SYMBOLS } from './core/CardType.ts';
import { applyEnhancement, isStone, isGlass } from './core/Card.ts';
import { HandLevelManager } from './gameplay/HandLevelManager.ts';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// ─── Core State ───
const deck = new DeckManager();
const round = new RoundManager();
const shop = new ShopManager();
const jokers = new JokerManager();
const handLevels = new HandLevelManager();
let hand: Card[] = [];
const selected = new Set<string>();
const MAX_SELECT = 5;

// ─── UI State ───
let phase: 'playing' | 'shop' | 'game_over' | 'blind_select' = 'playing';
let pendingNewAnte = false;

// ─── Tarot State ───
let tarotInventory: TarotDef[] = [];
let tarotApplyMode: { tarot: TarotDef } | null = null;

// ─── Blind Selection State ───
let selectedBlindType: BlindType | null = null;
let skipMessage = '';

// ─── Button geometry ───
const B = {
  USE_TAROT: { x: CANVAS_WIDTH / 2 - 55, y: 96, w: 110, h: 26 },
  PLAY: { x: CANVAS_WIDTH / 2 - 75, y: 132, w: 150, h: 44 },
  DISCARD: { x: CANVAS_WIDTH / 2 - 60, y: 186, w: 120, h: 38 },
  TAROT_CANCEL: { x: CANVAS_WIDTH / 2 - 50, y: 380, w: 100, h: 32 },
  SHOP_NEXT: { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 100, w: 140, h: 40 },
  SHOP_REROLL: { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 150, w: 140, h: 40 },
  GAME_RESTART: { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 120, w: 140, h: 44 },
  // Blind select
  BLIND_CARD_1: { x: 80, y: 130, w: 190, h: 260 },
  BLIND_CARD_2: { x: 305, y: 130, w: 190, h: 260 },
  BLIND_CARD_3: { x: 530, y: 130, w: 190, h: 260 },
  BLIND_CONFIRM: { x: CANVAS_WIDTH / 2 - 80, y: 420, w: 160, h: 40 },
  BLIND_SKIP: { x: CANVAS_WIDTH / 2 - 60, y: 480, w: 120, h: 32 },
};

const BLIND_POSITIONS = [B.BLIND_CARD_1, B.BLIND_CARD_2, B.BLIND_CARD_3];

const handFanBaseY = CANVAS_HEIGHT - CARD_HEIGHT / 2 - 50;

let shopBtnRects: { x: number; y: number; w: number; h: number; index: number }[] = [];
let jokerSlotRects: { x: number; y: number; w: number; h: number; index: number }[] = [];

// ─── Game Flow ───

function startGame() {
  deck.init();
  deck.shuffle();
  round.newGame();
  shop.gold = 0;
  jokers.clear();
  handLevels.reset();
  tarotInventory = [];
  tarotApplyMode = null;
  shop.generate();
  pendingNewAnte = false;
  selectedBlindType = null;
  skipMessage = '';
  phase = 'blind_select';
  console.log(`%c=== NEW GAME ===`, 'color: #ffd700; font-weight: bold');
}

function dealNewHand() {
  if (deck.remaining < 8) deck.recycle();
  hand = deck.deal(8);
  selected.clear();
}

function playHand() {
  if (selected.size === 0 || isAnimating() || phase !== 'playing') return;
  if (round.handsRemaining <= 0) return;

  const playedCards = hand.filter(c => selected.has(c.id));
  const result = evaluateHand(playedCards);

  // Use leveled base chips/mult
  let chips = handLevels.getBaseChips(result.handType);
  let mult = handLevels.getBaseMult(result.handType);
  const handLevel = handLevels.getLevel(result.handType);

  // ─── Joker pipeline ───
  // 1. Per-card joker effects + enhancement bonuses
  let goldFromCards = 0;
  const brokenGlass: string[] = [];
  const boss = round.getBossEffect();
  const debuffedSuits = boss?.debuffedSuits ?? [];
  for (const card of playedCards) {
    const isDebuffed = debuffedSuits.includes(card.suit);

    // The Mark: debuffed cards contribute nothing from enhancements
    if (isDebuffed) {
      // Joker effects still apply (check independent conditions)
      const cardResult = jokers.applyCardScored(card, 0, 0);
      mult += cardResult.mult;
      goldFromCards += cardResult.gold;
      // No chip contribution from debuffed cards
      continue;
    }

    // Joker card-scored effects
    const cardResult = jokers.applyCardScored(card, 0, 0);
    chips += cardResult.chips;
    mult += cardResult.mult;
    goldFromCards += cardResult.gold;

    // Stone card: +30 chips
    if (isStone(card)) {
      chips += 30;
    }

    // Glass card: x2 mult, 1-in-6 chance to break
    if (isGlass(card)) {
      mult *= 2;
      if (Math.random() < 1 / 6) {
        brokenGlass.push(card.id);
      }
    }
  }

  // 2. No-face-card check for Ride the Bus
  const hasFaceCard = playedCards.some(isFaceCard);
  if (hasFaceCard) {
    jokers.setState('ride_streak', 0);
  }

  // 3. Hand-level joker effects (includes Ice Cream's base mult)
  let iceCreamBonus = jokers.iceCreamMult;
  // Ice Cream's effect is: +iceCreamMult mult, but description says +20 mult
  // It applies as part of the Passive trigger, but we handle it via state
  if (jokers.activeJokers.some(j => j.id === 'ice_cream')) {
    mult += iceCreamBonus;
  }

  // Ramen: +ramenMult mult (decays on discard)
  if (jokers.activeJokers.some(j => j.id === 'ramen')) {
    mult += jokers.ramenMult;
  }

  const modified = jokers.applyHandResult(
    result.handType, chips, mult, playedCards, round.discardsRemaining,
  );
  chips = modified.chips;
  mult = modified.mult;

  // 4. Supernova: +1 mult per time this hand type was played
  const supernova = jokers.activeJokers.find(j => j.id === 'supernova');
  if (supernova) {
    const count = jokers.getState('supernova_counts');
    mult += count;
    jokers.setState('supernova_counts', count + 1);
  }

  // 5. Ride the Bus: +1 mult per consecutive hand without face card
  const rideBus = jokers.activeJokers.find(j => j.id === 'ride_the_bus');
  if (rideBus && !hasFaceCard) {
    const streak = jokers.getState('ride_streak');
    mult += streak;
    jokers.setState('ride_streak', streak + 1);
  }

  // 6. Banner: +10 chips per remaining discard
  const banner = jokers.activeJokers.find(j => j.id === 'banner');
  if (banner) {
    chips += banner.effect.chips * round.discardsRemaining;
  }

  const score = chips * mult;
  const beaten = round.playHand(score);

  // Gold from Business Card
  if (goldFromCards > 0) {
    shop.earn(goldFromCards);
  }

  const handType = handTypeLabel(result.handType);
  const fromPositions = playedCards.map(c => {
    const idx = hand.indexOf(c);
    return getFanPosition(idx, hand.length, CANVAS_WIDTH / 2, handFanBaseY, 480);
  });

  // Remove played cards, draw replacements
  hand = hand.filter(c => !selected.has(c.id));
  const replacements = deck.deal(playedCards.length);
  hand.push(...replacements);
  selected.clear();

  // Destroy broken glass cards permanently
  for (const id of brokenGlass) {
    deck.removeCardFromGame(id);
    console.log(`💔 Glass card shattered!`);
  }

  // ─── Joker post-hand effects ───
  jokers.onHandPlayed();

  console.log(`%c[PLAY] ${handType} ${chips}×${mult}=${score} (${round.currentScore}/${round.getBlindConfig().targetScore})`,
    beaten ? 'color: #4caf50; font-weight: bold' : 'color: gold');

  startPlayAnimation(playedCards, fromPositions, handType, chips, mult, handLevel, () => {
    // Boss: The Hook — discard 1 random card from hand after each play
    if (boss?.randomDiscardAfterPlay && hand.length > 0) {
      const randomIdx = Math.floor(Math.random() * hand.length);
      const removed = hand.splice(randomIdx, 1)[0];
      deck.discard(removed);
      console.log(`🎣 The Hook: discarded ${RANK_LABELS[removed.rank]}${SUIT_SYMBOLS[removed.suit]}`);
    }

    // Boss: The Arm — reduce hand level by 1 after each played hand
    if (boss?.reduceHandLevel) {
      const cur = handLevels.getLevel(result.handType);
      const newLevel = handLevels.reduceLevel(result.handType);
      console.log(`💪 The Arm: ${result.handType} reduced to Lv.${newLevel} (was Lv.${cur})`);
    }

    if (beaten) {
      onBlindBeaten();
    } else if (round.isOutOfHands) {
      onGameOver();
    }
  });
}

function discardSelected() {
  if (selected.size === 0 || round.discardsRemaining <= 0 || isAnimating() || phase !== 'playing') return;

  const count = selected.size;
  const discarded = hand.filter(c => selected.has(c.id));
  deck.discard(...discarded);
  hand = hand.filter(c => !selected.has(c.id));
  const replacements = deck.deal(count);
  hand.push(...replacements);
  selected.clear();
  round.discardsRemaining--;

  // Joker on-discard effects
  const { gold: discardGold } = jokers.onDiscard(count);
  if (discardGold > 0) {
    shop.earn(discardGold);
  }

  console.log(`[DISCARD] ${count} cards. Discards left: ${round.discardsRemaining}${discardGold > 0 ? ` (+$${discardGold})` : ''}`);
}

function onBlindBeaten() {
  const gold = round.collectReward();
  pendingNewAnte = round.advanceBlind();

  // End-of-round joker effects
  const jokerGold = jokers.onRoundEnd();

  shop.earn(gold + jokerGold);
  shop.generate();
  phase = 'shop';
  console.log(`%c🎉 BLIND BEATEN! +$${gold}${jokerGold > 0 ? ` (+$${jokerGold} from jokers)` : ''}`,
    'color: #4caf50; font-weight: bold');
  if (pendingNewAnte) {
    console.log(`%c⬆ ANTE ${round.ante}!`, 'color: #ffd700; font-weight: bold');
  }
}

function onGameOver() {
  phase = 'game_over';
  console.log('%c💀 GAME OVER', 'color: #e63946; font-weight: bold; font-size: 16px');
  console.log(`Ante ${round.ante} — ${round.getBlindConfig().name}`);
}

function buyShopItem(index: number) {
  const item = shop.items[index];
  if (!item) return;
  if (!shop.purchase(index)) return;

  // Check if this is a joker
  if (item.jokerDef) {
    if (jokers.add(item.jokerDef)) {
      console.log(`🃏 Bought joker: ${item.name}`);
    } else {
      // No slot available, refund
      shop.gold += item.cost;
      console.log('No joker slots available!');
    }
    return;
  }

  // Check if this is a tarot card
  if (item.tarotDef) {
    tarotInventory.push(item.tarotDef);
    console.log(`🔮 Bought tarot: ${item.name}`);
    return;
  }

  // Check if this is a planet card
  if (item.planetDef) {
    const planet = item.planetDef;
    const newLevel = handLevels.levelUp(planet.handType);
    console.log(`🪐 Bought planet: ${planet.name} — ${planet.description} now Lv.${newLevel}`);
    return;
  }

  // Utility items
  switch (item.id) {
    case 'add_hand':
      round.handsRemaining = Math.min(round.handsRemaining + 1, 10);
      break;
    case 'add_discard':
      round.discardsRemaining = Math.min(round.discardsRemaining + 1, 10);
      break;
    case 'remove_card':
      deck.init();
      deck.shuffle();
      break;
    case 'bonus_gold':
      shop.earn(3);
      break;
  }

  console.log(`🛒 Bought: ${item.name} ($-${item.cost})`);
}

function exitShop() {
  jokers.resetRound();
  round.resetRound();
  selectedBlindType = null;
  skipMessage = '';
  phase = 'blind_select';
}

// ─── Tarot functions ───

function enterTarotMode(): void {
  if (tarotInventory.length === 0) return;
  tarotApplyMode = { tarot: tarotInventory[0] };
}

function cancelTarotMode(): void {
  tarotApplyMode = null;
}

function applyTarotToCard(cardId: string): boolean {
  const mode = tarotApplyMode;
  if (!mode) return false;
  const idx = hand.findIndex(c => c.id === cardId);
  if (idx === -1) return false;
  hand[idx] = applyEnhancement(hand[idx], mode.tarot.enhancement);
  tarotInventory = tarotInventory.filter(t => t.id !== mode.tarot.id);
  console.log(`🔮 Applied ${mode.tarot.name} (${mode.tarot.enhancement})`);
  tarotApplyMode = null;
  return true;
}

// ─── Blind Selection ───

function selectBlind(type: BlindType): void {
  selectedBlindType = type;
  skipMessage = '';
}

function confirmBlindSelection(): void {
  if (!selectedBlindType) return;
  round.selectBlind(selectedBlindType);

  // Apply any pending skip reward from previous skip
  const reward = round.applySkipReward();
  if (reward.gold > 0) shop.earn(reward.gold);
  if (reward.extraHands > 0) round.handsRemaining += reward.extraHands;
  if (reward.extraDiscards > 0) round.discardsRemaining += reward.extraDiscards;

  dealNewHand();
  phase = 'playing';
  const boss = round.getBossEffect();
  if (boss) {
    console.log(`%c👹 BOSS: ${boss.name} — ${boss.description}`, 'color: #e63946; font-weight: bold');
  }
  console.log(`%c=== ${round.blindLabel} — target ${round.getBlindConfig().targetScore} ===`, 'color: #ffd700; font-weight: bold');
}

function handleSkipBlind(): void {
  const reward = round.skipBlind();
  selectedBlindType = null;
  // Apply gold immediately
  if (reward.goldAmount && reward.goldAmount > 0) {
    shop.earn(reward.goldAmount);
  }
  skipMessage = `Skipped! Reward: ${reward.label}`;
  console.log(`⏭️ Skipped blind — reward: ${reward.label}`);
}

// ─── Rendering ───

function renderScoreBar(y: number, current: number, target: number) {
  const barW = CANVAS_WIDTH - 40;
  const barH = 20;
  const x = 20;

  ctx.fillStyle = '#1a1a2e';
  roundRect(ctx, x, y, barW, barH, 6);
  ctx.fill();

  const progress = Math.min(current / target, 1);
  if (progress > 0) {
    const grad = ctx.createLinearGradient(x, y, x + barW * progress, y);
    grad.addColorStop(0, '#4caf50');
    grad.addColorStop(1, '#8bc34a');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barW * progress, barH, 6);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, barW, barH, 6);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.min(current, target)} / ${target}`, x + barW / 2, y + barH / 2);
  ctx.textBaseline = 'alphabetic';
}

/** Render joker slots on the right side */
function renderJokerSlots() {
  const slotW = 140;
  const slotH = 36;
  const startX = CANVAS_WIDTH - slotW - 10;
  const startY = 90;
  const gap = 4;

  jokerSlotRects = [];

  // Title
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('JOKERS', CANVAS_WIDTH - 10, startY - 4);

  for (let i = 0; i < 5; i++) {
    const y = startY + i * (slotH + gap);
    const joker = jokers.slots[i];
    jokerSlotRects.push({ x: startX, y, w: slotW, h: slotH, index: i });

    if (joker) {
      // Filled slot
      ctx.fillStyle = '#1a1a2e';
      ctx.strokeStyle = 'rgba(255,215,0,0.4)';
      ctx.lineWidth = 1;
      roundRect(ctx, startX, y, slotW, slotH, 6);
      ctx.fill();
      ctx.stroke();

      // Joker name
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(joker.name, startX + 8, y + 14);

      // Description
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px monospace';
      ctx.fillText(joker.description, startX + 8, y + 28);

      // Ice cream special display
      if (joker.id === 'ice_cream') {
        ctx.fillStyle = '#64b5f6';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${jokers.iceCreamMult}m`, startX + slotW - 8, y + 14);
      }

      // Egg special display
      if (joker.id === 'egg') {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`$${jokers.getState('egg_gold')}`, startX + slotW - 8, y + 14);
      }
    } else {
      // Empty slot
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      roundRect(ctx, startX, y, slotW, slotH, 6);
      ctx.stroke();
    }
  }
}

function render() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#0d5c2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (phase === 'playing') renderPlayScene();
  else if (phase === 'shop') renderShopScene();
  else if (phase === 'game_over') renderGameOverScene();
  else if (phase === 'blind_select') renderBlindSelectScene();
}

/** Horizontal joker slots row for play scene */
function renderJokerRow() {
  const slotW = 90;
  const slotH = 24;
  const gap = 4;
  const totalW = 5 * slotW + 4 * gap;
  const startX = (CANVAS_WIDTH - totalW) / 2;
  const y = 38;

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('JOKERS', CANVAS_WIDTH / 2, y - 4);

  for (let i = 0; i < 5; i++) {
    const x = startX + i * (slotW + gap);
    const joker = jokers.slots[i];

    if (joker) {
      ctx.fillStyle = '#1a1a2e';
      ctx.strokeStyle = 'rgba(255,215,0,0.4)';
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, slotW, slotH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(joker.name, x + 5, y + 10);

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '7px monospace';
      ctx.fillText(joker.description.substring(0, 16), x + 5, y + 19);

      // Special state displays
      ctx.textAlign = 'right';
      ctx.font = 'bold 8px monospace';
      if (joker.id === 'ice_cream') {
        ctx.fillStyle = '#64b5f6';
        ctx.fillText(`${jokers.iceCreamMult}m`, x + slotW - 4, y + 10);
      } else if (joker.id === 'egg') {
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`$${jokers.getState('egg_gold')}`, x + slotW - 4, y + 10);
      } else if (joker.id === 'ramen') {
        ctx.fillStyle = '#e8a87c';
        ctx.fillText(`${jokers.ramenMult}m`, x + slotW - 4, y + 10);
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, slotW, slotH, 4);
      ctx.stroke();
    }
  }
}

function renderPlayScene() {
  const blind = round.getBlindConfig();

  // ─── Top info bar ───
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(round.blindLabel, 15, 16);

  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`$${shop.gold}`, CANVAS_WIDTH - 15, 16);

  // Stats line
  ctx.textAlign = 'left';
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`Hands: ${round.handsRemaining}/${MAX_HANDS_PER_BLIND}  ` +
    `Discards: ${round.discardsRemaining}/${MAX_DISCARDS_PER_BLIND}  ` +
    `Deck: ${deck.remaining}`,
    15, 32);

  // Joker count on right
  ctx.textAlign = 'right';
  ctx.fillText(`Jokers: ${jokers.activeJokers.length}/5`, CANVAS_WIDTH - 15, 32);

  // ─── Joker row (horizontal) ───
  renderJokerRow();

  // ─── Score bar ───
  renderScoreBar(68, round.currentScore, blind.targetScore);

  // ─── Boss effect display ───
  const bossEffect = round.getBossEffect();
  if (bossEffect) {
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`👹 ${bossEffect.name}: ${bossEffect.description}`, CANVAS_WIDTH / 2, 88);
  }

  // ─── Animation layer ───
  renderAnimations(ctx, (card, x, y, angle) => {
    drawCardFaceAt(ctx, card, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2, angle);
  });

  // ─── Hand level info when cards selected ───
  if (selected.size > 0) {
    const playedCards = hand.filter(c => selected.has(c.id));
    const preview = evaluateHand(playedCards);
    const lvl = handLevels.getLevel(preview.handType);
    const nextChips = handLevels.getBaseChips(preview.handType);
    const nextMult = handLevels.getBaseMult(preview.handType);
    ctx.fillStyle = 'rgba(180,100,255,0.6)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${handTypeLabel(preview.handType)} Lv.${lvl}  —  ${nextChips} chips × ${nextMult} mult`,
      CANVAS_WIDTH / 2, 92,
    );
  }

  // ─── Action buttons (center) ───
  const boss = round.getBossEffect();
  const requireExactFive = boss?.requireExactFive ?? false;
  const canPlay = selected.size > 0 && !isAnimating() && round.handsRemaining > 0
    && (!requireExactFive || selected.size === 5);
  const canDiscard = selected.size > 0 && round.discardsRemaining > 0 && !isAnimating();
  const canUseTarot = tarotInventory.length > 0 && !isAnimating() && round.handsRemaining > 0 && !tarotApplyMode;

  // USE TAROT (small, subtle)
  drawButton(B.USE_TAROT, `USE TAROT${tarotInventory.length > 0 ? ` (${tarotInventory.length})` : ''}`, canUseTarot, '#888', '#222', 11);

  // PLAY (big, prominent)
  drawButton(B.PLAY, 'PLAY', canPlay, '#ffd700', '#1a1a2e', 18);

  // DISCARD (medium)
  drawButton(B.DISCARD, 'DISCARD', canDiscard, '#ccc', '#1a1a2e', 15);

  // Hint text
  if (selected.size === 0 && round.handsRemaining > 0 && !isAnimating()) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      requireExactFive ? 'Select exactly 5 cards to play' : 'Select 2-5 cards to play a hand',
      CANVAS_WIDTH / 2, 228,
    );
  }

  // ─── Hand (fan layout at bottom) ───
  if (!isAnimating()) {
    const positions = hand.map((_, i) => getFanPosition(i, hand.length, CANVAS_WIDTH / 2, handFanBaseY, 480));
    // Left to right (last card on top)
    for (let idx = 0; idx < hand.length; idx++) {
      const card = hand[idx];
      const pos = positions[idx];
      const isSelected = selected.has(card.id);

      // Lift selected cards up
      const liftY = isSelected ? pos.y - 25 : pos.y;

      drawCardFaceAt(ctx, card, pos.x, liftY, pos.angle);

      if (isSelected) {
        ctx.save();
        ctx.translate(pos.x, liftY);
        if (pos.angle !== 0) ctx.rotate(pos.angle * Math.PI / 180);
        ctx.translate(-pos.x, -liftY);

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;
        ctx.strokeRect(pos.x - CARD_WIDTH / 2 - 2, liftY - CARD_HEIGHT / 2 - 2, CARD_WIDTH + 4, CARD_HEIGHT + 4);

        ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
        ctx.fillRect(pos.x - CARD_WIDTH / 2, liftY - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
        ctx.restore();

        const selIdx = [...selected].indexOf(card.id);
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(pos.x + CARD_WIDTH / 2 - 8, liftY - CARD_HEIGHT / 2 + 8, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${selIdx + 1}`, pos.x + CARD_WIDTH / 2 - 8, liftY - CARD_HEIGHT / 2 + 8);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  // ─── Tarot mode overlay ───
  if (tarotApplyMode) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Apply "${tarotApplyMode.tarot.name}" — Click a card`, CANVAS_WIDTH / 2, 130);
    ctx.fillStyle = '#e63946';
    roundRect(ctx, B.TAROT_CANCEL.x, B.TAROT_CANCEL.y, B.TAROT_CANCEL.w, B.TAROT_CANCEL.h, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CANCEL', B.TAROT_CANCEL.x + B.TAROT_CANCEL.w / 2, B.TAROT_CANCEL.y + B.TAROT_CANCEL.h / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // No hands remaining
  if (round.handsRemaining <= 0 && !round.isBlindBeaten && !isAnimating()) {
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No hands remaining!', CANVAS_WIDTH / 2, 230);
  }
}

function renderShopScene() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('🏪 SHOP', CANVAS_WIDTH / 2, 50);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`Gold: $${shop.gold}`, CANVAS_WIDTH / 2, 80);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px monospace';
  ctx.fillText(pendingNewAnte ? `⬆ ANTE ${round.ante}!` : round.blindLabel, CANVAS_WIDTH / 2, 105);

  // Joker slots in shop
  renderJokerSlots();

  // Items
  shopBtnRects = [];
  const itemW = 160;
  const itemH = 170;
  const gap = 20;
  const totalW = shop.items.length * itemW + (shop.items.length - 1) * gap;
  const startX = (CANVAS_WIDTH - totalW) / 2;
  const itemY = 130;

  shop.items.forEach((item, i) => {
    const x = startX + i * (itemW + gap);

    const isJoker = !!item.jokerDef;
    const isTarot = !!item.tarotDef;
    const isPlanet = !!item.planetDef;
    ctx.fillStyle = isTarot ? '#1a1a3e' : isPlanet ? '#2a1a3e' : '#1a1a2e';
    ctx.strokeStyle = isTarot ? 'rgba(0,229,255,0.5)' : isPlanet ? 'rgba(180,100,255,0.5)' : (isJoker ? 'rgba(255,215,0,0.5)' : 'rgba(100,180,255,0.3)');
    ctx.lineWidth = 2;
    roundRect(ctx, x, itemY, itemW, itemH, 10);
    ctx.fill();
    ctx.stroke();

    // Type badge
    ctx.fillStyle = isTarot ? 'rgba(0,229,255,0.15)' : isPlanet ? 'rgba(180,100,255,0.15)' : (isJoker ? 'rgba(255,215,0,0.15)' : 'rgba(100,180,255,0.15)');
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(isTarot ? '🔮 TAROT' : isPlanet ? '🪐 PLANET' : (isJoker ? '🃏 JOKER' : '📦 ITEM'), x + itemW / 2, itemY + 18);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(item.name, x + itemW / 2, itemY + 42);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px monospace';
    ctx.fillText(item.description, x + itemW / 2, itemY + 68);

    // Price
    const affordable = shop.gold >= item.cost;
    ctx.fillStyle = affordable ? '#ffd700' : '#666';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`$${item.cost}`, x + itemW / 2, itemY + 105);

    // Buy button
    const buyX = x + 10;
    const buyY = itemY + 118;
    const buyW = itemW - 20;
    const buyH = 34;
    shopBtnRects.push({ x: buyX, y: buyY, w: buyW, h: buyH, index: i });

    ctx.fillStyle = affordable ? '#4caf50' : '#333';
    ctx.strokeStyle = affordable ? '#66bb6a' : '#555';
    ctx.lineWidth = 2;
    roundRect(ctx, buyX, buyY, buyW, buyH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = affordable ? '#fff' : '#666';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('BUY', buyX + buyW / 2, buyY + buyH / 2 + 4);
  });

  const canReroll = shop.gold >= 1;
  drawButton(B.SHOP_REROLL, `REROLL $1`, canReroll);
  drawButton(B.SHOP_NEXT, 'NEXT ROUND', true);

  ctx.textBaseline = 'alphabetic';
}

function renderGameOverScene() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#e63946';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px monospace';
  ctx.fillText(`Reached ${round.blindLabel}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
  ctx.fillText(`Score: ${round.currentScore.toLocaleString()}  |  Gold: $${shop.gold}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);

  // Show jokers collected
  const active = jokers.activeJokers;
  if (active.length > 0) {
    ctx.fillStyle = '#ffd700';
    ctx.font = '14px monospace';
    ctx.fillText('Jokers:', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px monospace';
    ctx.fillText(active.map(j => j.name).join(', '), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 105);
  }

  drawButton(B.GAME_RESTART, 'NEW GAME', true);
  ctx.textBaseline = 'alphabetic';
}

function renderBlindSelectScene() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Title
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`SELECT BLIND — Ante ${round.ante}`, CANVAS_WIDTH / 2, 50);

  // Gold display
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`Gold: $${shop.gold}`, CANVAS_WIDTH / 2, 78);

  // Skip message
  if (skipMessage) {
    ctx.fillStyle = '#8bc34a';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(skipMessage, CANVAS_WIDTH / 2, 105);
  }

  // Render 3 blind cards
  const blinds = round.getAvailableBlinds();
  blinds.forEach((blind, i) => {
    const rect = BLIND_POSITIONS[i];
    const isSelected = selectedBlindType === blind.type;

    // Card background
    const isBoss = blind.type === 'boss';
    ctx.fillStyle = isSelected
      ? (isBoss ? '#3d1a2e' : '#1a2a3d')
      : (isBoss ? '#2a1a1e' : '#1a1a2e');
    ctx.strokeStyle = isSelected
      ? '#ffd700'
      : (isBoss ? 'rgba(230,57,70,0.5)' : 'rgba(255,255,255,0.2)');
    ctx.lineWidth = isSelected ? 3 : 1;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.stroke();

    // Blind type label
    ctx.fillStyle = isBoss ? '#e63946' : '#64b5f6';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    const typeLabels: Record<string, string> = {
      small: 'SMALL BLIND',
      big: 'BIG BLIND',
      boss: 'BOSS BLIND',
    };
    ctx.fillText(typeLabels[blind.type], rect.x + rect.w / 2, rect.y + 30);

    // Boss name (if boss)
    if (blind.bossEffect) {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(blind.bossEffect.name, rect.x + rect.w / 2, rect.y + 60);
    }

    // Target score
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText('Target', rect.x + rect.w / 2, rect.y + 90);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(blind.targetScore.toLocaleString(), rect.x + rect.w / 2, rect.y + 120);

    // Reward
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px monospace';
    ctx.fillText('Reward', rect.x + rect.w / 2, rect.y + 155);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`+$${blind.rewardGold}`, rect.x + rect.w / 2, rect.y + 178);

    // Boss effect description
    if (blind.bossEffect) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px monospace';
      ctx.fillText(blind.bossEffect.description, rect.x + rect.w / 2, rect.y + 210);
    }
  });

  // Confirm button (only when a blind is selected)
  const canConfirm = selectedBlindType !== null;
  drawButton(B.BLIND_CONFIRM, 'CONFIRM', canConfirm, '#ffd700', '#1a1a2e', 15);

  // Skip button — always visible for non-boss blinds (just skip whatever is current)
  const currentType = round.currentBlind;
  const canSkip = currentType !== 'boss' || round.ante <= 1;
  drawButton(B.BLIND_SKIP, 'SKIP', canSkip, '#888', '#222', 12);
  if (currentType === 'boss') {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Cannot skip Boss Blind', CANVAS_WIDTH / 2, B.BLIND_SKIP.y + B.BLIND_SKIP.h + 14);
  }

  ctx.textBaseline = 'alphabetic';
}

function drawButton(def: { x: number; y: number; w: number; h: number }, label: string, enabled: boolean, accentColor = '#ffd700', bgColor = '#1a1a2e', fontSize = 14) {
  ctx.fillStyle = enabled ? bgColor : '#222';
  ctx.strokeStyle = enabled ? accentColor : '#444';
  ctx.lineWidth = 2;
  roundRect(ctx, def.x, def.y, def.w, def.h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = enabled ? accentColor : '#555';
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, def.x + def.w / 2, def.y + def.h / 2);
  ctx.textBaseline = 'alphabetic';
}

// ─── Input ───
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (phase === 'playing') {
    handlePlayClick(mx, my);
  } else if (phase === 'shop') {
    handleShopClick(mx, my);
  } else if (phase === 'game_over') {
    if (hitTest(mx, my, B.GAME_RESTART)) startGame();
  } else if (phase === 'blind_select') {
    handleBlindSelectClick(mx, my);
  }
});

function handlePlayClick(mx: number, my: number) {
  // Tarot apply mode: clicking a card applies the tarot
  if (tarotApplyMode) {
    if (hitTest(mx, my, B.TAROT_CANCEL)) {
      cancelTarotMode();
      return;
    }
    // Click card to apply tarot (fan hit-test, rightmost on top)
    const positions = hand.map((_, i) => getFanPosition(i, hand.length, CANVAS_WIDTH / 2, handFanBaseY, 480));
    for (let i = hand.length - 1; i >= 0; i--) {
      const pos = positions[i];
      if (mx >= pos.x - CARD_WIDTH / 2 && mx <= pos.x + CARD_WIDTH / 2 &&
          my >= pos.y - CARD_HEIGHT / 2 && my <= pos.y + CARD_HEIGHT / 2) {
        applyTarotToCard(hand[i].id);
        return;
      }
    }
    return; // Block other clicks in tarot mode
  }

  // USE TAROT button
  if (hitTest(mx, my, B.USE_TAROT) && tarotInventory.length > 0 && !isAnimating()) {
    enterTarotMode();
    return;
  }

  // PLAY / DISCARD buttons
  if (hitTest(mx, my, B.PLAY) && selected.size > 0 && round.handsRemaining > 0 && !isAnimating()) {
    playHand(); return;
  }
  if (hitTest(mx, my, B.DISCARD) && selected.size > 0 && round.discardsRemaining > 0 && !isAnimating()) {
    discardSelected(); return;
  }

  if (isAnimating() || phase !== 'playing') return;
  const positions = hand.map((_, i) => getFanPosition(i, hand.length, CANVAS_WIDTH / 2, handFanBaseY, 480));
  for (let i = hand.length - 1; i >= 0; i--) {
    const pos = positions[i];
    if (mx >= pos.x - CARD_WIDTH / 2 && mx <= pos.x + CARD_WIDTH / 2 &&
        my >= pos.y - CARD_HEIGHT / 2 && my <= pos.y + CARD_HEIGHT / 2) {
      const card = hand[i];
      if (selected.has(card.id)) selected.delete(card.id);
      else if (selected.size < MAX_SELECT) selected.add(card.id);
      return;
    }
  }
}

function handleShopClick(mx: number, my: number) {
  for (const btn of shopBtnRects) {
    if (hitTest(mx, my, btn)) {
      buyShopItem(btn.index);
      return;
    }
  }
  if (hitTest(mx, my, B.SHOP_REROLL)) {
    if (shop.reroll()) console.log('🔄 Shop rerolled');
    return;
  }
  if (hitTest(mx, my, B.SHOP_NEXT)) {
    exitShop();
  }
}

function handleBlindSelectClick(mx: number, my: number) {
  // Check blind card clicks
  const blinds = round.getAvailableBlinds();
  for (let i = 0; i < blinds.length; i++) {
    if (hitTest(mx, my, BLIND_POSITIONS[i])) {
      selectBlind(blinds[i].type);
      return;
    }
  }

  // Confirm button
  if (hitTest(mx, my, B.BLIND_CONFIRM) && selectedBlindType !== null) {
    confirmBlindSelection();
    return;
  }

  // Skip button
  if (hitTest(mx, my, B.BLIND_SKIP)) {
    const currentType = round.currentBlind;
    if (currentType !== 'boss' || round.ante <= 1) {
      handleSkipBlind();
    }
    return;
  }
}

function hitTest(mx: number, my: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    if (phase === 'playing' && selected.size > 0 && round.handsRemaining > 0 && !isAnimating()) playHand();
  } else if (e.key === 'd' || e.key === 'D') {
    if (phase === 'playing' && selected.size > 0 && round.discardsRemaining > 0 && !isAnimating()) discardSelected();
  } else if (e.key === ' ' && phase === 'shop') {
    exitShop();
  } else if (e.key === ' ' && phase === 'game_over') {
    startGame();
  }
});

// ─── Game Loop ───
let lastTime = 0;

function gameLoop(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

// ─── Start ───
startGame();
console.log('%c=== BALATRO-LIKE (Week 5 — Jokers!) ===', 'color: #ffd700; font-weight: bold; font-size: 16px');
console.log('Buy jokers in the shop, watch them trigger during scoring!');
requestAnimationFrame(gameLoop);
