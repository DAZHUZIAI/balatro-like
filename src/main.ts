import { CANVAS_WIDTH, CANVAS_HEIGHT, CARD_WIDTH, CARD_HEIGHT } from './utils/Constants.ts';
import { DeckManager } from './gameplay/DeckManager.ts';
import { drawCard, drawCardBack } from './ui/CardRenderer.ts';
import { evaluateHand, handTypeLabel } from './core/HandEvaluator.ts';
import type { Card } from './core/Card.ts';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const deck = new DeckManager();
deck.init();
deck.shuffle();

let hand: Card[] = [];
const selected = new Set<string>();
let lastHandType: string | null = null;
let lastChips = 0;
let lastMult = 0;
let handsPlayed = 0;
let discardsRemaining = 2;

/** Deal 8 cards to start or reshuffle */
function dealNewHand() {
  if (deck.remaining < 8) deck.recycle();
  hand = deck.deal(8);
  selected.clear();
}

function drawScene() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Felt background
  ctx.fillStyle = '#0d5c2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Title + stats
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('BALATRO-LIKE', 20, 30);

  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`Hands: ${handsPlayed}  |  Discards: ${discardsRemaining}  |  Deck: ${deck.remaining}`, 20, 54);

  // Last hand result
  if (lastHandType) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${lastHandType}`, CANVAS_WIDTH / 2, 110);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${lastChips} chips × ${lastMult} mult = ${lastChips * lastMult}`, CANVAS_WIDTH / 2, 136);
  }

  // Deck pile
  drawCardBack(ctx, 20, CANVAS_HEIGHT - CARD_HEIGHT - 70);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Deck`, 20 + CARD_WIDTH / 2, CANVAS_HEIGHT - 60);

  // Instructions (bottom-left)
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Click card to select (max 5)  |  [P]lay  |  [D]iscard', 20, CANVAS_HEIGHT - 25);

  // Hand cards — spread across bottom
  const totalW = hand.length * CARD_WIDTH + (hand.length - 1) * 8;
  const startX = (CANVAS_WIDTH - totalW) / 2;
  const y = CANVAS_HEIGHT - CARD_HEIGHT - 70;

  hand.forEach((card, i) => {
    const x = startX + i * (CARD_WIDTH + 8);
    const isSelected = selected.has(card.id);
    drawCard(ctx, card, x, y, true);

    if (isSelected) {
      // Highlight border
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 2, y - 2, CARD_WIDTH + 4, CARD_HEIGHT + 4);
      // Lift effect
      ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
      ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);
    }
  });
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Check if clicked on a card
  const totalW = hand.length * CARD_WIDTH + (hand.length - 1) * 8;
  const startX = (CANVAS_WIDTH - totalW) / 2;
  const cy = CANVAS_HEIGHT - CARD_HEIGHT - 70;

  for (let i = hand.length - 1; i >= 0; i--) {
    const cx = startX + i * (CARD_WIDTH + 8);
    if (mx >= cx && mx <= cx + CARD_WIDTH && my >= cy && my <= cy + CARD_HEIGHT) {
      const card = hand[i];
      if (selected.has(card.id)) {
        selected.delete(card.id);
      } else if (selected.size < 5) {
        selected.add(card.id);
      }
      drawScene();
      return;
    }
  }
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    playHand();
  } else if (e.key === 'd' || e.key === 'D') {
    discardSelected();
  }
});

function playHand() {
  if (selected.size === 0) return;

  const playedCards = hand.filter(c => selected.has(c.id));
  const result = evaluateHand(playedCards);

  lastHandType = handTypeLabel(result.handType);
  lastChips = result.score.chips;
  lastMult = result.score.mult;
  handsPlayed++;

  // Remove played cards from hand, draw replacements
  hand = hand.filter(c => !selected.has(c.id));
  const replacements = deck.deal(playedCards.length);
  hand.push(...replacements);
  selected.clear();

  // Log to console for inspection
  console.log(`%c[PLAY] ${lastHandType} — ${lastChips} × ${lastMult} = ${lastChips * lastMult}`, 'color: gold; font-weight: bold');
  console.log('  Cards:', playedCards.map(c => `${c.rank} of ${c.suit}`).join(', '));
  console.log(`  Hand size: ${hand.length}, Deck remaining: ${deck.remaining}`);

  drawScene();
}

function discardSelected() {
  if (selected.size === 0) return;
  if (discardsRemaining <= 0) return;

  const discarded = hand.filter(c => selected.has(c.id));
  deck.discard(...discarded);
  hand = hand.filter(c => !selected.has(c.id));

  const replacements = deck.deal(discarded.length);
  hand.push(...replacements);
  selected.clear();
  discardsRemaining--;

  console.log(`%c[DISCARD] ${discarded.length} cards. Discards left: ${discardsRemaining}`, 'color: #aaa; font-weight: bold');

  drawScene();
}

// Start
dealNewHand();
drawScene();
console.log('%c=== BALATRO-LIKE ===', 'color: green; font-weight: bold; font-size: 16px');
console.log('Click cards to select, then press P to Play or D to Discard');
console.log(`Deck: ${deck.remaining} cards`);
