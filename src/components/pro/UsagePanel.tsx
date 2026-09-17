import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import { colors } from '../../constants/colors';
import { CAR_LIMIT_BASIC, EVENT_LIMIT_BASIC, POST_LIMIT_BASIC } from '../../constants/limits';
import type { MonthlyUsage } from '../../types/api';
import { ProUpsell } from './ProUpsell';

/** Black on the brand fill, gold or blue — see GarageScreen's addBtn. */
const INK = '#000000';
const INK_SOFT = 'rgba(0,0,0,0.62)';

/**
 * Everything a membership allows, and how much of it is spent.
 *
 * One card rather than a meter per allowance: they're one question — "what
 * does my membership let me do" — and scattered across the dashboard they read
 * as unrelated warnings. Standing totals come first and on their own, then the
 * allowances that reset on the 1st under one heading that says so.
 *
 * Painted the member's brand colour, blue or gold, so the card reads as their
 * membership at a glance before any number on it does.
 *
 * Shown before it matters rather than at the moment it bites — someone who can
 * see they're at 18 of 20 can pace themselves, where someone who finds out by
 * being refused has already lost the post they were writing.
 */
export default function UsagePanel({
  cars,
  posts,
  events,
  style,
}: {
  cars: { used: number; limit: number | null };
  posts: MonthlyUsage;
  /** Missing from servers older than the event limit, and then not drawn. */
  events?: MonthlyUsage;
  style?: any;
}) {
  const brand = useBrandColor();
  const isPro = useIsPro();

  // Both monthly allowances share a window, so either one's date is the date.
  const resetsAt = posts.resets_at ?? events?.resets_at ?? null;
  const resets = resetsAt
    ? new Date(resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : null;

  return (
    <View style={[styles.wrap, { backgroundColor: brand }, style]}>
      <View style={styles.head}>
        <Text style={styles.title}>Your usage</Text>
        <Text style={styles.tier}>{isPro ? 'Pro' : 'Basic'}</Text>
      </View>

      <UsageBar label="Garage cars" used={cars.used} limit={cars.limit} />

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>This month</Text>
        {resets ? <Text style={styles.sectionSub}>Resets {resets}</Text> : null}
      </View>

      <UsageBar label="Posts" used={posts.used} limit={posts.limit} />
      {events && <UsageBar label="Events" used={events.used} limit={events.limit} />}

      {/* Nothing to sell someone who already has it. */}
      {!isPro && (
        <View style={styles.foot}>
          <Text style={styles.footText}>Pro removes every limit.</Text>
          <ProUpsell
            title="No limits with Pro"
            message={`A basic membership holds ${CAR_LIMIT_BASIC} garage cars, with ${POST_LIMIT_BASIC} posts and ${EVENT_LIMIT_BASIC} new events a month. Pro removes the limits, and unlocks route recording and the rest of the garage tools.`}
            // Its own gold would vanish into a Pro card, but a Pro card never
            // shows it; on blue it needs a dark edge to stand off the fill.
            style={styles.upsellBtn}
          />
        </View>
      )}
    </View>
  );
}

/**
 * One allowance: its name and count, then the bar.
 *
 * Unlimited gets the count and no bar — a full-width bar reading "unlimited"
 * is a progress indicator for something that never progresses.
 */
function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit === null;
  const ratio = unlimited ? 0 : Math.min(1, limit === 0 ? 1 : used / limit);
  const atLimit = !unlimited && used >= limit;

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowCount}>
          {unlimited ? `${used} · Unlimited` : `${used} of ${limit}`}
          {atLimit ? ' · Limit reached' : ''}
        </Text>
      </View>
      {!unlimited && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${ratio * 100}%`, backgroundColor: atLimit ? colors.red : INK },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: INK, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  tier: {
    color: INK, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.12)', overflow: 'hidden',
  },

  sectionHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { color: INK, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionSub: { color: INK_SOFT, fontSize: 12, fontWeight: '600' },

  row: { gap: 7 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { color: INK, fontSize: 14, fontWeight: '700' },
  rowCount: { color: INK_SOFT, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.16)' },
  fill: { height: '100%', borderRadius: 999 },

  foot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    marginTop: 2,
  },
  footText: { color: INK_SOFT, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  upsellBtn: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
});
