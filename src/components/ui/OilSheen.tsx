import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsPro } from '../../hooks/useBrandColor';
import {
  COLOR_SHEEN_BUTTER,
  COLOR_SHEEN_COPPER,
  COLOR_SHEEN_CRIMSON,
  COLOR_SHEEN_GOLD,
  COLOR_SHEEN_LIME,
  COLOR_SHEEN_MAGENTA,
  COLOR_SHEEN_MINT,
  COLOR_SHEEN_ORANGE,
  COLOR_SHEEN_PALE_BLUE,
  COLOR_SHEEN_PALE_LAVENDER,
  COLOR_SHEEN_PALE_MINT,
  COLOR_SHEEN_PALE_PINK,
  COLOR_SHEEN_PALE_YELLOW,
  COLOR_SHEEN_PEACH,
  COLOR_SHEEN_PINK,
  COLOR_SHEEN_SKY,
  COLOR_SHEEN_VIOLET,
  COLOR_SHEEN_YELLOW,
} from '../../constants/config';

export type SheenTone = 'cool' | 'warm' | 'pearl';

type SheenLayer = {
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/**
 * The film, per fill: a base sweep, then bands crossing it.
 *
 * The full spectrum on the blue. On the gold, the blues and violets fought the
 * fill and read as a smear of the wrong button, so Pro's film stays in the warm
 * half. Kept to warm hues it needs more going on to still read as oil rather
 * than a peach wash — so more stops, deep against pale (crimson beside cream,
 * bronze beside lime), and a third band at its own angle so the colours pool
 * unevenly instead of running in parallel stripes.
 */
const SHEEN: Record<SheenTone, SheenLayer[]> = {
  cool: [
    {
      colors: [COLOR_SHEEN_MAGENTA, COLOR_SHEEN_YELLOW, COLOR_SHEEN_MINT, COLOR_SHEEN_SKY, COLOR_SHEEN_VIOLET, COLOR_SHEEN_MAGENTA],
      locations: [0, 0.2, 0.4, 0.6, 0.8, 1],
      start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
    },
    {
      colors: ['transparent', 'rgba(60,255,210,0.55)', 'transparent', 'rgba(255,70,190,0.5)', 'transparent'],
      locations: [0.05, 0.3, 0.5, 0.72, 0.95],
      start: { x: 1, y: 0 }, end: { x: 0.1, y: 1 },
    },
  ],
  warm: [
    {
      colors: [COLOR_SHEEN_CRIMSON, COLOR_SHEEN_PEACH, COLOR_SHEEN_ORANGE, COLOR_SHEEN_BUTTER, COLOR_SHEEN_LIME, COLOR_SHEEN_COPPER, COLOR_SHEEN_PINK, COLOR_SHEEN_GOLD],
      locations: [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.85, 1],
      start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
    },
    {
      colors: ['transparent', 'rgba(255,205,80,0.65)', 'transparent', 'rgba(232,74,95,0.55)', 'transparent'],
      locations: [0.05, 0.28, 0.48, 0.7, 0.92],
      start: { x: 1, y: 0 }, end: { x: 0.1, y: 1 },
    },
    {
      colors: ['transparent', 'rgba(184,214,74,0.5)', 'transparent', 'rgba(255,154,60,0.55)', 'transparent'],
      locations: [0.1, 0.35, 0.55, 0.78, 1],
      start: { x: 0, y: 0.8 }, end: { x: 0.9, y: 0 },
    },
  ],
  /**
   * The same film for a white button, in pastels.
   *
   * The other two tones are saturated because they sit *over* a blue or gold
   * fill at half strength and need to survive it. On white there is nothing to
   * survive — the full-strength hues came out as a felt-tip scribble, and the
   * black label on top stopped being readable. Pale stops over white read the
   * way oil on a white panel actually does: pearlescent, the colour only
   * showing where the bands cross.
   */
  pearl: [
    {
      colors: [COLOR_SHEEN_PALE_BLUE, COLOR_SHEEN_PALE_PINK, COLOR_SHEEN_PALE_YELLOW, COLOR_SHEEN_PALE_MINT, COLOR_SHEEN_PALE_LAVENDER, COLOR_SHEEN_PALE_BLUE],
      locations: [0, 0.2, 0.4, 0.6, 0.8, 1],
      start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
    },
    {
      colors: ['transparent', 'rgba(255,255,255,0.85)', 'transparent', 'rgba(170,215,255,0.6)', 'transparent'],
      locations: [0.05, 0.3, 0.5, 0.72, 0.95],
      start: { x: 1, y: 0 }, end: { x: 0.1, y: 1 },
    },
    {
      colors: ['transparent', 'rgba(255,214,240,0.55)', 'transparent', 'rgba(198,242,226,0.5)', 'transparent'],
      locations: [0.1, 0.35, 0.55, 0.78, 1],
      start: { x: 0, y: 0.8 }, end: { x: 0.9, y: 0 },
    },
  ],
};

/** The tone that suits this account's brand fill — warm on gold, cool on blue. */
export function useSheenTone(): SheenTone {
  return useIsPro() ? 'warm' : 'cool';
}

/**
 * An oil-slick film over a brand-filled button — the header's home button and
 * the create button in the tab bar.
 *
 * Gradients crossing at different angles rather than one rainbow: a single
 * sweep reads as a pride flag, where oil on water is bands of colour
 * interfering with each other and pooling in some places more than others.
 * Laid over the brand fill at half strength rather than replacing it, so the
 * button is still blue or gold underneath — just catching the light.
 *
 * Fills its parent and clips to its own `radius` rather than relying on the
 * parent to: the wide Pro home button lets its content overflow for the
 * rotated PRO mark, and a shadowed parent can't clip without losing its shadow.
 * Render it first inside the button so the icon sits on top.
 */
export default function OilSheen({ tone, radius, opacity }: {
  tone: SheenTone;
  radius: number;
  /**
   * Strength of the whole film, over the default half. The pearl tone wants
   * more of itself showing — it has no coloured fill beneath it to tint.
   */
  opacity?: number;
}) {
  return (
    <View
      style={[styles.sheen, { borderRadius: radius }, opacity != null && { opacity }]}
      pointerEvents="none"
    >
      {SHEEN[tone].map((layer, i) => (
        <LinearGradient
          key={i}
          colors={layer.colors}
          locations={layer.locations}
          start={layer.start}
          end={layer.end}
          style={StyleSheet.absoluteFill}
        />
      ))}
      {/* The wet highlight — a narrow streak of light across the film. */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
        locations={[0.3, 0.42, 0.55]}
        start={{ x: 0, y: 0.1 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheen: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
    // The whole film at half strength over the brand fill, so the button is
    // still plainly blue or gold with the colours sitting on top of it. Plain
    // opacity rather than a blend mode, which renders differently on each
    // platform and not at all on older Android.
    opacity: 0.5,
  },
});
