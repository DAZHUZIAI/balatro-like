import { CANVAS_WIDTH, CANVAS_HEIGHT, CARD_WIDTH, CARD_HEIGHT } from './utils/Constants.ts';
import { DeckManager } from './gameplay/DeckManager.ts';
import { drawCard, drawCardBack } from './ui/CardRenderer.ts';
import type { Card } from './core/Card.ts';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const deck = new DeckManager();
deck.init();
deck.shuffle();

let dealtCards: Card[] = [];

function draw() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Felt background
  ctx.fillStyle = '#0d5c2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw dealt cards in a horizontal row
  const startX = (CANVAS_WIDTH - dealtCards.length * (CARD_WIDTH + 10)) / 2;
  dealtCards.forEach((card, i) => {
    const x = startX + i * (CARD_WIDTH + 10);
    const y = CANVAS_HEIGHT / 2 - CARD_HEIGHT / 2;
    drawCard(ctx, card, x, y, true);
  });

  // Draw deck pile (card back) at left
  if (deck.remaining > 0) {
    drawCardBack(ctx, 30, CANVAS_HEIGHT - CARD_HEIGHT - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${deck.remaining} cards`, 30 + CARD_WIDTH / 2, CANVAS_HEIGHT - 20);
  }

  // Instructions
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    dealtCards.length === 0 ? 'Click anywhere to deal a card' : 'Click to deal another card',
    CANVAS_WIDTH / 2, 40,
  );

  // Last dealt card info
  if (dealtCards.length > 0) {
    const last = dealtCards[dealtCards.length - 1];
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Last card: ${last.rank} of ${last.suit}`, 20, 80);

    if (deck.remaining === 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Deck is empty! Click to reshuffle', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);
    }
  }
}

canvas.addEventListener('click', () => {
  if (deck.remaining === 0) {
    deck.recycle();
    dealtCards = [];
  }
  const cards = deck.deal(1);
  if (cards.length > 0) {
    dealtCards.push(cards[0]);
  }
  draw();
});

draw();
