import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';

/**
 * Shown when we hold a token but can't turn it into an account.
 *
 * The app used to render itself anyway in this situation, which produced a
 * session that looked signed in and wasn't: default-blue chrome on a pro
 * member, a '?' in place of their avatar, and every button failing silently.
 * A member has no way to read that as "your session is broken" — it just looks
 * like the app is broken — so the two things that could actually fix it were
 * out of reach.
 *
 * A rejected token never gets this far; that logs out on its own. What lands
 * here is the ambiguous rest — the server erroring, a request that never
 * completed — where the token may well still be good. That's why signing out
 * is offered rather than done: throwing away a working session because a
 * server had a bad minute is the more expensive mistake of the two.
 */
export default function SessionRecovery({
  onRetry,
  onSignOut,
  retrying,
}: {
  onRetry: () => void;
  onSignOut: () => void;
  /** A retry is in flight — the button spins rather than looking inert. */
  retrying?: boolean;
}) {
  const c = useColors();

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.cream }]}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.fg }]}>Can't load your account</Text>
        <Text style={[styles.message, { color: c.grey }]}>
          You're signed in, but we couldn't reach your profile. Check your
          connection and try again — or sign in again to start fresh.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, retrying && styles.btnBusy]}
          onPress={onRetry}
          disabled={retrying}
          activeOpacity={0.85}
        >
          {retrying
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.primaryLabel}>Try again</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onSignOut} activeOpacity={0.7}>
          <Text style={[styles.secondaryLabel, { color: c.grey }]}>Sign in again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill:    { flex: 1 },
  body:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title:   { fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 28 },
  primaryBtn: {
    backgroundColor: colors.primaryAlt,
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 999,
    minWidth: 200, minHeight: 48, alignItems: 'center', justifyContent: 'center',
  },
  btnBusy:  { opacity: 0.7 },
  primaryLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 16 },
  secondaryLabel: { fontSize: 14, fontWeight: '600' },
});
