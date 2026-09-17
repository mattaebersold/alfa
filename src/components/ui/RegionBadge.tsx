import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { REGION_SHAPES, REGION_VIEWBOX, REGION_ASPECT, US_OUTLINE } from '../../constants/regionShapes';
import { regionKey } from '../../constants/regions';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * Where in the country this is: the United States in outline, with one region
 * lit in the member's own colour.
 *
 * "Bothell, WA" tells you where someone is only if you already know where
 * Bothell is. The map answers the same question in the shape of the country,
 * and reads at a glance from across a grid of cards.
 *
 * Only the coastline and national border are drawn — no state or region lines
 * inside them. At this size internal divisions are a grey smear, and the lit
 * shape says which part of the country it is without them.
 *
 * Renders nothing without a region: an outline of the US with nothing lit says
 * "somewhere in America", which isn't worth the space.
 */
export default function RegionBadge({
  region,
  size = 36,
  color,
  outline = '#FFFFFF',
  backdrop = true,
  style,
}: {
  /** A region key, or a stored label — anything `regionKey` recognises. */
  region?: string | null;
  size?: number;
  /** The lit region. Defaults to the account's brand colour — gold or blue. */
  color?: string;
  /** The country's border. */
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

  // Stroke width is in the viewBox's units, so a fixed one thins out as the
  // badge shrinks — at 24px a 1.6 stroke is a third of a pixel and disappears.
  // Solving for the screen width instead keeps the border a hairline at every
  // size this is used at.
  const stroke = (100 / size) * 1.1;

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
        {/* Lit first, so the border draws over its edge rather than under it.
            No clipping needed: these are the states' own outlines, so the fill
            already stops where the country does. */}
        <Path d={REGION_SHAPES[key]} fill={color ?? brand} />
        <Path
          d={US_OUTLINE}
          fill="none"
          stroke={outline}
          strokeWidth={stroke}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
