import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { Info, X, Check, Bell } from 'lucide-react-native';
import SteeringWheel from '../ui/SteeringWheel';
import { useRegisterProInterestMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { colors } from '../../constants/colors';

/**
 * What Pro includes — the same list murray's membership page shows.
 *
 * Only the things Pro adds. The shared features are on the comparison table
 * where two columns make "both plans" meaningful; in a modal that exists to
 * answer "what do I get if I upgrade", a tick beside something you already have
 * is noise.
 */
export const PRO_BENEFITS = [
  'Unlimited cars in your garage',
  'Unlimited posts — no monthly cap',
  'Create groups',
  'Create events',
  'Create driving routes',
  'Task lists on every car',
  'User lists',
  'Automated diecast marketplace listings',
  'Yearly invite-only PRO rally',
  'And more as it lands',
];

/** Ink for everything sitting on the gold. */
const ON_GOLD = '#14110B';
const ON_GOLD_MUTED = 'rgba(20,17,11,0.62)';

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

/**
 * The Pro pitch, as a gold card.
 *
 * The whole sheet carries the brand fill rather than a dark card with a gold
 * button in it: this is the one screen in a black app that is entirely about
 * one thing, and making it the colour of that thing says so before a word is
 * read. Everything on it is near-black, because gold is a light fill and white
 * on it is unreadable.
 *
 * The action is "get notified", not "buy" — Pro isn't purchasable yet, and a
 * button that can't do what it says is worse than no button. It registers
 * interest once and then reports that it did.
 */
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
  const { userInfo } = useAppSelector((st) => st.auth);
  const [registerInterest, { isLoading }] = useRegisterProInterestMutation();
  const [justRegistered, setJustRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Already on the list?
   *
   * `proInterest` comes back on the profile, so this survives closing the sheet,
   * backgrounding the app, and reinstalling it — the button doesn't come back
   * to be pressed a second time. `justRegistered` covers the moment between the
   * tap and the profile refetch landing.
   */
  const onTheList = justRegistered || userInfo?.proInterest === true;

  const handleNotify = async () => {
    setError(null);
    try {
      await registerInterest().unwrap();
      setJustRegistered(true);
    } catch (err: any) {
      setError(err?.data?.error ?? "Couldn't save that. Please try again.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* The backdrop is the dismiss target; the card is not. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={17} color={ON_GOLD} />
          </TouchableOpacity>

          <View style={styles.head}>
            <View style={styles.wheel}>
              <SteeringWheel size={19} color={colors.pro} strokeWidth={2.4} />
            </View>
            <Text style={styles.eyebrow}>Open Road Society</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{message}</Text>

          {/* The list can outgrow a short phone; it scrolls rather than pushing
              the action off the bottom of the card. */}
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {PRO_BENEFITS.map((line) => (
              <View key={line} style={styles.listRow}>
                <View style={styles.tick}>
                  <Check size={11} color={colors.pro} strokeWidth={3.5} />
                </View>
                <Text style={styles.listText}>{line}</Text>
              </View>
            ))}
          </ScrollView>

          {onTheList ? (
            <View style={styles.done}>
              <Check size={16} color={ON_GOLD} strokeWidth={3} />
              <Text style={styles.doneText}>
                We'll reach out to you when PRO is available.
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.cta, isLoading && styles.ctaBusy]}
                onPress={handleNotify}
                disabled={isLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Get notified when Pro is available"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.pro} />
                ) : (
                  <>
                    <Bell size={15} color={colors.pro} strokeWidth={2.4} />
                    <Text style={styles.ctaText}>Get notified when available</Text>
                  </>
                )}
              </TouchableOpacity>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}

          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.dismiss}>
            <Text style={styles.dismissText}>{onTheList ? 'Close' : 'Not now'}</Text>
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
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 380, maxHeight: '86%',
    borderRadius: 20, padding: 22,
    backgroundColor: colors.pro,
  },
  close: { position: 'absolute', top: 14, right: 14, padding: 4, zIndex: 1 },

  head:    { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  wheel: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: ON_GOLD,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.1,
    textTransform: 'uppercase', color: ON_GOLD_MUTED,
  },

  title: { fontSize: 24, fontWeight: '800', color: ON_GOLD, letterSpacing: -0.3, paddingRight: 20 },
  body:  { fontSize: 14, lineHeight: 20, color: ON_GOLD_MUTED, marginTop: 7 },

  listScroll: { marginTop: 16, marginBottom: 4 },
  list:     { gap: 9, paddingBottom: 4 },
  listRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tick: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: ON_GOLD,
    alignItems: 'center', justifyContent: 'center',
  },
  listText: { flex: 1, fontSize: 14, fontWeight: '600', color: ON_GOLD },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 14, borderRadius: 999,
    backgroundColor: ON_GOLD,
  },
  ctaBusy:  { opacity: 0.75 },
  ctaText:  { fontSize: 15, fontWeight: '800', color: colors.pro },
  error:    { fontSize: 12, fontWeight: '600', color: '#7A1508', textAlign: 'center', marginTop: 8 },

  done: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginTop: 16, paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5, borderColor: ON_GOLD,
  },
  doneText: { flex: 1, fontSize: 13, fontWeight: '700', color: ON_GOLD, lineHeight: 18 },

  dismiss:     { alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
  dismissText: { fontSize: 13, fontWeight: '700', color: ON_GOLD_MUTED },
});
