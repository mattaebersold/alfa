import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Text } from '../../theme/Text';
import { useColors } from '../../hooks/useColors';
import type { ProfileSocials as Socials } from '../../types/api';
import { socialLinks } from '../../utils/socials';
import SocialIcon from './SocialIcon';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * A member's social accounts and website, as buttons under their bio — the
 * same button shape as ProfileLinks, led by the network's icon.
 */
export default function ProfileSocials({ socials }: { socials?: Socials }) {
  const c = useColors();
  const items = socialLinks(socials);
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
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.button, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => open(item.href)}
          activeOpacity={0.8}
          accessibilityRole="link"
          accessibilityLabel={`${item.label}: ${item.value}`}
        >
          <SocialIcon network={item.key} size={15} color={c.fg} />
          <Text style={[styles.label, { color: c.fg }]} numberOfLines={1}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  label:  { fontSize: 13, fontFamily: FONT_INTER.bold, flexShrink: 1 },
});
