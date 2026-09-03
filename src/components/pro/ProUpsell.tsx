import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Info, X, Check } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { colors } from '../../constants/colors';

/**
 * What Pro is, in one place.
 *
 * The list was written twice before this — once in the garage badge and once
 * wherever the next limit turned up — which is exactly how two answers to "what
 * do I get" end up disagreeing. Callers supply the sentence explaining the limit
 * they've just hit; the benefits, the wording about it opening soon, and the
 * button that gets you here are all shared.
 */
export const PRO_BENEFITS = [
  'Unlimited cars in your garage',
  'Unlimited posts every month',
  'Record and save your own driving routes',
  'Task lists and build records on every car',
  'Lists, and the diecast marketplace',
  'Your pro badge on every post and profile',
  'And more',
];

/**
 * The way in. Gold whoever is looking at it — this button is about Pro, and on
 * a basic account the brand fill is the ordinary blue.
 */
export function GetProButton({ onPress, style }: { onPress: () => void; style?: any }) {
  return (
    <TouchableOpacity
      style={[styles.getProBtn, style]}
      onPress={onPress}
      hitSlop={8}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Get Pro"
    >
      <Info size={13} color="#000000" />
      <Text style={styles.getProText}>Get Pro</Text>
    </TouchableOpacity>
  );
}

export function ProUpsellModal({
  visible,
  onClose,
  title,
  message,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** The specific limit that prompted this — the rest is the same every time. */
  message: string;
}) {
  const c = useColors();
  const brand = useBrandColor();
  const brandText = useBrandTextColor();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* The backdrop is the dismiss target; the card is not. */}
        <Pressable style={[styles.card, { backgroundColor: c.card }]} onPress={() => {}}>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={16} color={c.grey} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: c.fg }]}>{title}</Text>
          <Text style={[styles.body, { color: c.grey }]}>{message}</Text>

          <View style={styles.list}>
            {PRO_BENEFITS.map((line) => (
              <View key={line} style={styles.listRow}>
                <Check size={14} color={brand} />
                <Text style={[styles.listText, { color: c.fg }]}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.soon, { borderColor: c.borderDark }]}>
            <Text style={[styles.soonText, { color: c.grey }]}>
              Pro memberships are opening soon. Nothing about your account
              changes in the meantime.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: brand }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaText, { color: brandText }]}>Got it</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Button and modal together, for the common case. */
export function ProUpsell({ title, message, style }: {
  title: string;
  message: string;
  style?: any;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GetProButton onPress={() => setOpen(true)} style={style} />
      <ProUpsellModal
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
        message={message}
      />
    </>
  );
}

const styles = StyleSheet.create({
  getProBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.pro,
  },
  getProText: { fontSize: 12, fontWeight: '800', color: '#000000', letterSpacing: 0.2 },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  card:  { width: '100%', maxWidth: 380, borderRadius: 16, padding: 22 },
  close: { position: 'absolute', top: 12, right: 12, padding: 4, zIndex: 1 },
  title: { fontSize: 19, fontWeight: '800', marginBottom: 8, paddingRight: 24 },
  body:  { fontSize: 14, lineHeight: 20 },

  list:     { marginTop: 16, gap: 9 },
  listRow:  { flexDirection: 'row', alignItems: 'center', gap: 9 },
  listText: { fontSize: 14, flex: 1 },

  soon:     { marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  soonText: { fontSize: 12, lineHeight: 17 },

  cta:     { marginTop: 18, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '800' },
});
