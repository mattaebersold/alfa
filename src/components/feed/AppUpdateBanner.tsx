import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Text } from '../../theme/Text';
import * as SecureStore from 'expo-secure-store';
import { Download, X } from 'lucide-react-native';
import { useGetLatestAppVersionQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { APP_VERSION } from '../../utils/appVersion';
import { COMMON_RADIUS, COLOR_BLACK, GUTTER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** How long a ✕ keeps it away. */
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;
const DISMISS_KEY = 'appUpdateBannerDismissed';

/** -1 / 0 / 1, numerically by part: "1.9" < "1.10", "1.87" == "1.87.0". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

type Dismissal = { at: number; version: string };

/**
 * The ✕, kept on the device. SecureStore because it's the only storage the
 * app has; a few bytes, so the keychain's size limit doesn't come into it.
 * A failed read counts as "not dismissed" — the worst case is seeing the row.
 */
async function readDismissal(): Promise<Dismissal | null> {
  try {
    const raw = await SecureStore.getItemAsync(DISMISS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * "A newer version is available" — on the home feed, where the live auction
 * row sits, while the store has a version newer than this one.
 *
 * The store's version comes from the server (horacio's helpers/storeVersions),
 * which asks Apple and Google and caches the answer; an unknown answer shows
 * nothing. The ✕ hides it for 30 days — or until an even newer version
 * ships, since that's a different update from the one that was waved off.
 */
export default function AppUpdateBanner() {
  const colors = useColors();
  const brand = useBrandColor();
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  const { data } = useGetLatestAppVersionQuery(platform, {
    skip: !APP_VERSION || (Platform.OS !== 'ios' && Platform.OS !== 'android'),
  });
  // Unknown until read, so a dismissed row doesn't flash in first.
  const [dismissal, setDismissal] = useState<Dismissal | null | undefined>(undefined);
  useEffect(() => { readDismissal().then(setDismissal); }, []);

  const latest = data?.version;
  if (!latest || !data?.url || !APP_VERSION || dismissal === undefined) return null;
  if (compareVersions(latest, APP_VERSION) <= 0) return null;
  if (
    dismissal
    && Date.now() - dismissal.at < DISMISS_MS
    && compareVersions(latest, dismissal.version) <= 0
  ) return null;

  const dismiss = () => {
    const next = { at: Date.now(), version: latest };
    setDismissal(next);
    SecureStore.setItemAsync(DISMISS_KEY, JSON.stringify(next)).catch(() => {});
  };
  const storeName = platform === 'ios' ? 'App Store' : 'Google Play';

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.main}
          onPress={() => Linking.openURL(data.url!).catch(() => {})}
          activeOpacity={0.8}
          accessibilityRole="link"
          accessibilityLabel={`Version ${latest} is available. Update on the ${storeName}`}
        >
          <View style={[styles.icon, { backgroundColor: brand }]}>
            <Download size={18} color={COLOR_BLACK} strokeWidth={2.6} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>A newer version is available</Text>
            <Text style={[styles.sub, { color: colors.grey }]} numberOfLines={1}>
              {latest} is on the {storeName} — you're on {APP_VERSION}
            </Text>
          </View>
          <Text style={[styles.cta, { color: colors.fg }]}>Update</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={10}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Dismiss for 30 days"
        >
          <X size={16} color={colors.grey} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { paddingTop: 8, paddingBottom: 4, paddingHorizontal: GUTTER },
  card:  {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12, paddingRight: 6,
  },
  main:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text:  { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontFamily: FONT_INTER.bold },
  sub:   { fontSize: 12, marginTop: 2 },
  cta:   { fontSize: 13, fontFamily: FONT_INTER.extrabold },
  close: { padding: 8, marginLeft: 4 },
});
