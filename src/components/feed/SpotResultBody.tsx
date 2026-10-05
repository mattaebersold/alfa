import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
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
  COLOR_GRAY_10,
  COLOR_GRAY_22,
  COLOR_RED,
  COLOR_SPOTTER_GREEN,
} from '../../constants/config';
import type { CarSpotSummary, CarSpotPlay } from '../../types/api';
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

/** The puzzle photo's side: a thumbnail set into the card, not a banner across it. */
const PHOTO = 100;

const SPOT_ICON = require('../../../assets/apps/spot-icon.png');

/** The server clamps zoom to 1.5–8; clamped again here so a bad row can't blow the image up. */
const clampZoom = (z: number) => Math.min(8, Math.max(1.5, Number(z) || 3.5));
const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0.5));

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
 * Same rule as murray's CarSpotZoomedImage, so web and app crop alike: the
 * photo is covered into the square with its content positioned at the focus —
 * which puts the focus point at exactly (focus_x, focus_y) of the square —
 * then scaled from that same point, so it stays put and everything zooms in
 * around it. Scaling about the focus rather than centring it also means the
 * window never slides off the photo's edge, whatever the focus.
 */
function ZoomedPuzzleImage({ carspot }: { carspot: CarSpotSummary }) {
  const fx = clamp01(carspot.focus_x);
  const fy = clamp01(carspot.focus_y);
  const origin = { left: `${fx * 100}%`, top: `${fy * 100}%` } as const;

  return (
    <View style={styles.imageWindow}>
      <Image
        source={{ uri: imageUrl(carspot.image) ?? undefined }}
        style={[
          StyleSheet.absoluteFill,
          {
            transformOrigin: `${fx * 100}% ${fy * 100}%`,
            transform: [{ scale: clampZoom(carspot.zoom) }],
          },
        ]}
        contentFit="cover"
        contentPosition={origin}
        transition={150}
        // Softened: the card says a game was played, not what the car was —
        // the crop already hides most of it, and the blur takes the rest, so
        // a feed full of results spoils nothing for anyone yet to play.
        blurRadius={PREVIEW_BLUR}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const finished = (p?: CarSpotPlay | null): p is CarSpotPlay => !!p && (p.status === 'won' || p.status === 'lost');

/** "3/5", or "✗" for a game that ran out — the number alone would read as a score. */
const scoreOf = (won: boolean, attempts: number) => (won ? `${attempts}/${MAX_ATTEMPTS}` : '✗');

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
function useSpotStanding(carspot: CarSpotSummary, author?: SpotResultBodyProps['author']) {
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: me } = useGetLoggedInUserQuery(undefined, { skip: !myId });
  // Missing means an account from before the field, which is an ORS-only one.
  const hasSpot = !!me?.accounts?.includes('spot');
  const date = carspot.play_date;

  const { data: day } = useGetCarSpotDayQuery(date, { skip: !hasSpot || !date });
  const isToday = !!day && day.today === date;
  // Only needed when the post is about an earlier day — otherwise the day's
  // answer already says whether today has been played.
  const { data: today } = useGetCarSpotTodayQuery(undefined, { skip: !hasSpot || !day || isToday });

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
export function SpotResultAction({ carspot, author }: Pick<SpotResultBodyProps, 'carspot' | 'author'>) {
  const colors = useColors();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: me } = useGetLoggedInUserQuery(undefined, { skip: !myId });
  const standing = useSpotStanding(carspot, author);
  if (!standing) return null;

  if (standing.kind === 'compare') {
    const mine = standing.mine;
    const iWon = mine.status === 'won';
    return (
      <View
        style={[styles.appBtn, styles.compare, { backgroundColor: COLOR_GRAY_22, borderColor: colors.borderDark }]}
        accessibilityLabel={`You ${scoreOf(iWon, mine.attempts)}, ${author?.username ? `@${author.username}` : 'they'} ${scoreOf(carspot.won, carspot.attempts)}`}
      >
        <Avatar user={me ?? undefined} size={22} />
        <Text style={[styles.score, { color: iWon ? HIT : colors.muted }]}>{scoreOf(iWon, mine.attempts)}</Text>
        <View style={[styles.divider, { backgroundColor: colors.borderDark }]} />
        <Avatar user={author ?? undefined} size={22} />
        <Text style={[styles.score, { color: carspot.won ? HIT : colors.muted }]}>{scoreOf(carspot.won, carspot.attempts)}</Text>
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
export default function SpotResultBody({ carspot, author, inset = 8, action = true }: SpotResultBodyProps) {
  const colors = useColors();
  const grid = Array.isArray(carspot.grid) ? carspot.grid : [];
  const attempts = carspot.attempts || grid.length;
  const result = carspot.won
    ? `Got it in ${attempts}/${MAX_ATTEMPTS}`
    : `Stumped — ${attempts}/${MAX_ATTEMPTS}`;

  return (
    <View style={styles.wrap}>
      <View style={[styles.main, { paddingHorizontal: inset }]}>
        <ZoomedPuzzleImage carspot={carspot} />

        <View style={styles.textCol}>
          <Text style={[styles.title, { color: colors.fg }]}>
            Car Spotter #{carspot.puzzle_number}
          </Text>
          <Text style={[styles.result, { color: carspot.won ? HIT : colors.muted }]}>
            {result}
          </Text>
        </View>

        {/* One row per guess, make then model — the order the game asks in.
            At the right, small: a mark of how it went, not a second picture. */}
        <View style={styles.grid} accessibilityLabel={`${result}. Guesses: ${grid.map(([mk, md], i) =>
          `${i + 1}: make ${mk ? 'right' : 'wrong'}, model ${md ? 'right' : 'wrong'}`).join('; ')}`}>
          {grid.map(([make, model], i) => (
            <View key={i} style={styles.gridRow}>
              <View style={[styles.cell, { backgroundColor: make ? HIT : MISS }]} />
              <View style={[styles.cell, { backgroundColor: model ? HIT : MISS }]} />
            </View>
          ))}
        </View>
      </View>

      {action ? (
        <View style={[styles.actionInline, { paddingHorizontal: inset }]}>
          <SpotResultAction carspot={carspot} author={author} />
        </View>
      ) : null}
    </View>
  );
}

const CELL = 11;

const styles = StyleSheet.create({
  wrap: { paddingBottom: 4 },
  main: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 4 },
  imageWindow: {
    width: PHOTO, height: PHOTO,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLOR_GRAY_10,
    flexShrink: 0,
  },
  textCol: { flex: 1, minWidth: 0 },
  title:   { fontSize: 16, fontFamily: FONT_INTER.bold, letterSpacing: 0.2 },
  result:  { fontSize: 13, fontFamily: FONT_INTER.semibold, marginTop: 2 },
  grid:    { gap: 3, alignItems: 'flex-end', flexShrink: 0, paddingTop: 2 },
  gridRow: { flexDirection: 'row', gap: 3 },
  cell: { width: CELL, height: CELL, borderRadius: COMMON_RADIUS / 2 },

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
  compare: { gap: 6, paddingRight: 12 },
  score:   { fontSize: 13, fontFamily: FONT_INTER.extrabold, marginRight: 4 },
  divider: { width: StyleSheet.hairlineWidth, height: 16, marginHorizontal: 2 },
});
