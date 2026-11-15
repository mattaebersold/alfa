import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, BackHandler, Animated } from 'react-native';
import { Text } from '../../../theme/Text';
import { BrandsView } from '../../../screens/cars/BrandsScreen';
import { BrandDetailView, type ModelPageParams } from '../../../screens/cars/BrandDetailScreen';
import { ModelDetailView, modelShortTitle } from '../../../screens/cars/ModelDetailScreen';
import { TABS_STUCK_RISE } from '../../ui/AppHeader';
import { headerOffset } from '../../../hooks/useHeaderScroll';
import { useColors } from '../../../hooks/useColors';
import { GUTTER, PILL_RADIUS } from '../../../constants/config';
import { FONT_INTER } from '../../../constants/fonts';
import type { SectionScreenProps } from '../types';

/** One step down the trail, after the brands themselves. */
type Crumb =
  | { kind: 'brand'; brand: string }
  | { kind: 'model'; params: ModelPageParams };

/**
 * Cars › Brands: browsing by make, as a sub-tab of its own.
 *
 * The brands, then a make, then a model, under a breadcrumb trail rather than
 * as pushed screens: from inside a tab a push would leave the tab bar behind,
 * and the home stack has none of those screens anyway. The trail is the
 * stack; each crumb before the last takes you back to it. It used to open
 * from a Browse by Brand button on the Cars landing.
 */
export default function BrandBrowseScreen({ headerPad, onScroll }: SectionScreenProps) {
  const colors = useColors();
  const [trail, setTrail] = useState<Crumb[]>([]);
  const here = trail[trail.length - 1];
  /** Back to the crumb at `depth` — 0 is the brands. */
  const popTo = (depth: number) => setTrail((t) => t.slice(0, depth));

  // Android's back steps up the trail before it leaves the tab.
  useEffect(() => {
    if (trail.length === 0) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { popTo(trail.length - 1); return true; });
    return () => sub.remove();
  }, [trail.length]);

  const crumbs: string[] = ['Brands', ...trail.map((c) => (c.kind === 'brand' ? c.brand : modelShortTitle(c.params)))];
  /** A make and a model both open on a banner, which carries the trail. */
  const onBanner = !!here;
  const crumbRow = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.crumbsScroller, !onBanner && { position: 'absolute', top: 0 }]}
      // A little further down on a make or a model, where the row sits on
      // the banner photo rather than tight under the header.
      contentContainerStyle={[styles.crumbs, onBanner && styles.crumbsOnBanner]}
    >
      {crumbs.map((label, i) => {
        const last = i === crumbs.length - 1;
        return (
          <React.Fragment key={`${i}-${label}`}>
            {i > 0 && <Text style={[styles.crumbSlash, { color: colors.grey }]}>/</Text>}
            {/* The ones behind are small outlined pills — buttons back up
                the trail. Where you are is just its name: nothing to tap. */}
            <TouchableOpacity
              onPress={() => popTo(i)}
              disabled={last}
              activeOpacity={0.75}
              style={last ? styles.crumbHere : [
                styles.crumbBtn,
                // A dark ground: the row floats over photos as often as not.
                { borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(0,0,0,0.5)' },
              ]}
              accessibilityRole={last ? 'header' : 'button'}
              accessibilityLabel={last ? label : `Back to ${label}`}
            >
              <Text style={[styles.crumb, { color: colors.fg }, last && styles.crumbHereText]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        );
      })}
    </ScrollView>
  );

  return (
    // Padded for the full header, and lifted as the header collapses — by the
    // same distance its tab rows rise — so the trail stays tucked under the
    // small header rather than hanging below where the buttons were. The box
    // runs that much past the foot to cover the lift.
    <Animated.View
      style={[
        styles.fill,
        { paddingTop: headerPad, marginBottom: -TABS_STUCK_RISE },
        { transform: [{ translateY: headerOffset.interpolate({ inputRange: [-TABS_STUCK_RISE, 0], outputRange: [-TABS_STUCK_RISE, 0], extrapolate: 'clamp' }) }] },
      ]}
    >
      {!here && (
        <View style={styles.fill}>
          {/* At the root the trail is just "Brands" — nothing to go back to. */}
          <BrandsView
            headerPad={0}
            onScroll={onScroll}
            onPickBrand={(b) => setTrail([{ kind: 'brand', brand: b }])}
          />
        </View>
      )}
      {here?.kind === 'brand' && (
        <BrandDetailView
          key={here.brand}
          brand={here.brand}
          bannerOverlay={crumbRow}
          // The header's tab rows stay pinned once the rest has slid away.
          scrollClearance={Math.max(0, headerPad - TABS_STUCK_RISE)}
          onScroll={onScroll}
          onOpenModel={(p) => setTrail((t) => [...t, { kind: 'model', params: p }])}
        />
      )}
      {here?.kind === 'model' && (
        <ModelDetailView
          key={`${here.params.modelHandle}-${here.params.generationHandle ?? ''}`}
          params={here.params}
          onOpenBrand={() => popTo(1)}
          onScroll={onScroll}
          bannerOverlay={crumbRow}
          scrollClearance={Math.max(0, headerPad - TABS_STUCK_RISE)}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // The trail over whatever's open: where you are, and the way back up it.
  crumbsScroller: { left: 0, right: 0, zIndex: 5, flexGrow: 0, flexShrink: 0 },
  crumbs:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 6 },
  crumbsOnBanner: { paddingTop: 9, paddingLeft: GUTTER + 6 },
  crumbSlash: { fontSize: 14, fontFamily: FONT_INTER.semibold, paddingHorizontal: 2 },
  crumbBtn:  { height: 32, paddingHorizontal: 12, borderRadius: PILL_RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  crumb:     { fontSize: 13, fontFamily: FONT_INTER.bold, maxWidth: 160 },
  // The current page: the pills' height, so the row stays level, and no pill.
  crumbHere: { height: 32, paddingHorizontal: 4, justifyContent: 'center' },
  // Shadowed — with no pill's dark ground, it still has to read over a photo.
  crumbHereText: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
});
