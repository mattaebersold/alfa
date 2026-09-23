import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { SOURCE_APPS, openSourceApp } from '../../constants/sourceApps';
import { COMMON_RADIUS } from '../../constants/radius';
import type { CarSpotSummary } from '../../types/api';

/** The game's own right/wrong colours, so the grid reads the same as in Car Spotter. */
const HIT = '#2FA84F';
const MISS = '#EC4632';
const MAX_ATTEMPTS = 5;

/** The server clamps zoom to 1.5–8; clamped again here so a bad row can't blow the image up. */
const clampZoom = (z: number) => Math.min(8, Math.max(1.5, Number(z) || 3.5));
const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0.5));

interface SpotResultBodyProps {
  carspot: CarSpotSummary;
  /**
   * Side padding for the text under the photo, to line up with the host's own
   * — the feed card insets by 8, the detail screen by 16. The photo is always
   * full-bleed.
   */
  inset?: number;
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
        accessibilityIgnoresInvertColors
      />
    </View>
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
 * Only the middle of the card: author, likes, comments and menus stay the
 * host's, the same as for any other post.
 */
export default function SpotResultBody({ carspot, inset = 8 }: SpotResultBodyProps) {
  const colors = useColors();
  const grid = Array.isArray(carspot.grid) ? carspot.grid : [];
  const attempts = carspot.attempts || grid.length;
  const result = carspot.won
    ? `Got it in ${attempts}/${MAX_ATTEMPTS}`
    : `Stumped — ${attempts}/${MAX_ATTEMPTS}`;

  return (
    <View style={styles.wrap}>
      <ZoomedPuzzleImage carspot={carspot} />

      <View style={[styles.info, { paddingHorizontal: inset }]}>
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: colors.fg }]}>
            Car Spotter #{carspot.puzzle_number}
          </Text>
          <Text style={[styles.result, { color: carspot.won ? HIT : colors.muted }]}>
            {result}
          </Text>
        </View>

        {/* One row per guess, make then model — the order the game asks in. */}
        <View style={styles.grid} accessibilityLabel={`${result}. Guesses: ${grid.map(([mk, md], i) =>
          `${i + 1}: make ${mk ? 'right' : 'wrong'}, model ${md ? 'right' : 'wrong'}`).join('; ')}`}>
          <View style={styles.gridRow}>
            <Text style={[styles.colLabel, { color: colors.muted }]}>Make</Text>
            <Text style={[styles.colLabel, { color: colors.muted }]}>Model</Text>
          </View>
          {grid.map(([make, model], i) => (
            <View key={i} style={styles.gridRow}>
              <View style={[styles.cell, { backgroundColor: make ? HIT : MISS }]} />
              <View style={[styles.cell, { backgroundColor: model ? HIT : MISS }]} />
            </View>
          ))}
        </View>
      </View>

      {/* The same deep link as the "Shared from" chip — today's puzzle, or the
          app's page when it isn't installed. */}
      <TouchableOpacity
        style={[styles.playLink, { paddingHorizontal: inset }]}
        onPress={() => openSourceApp(SOURCE_APPS.spot)}
        activeOpacity={0.7}
        hitSlop={6}
        accessibilityRole="link"
      >
        <Text style={[styles.playLinkText, { color: SOURCE_APPS.spot.accent }]}>
          Play today's puzzle
        </Text>
        <ChevronRight size={14} color={SOURCE_APPS.spot.accent} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const CELL = 18;

const styles = StyleSheet.create({
  wrap: { paddingBottom: 4 },
  imageWindow: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
  },
  info: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingTop: 12,
  },
  textCol: { flex: 1, minWidth: 0 },
  title:   { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  result:  { fontSize: 14, fontWeight: '600', marginTop: 3 },
  grid:    { gap: 4, alignItems: 'center' },
  gridRow: { flexDirection: 'row', gap: 4 },
  // As wide as a cell, so each label sits over its own column.
  colLabel: {
    width: CELL + 12, textAlign: 'center',
    fontSize: 9, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase',
    marginHorizontal: -6,
  },
  cell: { width: CELL, height: CELL, borderRadius: COMMON_RADIUS / 2 },
  playLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingTop: 10,
  },
  playLinkText: { fontSize: 13, fontWeight: '700' },
});
