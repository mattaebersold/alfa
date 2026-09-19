import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert as RNAlert, Platform, Switch,
} from 'react-native';
import { Check, Mail, Smartphone } from 'lucide-react-native';
import SharedModal from '../../components/ui/SharedModal';
import { StepFormNav, StepFormProgress } from '../../components/ui/StepFormHeader';
import MakeModelFields from '../../components/cars/MakeModelFields';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import {
  useGetAlertsQuery, useGetAlertMetaQuery,
  useCreateAlertMutation, useUpdateAlertMutation,
  useGetUsageQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { handleize } from '../../utils/handleize';
import { ss } from '../../styles/shared';
import { PILL_RADIUS } from '../../constants/radius';
import {
  ALERT_EVENTS, ALERT_SECTIONS, alertAllowance, alertCapCopy, alertSentence,
  categoryOptionsFor, filtersFor, groupNameOf, kindOptionsFor,
  normalizeAlertMeta, vocabWord, type NormalizedAlertMeta,
} from '../../components/alerts/alertFormat';
import AlertSentence from '../../components/alerts/AlertSentence';
import type { AppScreenProps } from '../../navigation/types';
import type { AlertEvent, AlertFilterKey, AlertFilters, AlertInput } from '../../types/api';

/**
 * Three steps, named in the header: what to watch, what to narrow it to, and
 * how to be told.
 *
 * ## Why steps and not one scroll
 *
 * Which fields exist depends entirely on the first answer. A group discussion
 * alert has two filters; a marketplace one has eight, and they aren't the same
 * eight. On a single scroll that means either showing every field to everyone
 * — a form where most of it is inert, and nothing tells you which part is —
 * or reflowing the page under the member's finger every time they change the
 * event at the top of it. Neither is a form anyone finishes.
 *
 * So: pick the event, *then* be shown only what applies to it. Step 2 is
 * genuinely different per event, which is exactly what steps are for.
 *
 * The one thing that isn't stepped is the sentence. It sits under the progress
 * bar on every step and rewrites itself as fields change, because "what will
 * this actually send me" is the question the whole form exists to answer, and
 * it should never be more than a glance away.
 */

const STEP_TITLES = ['What to watch', 'Narrow it down', 'How to hear about it'];

interface AlertForm {
  event: AlertEvent | null;
  make: string;
  model: string;
  /** Post type today — the category list depends on it. */
  kind: string;
  category: string;
  condition_min: number | null;
  price_max: string;
  /** Three-way, because "anywhere" is a real answer and an empty field isn't. */
  locationMode: 'any' | 'region' | 'near';
  region: string;
  zip: string;
  radius: number;
  group_id: string;
  keyword: string;
  label: string;
  push: boolean;
  email: boolean;
}

const emptyForm = (radius: number): AlertForm => ({
  event: null,
  make: '', model: '', kind: '', category: '',
  condition_min: null, price_max: '',
  locationMode: 'any', region: '', zip: '', radius,
  group_id: '', keyword: '', label: '',
  // Push on by default and email off: the point of an alert is speed, and a
  // member who wants the inbox copy says so.
  push: true, email: false,
});

/** The route: the sheet, popping the screen once it has slid away. */
export default function AlertCreateScreen({ navigation, route }: AppScreenProps<'AlertCreate'>) {
  return (
    <AlertCreateSheet
      alertId={route.params?.alertId}
      onDismissed={() => navigation.goBack()}
    />
  );
}

export function AlertCreateSheet({ alertId, onDismissed }: {
  /** Edit this alert; omitted to create one. */
  alertId?: string;
  onDismissed: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const keyboardHeight = useKeyboardHeight();
  const me = useAppSelector((s) => s.auth.userInfo);
  const isEdit = !!alertId;

  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(1);

  const { data: rawMeta } = useGetAlertMetaQuery();
  const meta = useMemo(() => normalizeAlertMeta(rawMeta), [rawMeta]);

  const [form, setForm] = useState<AlertForm>(() => emptyForm(50));
  const set = <K extends keyof AlertForm>(key: K) => (value: AlertForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // The default radius only arrives with meta, and only matters before the
  // member has touched the slider — so it lands once and never again.
  const radiusDefaulted = useRef(false);
  useEffect(() => {
    if (radiusDefaulted.current || !rawMeta) return;
    radiusDefaulted.current = true;
    setForm((p) => (p.radius === 50 ? { ...p, radius: meta.default_radius_miles } : p));
  }, [rawMeta, meta.default_radius_miles]);

  const { data: list } = useGetAlertsQuery();
  const existing = useMemo(
    () => list?.entries.find((e) => e.internal_id === alertId),
    [list, alertId],
  );

  /**
   * The groups this rule may name — from meta, not from a separate query.
   *
   * `/api/alerts/meta` already returns every group flagged with `is_member`,
   * and the server refuses a rule naming one you're not in. So the picker
   * offers exactly what will be accepted, and there's no second request whose
   * answer could disagree with the one the form was built from.
   */
  const myGroups = meta.groups;

  const [createAlert, { isLoading: creating }] = useCreateAlertMutation();
  const [updateAlert, { isLoading: updating }] = useUpdateAlertMutation();
  const busy = creating || updating;

  /**
   * The cap, read from whichever endpoint answered — the list's own `counts`
   * first, then `/api/users/usage`. Asked for by Pro members too, because Pro
   * is capped here as well (20, not unlimited). An edit spends nothing and is
   * never gated.
   */
  const { data: usage } = useGetUsageQuery();
  const allowance = alertAllowance(list?.counts ?? usage?.alerts);
  const overLimit = !isEdit && !!allowance?.reached;

  const [upsell, setUpsell] = useState<{ title: string; message: string; sellPro: boolean } | null>(
    overLimit ? alertCapCopy(!!allowance?.isPro) : null,
  );

  /**
   * At the cap before a field is filled: the form opens onto the pitch rather
   * than three steps the server will refuse at the end of. Also catches a
   * count that lands late behind an open sheet.
   */
  useEffect(() => {
    if (overLimit) setUpsell(alertCapCopy(!!allowance?.isPro));
  }, [overLimit, allowance?.isPro]);

  // Fill from the alert being edited, once, guarded on the id so a refetch
  // behind the sheet can't overwrite what's being typed into it.
  const filled = useRef<string | null>(null);
  useEffect(() => {
    if (!existing || filled.current === existing.internal_id) return;
    filled.current = existing.internal_id;
    const f = existing.filters ?? {};
    setForm({
      event: existing.event,
      make:  f.make  ?? '',
      model: f.model ?? '',
      kind: f.kind ?? '',
      category: f.category ?? '',
      condition_min: typeof f.condition_min === 'number' ? f.condition_min : null,
      price_max: f.price_max != null ? String(f.price_max) : '',
      locationMode: f.near?.zip ? 'near' : f.region ? 'region' : 'any',
      region: f.region ?? '',
      zip: f.near?.zip ?? '',
      radius: f.near?.radius_miles ?? meta.default_radius_miles,
      group_id: f.group_id ?? '',
      keyword: f.keyword ?? '',
      label: existing.label ?? '',
      push:  existing.channels?.push !== false,
      email: !!existing.channels?.email,
    });
  }, [existing, meta.default_radius_miles]);

  const event = form.event;
  const applies = useMemo(
    () => (event ? filtersFor(event, meta) : new Set<AlertFilterKey>()),
    [event, meta],
  );
  const has = (k: AlertFilterKey) => applies.has(k);
  const kinds = event ? kindOptionsFor(event, meta) : null;
  // Post categories are keyed by post type, so this list changes when `kind`
  // does — and is empty until one is picked.
  const categories = event ? categoryOptionsFor(event, meta, form.kind) : null;

  /**
   * Which events the server offers, in the builder's four sections. Sections
   * with nothing in them aren't drawn — a heading over no chips reads as a
   * broken screen.
   */
  const sections = useMemo(() => {
    return ALERT_SECTIONS
      .map((s) => ({ ...s, events: meta.events.filter((e) => e.section === s.key) }))
      .filter((s) => s.events.length > 0);
  }, [meta.events]);

  // ── The sentence, live ────────────────────────────────────────────────────
  const preview = useMemo(() => {
    if (!event) return null;
    const groupTitle = groupNameOf(meta, form.group_id);
    return alertSentence({ event, filters: formFilters(form, applies) }, meta, groupTitle);
  }, [event, form, applies, meta, myGroups]);

  // ── Validation ────────────────────────────────────────────────────────────
  const canAdvance = () => {
    if (step === 1) return !!event;
    // Step 2 asks for nothing: an unfiltered alert is "tell me about all of
    // them", which is legal and sometimes exactly right for a small group.
    return true;
  };
  // Nowhere to send it is the one combination that would silently do nothing.
  const canSubmit = !!event && (form.push || form.email);

  const handleSubmit = async () => {
    if (!event) return;
    if (overLimit) { setUpsell(alertCapCopy(!!allowance?.isPro)); return; }
    if (!form.push && !form.email) {
      RNAlert.alert('Pick a channel', 'Choose push, email, or both — otherwise this alert has nowhere to go.');
      return;
    }
    /**
     * A model with no make is a 400 from the server, and rightly: "911" alone
     * names a Porsche and several other marques' 500s and GTs. Caught here so
     * the answer arrives before the round trip.
     */
    if (has('model') && form.model.trim() && !form.make.trim()) {
      RNAlert.alert(
        'Pick a make first',
        "A model on its own doesn't identify a car — choose the make above.",
      );
      return;
    }

    const body: AlertInput = {
      event,
      label: form.label.trim() || undefined,
      filters: formFilters(form, applies),
      channels: { push: form.push, email: form.email },
    };

    try {
      const res = isEdit && alertId
        ? await updateAlert({ id: alertId, ...body }).unwrap()
        : await createAlert(body).unwrap();

      /**
       * The rule saved, but narrower than the sentence promised.
       *
       * The server does this on purpose for a zip it can't geocode — dropping
       * the distance filter beats refusing and losing everything else that was
       * set. But a rule quietly narrower than what the member just read is the
       * one failure this whole feature can't afford, so the sheet stays put
       * and says so; closing it is their acknowledgement.
       */
      if (res?.warnings?.length) {
        RNAlert.alert(
          isEdit ? 'Saved, with one change' : 'Alert created, with one change',
          `${res.warnings.join('\n\n')}\n\nEverything else was saved. You can edit it to try again.`,
          [{ text: 'Got it', onPress: () => setVisible(false) }],
        );
        return;
      }
      setVisible(false);
    } catch (err: any) {
      /**
       * Over the cap after all — the count went stale behind an open sheet, or
       * this build is talking to a server that counts differently. The server
       * words the basic and the Pro case differently, so its sentence wins.
       */
      if (err?.data?.code === 'alert_limit_reached') {
        const isProNow = err?.data?.usage?.isPro ?? !!allowance?.isPro;
        setUpsell(alertCapCopy(isProNow, err?.data?.error));
        return;
      }
      RNAlert.alert(
        isEdit ? "Couldn't save" : "Couldn't create that alert",
        err?.data?.error ?? 'Something went wrong. Please try again.',
      );
    }
  };

  const dismissUpsell = () => {
    setUpsell(null);
    // Out of alerts entirely: there's nothing behind the card worth filling
    // in, so dismissing it takes the sheet with it.
    if (overLimit) setVisible(false);
  };

  /**
   * A Pro member's refusal has no card, so it's an alert — raised here rather
   * than rendered, because there's no modal to render.
   */
  useEffect(() => {
    if (!upsell || upsell.sellPro) return;
    RNAlert.alert(upsell.title, upsell.message, [{ text: 'OK', onPress: dismissUpsell }]);
  }, [upsell]);

  return (
    <SharedModal
      visible={visible}
      onClose={() => setVisible(false)}
      onDismissed={onDismissed}
      titleContent={(
        <StepFormNav
          title={isEdit ? 'Edit Alert' : 'New Alert'}
          step={step}
          totalSteps={STEP_TITLES.length}
          onBack={() => setStep((s) => s - 1)}
          onNext={() => setStep((s) => s + 1)}
          canAdvance={canAdvance()}
          onSubmit={handleSubmit}
          submitLabel={isEdit ? 'Save' : 'Create'}
          submitAccessibilityLabel={isEdit ? 'Save alert' : 'Create alert'}
          canSubmit={canSubmit}
          submitting={busy}
        />
      )}
      fullHeight
    >
      <StepFormProgress step={step} total={STEP_TITLES.length} caption={STEP_TITLES[step - 1]} />

      {/* The sentence, on every step. Not a summary at the end: a member
          adding a price cap wants to see the cap appear in the sentence right
          then, which is also the moment they'd catch that they capped the
          wrong thing. */}
      {preview && (
        <View style={[styles.preview, { backgroundColor: colors.segment, borderColor: brand }]}>
          <Text style={[styles.previewLabel, { color: colors.grey }]}>You'll be told</Text>
          <AlertSentence parts={preview} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 24 + keyboardHeight + (Platform.OS === 'android' ? 40 : 20) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── STEP 1: the event ──────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            {sections.map((section) => (
              <View key={section.key}>
                <Label colors={colors}>{section.label}</Label>
                <View style={styles.eventList}>
                  {section.events.map((e) => {
                    const copy = ALERT_EVENTS[e.key];
                    const on = event === e.key;
                    return (
                      <TouchableOpacity
                        key={e.key}
                        style={[
                          styles.eventTile,
                          { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                          on && { borderColor: brand, backgroundColor: brand + '1F' },
                        ]}
                        onPress={() => pickEvent(e.key, form.event, setForm, meta)}
                        activeOpacity={0.85}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                      >
                        <View style={styles.eventText}>
                          {/* The label alone. A line of explanation under each
                              of twelve rows is a wall to read before picking
                              one, and the sentence above says what a choice
                              means the moment it's made. */}
                          <Text style={[styles.eventTitle, { color: colors.fg }]}>
                            {e.label ?? copy.label}
                          </Text>
                        </View>
                        <View style={[
                          styles.check,
                          { borderColor: on ? brand : colors.borderDark, backgroundColor: on ? brand : 'transparent' },
                        ]}>
                          {on && <Check size={13} color="#000000" strokeWidth={3.5} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── STEP 2: the filters this event takes ───────────────────────── */}
        {step === 2 && event && (
          <View>

            {(has('make') || has('model')) && (
              <>
                <Label colors={colors} first>Car</Label>
                {/* The garage form's own fields, so a make typed here is held
                    to the same reference list a car is — that list is what the
                    matching runs against, and free text wouldn't match it. */}
                <MakeModelFields
                  make={form.make}
                  model={form.model}
                  onMakeChange={set('make')}
                  onModelChange={set('model')}
                />
              </>
            )}

            {has('kind') && !!kinds?.options.length && (
              <>
                <Label colors={colors} first={!has('make')}>{kinds.label}</Label>
                <ChipRow
                  options={[{ key: '', label: 'Any' }, ...kinds.options.map((k) => ({
                    key: k, label: vocabWord(event, k),
                  }))]}
                  value={form.kind}
                  // Changing the type changes which categories exist, so the
                  // one picked under the old type goes with it — otherwise
                  // you'd save "a spot post about restoration", which is not a
                  // thing that can ever match.
                  onChange={(v) => setForm((p) => ({ ...p, kind: v, category: '' }))}
                  colors={colors}
                  brand={brand}
                />
              </>
            )}

            {has('category') && !!categories?.options.length && (
              <>
                <Label colors={colors}>{categories.label}</Label>
                <ChipRow
                  options={[{ key: '', label: 'Any' }, ...categories.options.map((c) => ({
                    key: c, label: vocabWord(event, c),
                  }))]}
                  value={form.category}
                  onChange={set('category')}
                  colors={colors}
                  brand={brand}
                />
              </>
            )}

            {/* Post categories only exist inside a type, so say so rather than
                leaving a gap where a picker plainly belongs. */}
            {has('category') && has('kind') && !form.kind && !!kinds?.options.length && (
              <Text style={[styles.hint, { color: colors.grey, marginTop: 10, marginBottom: 0 }]}>
                Pick a kind of post above to narrow it by category as well.
              </Text>
            )}

            {has('condition_min') && (
              <>
                <Label colors={colors}>Condition, at least</Label>
                <ChipRow
                  options={[
                    { key: '', label: 'Any' },
                    ...meta.listing_conditions.map((c, i) => ({ key: String(i), label: c })),
                  ]}
                  value={form.condition_min === null ? '' : String(form.condition_min)}
                  onChange={(v) => set('condition_min')(v === '' ? null : Number(v))}
                  colors={colors}
                  brand={brand}
                />
              </>
            )}

            {has('price_max') && (
              <>
                <Label colors={colors}>
                  {event === 'want_created' ? 'Only if their budget is at least' : 'Only under'}
                </Label>
                <TextInput
                  style={[ss.input, inputStyle(colors)]}
                  value={form.price_max}
                  onChangeText={(v) => set('price_max')(v.replace(/[^0-9]/g, ''))}
                  placeholder="No price limit"
                  placeholderTextColor={colors.grey}
                  keyboardType="number-pad"
                  maxLength={9}
                />
              </>
            )}

            {has('group_id') && (
              <>
                {/* Named for what it means on this event: on the three group
                    events it's which group; everywhere else `group_id` means
                    the thing was *shared into* that group. */}
                <Label colors={colors} first={!has('make') && !has('kind') && !has('category')}>
                  {ALERT_EVENTS[event].section === 'groups' ? 'Group' : 'Shared into a group'}
                </Label>
                {myGroups.length === 0 ? (
                  <Text style={[styles.hint, { color: colors.grey }]}>
                    You're not in any groups yet. Join one and this alert can
                    watch it.
                  </Text>
                ) : (
                  <ChipRow
                    options={[
                      { key: '', label: 'Any group' },
                      ...myGroups.map((g) => ({ key: g.internal_id, label: g.title })),
                    ]}
                    value={form.group_id}
                    onChange={set('group_id')}
                    colors={colors}
                    brand={brand}
                  />
                )}
              </>
            )}

            {(has('region') || has('near')) && (
              <>
                <Label colors={colors}>Where</Label>
                <ChipRow
                  options={[
                    { key: 'any', label: 'Anywhere' },
                    ...(has('region') ? [{ key: 'region', label: 'A region' }] : []),
                    ...(has('near')   ? [{ key: 'near',   label: 'Near a zip code' }] : []),
                  ]}
                  value={form.locationMode}
                  onChange={(v) => set('locationMode')(v as AlertForm['locationMode'])}
                  colors={colors}
                  brand={brand}
                />

                {form.locationMode === 'region' && (
                  <View style={styles.spaced}>
                    <ChipRow
                      options={meta.regions.map((r) => ({ key: r.key, label: r.label }))}
                      value={form.region}
                      onChange={set('region')}
                      colors={colors}
                      brand={brand}
                    />
                  </View>
                )}

                {form.locationMode === 'near' && (
                  <View style={styles.spaced}>
                    <TextInput
                      style={[ss.input, inputStyle(colors)]}
                      value={form.zip}
                      onChangeText={(v) => set('zip')(v.replace(/[^0-9-]/g, ''))}
                      placeholder="Zip code"
                      placeholderTextColor={colors.grey}
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                    <Text style={[styles.smallLabel, { color: colors.grey, marginTop: 12 }]}>
                      Within {form.radius} miles
                    </Text>
                    <ChipRow
                      options={radiusChoices(meta).map((r) => ({ key: String(r), label: `${r} mi` }))}
                      value={String(form.radius)}
                      onChange={(v) => set('radius')(Number(v))}
                      colors={colors}
                      brand={brand}
                    />
                  </View>
                )}
              </>
            )}

            {has('keyword') && (
              <>
                <Label colors={colors}>Keyword</Label>
                <Text style={[styles.hint, { color: colors.grey }]}>
                  One word or phrase that has to appear in the title or
                  description — "transaxle", "OEM", "hardtop".
                </Text>
                <TextInput
                  style={[ss.input, inputStyle(colors)]}
                  value={form.keyword}
                  onChangeText={set('keyword')}
                  placeholder="Anything"
                  placeholderTextColor={colors.grey}
                  autoCapitalize="none"
                  maxLength={60}
                />
              </>
            )}
          </View>
        )}

        {/* ── STEP 3: channels and a name ────────────────────────────────── */}
        {step === 3 && (
          <View>

            <ChannelRow
              label="Push notification"
              Icon={Smartphone}
              value={form.push}
              onChange={set('push')}
              colors={colors}
              brand={brand}
            />
            <ChannelRow
              label="Email"
              Icon={Mail}
              value={form.email}
              onChange={set('email')}
              colors={colors}
              brand={brand}
            />

            {!form.push && !form.email && (
              <Text style={[styles.warn, { color: colors.red }]}>
                Pick at least one — otherwise this alert only ever shows up in
                your notifications list.
              </Text>
            )}

            <Label colors={colors}>Name it</Label>
            <TextInput
              style={[ss.input, inputStyle(colors)]}
              value={form.label}
              onChangeText={set('label')}
              placeholder="911 parts hunt"
              placeholderTextColor={colors.grey}
              maxLength={60}
            />

            {/* The one thing the sentence can't say: you only get one of
                these. Said here rather than at the refusal. */}
            {allowance && !isEdit && (
              <Text style={[styles.hint, { color: colors.grey, marginTop: 18 }]}>
                Alert {allowance.used + 1} of {allowance.limit}.
              </Text>
            )}
            {allowance && isEdit && (
              <Text style={[styles.hint, { color: colors.grey, marginTop: 18 }]}>
                {allowance.used} of {allowance.limit} alerts used. Editing this
                one doesn't spend another.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Only a basic member is shown the gold card. A Pro member at twenty
          has nothing to buy, so their refusal is a plain alert — see
          `alertCapCopy`. */}
      <ProUpsellModal
        visible={!!upsell?.sellPro}
        onClose={dismissUpsell}
        title={upsell?.title ?? ''}
        message={upsell?.message ?? ''}
      />
    </SharedModal>
  );
}

// ── Picking an event ─────────────────────────────────────────────────────────

/**
 * Switching events drops the filters the new one can't use.
 *
 * Keeping them would leave a price cap on a group-discussion alert: invisible
 * on step 2, absent from the sentence, and quietly sent to the server anyway.
 * Anything both events share survives, so nudging between "listed" and
 * "wanted" doesn't cost you the make you just picked.
 */
function pickEvent(
  next: AlertEvent,
  current: AlertEvent | null,
  setForm: React.Dispatch<React.SetStateAction<AlertForm>>,
  meta: NormalizedAlertMeta,
) {
  setForm((prev) => {
    if (current === next) return prev;
    const keep = filtersFor(next, meta);
    return {
      ...prev,
      event: next,
      make:     keep.has('make')     ? prev.make     : '',
      model:    keep.has('model')    ? prev.model    : '',
      // A kind from another event's vocabulary means nothing here, same as a
      // category — `post_created` is the only event with one today anyway.
      kind:     '',
      // A category from another event's vocabulary is meaningless here even
      // when both events take a category at all.
      category: '',
      condition_min: keep.has('condition_min') ? prev.condition_min : null,
      price_max: keep.has('price_max') ? prev.price_max : '',
      locationMode: keep.has('region') || keep.has('near') ? prev.locationMode : 'any',
      region:   keep.has('region')   ? prev.region   : '',
      zip:      keep.has('near')     ? prev.zip      : '',
      group_id: keep.has('group_id') ? prev.group_id : '',
      keyword:  keep.has('keyword')  ? prev.keyword  : '',
    };
  });
}

// ── The form as the server wants it ──────────────────────────────────────────

/**
 * Only the filters this event takes, and only the ones that were filled in.
 *
 * Handles are sent alongside the display spellings rather than instead of
 * them: the server handleizes what it's given (helpers/utils.handleize), and
 * the names are what lets the list read a saved alert back as "Mercedes-Benz"
 * rather than a de-slugged guess.
 */
function formFilters(form: AlertForm, applies: Set<AlertFilterKey>): AlertFilters {
  const f: AlertFilters = {};
  const has = (k: AlertFilterKey) => applies.has(k);

  /**
   * The display spelling is what the server reads; it handleizes that itself
   * and stores both (controllers/alertController `cleanFilters`). The handle
   * is sent too because the server accepts one as a fallback, but it is
   * explicitly never trusted over the name — so this pair can't drift the rule
   * into a handle no content carries.
   */
  if (has('make') && form.make.trim()) {
    f.make = form.make.trim();
    f.make_handle = handleize(form.make);
  }
  if (has('model') && form.model.trim()) {
    f.model = form.model.trim();
    f.model_handle = handleize(form.model);
  }
  if (has('kind') && form.kind) f.kind = form.kind;
  if (has('category') && form.category) f.category = form.category;
  if (has('condition_min') && form.condition_min !== null) f.condition_min = form.condition_min;
  if (has('price_max') && form.price_max.trim()) {
    const n = Number(form.price_max);
    if (Number.isFinite(n) && n > 0) f.price_max = n;
  }
  if (has('group_id') && form.group_id) f.group_id = form.group_id;
  if (has('keyword') && form.keyword.trim()) f.keyword = form.keyword.trim();

  if (form.locationMode === 'region' && has('region') && form.region) {
    f.region = form.region;
  } else if (form.locationMode === 'near' && has('near') && form.zip.trim()) {
    f.near = { zip: form.zip.trim(), radius_miles: form.radius };
  }

  return f;
}

/** The radii offered, capped by whatever the server says it will honour. */
function radiusChoices(meta: NormalizedAlertMeta): number[] {
  return [25, 50, 100, 250, 500].filter((r) => r <= meta.max_radius_miles);
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function Label({ children, colors, first }: {
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
  first?: boolean;
}) {
  return (
    <Text style={[styles.label, { color: colors.grey }, first && styles.labelFirst]}>
      {children}
    </Text>
  );
}

const inputStyle = (colors: ReturnType<typeof useColors>) => ({
  borderColor: colors.inputBorder,
  color: colors.fg,
  backgroundColor: colors.card,
});

/** One choice from a wrapping row of pills. `''` is always "any". */
function ChipRow({ options, value, onChange, colors, brand }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
  brand: string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((opt) => {
        const on = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key || '_any'}
            style={[
              styles.chip,
              { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
              on && { borderColor: brand, backgroundColor: brand + '22' },
            ]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text
              style={[styles.chipText, { color: on ? brand : colors.grey }]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ChannelRow({ label, Icon, value, onChange, colors, brand }: {
  label: string;
  Icon: typeof Mail;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ReturnType<typeof useColors>;
  brand: string;
}) {
  return (
    <View style={[styles.channelRow, { borderColor: colors.borderDark }]}>
      <Icon size={17} color={value ? brand : colors.grey} />
      <View style={styles.channelText}>
        <Text style={[styles.channelLabel, { color: colors.fg }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.segment, true: brand }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  preview: {
    marginHorizontal: 16, marginBottom: 6,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 13, paddingVertical: 11, gap: 4,
  },
  previewLabel: {
    fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8,
  },

  label: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: 20, marginBottom: 8,
  },
  labelFirst: { marginTop: 0 },
  hint: { fontSize: 12.5, lineHeight: 18, marginBottom: 10, marginTop: -2 },
  smallLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  spaced: { marginTop: 10 },
  warn: { fontSize: 12.5, lineHeight: 18, marginTop: 10, fontWeight: '600' },

  eventList: { gap: 8 },
  eventTile: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 13, paddingVertical: 11,
  },
  eventText:  { flex: 1, minWidth: 0 },
  eventTitle: { fontSize: 15, fontWeight: '800' },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: PILL_RADIUS, borderWidth: 1, maxWidth: '100%',
  },
  chipText: { fontSize: 13, fontWeight: '700' },

  channelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 11, marginBottom: 9,
  },
  channelText:  { flex: 1, minWidth: 0 },
  channelLabel: { fontSize: 14.5, fontWeight: '700' },
  channelHint:  { fontSize: 12, lineHeight: 17, marginTop: 1 },
});
