import { CANVAS_WIDTH, CANVAS_HEIGHT, CARD_WIDTH, CARD_HEIGHT } from './utils/Constants.ts';
import { DeckManager } from './gameplay/DeckManager.ts';
import { RoundManager, MAX_HANDS_PER_BLIND, MAX_DISCARDS_PER_BLIND } from './gameplay/RoundManager.ts';
import { ShopManager } from './gameplay/ShopManager.ts';
import { drawCardFaceAt, drawCardBack, getFanPosition, fanDrawOrder, roundRect } from './ui/CardRenderer.ts';
import { evaluateHand, handTypeLabel } from './core/HandEvaluator.ts';
import { startPlayAnimation, update, renderAnimations, isAnimating } from './ui/Animations.ts';
import type { Card } from './core/Card.ts';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// ─── Core State ───
const deck = new DeckManager();
const round = new RoundManager();
const shop = new ShopManager();
let hand: Card[] = [];
const selected = new Set<string>();
const MAX_SELECT = 5;

// ─── UI State ───
let phase: 'playing' | 'shop' | 'game_over' = 'playing';
let pendingNewAnte = false;

// ─── Button geometry ───
const B = {
  PLAY: { x: CANVAS_WIDTH / 2 - 110, y: CANVAS_HEIGHT - 155, w: 100, h: 40 },
  DISCARD: { x: CANVAS_WIDTH / 2 + 10, y: CANVAS_HEIGHT - 155, w: 100, h: 40 },
  SHOP_NEXT: { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 100, w: 140, h: 40 },
  SHOP_REROLL: { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 150, w: 140, h: 40 },
  GAME_RESTART: { x: CANVAS_WIDTH / 2 - 70, y: CANVAS_HEIGHT - 120, w: 140, h: 44 },
};

let shopBtnRects: { x: number; y: number; w: number; h: number; index: number }[] = [];

// ─── Game Flow ───

function startGame() {
  deck.init();
  deck.shuffle();
  round.newGame();
  shop.gold = 0;
  shop.generate();
  phase = 'playing';
  pendingNewAnte = false;
  dealNewHand();
  console.log(`%c=== NEW GAME: ${round.blindLabel} — target ${round.getBlindConfig().targetScore} ===`, 'color: #ffd700; font-weight: bold');
}

function dealNewHand() {
  if (deck.remaining < 8) deck.recycle();
  hand = deck.deal(8);
  selected.clear();
}

function playHand() {
  if (selected.size === 0 || isAnimating() || phase !== 'playing') return;

  const playedCards = hand.filter(c => selected.has(c.id));
  const result = evaluateHand(playedCards);
  const score = result.score.chips * result.score.mult;

  const beaten = round.playHand(score);

  const handType = handTypeLabel(result.handType);
  const fromPositions = playedCards.map(c => {
    const idx = hand.indexOf(c);
    return getFanPosition(idx, hand.length, CANVAS_WIDTH / 2, CANVAS_HEIGHT - CARD_HEIGHT / 2 - 70);
  });

  // Remove played cards, draw replacements
  hand = hand.filter(c => !selected.has(c.id));
  const replacements = deck.deal(playedCards.length);
  hand.push(...replacements);
  selected.clear();

  console.log(`%c[PLAY] ${handType} +${score}  (${round.currentScore}/${round.getBlindConfig().targetScore})  Hands left: ${round.handsRemaining}`,
    beaten ? 'color: #4caf50; font-weight: bold' : 'color: gold');

  startPlayAnimation(playedCards, fromPositions, handType, result.score.chips, result.score.mult, () => {
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

  console.log(`[DISCARD] ${count} cards. Discards left: ${round.discardsRemaining}`);
}

function onBlindBeaten() {
  const gold = round.collectReward();
  pendingNewAnte = round.advanceBlind();
  shop.earn(gold);
  shop.generate();
  phase = 'shop';
  console.log(`%c🎉 BLIND BEATEN! +$${gold}`, 'color: #4caf50; font-weight: bold');
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

  // Apply effect
  switch (item.id) {
    case 'add_hand':
      round.handsRemaining = Math.min(round.handsRemaining + 1, 10);
      break;
    case 'add_discard':
      round.discardsRemaining = Math.min(round.discardsRemaining + 1, 10);
      break;
    case 'remove_card':
      deck.init(); // Simple: reset to 52-card deck
      deck.shuffle();
      break;
    case 'bonus_gold':
      shop.earn(3);
      break;
  }

  console.log(`🛒 Bought: ${item.name} ($-${item.cost})`);
}

function exitShop() {
  round.resetRound();
  dealNewHand();
  phase = 'playing';
  console.log(`\n%c=== ${round.blindLabel} — target ${round.getBlindConfig().targetScore} ===`, 'color: #ffd700; font-weight: bold');
}

// ─── Rendering ───

function renderScoreBar(y: number, current: number, target: number) {
  const barW = CANVAS_WIDTH - 40;
  const barH = 20;
  const x = 20;

  // Background
  ctx.fillStyle = '#1a1a2e';
  roundRect(ctx, x, y, barW, barH, 6);
  ctx.fill();

  // Progress
  const progress = Math.min(current / target, 1);
  if (progress > 0) {
    const grad = ctx.createLinearGradient(x, y, x + barW * progress, y);
    grad.addColorStop(0, '#4caf50');
    grad.addColorStop(1, '#8bc34a');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barW * progress, barH, 6);
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, barW, barH, 6);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.min(current, target)} / ${target}`, x + barW / 2, y + barH / 2);
  ctx.textBaseline = 'alphabetic';
}

function render() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // ─── Background ───
  ctx.fillStyle = '#0d5c2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (phase === 'playing') renderPlayScene();
  else if (phase === 'shop') renderShopScene();
  else if (phase === 'game_over') renderGameOverScene();
}

function renderPlayScene() {
  const blind = round.getBlindConfig();

  // ─── Top bar ───
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(round.blindLabel, 20, 28);

  // Gold
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`$${shop.gold}`, CANVAS_WIDTH - 20, 28);

  // Stats
  ctx.textAlign = 'left';
  ctx.font = '13px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`Hands: ${round.handsRemaining}/${MAX_HANDS_PER_BLIND}  ` +
    `Discards: ${round.discardsRemaining}/${MAX_DISCARDS_PER_BLIND}  ` +
    `Deck: ${deck.remaining}`,
    20, 50);

  // ─── Score bar ───
  renderScoreBar(62, round.currentScore, blind.targetScore);

  // ─── Deck pile ───
  drawCardBack(ctx, 20, 100);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${deck.remaining}`, 20 + CARD_WIDTH / 2, 100 + CARD_HEIGHT + 12);

  // ─── Animation layer ───
  renderAnimations(ctx, (card, x, y, angle) => {
    drawCardFaceAt(ctx, card, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2, angle);
  });

  // ─── Hand (fan layout) ───
  if (!isAnimating()) {
    const baseY = CANVAS_HEIGHT - CARD_HEIGHT / 2 - 70;
    const cx = CANVAS_WIDTH / 2;
    const positions = hand.map((_, i) => getFanPosition(i, hand.length, cx, baseY));
    const drawOrder = fanDrawOrder(hand.length);

    for (const idx of drawOrder) {
      const card = hand[idx];
      const pos = positions[idx];
      const isSelected = selected.has(card.id);

      drawCardFaceAt(ctx, card, pos.x, pos.y, pos.angle);

      if (isSelected) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        if (pos.angle !== 0) ctx.rotate(pos.angle * Math.PI / 180);
        ctx.translate(-pos.x, -pos.y);

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;
        ctx.strokeRect(pos.x - CARD_WIDTH / 2 - 2, pos.y - CARD_HEIGHT / 2 - 2, CARD_WIDTH + 4, CARD_HEIGHT + 4);

        ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
        ctx.fillRect(pos.x - CARD_WIDTH / 2, pos.y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
        ctx.restore();

        const selIdx = [...selected].indexOf(card.id);
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(pos.x + CARD_WIDTH / 2 - 8, pos.y - CARD_HEIGHT / 2 + 8, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${selIdx + 1}`, pos.x + CARD_WIDTH / 2 - 8, pos.y - CARD_HEIGHT / 2 + 8);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  // ─── Action buttons ───
  const canPlay = selected.size > 0 && !isAnimating() && round.handsRemaining > 0;
  const canDiscard = selected.size > 0 && round.discardsRemaining > 0 && !isAnimating() && phase === 'playing';
  drawButton(B.PLAY, 'PLAY', canPlay);
  drawButton(B.DISCARD, 'DISCARD', canDiscard);

  // "Out of hands" message
  if (round.handsRemaining <= 0 && !round.isBlindBeaten && !isAnimating()) {
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No hands remaining!', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 170);
  }
}

function renderShopScene() {
  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Title
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('🏪 SHOP', CANVAS_WIDTH / 2, 50);

  // Gold
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`Gold: $${shop.gold}`, CANVAS_WIDTH / 2, 80);

  // Blind info
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px monospace';
  ctx.fillText(pendingNewAnte ? `⬆ ANTE ${round.ante}!` : round.blindLabel, CANVAS_WIDTH / 2, 105);

  // ─── Items ───
  shopBtnRects = [];
  const itemW = 160;
  const itemH = 160;
  const gap = 20;
  const totalW = shop.items.length * itemW + (shop.items.length - 1) * gap;
  const startX = (CANVAS_WIDTH - totalW) / 2;
  const itemY = 130;

  shop.items.forEach((item, i) => {
    const x = startX + i * (itemW + gap);

    // Card
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, itemY, itemW, itemH, 10);
    ctx.fill();
    ctx.stroke();

    // Item name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, x + itemW / 2, itemY + 30);

    // Description
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px monospace';
    ctx.fillText(item.description, x + itemW / 2, itemY + 58);

    // Price
    const affordable = shop.gold >= item.cost;
    ctx.fillStyle = affordable ? '#ffd700' : '#666';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`$${item.cost}`, x + itemW / 2, itemY + 95);

    // Buy button
    const buyX = x + 10;
    const buyY = itemY + 110;
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

  // ─── Bottom buttons ───
  const canReroll = shop.gold >= 1;
  drawButton(B.SHOP_REROLL, `REROLL $1`, canReroll);
  drawButton(B.SHOP_NEXT, 'NEXT ROUND', true);

  ctx.textBaseline = 'alphabetic';
}

function renderGameOverScene() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Skull
  ctx.fillStyle = '#e63946';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px monospace';
  ctx.fillText(`Reached ${round.blindLabel}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
  ctx.fillText(`Score: ${round.currentScore.toLocaleString()}  |  Gold: $${shop.gold}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);

  // Restart button
  drawButton(B.GAME_RESTART, 'NEW GAME', true);
  ctx.textBaseline = 'alphabetic';
}

function drawButton(def: { x: number; y: number; w: number; h: number }, label: string, enabled: boolean) {
  ctx.fillStyle = enabled ? '#1a1a2e' : '#222';
  ctx.strokeStyle = enabled ? '#ffd700' : '#444';
  ctx.lineWidth = 2;
  roundRect(ctx, def.x, def.y, def.w, def.h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = enabled ? '#ffd700' : '#555';
  ctx.font = 'bold 14px monospace';
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
  }
});

function handlePlayClick(mx: number, my: number) {
  // Check buttons
  if (hitTest(mx, my, B.PLAY) && selected.size > 0 && round.handsRemaining > 0 && !isAnimating()) {
    playHand(); return;
  }
  if (hitTest(mx, my, B.DISCARD) && selected.size > 0 && round.discardsRemaining > 0 && !isAnimating()) {
    discardSelected(); return;
  }

  // Check cards
  if (isAnimating() || phase !== 'playing') return;
  const baseY = CANVAS_HEIGHT - CARD_HEIGHT / 2 - 70;
  const cx = CANVAS_WIDTH / 2;
  const drawOrder = fanDrawOrder(hand.length).reverse();
  for (const idx of drawOrder) {
    const pos = getFanPosition(idx, hand.length, cx, baseY);
    if (mx >= pos.x - CARD_WIDTH / 2 && mx <= pos.x + CARD_WIDTH / 2 &&
        my >= pos.y - CARD_HEIGHT / 2 && my <= pos.y + CARD_HEIGHT / 2) {
      const card = hand[idx];
      if (selected.has(card.id)) selected.delete(card.id);
      else if (selected.size < MAX_SELECT) selected.add(card.id);
      return;
    }
  }
}

function handleShopClick(mx: number, my: number) {
  // Buy buttons
  for (const btn of shopBtnRects) {
    if (hitTest(mx, my, btn)) {
      buyShopItem(btn.index);
      return;
    }
  }

  // Reroll
  if (hitTest(mx, my, B.SHOP_REROLL)) {
    if (shop.reroll()) console.log('🔄 Shop rerolled');
    return;
  }

  // Next round
  if (hitTest(mx, my, B.SHOP_NEXT)) {
    exitShop();
  }
}

function hitTest(mx: number, my: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

// Keyboard
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
console.log('%c=== BALATRO-LIKE (Week 4) ===', 'color: green; font-weight: bold; font-size: 16px');
console.log('Select cards → PLAY (P) or DISCARD (D)  |  Space = next/skip');
requestAnimationFrame(gameLoop);
