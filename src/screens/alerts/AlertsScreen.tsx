import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BellRing, Plus, Settings2 } from 'lucide-react-native';
import Spinner from '../../components/ui/Spinner';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import {
  useGetAlertsQuery, useGetAlertMetaQuery, useToggleAlertMutation, useDeleteAlertMutation,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';
import {
  alertAllowance, alertCapCopy, alertSentence, alertSentencePlain,
  groupNameOf, normalizeAlertMeta,
} from '../../components/alerts/alertFormat';
import AlertSentence from '../../components/alerts/AlertSentence';
import type { AppScreenProps } from '../../navigation/types';
import type { Alert as AlertRule } from '../../types/api';

/**
 * The rules a member has standing, and the way to add another.
 *
 * Every row is the sentence, not the record. An alert stored as
 * `listing_created` + `{make_handle: 'porsche', model_handle: '911'}` appears
 * here as "When a **Porsche 911** is **listed for sale**", because that's the
 * only form of it anyone can check at a glance — and checking it at a glance
 * is the whole job of this screen. The switch, the channels and the two
 * buttons hang off that sentence rather than off a name nobody wrote.
 *
 * A screen rather than a sheet on the dashboard: an alert is a thing you come
 * back to and edit, and editing one opens a form of its own, which a sheet
 * over a sheet handles badly.
 */
export default function AlertsScreen({ navigation }: AppScreenProps<'Alerts'>) {
  const colors = useColors();
  const brand = useBrandColor();

  const { data, isLoading, isError, refetch } = useGetAlertsQuery();
  const { data: rawMeta } = useGetAlertMetaQuery();
  const meta = useMemo(() => normalizeAlertMeta(rawMeta), [rawMeta]);

  const [toggleAlert] = useToggleAlertMutation();
  const [deleteAlert] = useDeleteAlertMutation();

  const entries = data?.entries ?? [];
  /**
   * Where they stand. Pro is capped here too — twenty rather than one — so
   * unlike every other meter in the app this one is read for Pro members as
   * well; see `alertAllowance`.
   */
  const allowance = alertAllowance(data?.counts);
  const atCap = !!allowance?.reached;

  const [upsell, setUpsell] = useState<{ title: string; message: string; sellPro: boolean } | null>(null);

  /**
   * The one gate. At the cap the plus explains instead of opening a form the
   * server would refuse at the end of — the same trade the marketplace's
   * create button makes. A basic member is shown the Pro card; a Pro member at
   * twenty has nothing to buy and gets a plain notice. An allowance that
   * didn't load gates nothing.
   */
  const onAdd = () => {
    if (atCap) {
      const copy = alertCapCopy(!!allowance?.isPro);
      if (copy.sellPro) setUpsell(copy);
      else RNAlert.alert(copy.title, copy.message);
      return;
    }
    navigation.navigate('AlertCreate');
  };

  const onToggle = async (alert: AlertRule) => {
    try {
      await toggleAlert({ id: alert.internal_id, enabled: !alert.enabled }).unwrap();
    } catch (err: any) {
      RNAlert.alert("Couldn't change that", err?.data?.error ?? 'Please try again.');
    }
  };

  /**
   * The cog. Edit and delete both act on the rule, so they share one control
   * rather than sitting on every row as a pencil and a bin.
   */
  const onManage = (alert: AlertRule) => {
    RNAlert.alert(
      alert.label?.trim() || 'This alert',
      alertSentencePlain(alert, meta, groupNameOf(meta, alert.filters?.group_id)),
      [
        { text: 'Edit', onPress: () => navigation.navigate('AlertCreate', { alertId: alert.internal_id }) },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(alert) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const onDelete = (alert: AlertRule) => {
    RNAlert.alert(
      'Delete this alert?',
      // The sentence again: "Delete Alert 2?" is not a question anyone can
      // answer, and this is the last chance to notice it's the wrong one.
      `${alertSentencePlain(alert, meta, groupNameOf(meta, alert.filters?.group_id))}\n\nYou'll stop being told about these.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAlert(alert.internal_id).unwrap();
            } catch (err: any) {
              RNAlert.alert("Couldn't delete that", err?.data?.error ?? 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    // Bottom only — the stack header already clears the status bar.
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {isLoading ? (
        <Spinner fullScreen />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isError ? (
            <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.noticeTitle, { color: colors.fg }]}>Couldn't load your alerts</Text>
              <Text style={[styles.noticeBody, { color: colors.grey }]}>
                Check your connection and try again.
              </Text>
              <TouchableOpacity
                style={[styles.retry, { borderColor: colors.borderDark }]}
                onPress={() => refetch()}
                activeOpacity={0.7}
              >
                <Text style={[styles.retryText, { color: colors.fg }]}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : entries.length === 0 ? (
            <EmptyState colors={colors} brand={brand} onAdd={onAdd} />
          ) : (
            <>
              {/* Where they stand, before the list rather than after it: at a
                  cap of one, "1 of 1 used" is the reason the add button won't
                  do what you expect, and reading it last is reading it too
                  late. Pro at 20 has room, so it's a fact, not a warning —
                  which is why the tint only appears at the cap. */}
              {allowance && (
                <View style={[
                  styles.countBar,
                  { backgroundColor: colors.card, borderColor: atCap ? brand : colors.borderDark },
                ]}>
                  <View style={[styles.countDot, { backgroundColor: atCap ? brand : colors.green }]} />
                  <Text style={[styles.countStrong, { color: colors.fg }]}>
                    {allowance.used} of {allowance.limit}
                  </Text>
                  <Text style={[styles.countText, { color: colors.grey }]}>
                    {atCap
                      ? allowance.isPro
                        ? 'alerts used — delete one to make room'
                        : 'alerts used — delete it, or go Pro for 20'
                      : `alerts used · ${allowance.limit - allowance.used} left`}
                  </Text>
                </View>
              )}

              {entries.map((alert) => (
                <AlertRow
                  key={alert.internal_id}
                  alert={alert}
                  meta={meta}
                  groupName={groupNameOf(meta, alert.filters?.group_id)}
                  colors={colors}
                  brand={brand}
                  onToggle={() => onToggle(alert)}
                  onManage={() => onManage(alert)}
                />
              ))}

            </>
          )}
        </ScrollView>
      )}

      {/* The plus, as the marketplace and the garage draw it: brand fill,
          black glyph, bottom right, over the list. Hidden on the empty state,
          which has a full-width button of its own and doesn't need two. */}
      {entries.length > 0 && !isError && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: brand }]}
          onPress={onAdd}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="New alert"
        >
          <Plus size={22} color="#000000" strokeWidth={2.8} />
        </TouchableOpacity>
      )}

      <ProUpsellModal
        visible={!!upsell}
        onClose={() => setUpsell(null)}
        title={upsell?.title ?? ''}
        message={upsell?.message ?? ''}
      />
    </SafeAreaView>
  );
}

// ── One rule ─────────────────────────────────────────────────────────────────

function AlertRow({ alert, meta, groupName, colors, brand, onToggle, onManage }: {
  alert: AlertRule;
  meta: ReturnType<typeof normalizeAlertMeta>;
  groupName: string | null;
  colors: ReturnType<typeof useColors>;
  brand: string;
  onToggle: () => void;
  onManage: () => void;
}) {
  const parts = alertSentence(alert, meta, groupName);
  const off = !alert.enabled;
  const custom = alert.label?.trim();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, off && styles.cardOff]}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          {/* A name the member wrote goes above the sentence, not instead of
              it — "911 parts" doesn't say what it watches, and the sentence
              is the part you actually check. */}
          {!!custom && <Text style={[styles.customName, { color: colors.grey }]}>{custom}</Text>}
          <View accessible accessibilityLabel={alertSentencePlain(alert, meta, groupName)}>
            <AlertSentence parts={parts} />
          </View>
        </View>

        <Switch
          value={alert.enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.segment, true: brand }}
          thumbColor="#FFFFFF"
          accessibilityLabel={alert.enabled ? 'Turn this alert off' : 'Turn this alert on'}
        />
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.channels}>
          {/* No channel pills. Push and email are set when the rule is made and
              changed by editing it, so on the row they were two badges of
              chrome against the one thing worth reading here — the sentence. */}
          {!!alert.match_count && (
            <Text style={[styles.matches, { color: colors.grey }]}>
              {alert.match_count} match{alert.match_count === 1 ? '' : 'es'}
            </Text>
          )}
        </View>

        {/* One cog rather than a pencil and a bin. Editing and deleting are
            both "do something to this rule", and two destructive-adjacent
            buttons on every row is a lot of weight for a list you mostly read.
            The menu names them, and puts the delete behind its own step. */}
        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: colors.borderDark }]}
          onPress={onManage}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Alert options"
        >
          <Settings2 size={16} color={colors.fg} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Nothing yet ──────────────────────────────────────────────────────────────

/**
 * The first screen most members will see, so it has to explain the feature
 * rather than apologise for being empty. One worked example, because "custom
 * alerts" means nothing and "tell me when a 911 gearbox shows up" means
 * everything.
 */
function EmptyState({ colors, brand, onAdd }: {
  colors: ReturnType<typeof useColors>;
  brand: string;
  onAdd: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: brand + '1F', borderColor: brand }]}>
        <BellRing size={26} color={brand} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.fg }]}>Get notified the moment it appears</Text>

      <View style={[styles.example, { borderColor: colors.borderDark }]}>
        <Text style={[styles.exampleLabel, { color: colors.grey }]}>Example:</Text>
        {/* The same badges a real rule wears, so the example teaches the
            shape as well as the idea. */}
        <AlertSentence
          parts={[
            { text: 'When' },
            { text: 'Porsche Boxster part', strong: true, tone: 'subject' },
            { text: 'is' },
            { text: 'listed for sale', strong: true, tone: 'action' },
            { text: 'under' },
            { text: '$2,000', strong: true, tone: 'price' },
          ]}
        />
      </View>

      <TouchableOpacity
        style={[styles.emptyBtn, { backgroundColor: brand }]}
        onPress={onAdd}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Plus size={16} color="#000000" strokeWidth={2.8} />
        <Text style={styles.emptyBtnText}>Create your first alert</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 100 },
  intro:   { fontSize: 13, lineHeight: 19, marginBottom: 12, paddingHorizontal: 2 },
  countBar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  // Green while there's room, brand-coloured at the cap — the state readable
  // before the words are.
  countDot:    { width: 7, height: 7, borderRadius: PILL_RADIUS },
  countStrong: { fontSize: 13, fontWeight: '800' },
  countText:   { fontSize: 12, fontWeight: '600', flexShrink: 1 },

  card: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 13, paddingTop: 12, paddingBottom: 10,
    marginBottom: 10, gap: 10,
  },
  /** Off, not gone: still legible, plainly not running. */
  cardOff: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardText: { flex: 1, minWidth: 0 },
  customName: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 4,
  },
  sentence: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  strong:   { fontWeight: '800' },

  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  channels:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  matches:  { fontSize: 11, fontWeight: '600', marginLeft: 2 },

  iconBtn: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  fab: {
    position: 'absolute', right: 18, bottom: 26,
    width: 52, height: 52, borderRadius: PILL_RADIUS,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },

  empty: { alignItems: 'center', paddingHorizontal: 12, paddingTop: 28 },
  emptyIcon: {
    width: 58, height: 58, borderRadius: PILL_RADIUS, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  emptyBody:  { fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 8 },

  example: {
    alignSelf: 'stretch', borderWidth: 1, borderRadius: 12,
    padding: 14, marginTop: 20, gap: 7,
  },
  exampleLabel: {
    fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  exampleNote: { fontSize: 12, lineHeight: 17 },

  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    alignSelf: 'stretch', marginTop: 20,
    paddingVertical: 14, borderRadius: COMMON_RADIUS,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '800', color: '#000000' },

  notice: {
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 20, paddingHorizontal: 16, alignItems: 'center',
  },
  noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  noticeBody:  { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 14 },
  retry:       { borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 18 },
  retryText:   { fontSize: 13, fontWeight: '700' },
});
