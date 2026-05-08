import type { Card } from '../core/Card.ts';
import { SUIT_SYMBOLS, SUIT_COLORS, RANK_LABELS } from '../core/CardType.ts';
import { CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS } from '../utils/Constants.ts';

export function drawCard(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number, y: number,
  faceUp: boolean,
  angle = 0,
): void {
  ctx.save();
  const cx = x + CARD_WIDTH / 2;
  const cy = y + CARD_HEIGHT / 2;
  ctx.translate(cx, cy);
  if (angle !== 0) ctx.rotate(angle * Math.PI / 180);
  ctx.translate(-cx, -cy);

  if (faceUp) {
    drawCardFace(ctx, card, x, y);
  } else {
    drawCardBack(ctx, x, y);
  }

  ctx.restore();
}

export function drawCardFaceAt(ctx: CanvasRenderingContext2D, card: Card, cx: number, cy: number, angle = 0): void {
  drawCard(ctx, card, cx - CARD_WIDTH / 2, cy - CARD_HEIGHT / 2, true, angle);
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

  // Enhancement indicators
  if (card.enhancement) {
    drawEnhancement(ctx, card, x, y);
  }
}

function drawEnhancement(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number): void {
  switch (card.enhancement) {
    case 'stone':
      ctx.save();
      ctx.fillStyle = 'rgba(100, 100, 100, 0.25)';
      roundRect(ctx, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
      ctx.fill();
      ctx.fillStyle = '#888';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('S', x + CARD_WIDTH - 6, y + CARD_HEIGHT - 4);
      ctx.restore();
      break;
    case 'glass':
      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      roundRect(ctx, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('G', x + CARD_WIDTH - 6, y + CARD_HEIGHT - 4);
      ctx.restore();
      break;
    case 'diamond_bonus':
    case 'heart_bonus':
    case 'spade_bonus':
    case 'club_bonus': {
      const symbolMap: Record<string, string> = {
        diamond_bonus: '♦', heart_bonus: '♥', spade_bonus: '♠', club_bonus: '♣',
      };
      const colorMap: Record<string, string> = {
        diamond_bonus: '#e63946', heart_bonus: '#e63946',
        spade_bonus: '#1a1a2e', club_bonus: '#1a1a2e',
      };
      ctx.save();
      ctx.fillStyle = colorMap[card.enhancement];
      ctx.font = '14px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(symbolMap[card.enhancement], x + CARD_WIDTH - 6, y + 4);
      ctx.restore();
      break;
    }
  }
}

export function drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#1a237e';
  ctx.strokeStyle = '#0d1557';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#283593';
  ctx.font = '24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
}

export function roundRect(
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

/** Compute fan position for a card in hand */
export function getFanPosition(
  index: number,
  total: number,
  centerX: number,
  baseY: number,
  maxSpread?: number,
): { x: number; y: number; angle: number } {
  if (total <= 1) return { x: centerX, y: baseY, angle: 0 };

  const maxAngle = 18;
  const spread = Math.min(maxSpread ?? 350, total * 40);
  const progress = total <= 1 ? 0 : (index / (total - 1)) * 2 - 1; // -1 to 1
  const angle = -progress * maxAngle;
  const x = centerX + progress * spread / 2;
  const y = baseY - Math.abs(progress) * 15;

  return { x, y, angle };
}

/** Z-order for fan: middle on top */
export function fanDrawOrder(total: number): number[] {
  const order: number[] = [];
  if (total <= 1) return [0];
  let left = Math.floor((total - 1) / 2);
  let right = left + 1;
  while (left >= 0 || right < total) {
    if (right < total) order.push(right++);
    if (left >= 0) order.push(left--);
  }
  return order;
}

/** Compute position for a card in a vertical cascade */
export function getCascadePosition(
  index: number,
  startX: number,
  startY: number,
  overlap: number,
): { x: number; y: number; angle: number } {
  return { x: startX, y: startY + index * overlap, angle: 0 };
}

/** Z-order for cascade: bottom card on top (drawn last) */
export function cascadeDrawOrder(total: number): number[] {
  return Array.from({ length: total }, (_, i) => i);
}
