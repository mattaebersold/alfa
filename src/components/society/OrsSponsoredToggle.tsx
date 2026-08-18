import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { ORS_EVENT_COLOR } from '../../constants/eventTypes';
import { useAppSelector } from '../../store/store';

/**
 * The "ORS sponsored event" switch on the event form.
 *
 * ORS sponsorship is a designation rather than a claim, so the switch only
 * appears for admins — and renders nothing for anyone else, which is why the
 * account check lives in here instead of at each call site. horacio enforces
 * the same rule, so hiding it is presentation only.
 */
export default function OrsSponsoredToggle({
  value, onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  if (userInfo?.accountType !== 'admin') return null;

  return (
    <TouchableOpacity
      style={[styles.row, { borderColor: colors.inputBorder, backgroundColor: colors.card }]}
      onPress={() => onChange(!value)}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
    >
      <View
        style={[
          styles.box,
          { borderColor: colors.inputBorder },
          value && { backgroundColor: ORS_EVENT_COLOR, borderColor: ORS_EVENT_COLOR },
        ]}
      >
        {value ? <Check size={13} color="#000000" /> : null}
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.fg }]}>ORS sponsored event</Text>
        <Text style={[styles.sub, { color: colors.grey }]}>
          Adds the ORS Event badge to the card and a banner on the event.
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 16,
  },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  copy:  { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700' },
  sub:   { fontSize: 12, lineHeight: 16 },
});
