import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Mail } from 'lucide-react-native';
import { useSummaryPanel } from '../ui/SummaryModal';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * "Message" from inside a summary panel — a person's own, or a group's admin.
 *
 * Only for use inside a SummaryModal's contents: it needs the panel to close
 * (and any panel under it, when it's stacked) before the compose screen opens,
 * since iOS won't present a screen over a modal that's still up. Compose picks
 * up an existing thread with that person if there is one.
 */
export default function SummaryMessageButton({
  userId,
  username,
  label = 'Message',
}: {
  userId: string;
  username?: string;
  label?: string;
}) {
  const nav = useNavigation<any>();
  const panel = useSummaryPanel();

  const compose = () => nav.navigate('ComposeMessage', { userId, username });

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => (panel ? panel.closeThen(compose) : compose())}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <Mail size={14} color="#FFFFFF" />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Matched to Button's `secondary` at size `sm`, which is what Follow beside
  // it renders as — same fill, radius, padding, size and weight. Two buttons
  // that do the same kind of thing shouldn't be two different shapes.
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: COMMON_RADIUS,
    backgroundColor: '#2A2A2A',
  },
  text: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
});
