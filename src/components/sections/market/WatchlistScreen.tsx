import React, { useMemo, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert as RNAlert,
  Dimensions,
} from 'react-native';
import { Text } from '@ors/kit';
import { useNavigation } from '@react-navigation/native';
import { Plus, Settings2, Pencil, Trash2, Tag, Megaphone } from 'lucide-react-native';
import SubTabs from '../../ui/SubTabs';
import FormInput from '../../ui/FormInput';
import {
  useGetAlertsQuery, useGetAlertMetaQuery, useCreateAlertMutation,
  useToggleAlertMutation, useDeleteAlertMutation,
  useGetListingsQuery, useGetListingMetaQuery,
} from '../../../api/apiService';
import ListingCard from '../../marketplace/ListingCard';
import ListingSummaryModal from '../../marketplace/ListingSummaryModal';
import AlertSentence from '../../alerts/AlertSentence';
import {
  alertAllowance, alertCapCopy, alertSentence, alertSentencePlain, groupNameOf, normalizeAlertMeta,
} from '../../alerts/alertFormat';
import ActionSheet from '../../ui/ActionSheet';
import Spinner from '../../ui/Spinner';
import RowEndSpacer from '../../ui/RowEndSpacer';
import { ProUpsellModal } from '../../pro/ProUpsell';
import type { SummaryOrigin } from '../../ui/SummaryModal';
import { useColors } from '../../../hooks/useColors';
import { useBrandColor } from '../../../hooks/useBrandColor';
import {
  COMMON_RADIUS, GUTTER, COLOR_BLACK, COLOR_WHITE, APP_BG, FORM_RADIUS,
} from '../../../constants/config';
import { FONT_INTER } from '../../../constants/fonts';
import type { Alert as AlertRule, AlertEvent, ListingBrowseParams } from '../../../types/api';
import type { SectionScreenProps } from '../types';

/** How many current matches a watch shows — a glance, not the browse. */
const MATCH_PREVIEW = 10;
/** Narrow enough that the next card peeks out and says the row scrolls. */
const MATCH_CARD_W = Math.min(Dimensions.get('window').width * 0.5, 220);

/** The two marketplace events a watch can be on. */
const WATCH_EVENTS: { key: 'listing_created' | 'want_created'; label: string; Icon: typeof Tag }[] = [
  { key: 'listing_created', label: 'For sale', Icon: Tag },
  { key: 'want_created',    label: 'Wanted',   Icon: Megaphone },
];
const isWatchEvent = (e: AlertEvent) => e === 'listing_created' || e === 'want_created';

/**
 * A watch's rule, as the browse's query — so "what matches now" is the same
 * question the alert asks of each new listing. The keyword goes in as the
 * search; the other marketplace filters the browse also takes come along.
 * Make and model don't: the browse has no filter for them.
 */
function matchParams(alert: AlertRule): ListingBrowseParams {
  const f = alert.filters ?? {};
  const want = alert.event === 'want_created';
  return {
    kind: want ? 'want' : 'sale',
    q: f.keyword?.trim() || undefined,
    ...(f.category ? { category: f.category } : {}),
    ...(!want && f.price_max != null ? { max_price: f.price_max } : {}),
    ...(!want && f.condition_min != null ? { condition_min: f.condition_min } : {}),
    ...(f.region ? { region: f.region } : {}),
    ...(f.near?.lat != null && f.near?.lng != null ? {
      near_lat: f.near.lat,
      near_lng: f.near.lng,
      ...(f.near.radius_miles ? { radius: f.near.radius_miles } : {}),
    } : {}),
    ...(f.group_id ? { group_id: f.group_id } : {}),
    sort: 'recent',
    limit: MATCH_PREVIEW,
  };
}

/**
 * Marketplace › Watchlist — the alerts that watch the marketplace for a word.
 *
 * Not a second store of anything: every watch is a custom alert (`/api/alerts`)
 * on `listing_created` or `want_created` with a `keyword`, so the server's
 * matcher does the notifying and the Alerts screen lists the same rules. What
 * this adds is the quick way in — type a word, done — and, under each watch,
 * what already matches it, from the browse's own search.
 *
 * Every marketplace alert shows here, keyword or not — one made on the
 * Alerts screen for a make or a price cap is listed the same way.
 */
export default function WatchlistScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const nav = useNavigation<any>();
  const colors = useColors();
  const brand = useBrandColor();

  const { data, isLoading, isError, refetch } = useGetAlertsQuery();
  const { data: rawMeta } = useGetAlertMetaQuery();
  const meta = useMemo(() => normalizeAlertMeta(rawMeta), [rawMeta]);
  const { data: listingMeta } = useGetListingMetaQuery();

  const [createAlert, { isLoading: creating }] = useCreateAlertMutation();
  const [toggleAlert] = useToggleAlertMutation();
  const [deleteAlert] = useDeleteAlertMutation();

  const marketAlerts = (data?.entries ?? []).filter((a) => isWatchEvent(a.event));
  // Every marketplace alert you've made — a keyword or not (make, price,
  // place) — each with what matches it now.
  const watches = marketAlerts;

  // The cap is the alerts' own, shared with every other rule the member has.
  const allowance = alertAllowance(data?.counts);
  const [upsell, setUpsell] = useState<{ title: string; message: string } | null>(null);
  const showCap = (serverMessage?: string) => {
    const copy = alertCapCopy(!!allowance?.isPro, serverMessage);
    if (copy.sellPro) setUpsell(copy);
    else RNAlert.alert(copy.title, copy.message);
  };

  const [keyword, setKeyword] = useState('');
  const [event, setEvent] = useState<'listing_created' | 'want_created'>('listing_created');

  const onAdd = async () => {
    const word = keyword.trim();
    if (!word || creating) return;
    if (allowance?.reached) { showCap(); return; }
    // Already watching it: say so rather than spend a slot on a duplicate.
    const dupe = watches.find((a) => a.event === event && a.filters.keyword?.trim().toLowerCase() === word.toLowerCase());
    if (dupe) {
      RNAlert.alert('Already on your watchlist', `You're already watching for “${word}”.`);
      return;
    }
    try {
      // Push on, email off — the rule builder's defaults; speed is the point.
      const res = await createAlert({
        event,
        filters: { keyword: word },
        channels: { push: true, email: false },
      }).unwrap();
      setKeyword('');
      if (res?.warnings?.length) RNAlert.alert('Saved, with a note', res.warnings.join('\n\n'));
    } catch (err: any) {
      if (err?.data?.code === 'alert_limit_reached') showCap(err?.data?.error);
      else RNAlert.alert("Couldn't add that", err?.data?.error ?? 'Please try again.');
    }
  };

  const onToggle = async (alert: AlertRule) => {
    try {
      await toggleAlert({ id: alert.internal_id, enabled: !alert.enabled }).unwrap();
    } catch (err: any) {
      RNAlert.alert("Couldn't change that", err?.data?.error ?? 'Please try again.');
    }
  };

  const onDelete = (alert: AlertRule) => {
    RNAlert.alert(
      'Remove from your watchlist?',
      `${alertSentencePlain(alert, meta, groupNameOf(meta, alert.filters?.group_id))}\n\nYou'll stop being told about these.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try { await deleteAlert(alert.internal_id).unwrap(); } catch (err: any) {
              RNAlert.alert("Couldn't remove that", err?.data?.error ?? 'Please try again.');
            }
          },
        },
      ],
    );
  };

  // The cog's menu, one for the screen.
  const [managing, setManaging] = useState<AlertRule | null>(null);
  // One summary panel for every shelf's cards.
  const [summary, setSummary] = useState<{ id: string; origin: SummaryOrigin | null } | null>(null);

  const addCard = (
    <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.addRow}>
        {/* The app's own field (FormInput), as on every form. */}
        <FormInput
            style={styles.input}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={onAdd}
            placeholder="Watch for… e.g. 911 gearbox"
            placeholderTextColor={colors.grey}
            autoCapitalize="none"
            returnKeyType="done"
            accessibilityLabel="Word or phrase to watch for"
          />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: brand }, !keyword.trim() && styles.addBtnOff]}
          onPress={onAdd}
          disabled={!keyword.trim() || creating}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add to watchlist"
        >
          {creating ? <ActivityIndicator size="small" color={COLOR_BLACK} /> : <Plus size={18} color={COLOR_BLACK} strokeWidth={3} />}
        </TouchableOpacity>
      </View>
      {/* Which side of the market to watch — a part someone's selling, or
          someone wanting one you have. */}
      <View style={styles.eventRow}>
        <View style={styles.eventTabs}>
          <SubTabs
            options={WATCH_EVENTS}
            value={event}
            onChange={setEvent}
            inset={0}
            tone="grey"
          />
        </View>
        {allowance ? (
          <Text style={[styles.cap, { color: allowance.reached ? brand : colors.grey }]}>
            {allowance.used} of {allowance.limit} alerts used
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: APP_BG }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: bottomPad }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {addCard}

        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <View style={styles.notice}>
            <Text style={[styles.noticeTitle, { color: colors.fg }]}>Couldn't load your watchlist</Text>
            <TouchableOpacity style={[styles.retry, { borderColor: colors.borderDark }]} onPress={() => refetch()}>
              <Text style={[styles.retryText, { color: colors.fg }]}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : watches.length === 0 ? null : (
          watches.map((alert) => (
            <WatchRow
              key={alert.internal_id}
              alert={alert}
              meta={meta}
              conditions={listingMeta?.conditions}
              onToggle={() => onToggle(alert)}
              onManage={() => setManaging(alert)}
              onOpen={(id, origin) => setSummary({ id, origin })}
            />
          ))
        )}

      </ScrollView>

      <ActionSheet
        visible={!!managing}
        onClose={() => setManaging(null)}
        title={managing ? (managing.filters.keyword?.trim() ? `“${managing.filters.keyword.trim()}”` : 'Alert') : undefined}
        options={managing ? [
          // The full rule builder, for the price cap, the place and the rest.
          { label: 'Edit', Icon: Pencil, onPress: () => nav.navigate('AlertCreate', { alertId: managing.internal_id }) },
          { label: 'Remove', Icon: Trash2, destructive: true, onPress: () => onDelete(managing) },
        ] : []}
      />

      <ListingSummaryModal
        listingId={summary?.id ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />

      <ProUpsellModal
        visible={!!upsell}
        onClose={() => setUpsell(null)}
        title={upsell?.title ?? ''}
        message={upsell?.message ?? ''}
      />
    </View>
  );
}

// ── One watch ────────────────────────────────────────────────────────────────

/**
 * The word, the rule it's part of, its switch and cog — and what matches it
 * now, as a shelf of the browse's own cards.
 */
function WatchRow({ alert, meta, conditions, onToggle, onManage, onOpen }: {
  alert: AlertRule;
  meta: ReturnType<typeof normalizeAlertMeta>;
  conditions?: string[];
  onToggle: () => void;
  onManage: () => void;
  onOpen: (id: string, origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const params = useMemo(() => matchParams(alert), [alert]);
  const { data, isFetching } = useGetListingsQuery(params);
  const matches = data?.entries ?? [];
  const total = data?.total ?? matches.length;
  const groupName = groupNameOf(meta, alert.filters?.group_id);
  const off = !alert.enabled;

  return (
    <View style={styles.watch}>
      <View style={[styles.watchHead, off && styles.off]}>
        <View style={styles.watchText}>
          {/* Its word leads when it has one; otherwise the sentence alone says it. */}
          {alert.filters.keyword?.trim() ? (
            <Text style={[styles.keyword, { color: colors.fg }]} numberOfLines={1}>
              “{alert.filters.keyword.trim()}”
            </Text>
          ) : null}
          {/* The whole rule, as the Alerts screen reads it — the word plus
              whatever else an edit added. */}
          <View accessible accessibilityLabel={alertSentencePlain(alert, meta, groupName)}>
            <AlertSentence parts={alertSentence(alert, meta, groupName)} textStyle={styles.sentence} />
          </View>
        </View>
        <Switch
          value={alert.enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.segment, true: brand }}
          thumbColor={COLOR_WHITE}
          accessibilityLabel={alert.enabled ? 'Stop watching' : 'Start watching'}
        />
        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: colors.borderDark }]}
          onPress={onManage}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Watch options"
        >
          <Settings2 size={16} color={colors.fg} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.matchCount, { color: colors.grey }]}>
        {isFetching && !data ? 'Looking…'
          : total === 0 ? (off ? 'Paused · nothing matches right now' : "Nothing matches right now — you'll hear when something does")
          : `${total} matching now${off ? ' · paused' : ''}`}
      </Text>

      {matches.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelf}
          snapToInterval={MATCH_CARD_W + 10}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          {matches.map((listing) => (
            <View key={listing.internal_id} style={{ width: MATCH_CARD_W }}>
              <ListingCard
                listing={listing}
                conditions={conditions}
                onPress={(origin) => onOpen(listing.internal_id, origin)}
              />
            </View>
          ))}
          <RowEndSpacer width={GUTTER} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  addCard: {
    marginHorizontal: GUTTER, marginTop: 12, padding: 10, gap: 10,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  addRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  input: { flex: 1, minWidth: 0 },
  // As tall as the field beside it, and its corners.
  addBtn: { width: 48, alignSelf: 'stretch', borderRadius: FORM_RADIUS, alignItems: 'center', justifyContent: 'center' },
  addBtnOff: { opacity: 0.4 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventTabs: { flexShrink: 1 },
  cap: { marginLeft: 'auto', flexShrink: 0, fontSize: 11, fontFamily: FONT_INTER.semibold },

  watch: { paddingTop: 22 },
  watchHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: GUTTER + 6 },
  /** Paused, not gone: still legible, plainly not running. */
  off: { opacity: 0.55 },
  watchText: { flex: 1, minWidth: 0, gap: 6 },
  keyword: { fontSize: 18, fontFamily: FONT_INTER.bold, letterSpacing: -0.3 },
  sentence: { fontSize: 12.5, lineHeight: 18 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  matchCount: { fontSize: 12, fontFamily: FONT_INTER.semibold, paddingHorizontal: GUTTER + 6, paddingTop: 8, paddingBottom: 10 },
  shelf: { paddingLeft: GUTTER, gap: 10 },


  notice: { alignItems: 'center', paddingTop: 36, gap: 14 },
  noticeTitle: { fontSize: 15, fontFamily: FONT_INTER.bold },
  retry: { borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 18 },
  retryText: { fontSize: 13, fontFamily: FONT_INTER.bold },

  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 24 },
  moreText: { fontSize: 12, fontFamily: FONT_INTER.semibold },
});
