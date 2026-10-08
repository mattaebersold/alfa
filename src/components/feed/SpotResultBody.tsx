import React, { useEffect, useState } from 'react';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { View, TouchableOpacity, StyleSheet, Platform, type LayoutChangeEvent } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { ChevronRight, Plus, Minus } from 'lucide-react-native';
import Svg, { G, Path } from 'react-native-svg';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import Avatar, { type AvatarUser } from '../ui/Avatar';
import {
  useGetLoggedInUserQuery, useGetCarSpotTodayQuery, useGetCarSpotDayQuery,
} from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { SOURCE_APPS, openSourceApp } from '../../constants/sourceApps';
import {
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_GRAY_10,
  COLOR_GRAY_22,
  COLOR_RED,
  COLOR_SPOTTER_GREEN,
  COLOR_SHEEN_GOLD,
} from '../../constants/config';
import type { CarSpotSummary, CarSpotPlay, CarSpotSharedResult, CarSpotDifficulty } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts'

/** The game's own right/wrong colours, so the grid reads the same as in Car Spotter. */
const HIT = COLOR_SPOTTER_GREEN;
const MISS = COLOR_RED;
const MAX_ATTEMPTS = 5;

/**
 * How soft the preview is — enough that the car can't be read off it.
 *
 * Android blurs the bitmap before the view's scale is applied, and the
 * preview is scaled up several times to zoom on the focus point — so the
 * blur comes out magnified by the zoom, and a radius that's gentle on iOS is
 * a wash there. The smallest radius that still blurs is enough.
 */
const PREVIEW_BLUR = Platform.OS === 'android' ? .7 :.7;

/** The puzzle photo's side: a small thumbnail set into the card, not a banner across it. */
const PHOTO = 60;

const SPOT_ICON = require('../../../assets/apps/spot-icon.png');

/** The server clamps zoom to 1.5–8; clamped again here so a bad row can't blow the image up. */
const clampZoom = (z: number) => Math.min(8, Math.max(1.5, Number(z) || 3.5));
const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0.5));

const DIFFICULTY_ORDER: CarSpotDifficulty[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABEL: Record<CarSpotDifficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
/** How many chilies each is — the Car Spotter app's own marks. */
const DIFFICULTY_HEAT: Record<CarSpotDifficulty, number> = { easy: 1, medium: 2, hard: 3 };
const DIFFICULTY_COLOR: Record<CarSpotDifficulty, string> = {
  easy: COLOR_SPOTTER_GREEN, medium: COLOR_SHEEN_GOLD, hard: COLOR_RED,
};

/**
 * A post's games, easy to hard: its `results`, or — a post shared before
 * there were difficulties — the one game its flat fields describe, medium.
 */
export function spotResultsOf(carspot: CarSpotSummary): CarSpotSharedResult[] {
  const list = carspot.results?.length ? carspot.results : [{
    difficulty: carspot.difficulty ?? 'medium',
    attempts: carspot.attempts,
    won: carspot.won,
    time_ms: carspot.time_ms ?? null,
    grid: Array.isArray(carspot.grid) ? carspot.grid : [],
    image: carspot.image,
    focus_x: carspot.focus_x,
    focus_y: carspot.focus_y,
    zoom: carspot.zoom,
  }];
  return [...list].sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty));
}

/** One outlined chili on a 24-unit grid — the same drawing as the Car Spotter app's. */
const PEPPER = [
  'M4 9.5c0 6 5 11 17 11.5c-5-3-7.5-7-9-12',
  'M4 9.5c1.5-2.5 5-3.2 8-1',
  'M8 7.4c-.3-2.2.5-3.9 2.6-4.9',
];

function Peppers({ count, size, color }: { count: number; size: number; color: string }) {
  const width = 24 + (count - 1) * 19;
  return (
    <Svg width={(size * width) / 24} height={size} viewBox={`0 0 ${width} 24`} fill="none">
      {Array.from({ length: count }, (_, i) => (
        <G key={i} transform={`translate(${i * 19} 0)`} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          {PEPPER.map((d) => <Path key={d} d={d} />)}
        </G>
      ))}
    </Svg>
  );
}

/** Which of the day's three cars a game was: its chilies and its name. */
export function SpotDifficultyBadge({ difficulty }: { difficulty: CarSpotDifficulty }) {
  const colors = useColors();
  const color = DIFFICULTY_COLOR[difficulty];
  return (
    <View style={[styles.difficultyBadge, { borderColor: `${color}66` }]} accessibilityLabel={`${DIFFICULTY_LABEL[difficulty]} difficulty`}>
      <Peppers count={DIFFICULTY_HEAT[difficulty]} size={11} color={color} />
      <Text style={[styles.difficultyText, { color: colors.fg }]}>{DIFFICULTY_LABEL[difficulty]}</Text>
    </View>
  );
}

interface SpotResultBodyProps {
  carspot: CarSpotSummary;
  /** Who shared it — their face beside their score, against the viewer's. */
  author?: AvatarUser | null;
  /**
   * Side padding, to line up with the host's own — the feed card insets by 8,
   * the detail screen by 16.
   */
  inset?: number;
  /**
   * Draw the get-the-app / play-today button under the result. Off for a host
   * that places SpotResultAction itself (the feed card's footer row).
   */
  action?: boolean;
}

/**
 * The puzzle photo as players first saw it: a square window onto the photo,
 * zoomed in on the admin's chosen focus point.
 *
 * The same rule as the Car Spotter app's own ZoomedPuzzleImage, so the feed
 * shows the crop the player was shown: the photo covers the window centred,
 * and is scaled about the spot where the focus point lands in that centred
 * cover. Scaling about a point inside the window, rather than centring the
 * focus, means the window never slides off the photo's edge. Where the focus
 * lands depends on the photo's shape, so it's worked out once the photo and
 * the window have reported their sizes (and is exact before that whenever
 * the photo is square).
 *
 * The origin goes in as [x, y, z] with two decimals, not as an "x% y%"
 * string: RN parses the string form with a whole-numbers-only pattern, so a
 * focus of 0.334 came apart into "4%" and the crop landed off the car — which
 * is why a shared result could show an empty corner instead of the photo.
 */
type PuzzleCrop = Pick<CarSpotSharedResult, 'image' | 'focus_x' | 'focus_y' | 'zoom'>;

function ZoomedPuzzleImage({ carspot }: { carspot: PuzzleCrop }) {
  const [photo, setPhoto] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const fx = clamp01(carspot.focus_x);
  const fy = clamp01(carspot.focus_y);
  const focus = zoomOrigin(fx, fy, photo, box);

  return (
    <View
      style={styles.imageWindow}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
      }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            transformOrigin: [`${focus.x.toFixed(2)}%`, `${focus.y.toFixed(2)}%`, 0],
            transform: [{ scale: clampZoom(carspot.zoom) }],
          },
        ]}
      >
        <Image
          source={{ uri: imageUrl(carspot.image) ?? undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          transition={150}
          // Full resolution: expo-image otherwise shrinks the picture to the
          // size of its view, and the zoom is a transform on top of that — it
          // would be magnifying a thumbnail, not the photo.
          allowDownscaling={false}
          // Softened: the card says a game was played, not what the car was —
          // the crop already hides most of it, and the blur takes the rest, so
          // a feed full of results spoils nothing for anyone yet to play.
          blurRadius={PREVIEW_BLUR}
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width > 0 && height > 0) {
              setPhoto((p) => (p && p.w === width && p.h === height ? p : { w: width, h: height }));
            }
          }}
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}

/**
 * Where the focus is, in percent of the window: the point where it lands once
 * the photo covers the window centred. Kept inside the window — a focus in a
 * part of the photo that's cropped off gets the nearest edge. Until the photo
 * and window sizes are known, the focus's own share of the window.
 */
function zoomOrigin(
  fx: number, fy: number,
  photo: { w: number; h: number } | null, box: { w: number; h: number } | null,
): { x: number; y: number } {
  if (!photo || !box || !box.w || !box.h) return { x: fx * 100, y: fy * 100 };
  const k = Math.max(box.w / photo.w, box.h / photo.h);
  const w = photo.w * k;
  const h = photo.h * k;
  const x = clamp01(((box.w - w) / 2 + fx * w) / box.w);
  const y = clamp01(((box.h - h) / 2 + fy * h) / box.h);
  return { x: x * 100, y: y * 100 };
}

const finished = (p?: CarSpotPlay | null): p is CarSpotPlay => !!p && (p.status === 'won' || p.status === 'lost');

/** "3/5", or "✗" for a game that ran out — the number alone would read as a score. */
const scoreOf = (won: boolean, attempts: number) => (won ? `${attempts}/${MAX_ATTEMPTS}` : '✗');

interface Game { won: boolean; attempts: number; time_ms?: number | null }

/**
 * Who took the day: a win over a loss, then fewer guesses, then — the same
 * number of guesses — the quicker game. Null when nothing separates them:
 * both stumped, or the same score with no time to settle it (a result shared
 * before games were timed, or a late game, which isn't).
 */
function winnerOf(me: Game, them: Game): 'me' | 'them' | null {
  if (me.won !== them.won) return me.won ? 'me' : 'them';
  if (!me.won) return null;
  if (me.attempts !== them.attempts) return me.attempts < them.attempts ? 'me' : 'them';
  const a = me.time_ms ?? null;
  const b = them.time_ms ?? null;
  if (a == null || b == null || a === b) return null;
  return a < b ? 'me' : 'them';
}

/**
 * Where the viewer stands against this result, from what their own account
 * says. Three answers:
 *  - `download`: not a Car Spotter player yet — the app, to get;
 *  - `play`: a player who hasn't finished today's — today's puzzle, to play;
 *  - `compare`: a player who played the day this result is from — the two
 *    games side by side (`mine` is theirs).
 * Null for a player who has played today but not the (older) day this is
 * about — there's no puzzle left to send them to — and for the author, since
 * it's their own result.
 */
function useSpotStanding(
  carspot: CarSpotSummary, difficulty: CarSpotDifficulty, author?: SpotResultBodyProps['author'],
) {
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: me } = useGetLoggedInUserQuery(undefined, { skip: !myId });
  // Missing means an account from before the field, which is an ORS-only one.
  const hasSpot = !!me?.accounts?.includes('spot');
  const date = carspot.play_date;

  // The viewer's game of the same day in the same difficulty — those are what compare.
  const { data: day } = useGetCarSpotDayQuery({ date, difficulty }, { skip: !hasSpot || !date });
  const isToday = !!day && day.today === date;
  // Only needed when the post is about an earlier day — otherwise the day's
  // answer already says whether today has been played.
  const { data: today } = useGetCarSpotTodayQuery(difficulty, { skip: !hasSpot || !day || isToday });

  const isMine = !!myId && !!author?.user_id && author.user_id === myId;
  if (isMine) return null;
  if (me && !hasSpot) return { kind: 'download' as const };
  // Not answered yet (or no account to answer for): nothing to say.
  if (!day) return null;
  if (finished(day.play)) return { kind: 'compare' as const, mine: day.play };
  const playedToday = isToday ? finished(day.play) : finished(today?.play);
  return playedToday ? null : { kind: 'play' as const };
}

/**
 * What the viewer does with it, in one slot: the app to get, today's puzzle
 * to play, or — once both have played that day — the two games side by side:
 * your face and your score, their face and theirs. Nothing when there's none
 * of those. Exported so a host can put it where its own actions are — the
 * feed card sets it in its footer row, beside the like and comment.
 */
export function SpotResultAction({ carspot, author, result }: Pick<SpotResultBodyProps, 'carspot' | 'author'> & {
  /** Which of the post's games to answer — its only one when left out. */
  result?: CarSpotSharedResult;
}) {
  const colors = useColors();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: me } = useGetLoggedInUserQuery(undefined, { skip: !myId });
  const game = result ?? spotResultsOf(carspot)[0];
  const standing = useSpotStanding(carspot, game.difficulty, author);
  if (!standing) return null;

  if (standing.kind === 'compare') {
    const mine = standing.mine;
    const iWon = mine.status === 'won';
    const winner = winnerOf(
      { won: iWon, attempts: mine.attempts, time_ms: mine.time_ms },
      { won: game.won, attempts: game.attempts, time_ms: game.time_ms },
    );
    // Capped, so a long name doesn't stretch the pill.
    const theirName = author?.username
      ? (author.username.length > 10 ? `${author.username.slice(0, 10)}…` : author.username)
      : 'Them';
    // Each side a column — crown, face and score, then whose it is — so the
    // two read as a head-to-head rather than a row of numbers.
    const side = (user: AvatarUser | undefined, won: boolean, attempts: number, grid: [boolean, boolean][] | undefined, label: string, crowned: boolean) => (
      <View style={styles.side}>
        <View style={styles.sideRow}>
          {/* The crown sits on the face itself, not over the pair. */}
          <View style={styles.face}>
            <Avatar user={user} size={22} />
            {/* Tipped onto the face's top-left corner, at eleven o'clock. */}
            {crowned ? (
              <View style={styles.crown} pointerEvents="none">
                <SimpleCrown size={14} color={COLOR_SHEEN_GOLD} />
              </View>
            ) : null}
          </View>
          <GuessDots won={won} attempts={attempts} grid={grid} />
        </View>
        <Text style={[styles.sideLabel, { color: colors.muted }]} numberOfLines={1}>{label}</Text>
      </View>
    );
    return (
      <View
        style={[styles.appBtn, styles.compare, { backgroundColor: COLOR_GRAY_10, borderColor: colors.borderDark }]}
        accessibilityLabel={`${DIFFICULTY_LABEL[game.difficulty]}: you ${scoreOf(iWon, mine.attempts)}, ${theirName} ${scoreOf(game.won, game.attempts)}${
          winner === 'me' ? '. You won' : winner === 'them' ? `. ${theirName} won` : ''}`}
      >
        {side(me ?? undefined, iWon, mine.attempts, mine.guesses?.map((g) => [!!g.make_correct, !!g.model_correct] as [boolean, boolean]), 'You', winner === 'me')}
        <View style={[styles.divider, { backgroundColor: colors.borderDark }]} />
        {side(author ?? undefined, game.won, game.attempts, Array.isArray(game.grid) ? game.grid : undefined, theirName, winner === 'them')}
      </View>
    );
  }

  const play = standing.kind === 'play';
  // Dark either way: the app's icon carries its colour, and a green slab in
  // the footer outshone the post it was under.
  return (
    <TouchableOpacity
      onPress={() => openSourceApp(SOURCE_APPS.spot)}
      activeOpacity={0.8}
      accessibilityRole="link"
      style={[styles.appBtn, { backgroundColor: COLOR_GRAY_22, borderColor: colors.borderDark }]}
    >
      <Image source={SPOT_ICON} style={styles.appIcon} contentFit="cover" />
      <Text style={[styles.appBtnText, { color: colors.fg }]} numberOfLines={1}>
        {play ? "Play today's puzzle" : 'Get the guessing game app'}
      </Text>
      <ChevronRight size={15} color={colors.muted} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

/** A plain three-point crown, one solid shape — reads at a dozen pixels where a detailed one doesn't. */
function SimpleCrown({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 20 16">
      <Path d="M1 3 L6 8 L10 1 L14 8 L19 3 L17 15 H3 Z" fill={color} />
    </Svg>
  );
}

/**
 * A game as the card's table in miniature: a row of dots for the make and
 * one for the model, a column per guess, green where it was right — in
 * place of "3/5". Without the guesses themselves (an old share), each miss
 * is red on both rows and a win's last guess green.
 */
function GuessDots({ won, attempts, grid }: { won: boolean; attempts: number; grid?: [boolean, boolean][] }) {
  const n = Math.max(1, Math.min(grid?.length || attempts || MAX_ATTEMPTS, MAX_ATTEMPTS));
  const cols = Array.from({ length: n }, (_, i): [boolean, boolean] =>
    grid?.[i] ?? (won && i === n - 1 ? [true, true] : [false, false]));
  return (
    <View style={styles.dots}>
      {[0, 1].map((row) => (
        <View key={row} style={styles.dotRow}>
          {cols.map((c, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: c[row] ? HIT : MISS }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * The feed's spot result folds down to its header row — "@name played Guess
 * the car" — and this opens it. A feed with a few friends playing daily was
 * mostly game grids; folded, each is one line, and the grid is a tap away.
 */
/** The game's day as a small badge — the folded card's header shows it beside the chevron. */
export function SpotDateBadge({ carspot }: { carspot: CarSpotSummary }) {
  const colors = useColors();
  if (!carspot.play_date) return null;
  return (
    <View style={[styles.headerDateBadge, { backgroundColor: colors.fg }]}>
      <Text style={[styles.date, { color: colors.bg }]}>{shortDateLabel(carspot.play_date)}</Text>
    </View>
  );
}

/** "2026-10-08" → "10/8", read from the parts so the viewer's timezone can't shift the day. */
function shortDateLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[2])}/${Number(m[3])}` : date;
}

export function SpotExpandButton({ open, onToggle, color }: {
  open: boolean;
  onToggle: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={open ? 'Hide the game' : 'Show the game'}
      accessibilityState={{ expanded: open }}
      style={styles.expandBtn}
    >
      {open
        ? <Minus size={13} color={color} strokeWidth={3.2} />
        : <Plus size={13} color={color} strokeWidth={3.2} />}
    </TouchableOpacity>
  );
}

const SPOT_OPEN_MS = 260;

/**
 * The opened part of a game result, sliding open and shut under the header.
 *
 * The content is measured where it lies unclipped, and the wrapper's height
 * runs between none and that — so it opens to exactly its own size, and
 * keeps up if something in it (a photo arriving) changes that size later.
 * Kept mounted until it has finished closing, so it slides shut rather than
 * vanishing.
 */
export function SpotCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    if (open) setMounted(true);
    progress.value = withTiming(
      open ? 1 : 0,
      { duration: SPOT_OPEN_MS, easing: Easing.out(Easing.cubic) },
      (done) => { if (done && !open) runOnJS(setMounted)(false); },
    );
  }, [open]);

  const style = useAnimatedStyle(() => ({ height: progress.value * height, opacity: progress.value }));

  if (!mounted) return null;
  return (
    <Animated.View style={[styles.collapse, style]}>
      <View style={styles.collapseInner} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

/**
 * A shared Car Spotter result, drawn instead of a post's text and photos.
 *
 * The post's `body` is the emoji version of the same thing (🟩🟥 rows) for
 * surfaces that can only show text; here we have the structured `carspot`
 * summary, so the grid is drawn properly and the emoji are left out. The
 * answer is never on the post — a result is shareable the day it's played
 * without spoiling it for anyone who hasn't.
 *
 * The photo as a square on the left, the game beside it, and under both what
 * the viewer can do about it (SpotFooter). Only the middle of the card:
 * author, likes, comments and menus stay the host's, the same as for any
 * other post.
 */
/** One game: the photo as a square on the left, the guesses as a small table beside it. */
function SpotGame({ result, inset }: { result: CarSpotSharedResult; inset: number }) {
  const colors = useColors();
  const grid = Array.isArray(result.grid) ? result.grid : [];
  const attempts = result.attempts || grid.length;
  const summary = result.won
    ? `Got it in ${attempts}/${MAX_ATTEMPTS}`
    : `Stumped — ${attempts}/${MAX_ATTEMPTS}`;

  return (
    <View style={[styles.main, { paddingHorizontal: inset }]}>
      <ZoomedPuzzleImage carspot={result} />

      {/* The guesses as a small table: a row for the make and one for the
          model, the guesses running across in the order they were made,
          spread over the width beside the picture. */}
      <View style={[styles.table, { borderColor: TABLE_RULE }]} accessibilityLabel={`${summary}. Guesses: ${grid.map(([mk, md], i) =>
        `${i + 1}: make ${mk ? 'right' : 'wrong'}, model ${md ? 'right' : 'wrong'}`).join('; ')}`}>
        {(['Make', 'Model'] as const).map((label, col) => (
          <View key={label} style={[styles.tableRow, col > 0 && styles.ruledRow, { borderColor: TABLE_RULE }]}>
            <View style={styles.rowLabel}>
              <Text style={[styles.rowLabelText, { color: colors.muted }]}>{label}</Text>
            </View>
            {COLUMNS.map((i) => (
              <View key={i} style={[styles.cellBox, { borderColor: TABLE_RULE }]}>
                {grid[i] ? <View style={[styles.cell, { backgroundColor: grid[i][col] ? HIT : MISS }]} /> : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * A shared Car Spotter day, drawn instead of a post's text and photos.
 *
 * The post's `body` is the emoji version of the same thing (🟩🟥 rows) for
 * surfaces that can only show text; here we have the structured `carspot`
 * summary, so the grid is drawn properly and the emoji are left out. The
 * answer is never on the post — a result is shareable the day it's played
 * without spoiling it for anyone who hasn't.
 *
 * One game per difficulty the member shared that day, easy to hard, each
 * with its badge. A single game is drawn as it always was, with the badge
 * over it; two or three each get a sub-card of their own, and each its own
 * comparison against the viewer's game of that difficulty — the feed card's
 * footer only has room for one. Only the middle of the card: author, likes,
 * comments and menus stay the host's, the same as for any other post.
 */
export default function SpotResultBody({ carspot, author, inset = 8, action = true }: SpotResultBodyProps) {
  const colors = useColors();
  const results = spotResultsOf(carspot);

  if (results.length === 1) {
    const [result] = results;
    return (
      <View style={styles.wrap}>
        <View style={[styles.badgeRow, { paddingHorizontal: inset }]}>
          <SpotDifficultyBadge difficulty={result.difficulty} />
        </View>
        <SpotGame result={result} inset={inset} />
        {action ? (
          <View style={[styles.actionInline, { paddingHorizontal: inset }]}>
            <SpotResultAction carspot={carspot} author={author} result={result} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.subCards, { paddingHorizontal: inset }]}>
      {results.map((result) => (
        <View key={result.difficulty} style={[styles.subCard, { borderColor: colors.borderDark }]}>
          <View style={[styles.badgeRow, { paddingHorizontal: SUB_INSET }]}>
            <SpotDifficultyBadge difficulty={result.difficulty} />
          </View>
          <SpotGame result={result} inset={SUB_INSET} />
          <View style={[styles.actionInline, { paddingHorizontal: SUB_INSET }]}>
            <SpotResultAction carspot={carspot} author={author} result={result} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Whether a post carries more than one game — its comparisons then go in its sub-cards, not the footer. */
export const spotHasSeveral = (carspot: CarSpotSummary) => spotResultsOf(carspot).length > 1;

/** A sub-card's own padding. */
const SUB_INSET = 10;
/** The table's rules: lighter than the card's own borders, so they read as a grid rather than a box. */
const TABLE_RULE = 'rgba(255,255,255,0.22)';
/** Every guess the game allows, so the table is the same shape whatever the score. */
const COLUMNS = Array.from({ length: MAX_ATTEMPTS }, (_, i) => i);

const styles = StyleSheet.create({
  wrap: { paddingBottom: 4 },
  badgeRow: { flexDirection: 'row', paddingTop: 4, paddingBottom: 2 },
  difficultyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: PILL_RADIUS, borderWidth: StyleSheet.hairlineWidth,
  },
  difficultyText: { fontSize: 10.5, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  // The day's games stacked, each in a card of its own inside the post's.
  subCards: { gap: 8, paddingTop: 4 },
  subCard: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: COMMON_RADIUS,
    backgroundColor: COLOR_GRAY_10, paddingTop: 4, paddingBottom: 10,
  },
  main: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 4 },
  imageWindow: {
    width: PHOTO, height: PHOTO,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLOR_GRAY_10,
    flexShrink: 0,
  },
  headerDateBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: PILL_RADIUS },
  date:    { fontSize: 10.5, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  // Ruled like a table: a rounded outer border, then each row after the first
  // draws its top rule and each cell its left one, so no line is drawn twice.
  table:    { flex: 1, minWidth: 0, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden', alignSelf: 'stretch' },
  // The two rows share the picture's height between them.
  tableRow: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  ruledRow: { borderTopWidth: StyleSheet.hairlineWidth },
  // The row's name, in a fixed column so the cells line up under their numbers.
  rowLabel: { width: 44, paddingHorizontal: 7, paddingVertical: 6, justifyContent: 'center' },
  rowLabelText: { fontSize: 9.5, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  cellBox:  { flex: 1, padding: 5, alignItems: 'stretch', borderLeftWidth: StyleSheet.hairlineWidth },
  // Fills its cell, inset enough that the table's rules frame it.
  cell: { flex: 1, borderRadius: 4 },

  expandBtn:  { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  collapse:      { overflow: 'hidden' },
  collapseInner: { position: 'absolute', top: 0, left: 0, right: 0 },

  // ── Under it ─────────────────────────────────────────────────────────────
  actionInline: { paddingTop: 10, alignItems: 'flex-start' },
  // Sized to its words, so it can share a row with the card's icons.
  appBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 6, paddingRight: 10, paddingVertical: 6,
    borderRadius: 999, alignSelf: 'flex-start', maxWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
  },
  // The app's own icon, at home-screen proportions.
  appIcon: { width: 24, height: 24, borderRadius: 6 },
  appBtnText: { flexShrink: 1, fontSize: 12.5, fontFamily: FONT_INTER.bold },

  // The two games as one pill, the same shape as the button it stands in
  // for: face, score, a rule, face, score.
  // No vertical padding of its own — the sides carry it — so the rule
  // between them runs the pill's full height.
  compare: { gap: 10, paddingLeft: 10, paddingRight: 12, paddingVertical: 0, borderRadius: 16, alignItems: 'stretch' },
  side:    { alignItems: 'flex-start', justifyContent: 'center', maxWidth: 120, paddingTop: 2, paddingBottom: 6 },
  crown:   { position: 'absolute', top: -5, left: -4, transform: [{ rotate: '-30deg' }] },
  sideRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  face:    { marginTop: 8 },
  sideLabel: { fontSize: 9, fontFamily: FONT_INTER.semibold, marginTop: 2 },
  // Two rows a hair's gap apart, together the avatar's height.
  dots:    { height: 22, justifyContent: 'center', gap: 3 },
  dotRow:  { flexDirection: 'row', gap: 3 },
  dot:     { width: 8, height: 8, borderRadius: 2 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});
