import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert, Platform, Switch, ScrollView } from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { FormScrollView } from '@ors/kit';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Check, Tag, X, Plus } from 'lucide-react-native';
import SharedModal from '../../components/ui/SharedModal';
import { StepFormNav, StepFormProgress } from '../../components/ui/StepFormHeader';
import PhotoPickerField from '../../components/ui/PhotoPickerField';
import Segmented from '../../components/ui/Segmented';
import PostToSelector from '../../components/social/PostToSelector';
import MakeModelFields from '../../components/cars/MakeModelFields';
import GarageCarStrip from '../../components/social/GarageCarStrip';
import {
  useCreateListingMutation, useUpdateListingMutation,
  useGetListingQuery, useGetListingMetaQuery,
  useGetUserGarageQuery, useGetUserGroupsQuery, useGetUsageQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import {
  DIECAST_UPSELL,
  LISTING_LIMIT_UPSELL,
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_GRAY_22,
  COLOR_WHITE,
} from '../../constants/config';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import {
  categoryLabel, isDiecastCategory, isVehicleCategory, LISTING_CONDITIONS,
} from '../../components/marketplace/listingFormat';
import { ss } from '../../styles/shared';
import type { AppScreenProps } from '../../navigation/types';
import type { ListingKind, ListingPriceMode, ListingShipping } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts'

/**
 * The steps, named in the header rather than inside each one — the same
 * arrangement the garage's and the group's create forms use. The header itself
 * is ui/StepFormHeader, shared with both.
 */
const STEP_TITLES = [
  'What it is',
  'Details',
  'Car, location & who sees it',
];

const SHIPPING_CHOICES: { key: ListingShipping; label: string }[] = [
  { key: 'pickup', label: 'Pickup only' },
  { key: 'ship',   label: 'Will ship' },
  { key: 'both',   label: 'Either' },
];

const PRICE_MODES: { key: ListingPriceMode; label: string }[] = [
  { key: 'amount', label: 'Price' },
  { key: 'free',   label: 'Free' },
  { key: 'trade',  label: 'Trade' },
];

export interface PickedImage { uri: string; name: string; type: string }

interface ListingForm {
  kind: ListingKind;
  title: string;
  category: string;
  body: string;
  images: PickedImage[];

  /** 0-5, or null for "not stated" — a seller who doesn't know shouldn't guess. */
  condition: number | null;
  price_mode: ListingPriceMode;
  price: string;
  obo: boolean;
  willing_to_pay: string;
  shipping: ListingShipping;

  car_id: string;
  make: string;
  model: string;
  year: string;
  trim: string;
  color: string;
  vin: string;
  mileage: string;
  part_number: string;

  diecast_brand: string;
  diecast_rarity: string;
  in_packaging: boolean;
  is_limited_edition: boolean;
  estimated_value_low: string;
  estimated_value_high: string;

  /** Blank leaves the listing where the seller is — the server's default. */
  zip: string;

  isPublic: boolean;
  groupIds: string[];
}

const emptyForm = (kind: ListingKind, groupId?: string): ListingForm => ({
  kind,
  // Parts are most of what's listed, so a new listing starts there.
  title: '', category: 'part', body: '', images: [],
  condition: null, price_mode: 'amount', price: '', obo: false,
  willing_to_pay: '', shipping: 'pickup',
  car_id: '', make: '', model: '', year: '', trim: '', color: '', vin: '',
  mileage: '', part_number: '',
  diecast_brand: '', diecast_rarity: '', in_packaging: false,
  is_limited_edition: false, estimated_value_low: '', estimated_value_high: '',
  zip: '',
  // Started from inside a group, the group comes pre-picked — and public
  // stays on, so the listing is in both unless the seller says otherwise.
  isPublic: true, groupIds: groupId ? [groupId] : [],
});

/** The route: the sheet, popping the screen once it has slid away. */
export default function ListingCreateScreen({ navigation, route }: AppScreenProps<'ListingCreate'>) {
  return (
    <ListingCreateSheet
      listingId={route.params?.listingId}
      initialKind={route.params?.kind}
      initialGroupId={route.params?.groupId}
      onDismissed={() => navigation.goBack()}
    />
  );
}

/**
 * List something, or say what you're looking for.
 *
 * Five steps, because a listing asks for more than a form's worth of things and
 * a single scroll of twenty fields is how you get listings with a title and
 * nothing else. Each step is one decision: what kind of ad, what the thing is,
 * what it costs, which car and where it is, and who gets to see it.
 *
 * What's asked for follows the answers. A want ad has no condition — it has a
 * wish — so that step drops it; a diecast listing gains the fields only diecast
 * has; the car fields appear for the categories that are (or come off) a car.
 * The alternative is one form showing every field to everyone, which is the
 * form this replaces.
 */
export function ListingCreateSheet({ listingId, initialKind, initialGroupId, initialImages, onDismissed, inline = false, onNav }: {
  /** Edit this listing; omitted to create one. */
  listingId?: string;
  /** Which side of the marketplace the create button was on. */
  initialKind?: ListingKind;
  /**
   * The group this was started from — pre-picked on the last step, so the
   * plus inside a group's Market section posts to that group by default. An
   * edit ignores it: the listing's own groups are what the form loads.
   */
  initialGroupId?: string;
  /** Photos already taken — the create screen's, when it opens this from its listing tab. */
  initialImages?: PickedImage[];
  onDismissed: () => void;
  /**
   * Inside another form rather than a sheet of its own — the create pane's
   * Listing tab. No sheet, no scroller: the host scrolls, and the steps,
   * their progress and their Back / Next / Post sit in its flow. Closing
   * is the host's: `onDismissed` fires at once instead of after a slide.
   */
  inline?: boolean;
  /**
   * Inline, hand the Back / progress / Next row to the host to pin above
   * its scroller rather than drawing it in the flow. Called whenever the
   * row's state changes; the host renders what it's given.
   */
  onNav?: (nav: React.ReactNode) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const isPro = useIsPro();
  const me = useAppSelector((s) => s.auth.userInfo);
  const isEdit = !!listingId;

  const [visible, setVisible] = useState(true);
  /** Runs once the sheet is gone and the screen has popped. */
  const afterDismiss = useRef<(() => void) | null>(null);
  /** Done here: the sheet slides out and reports, or inline the host is told now. */
  const close = () => {
    if (!inline) { setVisible(false); return; }
    const done = afterDismiss.current;
    afterDismiss.current = null;
    onDismissed();
    done?.();
  };
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ListingForm>(() => ({
    ...emptyForm(initialKind ?? 'sale', listingId ? undefined : initialGroupId),
    images: (listingId ? [] : initialImages ?? []).slice(0, 10),
  }));

  const { data: meta } = useGetListingMetaQuery();
  const { data: existing } = useGetListingQuery(listingId ?? '', { skip: !listingId });
  const { data: garage } = useGetUserGarageQuery();
  const { data: rawGroups } = useGetUserGroupsQuery(me?.user_id ?? '', { skip: !me?.user_id });
  const [createListing, { isLoading: creating }] = useCreateListingMutation();
  const [updateListing, { isLoading: updating }] = useUpdateListingMutation();
  const busy = creating || updating;

  /**
   * What a basic membership has left this month — the same read the events
   * screen does before its add button. Pro has nothing to count and doesn't
   * ask; a server that doesn't report `listings` yet gates nothing.
   *
   * Editing an existing listing spends no allowance, so it's never gated.
   */
  const { data: usage } = useGetUsageQuery(undefined, { skip: isPro });
  const listingAllowance = !isPro && usage?.listings?.limit != null ? usage.listings : null;
  const overListingLimit = !isEdit && !!listingAllowance?.reached;

  /**
   * The upsell, over the form rather than instead of it: whichever button was
   * pressed, the answer is the same gold card, and closing it leaves the sheet
   * where it was. `null` while nothing is being sold.
   */
  const [upsell, setUpsell] = useState<{ title: string; message: string } | null>(
    overListingLimit ? LISTING_LIMIT_UPSELL : null,
  );

  /**
   * At the limit before a word is typed: the form opens onto the pitch instead
   * of five steps the server will refuse at the end. The count can also go
   * stale behind an open sheet, so this catches a `usage` that lands late.
   */
  useEffect(() => {
    if (overListingLimit) setUpsell(LISTING_LIMIT_UPSELL);
  }, [overListingLimit]);

  const myGroups = useMemo(
    () => (Array.isArray(rawGroups) ? rawGroups : (rawGroups as any)?.entries ?? []),
    [rawGroups],
  );
  const conditions = meta?.conditions ?? LISTING_CONDITIONS;
  // Parts first: the one most listings are, and the one a new form starts on.
  const rawCategories = meta?.categories ?? [];
  const categories = rawCategories.includes('part')
    ? ['part', ...rawCategories.filter((c) => c !== 'part')]
    : rawCategories;
  // A new form starts on Part — and stays on it if the list arrives after the
  // form did, or the form was opened before the default was set.
  useEffect(() => {
    if (!isEdit && !form.category && categories.includes('part')) set('category')('part');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, form.category, categories.join(',')]);
  // And on New: the top of the scale, where most of what's listed sits. Set
  // once the scale is known, since its index is the value.
  useEffect(() => {
    if (!isEdit && form.condition == null && conditions.length > 0) {
      const top = conditions.findIndex((c) => c.toLowerCase() === 'new');
      set('condition')(top >= 0 ? top : conditions.length - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, form.condition, conditions.join(',')]);

  const set = <K extends keyof ListingForm>(key: K) => (value: ListingForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Fill the form from the listing being edited, once. Guarded on the id so a
  // refetch behind the sheet can't overwrite what's being typed into it.
  const filled = useRef<string | null>(null);
  useEffect(() => {
    const entry = existing?.entry;
    if (!entry || filled.current === entry.internal_id) return;
    filled.current = entry.internal_id;
    setForm({
      kind: entry.kind ?? 'sale',
      title: entry.title ?? '',
      category: entry.category ?? '',
      body: entry.body ? stripHtml(entry.body) : '',
      images: [],
      condition: entry.condition ?? null,
      price_mode: entry.price_mode ?? 'amount',
      price: entry.price !== null && entry.price !== undefined ? String(entry.price) : '',
      obo: !!entry.obo,
      willing_to_pay: entry.willing_to_pay !== null && entry.willing_to_pay !== undefined
        ? String(entry.willing_to_pay) : '',
      shipping: entry.shipping ?? 'pickup',
      car_id: entry.car_id ?? '',
      make: entry.make ?? '',
      model: entry.model ?? '',
      year: entry.year ?? '',
      trim: entry.trim ?? '',
      color: entry.color ?? '',
      vin: entry.vin ?? '',
      mileage: entry.mileage ?? '',
      part_number: entry.part_number ?? '',
      diecast_brand: entry.diecast?.brand ?? '',
      diecast_rarity: entry.diecast?.rarity ?? '',
      in_packaging: !!entry.diecast?.in_packaging,
      is_limited_edition: !!entry.diecast?.is_limited_edition,
      estimated_value_low: entry.diecast?.estimated_value_low != null
        ? String(entry.diecast.estimated_value_low) : '',
      estimated_value_high: entry.diecast?.estimated_value_high != null
        ? String(entry.diecast.estimated_value_high) : '',
      zip: entry.zip ?? '',
      // No groups means public; groups plus also_public means both.
      isPublic: !(entry.group_ids?.length) || !!entry.also_public,
      groupIds: entry.group_ids ?? [],
    });
  }, [existing]);

  const pickImages = () => {
    Alert.alert('Add Photo', 'How would you like to add a photo?', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera access is required to take photos.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
          if (!result.canceled) addImages(await normalizePickedAssets(result.assets));
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85,
          });
          if (!result.canceled) addImages(await normalizePickedAssets(result.assets));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addImages = (picked: PickedImage[]) =>
    setForm((prev) => ({ ...prev, images: [...prev.images, ...picked].slice(0, 10) }));

  const removeImage = (uri: string) =>
    setForm((prev) => ({ ...prev, images: prev.images.filter((i) => i.uri !== uri) }));

  /**
   * Pick a car out of the garage, which fills the make and model from it.
   *
   * The same car tapped again un-picks it: the fields it filled stay, so a
   * listing that started from a car can be loosened into a generic one without
   * retyping what was right.
   */
  const chooseCar = (carId: string) => {
    if (form.car_id === carId) {
      setForm((prev) => ({ ...prev, car_id: '' }));
      return;
    }
    const car = garage?.entries?.find((c) => c.internal_id === carId);
    setForm((prev) => ({
      ...prev,
      car_id: carId,
      make: car?.make ?? prev.make,
      model: car?.model ?? prev.model,
      year: car?.year ?? prev.year,
      trim: car?.trim ?? prev.trim,
      color: car?.color ?? prev.color,
      vin: car?.vin ?? prev.vin,
      mileage: car?.mileage ?? prev.mileage,
    }));
  };

  const toggleGroup = (groupId: string) =>
    setForm((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((g) => g !== groupId)
        : [...prev.groupIds, groupId],
    }));

  /** What each step won't let you past without. */
  const canAdvance = (): boolean => {
    if (step === 1) return !!form.title.trim() && !!form.category;
    if (step === 2) {
      // A number is the whole point of a priced sale; free and trade have none,
      // and a want ad's budget is genuinely optional.
      if (form.kind === 'sale' && form.price_mode === 'amount') return !!form.price.trim();
      return true;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.category) {
      Alert.alert('Almost there', 'A title and a category are needed before this can be posted.');
      setStep(1);
      return;
    }

    // The two things the server will refuse, caught here so nobody watches a
    // gallery upload run before being told no. Diecast is asked first, the way
    // horacio asks it: it's Pro-only outright and spends no allowance, so a
    // quota message would be answering the wrong question.
    if (!isPro && isDiecastCategory(form.category)) { setUpsell(DIECAST_UPSELL); return; }
    if (overListingLimit) { setUpsell(LISTING_LIMIT_UPSELL); return; }

    const fd = new FormData();
    if (isEdit) fd.append('internal_id', listingId!);
    fd.append('kind', form.kind);
    fd.append('title', form.title.trim());
    fd.append('category', form.category);
    fd.append('body', form.body);
    fd.append('shipping', form.shipping);
    fd.append('price_mode', form.price_mode);
    fd.append('status', 'published');

    // Sale only — the server nulls a want ad's condition anyway, but sending
    // one would say the form believes otherwise.
    if (form.kind === 'sale' && form.condition !== null) {
      fd.append('condition', String(form.condition));
    }
    if (form.kind === 'sale' && form.price_mode === 'amount') {
      fd.append('price', form.price.replace(/[^0-9.]/g, ''));
      fd.append('obo', form.obo ? 'true' : 'false');
    }
    if (form.kind === 'want' && form.willing_to_pay.trim()) {
      fd.append('willing_to_pay', form.willing_to_pay.replace(/[^0-9.]/g, ''));
    }

    // Always sent, blank included: the server reads the car's own make and
    // model off it when there is one, and falls back to these when there isn't.
    fd.append('car_id', form.car_id);
    if (isVehicleCategory(form.category)) {
      fd.append('make', form.make);
      fd.append('model', form.model);
      fd.append('year', form.year);
      fd.append('trim', form.trim);
      fd.append('color', form.color);
      fd.append('vin', form.vin);
      fd.append('mileage', form.mileage);
      fd.append('part_number', form.part_number);
    }

    if (isDiecastCategory(form.category)) {
      fd.append('diecast_brand', form.diecast_brand);
      fd.append('diecast_rarity', form.diecast_rarity);
      fd.append('in_packaging', form.in_packaging ? 'true' : 'false');
      fd.append('is_limited_edition', form.is_limited_edition ? 'true' : 'false');
      if (form.estimated_value_low.trim()) fd.append('estimated_value_low', form.estimated_value_low);
      if (form.estimated_value_high.trim()) fd.append('estimated_value_high', form.estimated_value_high);
    }

    // Only when given: an edit that never touched the location shouldn't move
    // the listing to the seller's zip.
    if (form.zip.trim()) fd.append('zip', form.zip.trim());

    // Groups as a JSON array, the way multipart carries one. No groups means
    // public whatever the toggle says, so `also_public` is only meaningful
    // alongside them.
    fd.append('group_ids', JSON.stringify(form.groupIds));
    fd.append('also_public', form.groupIds.length ? (form.isPublic ? 'true' : 'false') : 'true');

    form.images.forEach((img) => fd.append('gallery', uploadFile(img.uri)));

    try {
      if (isEdit) await updateListing(fd).unwrap();
      else await createListing(fd).unwrap();
      // Queued rather than fired now: an alert over a sheet that's still
      // sliding out lands on top of it.
      afterDismiss.current = () => Alert.alert(
        isEdit ? 'Listing updated' : 'Listing posted',
        isEdit
          ? 'Your changes are live.'
          : form.kind === 'want'
            ? "Your want ad is up. You'll hear from anyone who has one."
            : "It's up. You'll hear from anyone interested.",
      );
      close();
    } catch (err: any) {
      /**
       * The refusals worth their own words. The checks above normally catch
       * both first — this is for a count that went stale while the form was
       * open, and for an older build of this screen talking to a newer server.
       *
       * `post_limit_reached` is here because listings were posts until very
       * recently, and a server mid-deploy can still answer with that code.
       */
      const code = err?.data?.code;
      if (code === 'listing_limit_reached' || code === 'post_limit_reached') {
        setUpsell({
          title: LISTING_LIMIT_UPSELL.title,
          message: err?.data?.error ?? LISTING_LIMIT_UPSELL.message,
        });
        return;
      }
      if (code === 'pro_required') {
        setUpsell({
          title: DIECAST_UPSELL.title,
          message: err?.data?.error ?? DIECAST_UPSELL.message,
        });
        return;
      }
      Alert.alert(
        isEdit ? "Couldn't save" : "Couldn't post",
        err?.data?.error ?? 'Something went wrong. Please try again.',
      );
    }
  };

  // The steps' container: the sheet's own scroller, or, inline, a plain view
  // in the host's. A variable element rather than a wrapper component, so
  // the fields inside keep their identity (and focus) across renders.
  const Body: React.ElementType = inline ? View : FormScrollView;
  const bodyProps = inline
    ? { style: styles.inlineBody }
    : {
        contentContainerStyle: [styles.scroll, { paddingBottom: 24 + (Platform.OS === 'android' ? 40 : 20) }],
        showsVerticalScrollIndicator: false,
      };

  const existingPhotos = (existing?.entry.gallery ?? [])
    .map((g) => imageUrl(g.filename))
    .filter((u): u is string => !!u);

  // The submit handler, by ref: a pinned nav built when the step changed
  // must still post the form as it is now, not as it was then.
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;
  const advance = canAdvance();
  const nav = (
    <StepFormNav
      // Inline there's no heading: the progress bar sits between the arrows,
      // level with them, and says where you are on its own.
      center={inline ? <StepFormProgress step={step} total={STEP_TITLES.length} style={styles.inlineTrack} /> : undefined}
      title={isEdit ? 'Edit Listing' : form.kind === 'want' ? 'New Want Ad' : 'New Listing'}
      step={step}
      totalSteps={STEP_TITLES.length}
      onBack={() => setStep((s) => s - 1)}
      onNext={() => setStep((s) => s + 1)}
      canAdvance={advance}
      onSubmit={() => submitRef.current()}
      submitLabel={isEdit ? 'Save' : 'Post'}
      submitAccessibilityLabel={isEdit ? 'Save changes' : 'Post listing'}
      submitting={busy}
    />
  );
  // Handed up when what it shows changes — not every render, which would
  // have the host re-rendering this, which hands it up again.
  const pinned = !!(inline && onNav);
  useEffect(() => {
    if (pinned) onNav!(<View style={styles.inlineNav}>{nav}</View>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, step, advance, busy, isEdit, form.kind]);
  useEffect(() => () => { if (pinned) onNav!(null); }, [pinned]); // eslint-disable-line react-hooks/exhaustive-deps

  const frame = (
    <>
      {!inline && <StepFormProgress step={step} total={STEP_TITLES.length} caption={STEP_TITLES[step - 1]} />}

      <Body {...bodyProps}>
        {/* ── STEP 1: which side of the market ───────────────────────────── */}
        {/* ── STEP 1: which side of the market, and what it is ───────────── */}
        {step === 1 && (
          <View>
            {/* For sale or wanted: two tiles, half the row each. */}
            <View style={styles.kindGrid}>
              {([
                { key: 'sale' as const, title: 'For sale' },
                { key: 'want' as const, title: 'Want ad' },
              ]).map((opt) => {
                const on = form.kind === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.kindTile,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                      on && { borderColor: brand, backgroundColor: brand + '1F' },
                    ]}
                    onPress={() => set('kind')(opt.key)}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Tag size={16} color={on ? brand : colors.grey} />
                    <Text style={[styles.kindTitle, { color: on ? colors.fg : colors.muted }]} numberOfLines={1}>
                      {opt.title}
                    </Text>
                    <View style={[
                      styles.check,
                      { borderColor: on ? brand : colors.inputBorder },
                      on && { backgroundColor: brand },
                    ]}>
                      {on && <Check size={11} color={COLOR_BLACK} strokeWidth={3.5} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* The post form's type track: one of these, the thumb sliding
                to it. Diecast is Pro, and it's shown rather than hidden: a
                member who can't see the category doesn't know the app does
                it, and one who picks it is told why now — not at the end
                by a server refusal. */}
            <Label colors={colors}>Category</Label>
            <View style={styles.categoryTrack}>
              <Segmented
                options={categories.map((c) => ({
                  key: c,
                  label: isDiecastCategory(c) && !isPro ? `${categoryLabel(c)} · Pro` : categoryLabel(c),
                }))}
                value={form.category}
                onChange={(c) => (isDiecastCategory(c) && !isPro ? setUpsell(DIECAST_UPSELL) : set('category')(c))}
                fit="scroll"
              />
            </View>

            {/* Photos, as the post form has them: the well, then a row of
                thumbnails that scrolls. The photos already on the listing
                lead it — removing one of those is done from the listing. */}
            <Label colors={colors}>Photos</Label>
            {existingPhotos.length === 0 && form.images.length === 0 ? (
              <PhotoPickerField
                onPress={pickImages}
                title="Add Media"
                hint=""
                muted
                style={styles.photoField}
              />
            ) : (
              /* The previews, then an add tile the same size at the end —
                 the post form's row. The photos already on the listing lead
                 it; removing one of those is done from the listing. */
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} keyboardShouldPersistTaps="handled">
                {existingPhotos.map((uri) => (
                  <View key={uri} style={styles.thumbWrap}>
                    <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                  </View>
                ))}
                {form.images.map((img) => (
                  <View key={img.uri} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.thumbX}
                      onPress={() => removeImage(img.uri)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                    >
                      <X size={11} color={COLOR_WHITE} strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.thumb, styles.addTile, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                  onPress={pickImages}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Add media"
                >
                  <Plus size={20} color={colors.grey} strokeWidth={2.4} />
                  <Text style={[styles.addTileText, { color: colors.grey }]}>Add Media</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            <Label colors={colors}>Title</Label>
            <TextInput
              style={[ss.input, inputStyle(colors)]}
              value={form.title}
              onChangeText={set('title')}
              maxLength={120}
            />

            <Label colors={colors}>Description</Label>
            <TextInput
              style={[ss.input, ss.inputMulti, inputStyle(colors)]}
              value={form.body}
              onChangeText={set('body')}
              multiline
              numberOfLines={5}
            />
          </View>
        )}

        {/* ── STEP 2: what it costs, and what it is ──────────────────────── */}
        {step === 2 && (
          <View>
            {/* Sale only — a want ad has no condition, it has a wish. The
                server's scale, as the category's track: best first, since
                that's where most things listed sit. The value stays the
                scale's index. */}
            {form.kind === 'sale' && (
              <>
                <Label colors={colors} first>Condition</Label>
                <View style={styles.categoryTrack}>
                  <Segmented
                    options={conditions.map((label, i) => ({ key: String(i), label })).reverse()}
                    value={form.condition == null ? '' : String(form.condition)}
                    onChange={(k) => set('condition')(Number(k))}
                    fit="scroll"
                  />
                </View>
              </>
            )}

            {form.kind === 'sale' ? (
              <>
                <Label colors={colors} first={form.kind !== 'sale'}>Price</Label>
                <View style={styles.categoryTrack}>
                  <Segmented
                    options={PRICE_MODES.map((m) => ({ key: m.key, label: m.label }))}
                    value={form.price_mode}
                    onChange={set('price_mode')}
                  />
                </View>

                {/* Free and trade have no number attached — the server drops
                    one left in the form, so the form only asks for it when a
                    price is the choice. */}
                {form.price_mode === 'amount' && (
                  <TextInput
                    style={[ss.input, inputStyle(colors), styles.spaced]}
                    value={form.price}
                    onChangeText={set('price')}
                    placeholder="$"
                    placeholderTextColor={colors.grey}
                    keyboardType="numeric"
                  />
                )}
              </>
            ) : (
              <>
                <Label colors={colors} first>What you'll pay</Label>
                <Text style={[styles.hint, { color: colors.grey }]}>
                  Optional. A number here is what the card shows as "Will pay $400".
                </Text>
                <TextInput
                  style={[ss.input, inputStyle(colors)]}
                  value={form.willing_to_pay}
                  onChangeText={set('willing_to_pay')}
                  placeholder="$"
                  placeholderTextColor={colors.grey}
                  keyboardType="numeric"
                />
              </>
            )}

            <Label colors={colors}>Shipping</Label>
            <View style={styles.categoryTrack}>
              <Segmented
                options={SHIPPING_CHOICES.map((c) => ({ key: c.key, label: c.label }))}
                value={form.shipping}
                onChange={set('shipping')}
              />
            </View>

            {/* Only the categories that are — or come off — a car. */}
            {isVehicleCategory(form.category) && (
              <>
                <View style={styles.makeModel}>
                  <MakeModelFields
                    make={form.make}
                    model={form.model}
                    onMakeChange={set('make')}
                    onModelChange={set('model')}
                  />
                </View>
                <View style={styles.pairRow}>
                  <SmallField colors={colors} label="Year" value={form.year} onChange={set('year')} numeric />
                  <SmallField colors={colors} label="Trim" value={form.trim} onChange={set('trim')} />
                </View>
                <View style={styles.pairRow}>
                  <SmallField colors={colors} label="Color" value={form.color} onChange={set('color')} />
                  <SmallField colors={colors} label="Mileage" value={form.mileage} onChange={set('mileage')} numeric />
                </View>
                <View style={styles.pairRow}>
                  <SmallField colors={colors} label="VIN" value={form.vin} onChange={set('vin')} />
                  <SmallField colors={colors} label="Part number" value={form.part_number} onChange={set('part_number')} />
                </View>
              </>
            )}

            {/* Fields nothing else carries, so they only appear on the category
                that has them. */}
            {isDiecastCategory(form.category) && (
              <>
                <Label colors={colors}>Diecast</Label>
                <View style={styles.pairRow}>
                  <SmallField colors={colors} label="Brand" value={form.diecast_brand} onChange={set('diecast_brand')} />
                  <SmallField colors={colors} label="Rarity" value={form.diecast_rarity} onChange={set('diecast_rarity')} />
                </View>
                <View style={styles.pairRow}>
                  <SmallField colors={colors} label="Est. value low" value={form.estimated_value_low} onChange={set('estimated_value_low')} numeric />
                  <SmallField colors={colors} label="Est. value high" value={form.estimated_value_high} onChange={set('estimated_value_high')} numeric />
                </View>
                <ToggleRow colors={colors} brand={brand} label="Still in the packaging" value={form.in_packaging} onChange={set('in_packaging')} />
                <ToggleRow colors={colors} brand={brand} label="Limited edition" value={form.is_limited_edition} onChange={set('is_limited_edition')} />
              </>
            )}
          </View>
        )}

        {/* ── STEP 3: which car, where it is, and who sees it ────────────── */}
        {step === 3 && (
          <View>
            {/* The garage as the post form's tag strip: the cars by their
                photos, one pickable. Picking fills the make and model, and
                the listing links back to the car. */}
            {(garage?.entries?.length ?? 0) > 0 && (
              <>
                <Label colors={colors} first>Link a car from your garage</Label>
                <GarageCarStrip
                  selectedIds={form.car_id ? [form.car_id] : []}
                  onToggle={(tag) => chooseCar(tag.id)}
                  bleed={inline ? 12 : 16}
                />
              </>
            )}

            {/* Defaulted from your profile, so nobody retypes their zip for
                every part they list — which is how a marketplace ends up
                unable to answer "near me". */}
            <TextInput
              style={[ss.input, inputStyle(colors), styles.spaced]}
              value={form.zip}
              onChangeText={set('zip')}
              placeholder="Zip code"
              placeholderTextColor={colors.grey}
              keyboardType="number-pad"
              maxLength={10}
            />

            <View style={styles.spacedMore} />
            {/* Two across, all in view: the choice ends the form, so there's
                no line below for a scrolling row to save room for. */}
            <PostToSelector
              layout="grid"
              isPublic={form.isPublic}
              onTogglePublic={() => set('isPublic')(!form.isPublic)}
              groups={myGroups}
              selectedGroupIds={form.groupIds}
              onToggleGroup={toggleGroup}
            />
            {myGroups.length === 0 && (
              <Text style={[styles.hint, { color: colors.grey }]}>
                You're not a member of any groups yet.
              </Text>
            )}
          </View>
        )}
      </Body>

      {/*
        The pitch, over the form. Someone who's out of listings for the month
        never gets to the steps — the card is up before the first field, and
        dismissing it takes the sheet with it, because there's nothing behind
        it worth filling in. Someone who only tapped the diecast chip is put
        back where they were.
      */}
      <ProUpsellModal
        visible={!!upsell}
        onClose={() => {
          setUpsell(null);
          if (overListingLimit) close();
        }}
        title={upsell?.title ?? ''}
        message={upsell?.message ?? ''}
      />
    </>
  );

  if (inline) {
    return (
      <View style={styles.inlineWrap}>
        {!pinned && <View style={styles.inlineNav}>{nav}</View>}
        {frame}
      </View>
    );
  }
  return (
    <SharedModal
      visible={visible}
      onClose={() => setVisible(false)}
      onDismissed={() => {
        const done = afterDismiss.current;
        afterDismiss.current = null;
        onDismissed();
        done?.();
      }}
      titleContent={nav}
      fullHeight
    >
      {frame}
    </SharedModal>
  );
}

// ── Small pieces the steps share ─────────────────────────────────────────────
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

// The post form's fields: the input ground, not the card's.
const inputStyle = (colors: ReturnType<typeof useColors>) => ({
  borderColor: colors.inputBorder,
  color: colors.fg,
  backgroundColor: colors.inputBg,
});

function SmallField({ colors, label, value, onChange, numeric }: {
  colors: ReturnType<typeof useColors>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <View style={styles.pairHalf}>
      <Text style={[styles.smallLabel, { color: colors.grey }]}>{label}</Text>
      <TextInput
        style={[ss.input, inputStyle(colors)]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.grey}
        keyboardType={numeric ? 'numeric' : 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

function ToggleRow({ colors, brand, label, value, onChange }: {
  colors: ReturnType<typeof useColors>;
  brand: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: colors.fg }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.segment, true: brand }}
        thumbColor={COLOR_WHITE}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  // Inline: the host's inset, and the nav row's clearance above it.
  inlineWrap: { paddingTop: 4 },
  // The Back / Next / Post row, in from the screen's edge.
  inlineNav:  { paddingHorizontal: 12, paddingTop: 18, paddingBottom: 14 },
  // Between the arrows: no margins of its own, the row's gap instead.
  inlineTrack: { flex: 1, marginHorizontal: 14, marginTop: 0, marginBottom: 0 },
  inlineBody: { paddingHorizontal: 12, paddingBottom: 8 },

  // The post form's field captions: sentence case, a size up from the old
  // uppercase tag, in the muted ink.
  label: { fontSize: 12, fontFamily: FONT_INTER.semibold, marginTop: 14, marginBottom: 6 },
  labelFirst: { marginTop: 0 },
  hint: { fontSize: 12.5, lineHeight: 18, marginBottom: 10, marginTop: -2 },
  spaced: { marginTop: 10 },
  spacedMore: { height: 14 },

  // Two across, half each: the icon, the word, the check.
  kindGrid:  { flexDirection: 'row', gap: 10, marginTop: 4 },
  kindTile:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, height: 50 },
  kindTitle: { flex: 1, fontSize: 15, fontFamily: FONT_INTER.bold },
  categoryTrack: { marginHorizontal: -12 },
  // Room under the make/model pair before the year and trim.
  makeModel:     { marginBottom: 12 },
  // The post form's photo well and thumbnail row.
  photoField: { alignSelf: 'stretch', maxWidth: '100%', marginBottom: 6 },
  thumbRow:   { marginBottom: 4 },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS, borderWidth: 1, maxWidth: '100%',
  },
  chipText: { fontSize: 13, fontFamily: FONT_INTER.bold },
  /** The gold tag on a category a basic membership can't pick. */
  chipPro: { fontSize: 9, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.8 },

  thumbWrap: { marginRight: 8, position: 'relative' },
  addTile:     { borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  addTileText: { fontSize: 10, fontFamily: FONT_INTER.bold, textAlign: 'center' },
  thumb:     { width: 72, height: 72, borderRadius: 8, backgroundColor: COLOR_GRAY_22 },
  thumbX: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },

  pairRow:  { flexDirection: 'row', gap: 10 },
  pairHalf: { flex: 1, marginBottom: 10 },
  smallLabel: { fontSize: 12, fontFamily: FONT_INTER.bold, marginBottom: 5 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, gap: 12,
  },
  toggleLabel: { flex: 1, fontSize: 14, fontFamily: FONT_INTER.semibold },
});
