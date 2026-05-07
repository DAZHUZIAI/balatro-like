import type { Card } from '../core/Card.ts';
import { SUIT_SYMBOLS, SUIT_COLORS, RANK_LABELS } from '../core/CardType.ts';
import { CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS } from '../utils/Constants.ts';

export function drawCard(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number, faceUp: boolean): void {
  if (faceUp) {
    drawCardFace(ctx, card, x, y);
  } else {
    drawCardBack(ctx, x, y);
  }
}

function drawCardFace(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number): void {
  const color = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];
  const label = RANK_LABELS[card.rank];

  // Card background
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  ctx.fill();
  ctx.stroke();

  // Rank label top-left
  ctx.fillStyle = color;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 6, y + 4);

  // Suit symbol near rank
  ctx.font = '12px monospace';
  ctx.fillText(symbol, x + 6, y + 22);

  // Large center suit
  ctx.font = '32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
}

export function drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#1a237e';
  ctx.strokeStyle = '#0d1557';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  ctx.fill();
  ctx.stroke();

  // Simple pattern on back
  ctx.fillStyle = '#283593';
  ctx.font = '24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
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
