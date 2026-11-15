import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { GAME_BG } from './game';

/**
 * How far either side of the price the meter reaches: the ratio at which a
 * guess scores 0 (horacio's helpers/spotDaily SCORE_SPAN) — 2.5x over, or
 * 40% of the price under.
 */
const SPAN = 2.5;
const LOG_SPAN = Math.log(SPAN);

/** "$190k", "$1.2M", "$850" — short enough to sit on a meter. */
export function shortPrice(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
}

/**
 * Where on the meter a guess lands, -1 (40% of the price or less) to 1
 * (2.5x or more), the price at 0. A ratio, so double sits as far right as
 * half sits left — the way the guess is scored.
 */
const position = (guess: number, price: number) =>
  Math.max(-1, Math.min(1, Math.log(guess / price) / LOG_SPAN));

/**
 * The ten grade bands, as distances from the middle (0 to 1): grade g is a
 * score of 10g±5, and a score is 100·(1−|position|). The bullseye is within
 * 5% of the price either way.
 */
const BULL = Math.log(1.05) / LOG_SPAN;
const bands = Array.from({ length: 10 }, (_, i) => {
  const g = i + 1;
  if (g === 10) return { g, from: 0, to: BULL };
  const from = g === 9 ? BULL : Math.max(BULL, 1 - (10 * g + 5) / 100);
  const to = g === 1 ? 1 : 1 - (10 * g - 5) / 100;
  return { g, from, to };
});

const TRACK_Y = 62;
const TRACK_H = 24;
const HEIGHT = TRACK_Y + TRACK_H + 56;
/** The two ticks — the price and your guess — heavy enough to read first. */
const TICK = 3.5;
/** Clear space between a tick's end and its badge. */
const LABEL_GAP = 7;
const PAD = 6;

/** A label's badge: its height, font size and side padding. */
const BADGE_H = 20;
const BADGE_FONT = 12;
const BADGE_PAD = 7;
/** Roughly how wide a run of text is at a size — enough to size a badge around it. */
const textWidth = (text: string, size: number) => text.length * size * 0.62;

/** A label word's size, and its space from its badge. */
const WORD_FONT = 11;
const WORD_GAP = 4;

/**
 * A price in a rounded badge centred on `x`, so its tick runs straight into
 * it, with its word stacked on it — "You" above, "Sold" below — and the pair
 * slid along to stay inside the meter at either end. `y` is the badge's middle.
 */
function BadgeLabel({ x, y, word, wordAt, value, fill, textFill, wordFill = '#FFFFFF', min, max }: {
  x: number; y: number; word: string; wordAt: 'above' | 'below'; value: string;
  fill: string; textFill: string; wordFill?: string; min: number; max: number;
}) {
  const badgeW = textWidth(value, BADGE_FONT) + BADGE_PAD * 2;
  const half = Math.max(badgeW, textWidth(word, WORD_FONT)) / 2;
  const cx = Math.max(min + half, Math.min(max - half, x));
  const baseline = y + BADGE_FONT * 0.36;
  const wordY = wordAt === 'above'
    ? y - BADGE_H / 2 - WORD_GAP
    : y + BADGE_H / 2 + WORD_GAP + WORD_FONT * 0.8;
  return (
    <>
      <Rect x={cx - badgeW / 2} y={y - BADGE_H / 2} width={badgeW} height={BADGE_H} rx={BADGE_H / 2} fill={fill} />
      <SvgText x={cx} y={baseline} fontSize={BADGE_FONT} fontWeight="800" fill={textFill} textAnchor="middle">{value}</SvgText>
      <SvgText x={cx} y={wordY} fontSize={WORD_FONT} fontWeight="700" fill={wordFill} textAnchor="middle">{word}</SvgText>
    </>
  );
}

/**
 * An auction guess against the price it sold for, on one scale: the price
 * in the middle, the meter running out to where a guess scores nothing (2.5x
 * either way, unlabelled), the
 * ten grade bands shaded stronger toward the middle — the band the guess
 * landed in fully lit — your guess pinned above, the price below.
 */
export default function PriceMeter({ guess, price, grade, sold = true }: {
  guess: number;
  price: number;
  /** 1–10, as the game graded it — the band that's lit. */
  grade: number;
  sold?: boolean;
}) {
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const t = position(guess, price);
  const offScale = Math.abs(Math.log(guess / price)) > LOG_SPAN;
  const left = PAD;
  const right = width - PAD;
  const mid = width / 2;
  const half = (right - left) / 2;
  const xOf = (p: number) => mid + p * half;
  const gx = xOf(t);
  // A label kept inside the meter: anchored to whichever edge it's near.

  return (
    <View onLayout={onLayout} style={{ height: HEIGHT }} accessible
      accessibilityLabel={`Your guess ${shortPrice(guess)}, ${sold ? 'sold for' : 'bid to'} ${shortPrice(price)}: ${grade} out of 10`}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {/* The bands, both sides of the price: one hue, stronger toward the middle. */}
          {bands.flatMap(({ g, from, to }) => [-1, 1].map((side) => {
            const a = xOf(side * from);
            const b = xOf(side * to);
            const hit = g === grade && (g === 10 || Math.sign(t) === side);
            return (
              <Rect
                key={`${g}:${side}`}
                x={Math.min(a, b)}
                y={TRACK_Y}
                width={Math.max(0.5, Math.abs(b - a) - 1)}
                height={TRACK_H}
                fill={brand}
                opacity={hit ? 1 : 0.08 + (g / 10) * 0.3}
              />
            );
          }))}

          {/* The price, down the middle, and labelled under the meter. */}
          {/* From just above the track to just short of its badge, below. */}
          {/* In the price's colour, edged dark so it still shows on a lit bullseye. */}
          <Line x1={mid} y1={TRACK_Y - 5} x2={mid} y2={TRACK_Y + TRACK_H + 8} stroke={GAME_BG} strokeWidth={TICK + 3} strokeLinecap="round" />
          <Line x1={mid} y1={TRACK_Y - 5} x2={mid} y2={TRACK_Y + TRACK_H + 8} stroke={brand} strokeWidth={TICK} strokeLinecap="round" />
          <BadgeLabel
            x={mid}
            y={TRACK_Y + TRACK_H + 8 + LABEL_GAP + BADGE_H / 2}
            word={sold ? 'Sold' : 'Bid to'}
            wordAt="below"
            wordFill={brand}
            value={shortPrice(price)}
            fill={brand}
            textFill={brandText}
            min={left}
            max={right}
          />

          {/* Your guess: a tick through the meter, its badge just above. */}
          <Line x1={gx} y1={TRACK_Y - 8} x2={gx} y2={TRACK_Y + TRACK_H + 5} stroke="#FFFFFF" strokeWidth={TICK} strokeLinecap="round" />
          <BadgeLabel
            x={gx}
            y={TRACK_Y - 8 - LABEL_GAP - BADGE_H / 2}
            word="You"
            wordAt="above"
            value={`${shortPrice(guess)}${offScale ? (t < 0 ? ' ◀' : ' ▶') : ''}`}
            fill="#FFFFFF"
            textFill="#000000"
            min={left}
            max={right}
          />
        </Svg>
      ) : null}
    </View>
  );
}
