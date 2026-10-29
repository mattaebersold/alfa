import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { REGION_SHAPES, REGION_VIEWBOX, REGION_ASPECT, US_OUTLINE } from '../../constants/regionShapes';

/** Every region, drawn together as the country's solid shape. */
const REGION_KEYS = Object.keys(REGION_SHAPES);
import { regionKey } from '../../constants/regions';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS, COLOR_BLACK } from '../../constants/config';

/**
 * Where in the country this is: the United States as a solid black shape, with
 * one region lit in the member's own colour. No border — the black country is
 * the shape, and a hairline around it was one more line to read.
 *
 * "Bothell, WA" tells you where someone is only if you already know where
 * Bothell is. The map answers the same question in the shape of the country,
 * and reads at a glance from across a grid of cards.
 *
 * No state or region lines inside it. At this size internal divisions are a
 * grey smear, and the lit shape says which part of the country it is without
 * them.
 *
 * Renders nothing without a region: a map of the US with nothing lit says
 * "somewhere in America", which isn't worth the space.
 */
export default function RegionBadge({
  region,
  size = 36,
  color,
  land = COLOR_BLACK,
  outline,
  backdrop = true,
  style,
}: {
  /** A region key, or a stored label — anything `regionKey` recognises. */
  region?: string | null;
  size?: number;
  /** The lit region. Defaults to the account's brand colour — gold or blue. */
  color?: string;
  /** The country's own fill, under the lit region. */
  land?: string;
  /** A hairline around the country, in this colour — where the black shape needs an edge. */
  outline?: string;
  /**
   * A dark pad behind the map.
   *
   * These sit over photographs as often as not, and a white outline on a white
   * car is invisible — worse, the lit region loses against a bright sky and
   * the badge stops saying anything. Off for the places it sits on a plain
   * card, where the pad is just a smudge.
   */
  backdrop?: boolean;
  style?: any;
}) {
  const brand = useBrandColor();
  const key = regionKey(region);
  if (!key || !REGION_SHAPES[key]) return null;

  // Scales with the badge so a small one isn't swallowed by its own padding.
  const pad = backdrop ? Math.max(2, Math.round(size * 0.09)) : 0;

  return (
    <View
      style={[
        backdrop && {
          padding: pad,
          borderRadius: COMMON_RADIUS,
          backgroundColor: 'rgba(0,0,0,0.45)',
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size * REGION_ASPECT} viewBox={REGION_VIEWBOX}>
        {/* The country, solid — every region in the land colour, since the
            outline is only its edges and won't fill — then the lit one over it. */}
        {REGION_KEYS.map((k) => (k === key ? null : <Path key={k} d={REGION_SHAPES[k]} fill={land} />))}
        <Path d={REGION_SHAPES[key]} fill={color ?? brand} />
        {/* Over the lit region's edge rather than under it. The viewBox's
            units shrink with the badge, so the stroke is solved for a
            constant hairline on screen. */}
        {outline ? (
          <Path d={US_OUTLINE} fill="none" stroke={outline} strokeWidth={(100 / size) * 1.1} strokeLinejoin="round" />
        ) : null}
      </Svg>
    </View>
  );
}
