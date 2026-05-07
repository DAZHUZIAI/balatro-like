import { CANVAS_WIDTH, CANVAS_HEIGHT, CARD_WIDTH, CARD_HEIGHT } from './utils/Constants.ts';
import { DeckManager } from './gameplay/DeckManager.ts';
import { drawCardFaceAt, drawCardBack, getFanPosition, fanDrawOrder } from './ui/CardRenderer.ts';
import { evaluateHand, handTypeLabel } from './core/HandEvaluator.ts';
import {
  startPlayAnimation, update, renderAnimations, isAnimating,
} from './ui/Animations.ts';
import type { Card } from './core/Card.ts';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// ─── Game State ───
const deck = new DeckManager();
let hand: Card[] = [];
const selected = new Set<string>();
let handsPlayed = 0;
let discardsRemaining = 2;
const MAX_SELECT = 5;

// ─── Button definitions ───
interface Button {
  label: string;
  x: number; y: number; w: number; h: number;
  enabled: () => boolean;
  onclick: () => void;
}
const buttons: Button[] = [
  {
    label: 'PLAY', x: CANVAS_WIDTH / 2 - 110, y: CANVAS_HEIGHT - 155, w: 100, h: 40,
    enabled: () => selected.size > 0 && !isAnimating(),
    onclick: () => playHand(),
  },
  {
    label: 'DISCARD', x: CANVAS_WIDTH / 2 + 10, y: CANVAS_HEIGHT - 155, w: 100, h: 40,
    enabled: () => selected.size > 0 && discardsRemaining > 0 && !isAnimating(),
    onclick: () => discardSelected(),
  },
];

let lastAnimHandType = '';
let lastAnimChips = 0;
let lastAnimMult = 0;
let lastAnimCallbacks: (() => void) | null = null;

// ─── Game Logic ───
function dealNewHand() {
  if (deck.remaining < 8) deck.recycle();
  hand = deck.deal(8);
  selected.clear();
}

function playHand() {
  if (selected.size === 0 || isAnimating()) return;

  const playedCards = hand.filter(c => selected.has(c.id));
  const result = evaluateHand(playedCards);

  lastAnimHandType = handTypeLabel(result.handType);
  lastAnimChips = result.score.chips;
  lastAnimMult = result.score.mult;
  handsPlayed++;

  const fromPositions = hand
    .filter(c => selected.has(c.id))
    .map(c => {
      const idx = hand.indexOf(c);
      return getFanPosition(idx, hand.length, CANVAS_WIDTH / 2, CANVAS_HEIGHT - CARD_HEIGHT / 2 - 70);
    });

  // Remove cards from hand immediately, draw replacements
  hand = hand.filter(c => !selected.has(c.id));
  const replacements = deck.deal(playedCards.length);
  hand.push(...replacements);
  selected.clear();

  // Store callback to fire after animation completes
  lastAnimCallbacks = () => {
    console.log(`%c[PLAY] ${lastAnimHandType} — ${lastAnimChips} × ${lastAnimMult} = ${lastAnimChips * lastAnimMult}`,
      'color: gold; font-weight: bold');
  };

  startPlayAnimation(playedCards, fromPositions, lastAnimHandType, lastAnimChips, lastAnimMult, () => {
    lastAnimCallbacks?.();
    lastAnimCallbacks = null;
  });
}

function discardSelected() {
  if (selected.size === 0 || discardsRemaining <= 0 || isAnimating()) return;

  const discarded = hand.filter(c => selected.has(c.id));
  deck.discard(...discarded);
  hand = hand.filter(c => !selected.has(c.id));

  const replacements = deck.deal(discarded.length);
  hand.push(...replacements);
  selected.clear();
  discardsRemaining--;

  console.log(`%c[DISCARD] ${discarded.length} cards. Discards left: ${discardsRemaining}`, 'color: #aaa; font-weight: bold');
}

// ─── Rendering ───
function render() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Background
  ctx.fillStyle = '#0d5c2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle felt texture
  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Top bar ───
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('BALATRO-LIKE', 20, 30);

  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(
    `Hands: ${handsPlayed}  |  Discards: ${discardsRemaining}  |  Deck: ${deck.remaining}  |  Cards: ${hand.length}`,
    20, 54,
  );

  // ─── Deck pile ───
  drawCardBack(ctx, 20, 80);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${deck.remaining}`, 20 + CARD_WIDTH / 2, 80 + CARD_HEIGHT + 12);
  ctx.fillText('remaining', 20 + CARD_WIDTH / 2, 80 + CARD_HEIGHT + 26);

  // ─── Animation layer ───
  renderAnimations(ctx, (card, x, y, angle) => {
    drawCardFaceAt(ctx, card, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2, angle);
  });

  // ─── Hand (fan layout) ───
  if (!isAnimating()) {
    const baseY = CANVAS_HEIGHT - CARD_HEIGHT / 2 - 70;
    const cx = CANVAS_WIDTH / 2;

    // Pre-compute positions
    const positions = hand.map((_, i) => getFanPosition(i, hand.length, cx, baseY));

    // Draw in z-order (center on top)
    const drawOrder = fanDrawOrder(hand.length);
    for (const idx of drawOrder) {
      const card = hand[idx];
      const pos = positions[idx];
      const isSelected = selected.has(card.id);

      drawCardFaceAt(ctx, card, pos.x, pos.y, pos.angle);

      if (isSelected) {
        // Gold highlight
        ctx.save();
        ctx.translate(pos.x, pos.y);
        if (pos.angle !== 0) ctx.rotate(pos.angle * Math.PI / 180);
        ctx.translate(-pos.x, -pos.y);

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;
        ctx.strokeRect(pos.x - CARD_WIDTH / 2 - 2, pos.y - CARD_HEIGHT / 2 - 2, CARD_WIDTH + 4, CARD_HEIGHT + 4);

        // Lift indicator
        ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
        ctx.fillRect(pos.x - CARD_WIDTH / 2, pos.y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);

        ctx.restore();

        // Selected count badge
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
      }
    }
  }

  // ─── Buttons ───
  for (const btn of buttons) {
    const enabled = btn.enabled();
    // Button bg
    ctx.fillStyle = enabled ? '#1a1a2e' : '#333';
    ctx.strokeStyle = enabled ? '#ffd700' : '#555';
    ctx.lineWidth = 2;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = enabled ? '#ffd700' : '#666';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  ctx.textBaseline = 'alphabetic';
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── Input ───
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Check buttons
  for (const btn of buttons) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      if (btn.enabled()) btn.onclick();
      return;
    }
  }

  // Check cards (fan layout)
  if (isAnimating()) return;
  const baseY = CANVAS_HEIGHT - CARD_HEIGHT / 2 - 70;
  const cx = CANVAS_WIDTH / 2;

  // Iterate in reverse draw order (top-most first)
  const drawOrder = fanDrawOrder(hand.length).reverse();
  for (const idx of drawOrder) {
    const pos = getFanPosition(idx, hand.length, cx, baseY);
    const halfW = CARD_WIDTH / 2;
    const halfH = CARD_HEIGHT / 2;
    if (mx >= pos.x - halfW && mx <= pos.x + halfW && my >= pos.y - halfH && my <= pos.y + halfH) {
      const card = hand[idx];
      if (selected.has(card.id)) {
        selected.delete(card.id);
      } else if (selected.size < MAX_SELECT) {
        selected.add(card.id);
      }
      return;
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    if (buttons[0].enabled()) buttons[0].onclick();
  } else if (e.key === 'd' || e.key === 'D') {
    if (buttons[1].enabled()) buttons[1].onclick();
  }
});

// ─── Game Loop ───
let lastTime = 0;

function gameLoop(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.05); // cap dt
  lastTime = time;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// ─── Start ───
deck.init();
deck.shuffle();
dealNewHand();

console.log('%c=== BALATRO-LIKE (Week 3) ===', 'color: green; font-weight: bold; font-size: 16px');
console.log('Click cards to select, then press PLAY button or P key');
console.log('Press D to discard');

requestAnimationFrame(gameLoop);
