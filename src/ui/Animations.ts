import type { Card } from '../core/Card.ts';
import { CARD_WIDTH, CARD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT } from '../utils/Constants.ts';

// ─── Easing ───
function easeOutQuad(t: number): number { return t * (2 - t); }
function easeOutBack(t: number): number {
  const c = 1.7;
  return 1 + c * Math.pow(t - 1, 3) + c * (t - 1) * (t - 1);
}
function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }

// ─── Types ───
export enum GameAnimState {
  Idle,
  CardFly,
  ScoreRoll,
  Done,
}

interface FlyingCard {
  card: Card;
  fromX: number; fromY: number; fromAngle: number;
  toX: number; toY: number; toAngle: number;
}

let state = GameAnimState.Idle;
let flyCards: FlyingCard[] = [];
let flyProgress = 0;
let flyDuration = 0.5;

let scoreProgress = 0;
let scoreDuration = 1.0;
let showChips = 0;
let showMult = 0;
let resultHandType = '';
let resultTotal = 0;

let floatTexts: { text: string; x: number; y: number; progress: number; duration: number }[] = [];

let onDone: (() => void) | null = null;

// ─── API ───

export function startPlayAnimation(
  cards: Card[],
  fromPositions: { x: number; y: number; angle: number }[],
  handType: string,
  chips: number,
  mult: number,
  callback: () => void,
): void {
  const targetX = CANVAS_WIDTH / 2;
  const targetY = CANVAS_HEIGHT / 2 - 80;

  flyCards = cards.map((card, i) => {
    const fp = fromPositions[i] ?? { x: targetX, y: targetY, angle: 0 };
    const angleOff = (i - (cards.length - 1) / 2) * 5;
    return {
      card,
      fromX: fp.x, fromY: fp.y, fromAngle: fp.angle,
      toX: targetX + (i - (cards.length - 1) / 2) * 40,
      toY: targetY + Math.sin((i / cards.length) * Math.PI) * 20,
      toAngle: angleOff,
    };
  });

  flyProgress = 0;
  scoreProgress = 0;
  showChips = 0;
  showMult = 0;
  resultHandType = handType;
  resultTotal = chips * mult;
  state = GameAnimState.CardFly;
  onDone = callback;
}

export function addFloatText(text: string, x: number, y: number): void {
  floatTexts.push({ text, x, y, progress: 0, duration: 1.2 });
}

export function getState(): GameAnimState { return state; }
export function getFlyProgress(): number { return flyProgress; }
export function getScoreProgress(): number { return scoreProgress; }
export function getFlyingCards(): FlyingCard[] { return flyCards; }
export function getShowChips(): number { return showChips; }
export function getShowMult(): number { return showMult; }
export function getResultHandType(): string { return resultHandType; }
export function getResultTotal(): number { return resultTotal; }
export function getFloatTexts() { return floatTexts; }

/** Returns true if still animating */
export function update(dt: number): boolean {
  let busy = false;

  // Update float texts (always)
  for (const ft of floatTexts) {
    ft.progress = Math.min(1, ft.progress + dt / ft.duration);
  }
  floatTexts = floatTexts.filter(ft => ft.progress < 1);
  if (floatTexts.length > 0) busy = true;

  switch (state) {
    case GameAnimState.Idle:
      return busy;

    case GameAnimState.CardFly:
      flyProgress = Math.min(1, flyProgress + dt / flyDuration);
      if (flyProgress >= 1) {
        state = GameAnimState.ScoreRoll;
      }
      busy = true;
      break;

    case GameAnimState.ScoreRoll:
      scoreProgress = Math.min(1, scoreProgress + dt / scoreDuration);
      const eased = easeOutCubic(scoreProgress);
      showChips = Math.round(eased * 100);
      showMult = Math.round(eased * 10);
      if (scoreProgress >= 1) {
        showChips = 100;
        showMult = 10;
        state = GameAnimState.Done;
        // Add float text for total
        addFloatText(`+${resultTotal}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
      }
      busy = true;
      break;

    case GameAnimState.Done:
      busy = floatTexts.length > 0;
      if (!busy) {
        state = GameAnimState.Idle;
        onDone?.();
        onDone = null;
      }
      break;
  }

  return busy || floatTexts.length > 0;
}

export function reset(): void {
  state = GameAnimState.Idle;
  flyCards = [];
  flyProgress = 0;
  scoreProgress = 0;
  floatTexts = [];
  onDone = null;
}

// ─── Render ───

export function renderAnimations(
  ctx: CanvasRenderingContext2D,
  renderCard: (card: Card, x: number, y: number, angle: number) => void,
): void {
  if (state === GameAnimState.CardFly) {
    const easePos = easeOutQuad(flyProgress);
    const easeScale = 1 - 0.15 * Math.sin(flyProgress * Math.PI); // slight scale pulse

    for (const fc of flyCards) {
      const x = fc.fromX + (fc.toX - fc.fromX) * easePos;
      const y = fc.fromY + (fc.toY - fc.fromY - 80) * easePos; // arc up
      // Parabolic arc: add vertical arc
      const arcY = -60 * Math.sin(easePos * Math.PI);
      const angle = fc.fromAngle + (fc.toAngle - fc.fromAngle) * easePos;

      ctx.save();
      ctx.translate(x, y + arcY);
      ctx.scale(easeScale, easeScale);
      ctx.translate(-x, -y);
      renderCard(fc.card, x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, angle);
      ctx.restore();
    }
  }

  if (state === GameAnimState.ScoreRoll || state === GameAnimState.Done) {
    // Show result text
    const alpha = Math.min(1, scoreProgress * 1.5);
    const scale = easeOutBack(Math.min(1, scoreProgress * 1.2));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = alpha;

    // Hand type
    ctx.font = `bold ${Math.round(28 * scale)}px monospace`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(resultHandType, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    // Chips and mult
    ctx.font = '18px monospace';
    ctx.fillStyle = '#fff';
    const displayChips = Math.min(showChips, 100);
    const displayMult = Math.min(showMult, 10);
    ctx.fillText(
      `${displayChips} chips × ${displayMult} mult`,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 28,
    );

    ctx.restore();
  }

  // Float texts
  for (const ft of floatTexts) {
    const alpha = 1 - ft.progress;
    const yOffset = -40 * ft.progress;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(ft.text, ft.x, ft.y + yOffset);
    ctx.restore();
  }
}

// Draw cards that are flying back (after play)
export function isAnimating(): boolean {
  return state !== GameAnimState.Idle;
}
