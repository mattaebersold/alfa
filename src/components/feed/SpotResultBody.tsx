import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, type LayoutChangeEvent } from 'react-native';
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
  PILL_RADIUS,
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

/** The puzzle photo's side: a small thumbnail set into the card, not a banner across it. */
const PHOTO = 50;

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
function ZoomedPuzzleImage({ carspot }: { carspot: CarSpotSummary }) {
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

/**
 * 'YYYY-MM-DD' as "Oct 6", with the year once it's not this year's. Built from
 * the parts rather than parsed, so the game's date isn't shifted by the
 * viewer's timezone.
 */
function playDateLabel(date: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  if (!m) return date ?? '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(thisYear ? {} : { year: 'numeric' }) });
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
          <Text style={[styles.title, { color: colors.fg }]}>Guess the car</Text>
          {/* The day, as a badge. How it went is the table's to tell. */}
          <View style={[styles.dateBadge, { backgroundColor: colors.fg }]}>
            <Text style={[styles.date, { color: colors.bg }]}>{playDateLabel(carspot.play_date)}</Text>
          </View>
        </View>

        {/* The guesses as a small table: a row for the make and one for the
            model, the guesses running across in the order they were made.
            Small: a mark of how it went, not a second picture. */}
        <View style={[styles.table, { borderColor: TABLE_RULE }]} accessibilityLabel={`${result}. Guesses: ${grid.map(([mk, md], i) =>
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

      {action ? (
        <View style={[styles.actionInline, { paddingHorizontal: inset }]}>
          <SpotResultAction carspot={carspot} author={author} />
        </View>
      ) : null}
    </View>
  );
}

const CELL = 11;
/** The table's rules: lighter than the card's own borders, so they read as a grid rather than a box. */
const TABLE_RULE = 'rgba(255,255,255,0.22)';
/** Every guess the game allows, so the table is the same shape whatever the score. */
const COLUMNS = Array.from({ length: MAX_ATTEMPTS }, (_, i) => i);

const styles = StyleSheet.create({
  wrap: { paddingBottom: 4 },
  main: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 4 },
  imageWindow: {
    width: PHOTO, height: PHOTO,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLOR_GRAY_10,
    flexShrink: 0,
  },
  textCol: { flex: 1, minWidth: 0 },
  title:   { fontSize: 13.5, fontFamily: FONT_INTER.bold, letterSpacing: 0.2 },
  dateBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: PILL_RADIUS, marginTop: 4 },
  date:    { fontSize: 10.5, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  // Ruled like a table: a rounded outer border, then each row after the first
  // draws its top rule and each cell its left one, so no line is drawn twice.
  table:    { flexShrink: 0, marginLeft: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden', alignSelf: 'flex-start' },
  tableRow: { flexDirection: 'row', alignItems: 'stretch' },
  ruledRow: { borderTopWidth: StyleSheet.hairlineWidth },
  // The row's name, in a fixed column so the cells line up under their numbers.
  rowLabel: { width: 44, paddingHorizontal: 7, paddingVertical: 6, justifyContent: 'center' },
  rowLabelText: { fontSize: 9.5, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  cellBox:  { width: CELL + 14, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth },
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
