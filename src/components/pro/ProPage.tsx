import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Text } from '../../theme/Text';
import { Bell, Check } from 'lucide-react-native';
import SteeringWheel from '../ui/SteeringWheel';
import { useProSignup } from './ProUpsell';
import { colors } from '../../constants/colors';
import {
  COLOR_BLACK, COLOR_WHITE, COMMON_RADIUS, SURFACE_MID,
  CAR_LIMIT_BASIC, CAR_LIMIT_PRO, POST_LIMIT_BASIC, POST_LIMIT_PRO,
  LISTING_LIMIT_BASIC, LISTING_LIMIT_PRO, ALERT_LIMIT_BASIC, ALERT_LIMIT_PRO,
  EVENT_LIMIT_BASIC, ROUTE_LIMIT_BASIC, GROUP_LIMIT_BASIC,
  EVENT_LIMIT_PRO, GROUP_LIMIT_PRO, ROUTE_LIMIT_PRO,
} from '../../constants/config';
import { PHOTO_SPOT_LIMIT_BASIC, PHOTO_SPOT_LIMIT_PRO } from '../../photography';
import { FONT_INTER } from '../../constants/fonts';

/** What Pro adds that a basic membership doesn't have at all. */
const PRO_FEATURES = [
  'Access to the PRO-only group',
  'Access to the PRO section of the app',
  'Marketplace',
  'Create and watch PRO member videos',
  'Daily games',
  'Manage car to-dos',
  'Lists on your profile and your cars',
  'Automated diecast marketplace listings',
  'Yearly invite-only PRO rally',
  'Access to the Pro channels on Discord',
];

/** What a regular membership can make a little of, and Pro more of. */
const PRO_LIMITS: { label: string; basic: number | string; pro: number | string }[] = [
  { label: 'Garage cars',                   basic: CAR_LIMIT_BASIC,        pro: CAR_LIMIT_PRO },
  { label: 'Posts a month',                 basic: POST_LIMIT_BASIC,       pro: POST_LIMIT_PRO },
  { label: 'Events',                        basic: EVENT_LIMIT_BASIC,      pro: EVENT_LIMIT_PRO },
  { label: 'Custom alerts',                 basic: ALERT_LIMIT_BASIC,      pro: ALERT_LIMIT_PRO },
  { label: 'Groups',                        basic: GROUP_LIMIT_BASIC,      pro: GROUP_LIMIT_PRO },
  { label: 'Photography pins',              basic: PHOTO_SPOT_LIMIT_BASIC, pro: PHOTO_SPOT_LIMIT_PRO },
  { label: 'Marketplace listings a month',  basic: LISTING_LIMIT_BASIC,    pro: LISTING_LIMIT_PRO },
  { label: 'Driving routes',                basic: ROUTE_LIMIT_BASIC,      pro: ROUTE_LIMIT_PRO },
];

/**
 * The PRO tab's page: straight on the screen's ground, not a card. The wheel
 * beside the title, the way in above it; then what Pro adds, as a list; then "Create more content",
 * regular against Pro; then the way in — or "You're PRO" if you are.
 *
 * The Pro sheet (ProUpsellModal) is the short version of this; the two share
 * the sign-up itself (useProSignup).
 */
export default function ProPage() {
  const { isPro, onTheList, purchase, handleNotify, isLoading, error } = useProSignup();

  /**
   * The way in, at the top of the page: the button, the store's terms and
   * Restore — or the "we'll reach out" note. Nothing for a Pro member.
   */
  const action = () => (
      isPro ? null : purchase.ready ? (
        <>
          <TouchableOpacity
            style={[styles.cta, styles.ctaTop, purchase.busy && styles.ctaBusy]}
            onPress={purchase.subscribe}
            disabled={purchase.busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={purchase.price ? `Subscribe to Pro for ${purchase.price} a month` : 'Subscribe to Pro'}
          >
            {purchase.busy ? (
              <ActivityIndicator size="small" color={COLOR_WHITE} />
            ) : (
              <>
                <SteeringWheel size={16} color={COLOR_WHITE} strokeWidth={2.4} />
                <Text style={styles.ctaText}>{purchase.price ? `Get PRO · ${purchase.price}/month` : 'Get PRO'}</Text>
              </>
            )}
          </TouchableOpacity>
          {purchase.error ? <Text style={styles.error}>{purchase.error}</Text> : null}
          {/* What the stores require beside a subscription: the length, the
              price, that it renews, how to stop it, and the terms. */}
          <Text style={styles.fine}>
            Monthly subscription{purchase.price ? ` at ${purchase.price}` : ''}, renewing automatically
            until you cancel. Cancel anytime in your {purchase.storeName} settings.{' '}
            <Text style={styles.fineLink} onPress={() => Linking.openURL('https://openroadsociety.co/terms-of-service')}>Terms</Text>
            {' · '}
            <Text style={styles.fineLink} onPress={() => Linking.openURL('https://openroadsociety.co/privacy-policy')}>Privacy</Text>
          </Text>
          <TouchableOpacity onPress={purchase.restore} disabled={purchase.busy} hitSlop={8} style={styles.restore}>
            <Text style={styles.restoreText}>Restore purchase</Text>
          </TouchableOpacity>
        </>
      ) : onTheList ? (
        <View style={[styles.youre, styles.youreTop]}>
          <Check size={16} color={colors.pro} strokeWidth={3} />
          <Text style={styles.youreText}>We'll reach out to you when PRO is available.</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.cta, styles.ctaTop, isLoading && styles.ctaBusy]}
            onPress={handleNotify}
            disabled={isLoading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Get notified when Pro is available"
          >
            {isLoading ? <ActivityIndicator size="small" color={COLOR_WHITE} /> : (
              <>
                <Bell size={16} color={COLOR_WHITE} strokeWidth={2.4} />
                <Text style={styles.ctaText}>Get notified when available</Text>
              </>
            )}
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )
  );

  return (
    <View style={styles.page}>
      {action()}
      <View style={[styles.titleRow, !isPro && styles.titleRowAfterAction]}>
        <SteeringWheel size={28} color={colors.pro} strokeWidth={2.3} />
        <Text style={styles.title}>Open Road Society</Text>
        {/* PRO as a pill: black on the Pro red. */}
        <View style={styles.titlePill}>
          <Text style={styles.titlePillText}>PRO</Text>
        </View>
      </View>

      {isPro ? (
        <View style={styles.youre}>
          <Check size={16} color={colors.pro} strokeWidth={3} />
          <Text style={styles.youreText}>You're PRO. Thanks for supporting the society.</Text>
        </View>
      ) : null}

      <Text style={styles.sectionHead}>What you get</Text>
      <View style={styles.bullets}>
        {PRO_FEATURES.map((line) => (
          <View key={line} style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionHead}>Create more content</Text>
      <View style={styles.limits}>
        <View style={[styles.limitRow, styles.limitHeadRow]}>
          <Text style={[styles.limitLabel, styles.limitHead]} />
          {/* No heading over the regular column: the Pro one says which is which. */}
          <Text style={styles.limitCell} />
          <Text style={[styles.limitCell, styles.limitHeadPro]}>PRO</Text>
        </View>
        {PRO_LIMITS.map((l, i) => (
          <View key={l.label} style={[styles.limitRow, i > 0 && styles.limitRule]}>
            <Text style={styles.limitLabel}>{l.label}</Text>
            <Text style={[styles.limitCell, styles.limitBasic]}>{l.basic}</Text>
            <Text style={[styles.limitCell, styles.limitPro]}>{l.pro}</Text>
          </View>
        ))}
      </View>

    </View>
  );
}

const MUTED = 'rgba(255,255,255,0.62)';

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 520, alignSelf: 'center' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRowAfterAction: { marginTop: 24 },
  title: { flexShrink: 1, fontSize: 24, fontFamily: FONT_INTER.bold, color: colors.pro, letterSpacing: -0.3 },
  titlePill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.pro },
  titlePillText: { fontSize: 15, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK, letterSpacing: 0.6 },

  youre: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: COMMON_RADIUS, backgroundColor: SURFACE_MID,
  },
  youreTop: { marginTop: 0 },
  youreText: { flex: 1, fontSize: 14, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },

  sectionHead: {
    marginTop: 30, marginBottom: 12,
    fontSize: 18, fontFamily: FONT_INTER.bold, color: COLOR_WHITE,
  },

  bullets: { gap: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // Centred on the first line of the text beside it (lineHeight 21).
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: COLOR_WHITE },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 21, fontFamily: FONT_INTER.medium, color: COLOR_WHITE },

  limits: {},
  limitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  limitHeadRow: { paddingTop: 0, paddingBottom: 6 },
  limitRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.22)' },
  limitLabel: { flex: 1, fontSize: 14, fontFamily: FONT_INTER.medium, color: COLOR_WHITE, paddingRight: 8 },
  limitCell: { width: 76, textAlign: 'right', fontSize: 14, fontVariant: ['tabular-nums'] },
  limitHead: { fontSize: 11, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.8, textTransform: 'uppercase', color: MUTED },
  limitBasic: { fontFamily: FONT_INTER.medium, color: MUTED },
  limitHeadPro: { fontSize: 15, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6, color: colors.pro },
  limitPro: { fontFamily: FONT_INTER.bold, color: colors.pro },

  cta: {
    marginTop: 30, height: 52, borderRadius: COMMON_RADIUS,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    // A red outline, white words — the page is already red-led by its title.
    borderWidth: 1.5, borderColor: colors.pro,
  },
  ctaBusy: { opacity: 0.7 },
  // First on the page: no room above it, the title's gap below it instead.
  ctaTop: { marginTop: 0 },
  ctaText: { fontSize: 16, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE },
  error: { marginTop: 10, fontSize: 13, color: colors.pro, textAlign: 'center' },
  fine: { marginTop: 12, fontSize: 11.5, lineHeight: 16, color: MUTED, textAlign: 'center' },
  fineLink: { textDecorationLine: 'underline', color: COLOR_WHITE },
  restore: { alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
  restoreText: { fontSize: 13, fontFamily: FONT_INTER.semibold, color: MUTED },
});
