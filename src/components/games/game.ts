import { Platform } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Car, Gavel } from 'lucide-react-native';
import type React from 'react';
import { appConfig } from '../../constants/appConfig';
import { COLOR_GREEN, COLOR_PRO, SURFACE_BLACK, SURFACE_DARK, SURFACE_MID } from '../../constants/config';
import { MAX_ATTEMPTS, type CarAnswer, type DailyGameKind } from '../../types/games';

/**
 * The Daily Games' shared helpers and look, ported from Car Spotter's
 * game.ts and games.tsx (trivia left behind with the app).
 */

/** The two games, in the order they're shown everywhere. */
export const DAILY_GAMES: {
  value: DailyGameKind;
  label: string;
  /** A line under the label on the landing's button. */
  blurb: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}[] = [
  { value: 'car', label: 'Guess the Car', blurb: 'Name it from a close-up', Icon: Car },
  { value: 'auction', label: 'Guess the Price', blurb: 'What did it sell for?', Icon: Gavel },
];

export const gameLabel = (g: DailyGameKind) => DAILY_GAMES.find((o) => o.value === g)?.label ?? 'Daily Game';

/** "Next car in" / "Next auction in". */
export const nextLabel = (g: DailyGameKind) => (g === 'auction' ? 'Next auction in' : 'Next car in');

/** The game screens' ground and their raised pieces — alfa's three surfaces. */
export const GAME_BG = SURFACE_DARK;
export const GAME_CARD = SURFACE_MID;
export const GAME_INSET = SURFACE_BLACK;

/** The game's side margin. */
export const GAME_GUTTER = 14;

/** One height for a guess chip and the fields under it, so made and to-be-made guesses read as one row. */
export const GUESS_ROW_H = 40;

/** Right and wrong: the feed's own pair (SpotResultBody) — the muted green and the Pro red. */
export const HIT = COLOR_GREEN;
export const MISS = COLOR_PRO;

/** The same two as fills under black text, for the guess chips and the result banner. */
export const HIT_SOFT = '#8FCB88';
export const MISS_SOFT = '#FF8A92';

/** The server clamps zoom to 1.5–8; clamped again so a bad row can't blow the image up. */
export const clampZoom = (z: number) => Math.min(8, Math.max(1.5, Number(z) || 3.5));
export const clamp01 = (n: number) =>
  Math.min(1, Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0.5));

/**
 * How far in the photo is after `attempts` misses: each backs the camera out
 * a fifth of the way to the whole photo, so the puzzle gets easier the longer
 * you're stuck.
 */
export function zoomForAttempts(zoom: number, attempts: number): number {
  const z = clampZoom(zoom);
  const t = Math.min(1, Math.max(0, attempts / MAX_ATTEMPTS));
  return z + (1 - z) * t;
}

// ── The other image modes ────────────────────────────────────────────────────
// New games are always zoom. These stay so a game begun in Car Spotter in
// another mode plays out the way it started.

const BLUR_STEPS = Platform.select({
  // Android's blur is heavier at the same radius.
  android: [10, 6, 4, 2, 1],
  default: [30, 18, 10, 5, 2],
});
export function blurForAttempts(attempts: number): number {
  return BLUR_STEPS[Math.min(Math.max(0, attempts), BLUR_STEPS.length - 1)];
}

/** Pixelated mode's photo for a number of misses — horacio draws the blocks. */
const PIXEL_VERSION = 3;
export function pixelatedImage(puzzleId: string, attempts: number): string {
  const level = Math.min(Math.max(0, attempts), MAX_ATTEMPTS - 1);
  return `${appConfig().API_BASE_URL}/api/carspot/pixelated/${encodeURIComponent(puzzleId)}/${level}?v=${PIXEL_VERSION}`;
}

/** 0–1 for `seed`, the same every time — every player sees the same jumps. */
export function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Scattered mode: a different spot on the car each miss, in the band the car almost always fills. */
const SCATTER_X = [0.22, 0.78];
const SCATTER_Y = [0.38, 0.72];
export function scatterFocus(puzzleId: string, attempts: number, first: { x: number; y: number }): { x: number; y: number } {
  const prev = attempts > 0 ? scatterFocus(puzzleId, attempts - 1, first) : null;
  const within = (v: number, [lo, hi]: number[]) => Math.min(hi, Math.max(lo, v));
  const anchor = { x: within(first.x, SCATTER_X), y: within(first.y, SCATTER_Y) };
  let spot = anchor;
  for (let tryN = 0; tryN < 8; tryN += 1) {
    const rx = SCATTER_X[0] + seeded(`${puzzleId}:${attempts}:${tryN}:x`) * (SCATTER_X[1] - SCATTER_X[0]);
    const ry = SCATTER_Y[0] + seeded(`${puzzleId}:${attempts}:${tryN}:y`) * (SCATTER_Y[1] - SCATTER_Y[0]);
    spot = { x: (rx + anchor.x) / 2, y: (ry + anchor.y) / 2 };
    if (!prev || Math.hypot(spot.x - prev.x, spot.y - prev.y) >= 0.12) return spot;
  }
  return spot;
}
export function scatterZoom(zoom: number, attempts: number): number {
  const z = Math.min(8, clampZoom(zoom) + 1.5);
  const t = Math.min(1, Math.max(0, attempts) / (MAX_ATTEMPTS - 1));
  return Math.max(1.6, z + (1.6 - z) * t);
}

// ── Words ────────────────────────────────────────────────────────────────────

/** "2019 Porsche 911 GT3" — year only when the entry has one. */
export function answerLabel(a?: CarAnswer | null): string {
  if (!a) return '';
  return [a.year, a.make, a.model].filter(Boolean).join(' ');
}

/** "$210,000" — whole dollars, grouped. */
export function formatPrice(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return '';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * An auction guess graded 1–10: 10 is a bullseye (within 5%), down to 1 for
 * way off. Read from the server's 0–100 score, which measures the miss as a
 * ratio so it's fair at any price.
 */
export function auctionGrade(score: number, bullseye?: boolean): number {
  if (bullseye ?? score >= 94) return 10;
  return Math.min(9, Math.max(1, Math.round(score / 10)));
}

/** A grade in a word, for beside the number. */
export function gradeWord(grade: number): string {
  if (grade >= 10) return 'Bullseye';
  if (grade === 9) return 'So close';
  if (grade >= 7) return 'Close';
  if (grade >= 5) return 'In the ballpark';
  if (grade >= 3) return 'Off the mark';
  return 'Way off';
}

/** 'YYYY-MM-DD' is a calendar day, not an instant — parsed as one so no timezone shifts it. */
export function dayLabel(d?: string | null, pattern = 'EEE, MMM d, yyyy'): string {
  if (!d) return '';
  try { return format(parseISO(d), pattern); } catch { return d; }
}

/** "3h 12m 05s" until `iso`, or null once it has passed. */
export function countdown(iso: string, now: number): string | null {
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${h}h ${pad(m)}m ${pad(sec)}s`;
}

/** "0:42", "12:05", "1:02:09". */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** A 404 from a `today` endpoint — nothing scheduled, not a failure. */
export const isNoGame = (error: unknown) => (error as { status?: number } | undefined)?.status === 404;
