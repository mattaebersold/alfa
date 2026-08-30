import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import type { ProfileLink } from '../../types/api';

/**
 * A member's own links, as buttons under their bio.
 *
 * The server normalises and filters what it stores — see horacio's
 * helpers/profileLinks — so anything arriving here already has an http(s) URL.
 * The guard below is a second line for records written before that existed.
 */
export default function ProfileLinks({ links }: { links?: ProfileLink[] }) {
  const c = useColors();

  const items = (links ?? []).filter((link) => link?.url && /^https?:\/\//i.test(link.url));
  if (items.length === 0) return null;

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Couldn't open link", url);
    }
  };

  return (
    <View style={styles.wrap}>
      {items.map((link, i) => (
        <TouchableOpacity
          key={`${link.url}_${i}`}
          style={[styles.button, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => open(link.url)}
          activeOpacity={0.8}
          accessibilityRole="link"
          accessibilityLabel={link.title}
        >
          <Text style={[styles.label, { color: c.fg }]} numberOfLines={1}>{link.title}</Text>
          <ExternalLink size={13} color={c.grey} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Wraps rather than scrolling: these are a handful of short buttons, and a
  // row that scrolls hides the ones past the edge.
  wrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  label:  { fontSize: 13, fontWeight: '700', flexShrink: 1 },
});
