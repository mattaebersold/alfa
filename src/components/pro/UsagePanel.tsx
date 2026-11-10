import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from '@ors/kit';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import { colors } from '../../constants/colors';
import {
  ALERT_LIMIT_BASIC,
  CAR_LIMIT_BASIC,
  EVENT_LIMIT_BASIC,
  LISTING_LIMIT_BASIC,
  POST_LIMIT_BASIC,
  ROUTE_LIMIT_BASIC,
  CAR_LIMIT_PRO,
  POST_LIMIT_PRO,
  LISTING_LIMIT_PRO,
  COLOR_WHITE,
} from '../../constants/config';
import { PHOTO_SPOT_LIMIT_BASIC, PHOTO_SPOT_LIMIT_PRO } from '@ors/kit/src/photography';
import type { MonthlyUsage } from '../../types/api';
import { ProUpsell } from './ProUpsell';
import { FONT_INTER } from '../../constants/fonts';

/** Light on the dark page — the card is an outline, not a fill. */
const INK = COLOR_WHITE;
const TRACK = 'rgba(255,255,255,0.14)';

const PIE_SIZE = 64;
/** The round count on a pie's centre. */
const PIE_COUNT = 36;
/** Header badges and the Get Pro button, all the same height. */
const BADGE_H = 24;

type Meter = { used: number; limit: number | null };

/**
 * Everything a basic membership limits, and how much of it is spent.
 *
 * Two groups:
 *  - Standing totals (cars, routes, events, groups, alerts, pins) — a slot
 *    comes back when something is deleted, never on a date. Bars, two to a row.
 *  - Per month (posts, listings), which come back on the 1st. Pies, under
 *    their own heading with the reset date as a badge.
 *
 * Outlined in the member's brand colour, with the meters filled in it, so the
 * card reads as their membership at a glance before any number on it does.
 */
export default function UsagePanel({
  cars,
  posts,
  events,
  listings,
  alerts,
  groups,
  routes,
  photoSpots,
  style,
}: {
  cars: Meter;
  posts: MonthlyUsage;
  /** A standing total (not monthly). Missing from servers older than the event limit. */
  events?: MonthlyUsage;
  /** Missing from servers older than the listing limit, and then not drawn. */
  listings?: MonthlyUsage;
  /** Custom alerts — a standing count. Missing from servers older than the feature. */
  alerts?: { used: number; limit: number | null };
  /** Groups started — a standing count. Missing from servers older than the group limit. */
  groups?: { used: number; limit: number | null };
  /** Routes kept — a standing count. `used` is missing from servers older than the basic allowance. */
  routes?: { used?: number; limit?: number | null };
  /** Photography pins — a standing count. Missing until the kit's spot usage has loaded. */
  photoSpots?: Meter;
  style?: any;
}) {
  const brand = useBrandColor();
  const isPro = useIsPro();

  const resets = resetLabel(posts, listings);

  // A count the server hasn't started reporting draws nothing at all —
  // "undefined of 5" is worse than no meter.
  const bars: { label: string; meter: Meter }[] = [{ label: 'Garage cars', meter: cars }];
  // A server from before the basic route allowance sends no count — routes
  // were Pro-only there, so a basic member has none of their own to count.
  bars.push({
    label: 'Driving Routes',
    meter: typeof routes?.used === 'number'
      ? { used: routes.used, limit: routes.limit ?? null }
      : { used: 0, limit: isPro ? null : ROUTE_LIMIT_BASIC },
  });
  if (typeof events?.used === 'number') bars.push({ label: 'Events', meter: events });
  if (typeof groups?.used === 'number') bars.push({ label: 'Groups started', meter: { used: groups.used, limit: groups.limit ?? null } });
  if (typeof alerts?.used === 'number') bars.push({ label: 'Custom alerts', meter: { used: alerts.used, limit: alerts.limit ?? null } });
  if (photoSpots) bars.push({ label: 'Photography pins', meter: photoSpots });

  return (
    <View style={[styles.wrap, { borderColor: brand }, style]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: brand }]}>Your usage</Text>
        <View style={styles.headRight}>
          <Badge>{isPro ? 'Pro' : 'Basic'}</Badge>
          {/* Nothing to sell someone who already has it. */}
          {!isPro && (
            <ProUpsell
              style={styles.getPro}
              title="No limits with Pro"
              message={`A basic membership holds ${CAR_LIMIT_BASIC} garage cars, ${ROUTE_LIMIT_BASIC} route, ${PHOTO_SPOT_LIMIT_BASIC} photography pins, ${ALERT_LIMIT_BASIC} custom alert, ${EVENT_LIMIT_BASIC} event and 1 group, with ${POST_LIMIT_BASIC} posts and ${LISTING_LIMIT_BASIC} marketplace listings a month. Pro raises them to ${CAR_LIMIT_PRO} cars, unlimited routes, ${PHOTO_SPOT_LIMIT_PRO} pins, unlimited events and groups, and ${POST_LIMIT_PRO} posts and ${LISTING_LIMIT_PRO} listings a month, and unlocks lists and car tasks.`}
            />
          )}
        </View>
      </View>

      <View style={styles.grid}>
        {bars.map(({ label, meter }) => (
          <UsageBar key={label} brand={brand} label={label} used={meter.used} limit={meter.limit} />
        ))}
      </View>

      <View style={[styles.head, styles.monthHead]}>
        <Text style={[styles.title, { color: brand }]}>Per month</Text>
        {resets ? <Badge>Resets {resets}</Badge> : null}
      </View>

      <View style={styles.pies}>
        <UsagePie brand={brand} label="Posts" used={posts.used} limit={posts.limit} />
        {typeof listings?.used === 'number' && (
          <UsagePie brand={brand} label="Marketplace listings" used={listings.used} limit={listings.limit ?? null} />
        )}
      </View>
    </View>
  );
}

/**
 * The reset day, e.g. "December 1".
 *
 * From `resets_on` (a calendar date the server picks) when it's there, so
 * the day can't drift with the phone's time zone; an older server's
 * `resets_at` is midnight UTC on the 1st, whose UTC date is the same day.
 * Parsed by hand rather than through Intl's timeZone option, which Hermes
 * doesn't support everywhere.
 */
function resetLabel(...meters: (MonthlyUsage | undefined)[]) {
  for (const m of meters) {
    const ymd = m?.resets_on ?? (m?.resets_at ? new Date(m.resets_at).toISOString().slice(0, 10) : null);
    if (!ymd) continue;
    const [y, mo, d] = ymd.split('-').map(Number);
    if (!y || !mo || !d) continue;
    return new Date(y, mo - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }
  return null;
}

/** A small dark tag, sized to sit level with the Get Pro button. */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

/**
 * One standing allowance: its name and count, then the bar. Half the card's
 * width — they sit two to a row.
 *
 * Unlimited gets the count and no bar — a full-width bar reading "unlimited"
 * is a progress indicator for something that never progresses.
 */
function UsageBar({ brand, label, used, limit }: { brand: string; label: string; used: number; limit: number | null }) {
  const unlimited = limit === null;
  const ratio = unlimited ? 0 : Math.min(1, limit === 0 ? 1 : used / limit);
  const atLimit = !unlimited && used >= limit;

  return (
    <View style={styles.cell}>
      <View style={styles.cellHead}>
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
        <Text style={[styles.countPill, atLimit && styles.pillAtLimit]} numberOfLines={1}>
          {limit === null ? `${used}` : `${used}/${limit}`}
        </Text>
      </View>
      {!unlimited && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${ratio * 100}%`, backgroundColor: atLimit ? colors.red : brand },
            ]}
          />
        </View>
      )}
    </View>
  );
}

/** The wedge from twelve o'clock, clockwise, covering `ratio` of the circle. */
function wedge(ratio: number, size: number) {
  const r = size / 2;
  const angle = ratio * 2 * Math.PI;
  const x = r + r * Math.sin(angle);
  const y = r - r * Math.cos(angle);
  const large = ratio > 0.5 ? 1 : 0;
  return `M ${r} ${r} L ${r} 0 A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
}

/** One monthly allowance as a solid pie, its name and a count pill beneath. */
function UsagePie({ brand, label, used, limit }: { brand: string; label: string; used: number; limit: number | null }) {
  const unlimited = limit === null;
  const ratio = unlimited ? 0 : Math.min(1, limit === 0 ? 1 : used / limit);
  const atLimit = !unlimited && used >= limit;
  const fill = atLimit ? colors.red : brand;
  const r = PIE_SIZE / 2;

  return (
    <View style={styles.pie}>
      <View style={styles.pieChart}>
        <Svg width={PIE_SIZE} height={PIE_SIZE}>
          <Circle cx={r} cy={r} r={r} fill={TRACK} />
          {/* A full circle can't be drawn as an arc — its ends meet. */}
          {ratio >= 1
            ? <Circle cx={r} cy={r} r={r} fill={fill} />
            : ratio > 0 && <Path d={wedge(ratio, PIE_SIZE)} fill={fill} />}
        </Svg>
        {/* The count, centred on the pie. */}
        <View style={styles.pieCenter}>
          <View style={[styles.pieCount, atLimit && styles.pillAtLimit]}>
            <Text style={styles.pieCountText} numberOfLines={1} adjustsFontSizeToFit>
              {limit === null ? `${used}` : `${used}/${limit}`}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.pieLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 22, borderWidth: 2.5, padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontFamily: FONT_INTER.bold, letterSpacing: -0.2 },
  // The badges and Get Pro share one height so they line up in the header.
  badge: {
    height: BADGE_H, paddingHorizontal: 8, borderRadius: 999,
    justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)',
  },
  badgeText: { color: INK, fontSize: 10, fontFamily: FONT_INTER.semibold },
  getPro: { height: BADGE_H, paddingVertical: 0 },
  // The reset badge sits right after the heading rather than out at the edge.
  monthHead: { marginTop: 14, justifyContent: 'flex-start' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 20, columnGap: 24 },
  // Two to a row: half the width, less half the gap between them.
  cell: { width: '44%', flexGrow: 1, gap: 6 },
  cellHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { color: INK, fontSize: 13, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  countPill: {
    color: INK, fontSize: 10, fontFamily: FONT_INTER.semibold, fontVariant: ['tabular-nums'],
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)', overflow: 'hidden',
  },
  track: { height: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: TRACK, marginTop: 2 },
  fill: { height: '100%', borderRadius: 999 },

  pies: { flexDirection: 'row', justifyContent: 'space-around', gap: 12 },
  pie: { alignItems: 'center', flex: 1, gap: 8 },
  pieChart: { width: PIE_SIZE, height: PIE_SIZE },
  pieCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  // Round, like the pie it sits on. Shrinks its text rather than its shape
  // for a long count.
  pieCount: {
    width: PIE_COUNT, height: PIE_COUNT, borderRadius: PIE_COUNT / 2, paddingHorizontal: 3,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pieCountText: { color: INK, fontSize: 10, fontFamily: FONT_INTER.semibold, fontVariant: ['tabular-nums'] },
  pieLabel: { color: INK, fontSize: 13, fontFamily: FONT_INTER.bold, textAlign: 'center' },
  pillAtLimit: { backgroundColor: colors.red, color: COLOR_WHITE },
});
