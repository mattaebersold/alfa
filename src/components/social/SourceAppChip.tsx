import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Aperture, ScanSearch, ArrowUpRight } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { sourceAppFor, openSourceApp, type SourceAppId } from '../../constants/sourceApps';
import { PILL_RADIUS } from '../../constants/radius';

interface SourceAppChipProps {
  /** The post's `source_app`. Anything we don't recognise draws nothing. */
  app?: string | null;
  /** The post's `source_id` — what the deep link opens, where the app needs one. */
  sourceId?: string | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's mark, drawn small.
 *
 * Lucide glyphs on the app's tile rather than bundled PNGs of the real icons:
 * at 18pt the silhouette is all that reads, and this keeps alfa from shipping
 * (and having to keep in sync) artwork owned by two other apps.
 */
function AppIconTile({ app, tile }: { app: SourceAppId; tile: string }) {
  const Glyph = app === 'photo' ? Aperture : ScanSearch;
  return (
    <View style={[styles.tile, { backgroundColor: tile }]}>
      <Glyph size={12} color="#FFFFFF" strokeWidth={2.25} />
    </View>
  );
}

/**
 * "Shared from ORS Photo ↗" — a way back to where a post was made.
 *
 * Posts shared in from the sibling apps are ordinary posts in every other
 * respect (likes, comments, menus), so this is the one thing that marks them.
 * A pill, not a banner: it's provenance, and it shouldn't outrank the post.
 * Tapping opens the app on the thing that was shared, or its store page when
 * it isn't installed — see openSourceApp.
 */
export default function SourceAppChip({ app, sourceId, style }: SourceAppChipProps) {
  const colors = useColors();
  const def = sourceAppFor(app);
  if (!def) return null;

  return (
    <TouchableOpacity
      style={[styles.chip, { borderColor: colors.border }, style]}
      onPress={() => openSourceApp(def, sourceId)}
      activeOpacity={0.75}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={`Shared from ${def.name}. Open in ${def.name}`}
    >
      <AppIconTile app={def.id} tile={def.tile} />
      <Text style={[styles.label, { color: colors.muted }]} numberOfLines={1}>
        Shared from <Text style={[styles.name, { color: colors.fg }]}>{def.name}</Text>
      </Text>
      <ArrowUpRight size={13} color={colors.muted} strokeWidth={2.25} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    // Sized to its words — a full-width row would read as a section.
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingLeft: 4, paddingRight: 9, paddingVertical: 4,
    borderRadius: PILL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  // Squircle-ish, like a home-screen icon, so it reads as "an app" at a glance.
  tile: {
    width: 18, height: 18, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '500' },
  name:  { fontWeight: '700' },
});
