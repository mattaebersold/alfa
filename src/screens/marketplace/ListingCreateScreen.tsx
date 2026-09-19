import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, Platform, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Check, Tag, X } from 'lucide-react-native';
import SharedModal from '../../components/ui/SharedModal';
import { StepFormNav, StepFormProgress } from '../../components/ui/StepFormHeader';
import PhotoPickerField from '../../components/ui/PhotoPickerField';
import PostToSelector from '../../components/social/PostToSelector';
import MakeModelFields from '../../components/cars/MakeModelFields';
import {
  useCreateListingMutation, useUpdateListingMutation,
  useGetListingQuery, useGetListingMetaQuery,
  useGetUserGarageQuery, useGetUserGroupsQuery, useGetUsageQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import { DIECAST_UPSELL, LISTING_LIMIT_UPSELL } from '../../constants/limits';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import {
  categoryLabel, isDiecastCategory, isVehicleCategory, LISTING_CONDITIONS,
} from '../../components/marketplace/listingFormat';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';
import { ss } from '../../styles/shared';
import type { AppScreenProps } from '../../navigation/types';
import type { ListingKind, ListingPriceMode, ListingShipping } from '../../types/api';

/**
 * The steps, named in the header rather than inside each one — the same
 * arrangement the garage's and the group's create forms use. The header itself
 * is ui/StepFormHeader, shared with both.
 */
const STEP_TITLES = [
  'For sale or wanted',
  'What it is',
  'Details',
  'Car & location',
  'Where to post',
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

interface PickedImage { uri: string; name: string; type: string }

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
  title: '', category: '', body: '', images: [],
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
export function ListingCreateSheet({ listingId, initialKind, initialGroupId, onDismissed }: {
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
  onDismissed: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const isPro = useIsPro();
  const keyboardHeight = useKeyboardHeight();
  const me = useAppSelector((s) => s.auth.userInfo);
  const isEdit = !!listingId;

  const [visible, setVisible] = useState(true);
  /** Runs once the sheet is gone and the screen has popped. */
  const afterDismiss = useRef<(() => void) | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ListingForm>(
    () => emptyForm(initialKind ?? 'sale', listingId ? undefined : initialGroupId),
  );

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
  const categories = meta?.categories ?? [];

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
    if (step === 2) return !!form.title.trim() && !!form.category;
    if (step === 3) {
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
      setStep(2);
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
      setVisible(false);
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

  const existingPhotos = (existing?.entry.gallery ?? [])
    .map((g) => imageUrl(g.filename))
    .filter((u): u is string => !!u);

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
      titleContent={(
        <StepFormNav
          title={isEdit ? 'Edit Listing' : form.kind === 'want' ? 'New Want Ad' : 'New Listing'}
          step={step}
          totalSteps={STEP_TITLES.length}
          onBack={() => setStep((s) => s - 1)}
          onNext={() => setStep((s) => s + 1)}
          canAdvance={canAdvance()}
          onSubmit={handleSubmit}
          submitLabel={isEdit ? 'Save' : 'Post'}
          submitAccessibilityLabel={isEdit ? 'Save changes' : 'Post listing'}
          submitting={busy}
        />
      )}
      fullHeight
    >
      <StepFormProgress step={step} total={STEP_TITLES.length} caption={STEP_TITLES[step - 1]} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 24 + keyboardHeight + (Platform.OS === 'android' ? 40 : 20) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── STEP 1: which side of the market ───────────────────────────── */}
        {step === 1 && (
          <View style={styles.kindGrid}>
            {([
              {
                key: 'sale' as const,
                title: 'For sale',
                hint: 'You have something and want it gone — a car, a part, a box of trim clips.',
              },
              {
                key: 'want' as const,
                title: 'Want ad',
                hint: "You're looking for something. Say what, and what you'd pay for it.",
              },
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
                  <View style={styles.kindTileTop}>
                    <Tag size={18} color={on ? brand : colors.grey} />
                    <View style={[
                      styles.check,
                      { borderColor: on ? brand : colors.inputBorder },
                      on && { backgroundColor: brand },
                    ]}>
                      {on && <Check size={11} color="#000000" strokeWidth={3.5} />}
                    </View>
                  </View>
                  <Text style={[styles.kindTitle, { color: on ? colors.fg : colors.muted }]}>
                    {opt.title}
                  </Text>
                  <Text style={[styles.kindHint, { color: colors.grey }]}>{opt.hint}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── STEP 2: what it is ─────────────────────────────────────────── */}
        {step === 2 && (
          <View>
            <Label colors={colors} first>Title</Label>
            <TextInput
              style={[ss.input, inputStyle(colors)]}
              value={form.title}
              onChangeText={set('title')}
              placeholder={form.kind === 'want' ? 'e.g. 911 SC front bumper' : 'e.g. 1987 Porsche 911 Carrera'}
              placeholderTextColor={colors.grey}
              maxLength={120}
            />

            <Label colors={colors}>Category</Label>
            <View style={styles.chips}>
              {categories.map((c) => {
                const on = form.category === c;
                /**
                 * Diecast is Pro, and it's shown rather than hidden: a member
                 * who can't see the category doesn't know the app does it, and
                 * one who picks it should be told why now — not at the end of
                 * five steps by a server refusal.
                 */
                const proOnly = isDiecastCategory(c) && !isPro;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.card },
                      on && { backgroundColor: brand, borderColor: brand },
                      proOnly && { borderColor: colors.pro },
                    ]}
                    onPress={() => (proOnly ? setUpsell(DIECAST_UPSELL) : set('category')(c))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={proOnly ? `${categoryLabel(c)}, a Pro category` : undefined}
                  >
                    <Text style={[styles.chipText, { color: on ? '#000000' : colors.fg }]}>
                      {categoryLabel(c)}
                    </Text>
                    {proOnly && (
                      <Text style={[styles.chipPro, { color: colors.pro }]}>PRO</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Label colors={colors}>Photos</Label>
            {/* The photos already on the listing. New ones are added after
                them — removing one is done from the listing itself. */}
            {existingPhotos.length > 0 && (
              <View style={styles.thumbs}>
                {existingPhotos.map((uri) => (
                  <Image key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
                ))}
              </View>
            )}
            {form.images.length > 0 && (
              <View style={styles.thumbs}>
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
                      <X size={12} color="#FFFFFF" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <PhotoPickerField
              onPress={pickImages}
              compact={form.images.length > 0 || existingPhotos.length > 0}
              title={form.images.length > 0 || existingPhotos.length > 0 ? 'Add more photos' : 'Add Photos'}
            />

            <Label colors={colors}>Description</Label>
            <TextInput
              style={[ss.input, ss.inputMulti, inputStyle(colors)]}
              value={form.body}
              onChangeText={set('body')}
              placeholder={form.kind === 'want'
                ? 'What exactly are you after? Fitment, condition, colour…'
                : 'History, condition, what it fits, why you’re selling…'}
              placeholderTextColor={colors.grey}
              multiline
              numberOfLines={5}
            />
          </View>
        )}

        {/* ── STEP 3: what it costs, and what it is ──────────────────────── */}
        {step === 3 && (
          <View>
            {/* Sale only — a want ad has no condition, it has a wish. */}
            {form.kind === 'sale' && (
              <>
                <Label colors={colors} first>Condition</Label>
                <ConditionSlider
                  value={form.condition}
                  labels={conditions}
                  onChange={set('condition')}
                />
              </>
            )}

            {form.kind === 'sale' ? (
              <>
                <Label colors={colors} first={form.kind !== 'sale'}>Price</Label>
                <View style={styles.chips}>
                  {PRICE_MODES.map((m) => {
                    const on = form.price_mode === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        style={[
                          styles.chip,
                          { borderColor: colors.border, backgroundColor: colors.card },
                          on && { backgroundColor: brand, borderColor: brand },
                        ]}
                        onPress={() => set('price_mode')(m.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.chipText, { color: on ? '#000000' : colors.fg }]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Free and trade have no number attached — the server drops
                    one left in the form, so the form stops asking for it. */}
                {form.price_mode === 'amount' && (
                  <>
                    <TextInput
                      style={[ss.input, inputStyle(colors), styles.spaced]}
                      value={form.price}
                      onChangeText={set('price')}
                      placeholder="$"
                      placeholderTextColor={colors.grey}
                      keyboardType="numeric"
                    />
                    <ToggleRow
                      colors={colors}
                      brand={brand}
                      label="Open to offers (OBO)"
                      value={form.obo}
                      onChange={set('obo')}
                    />
                  </>
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
            <View style={styles.chips}>
              {SHIPPING_CHOICES.map((s) => {
                const on = form.shipping === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.card },
                      on && { backgroundColor: brand, borderColor: brand },
                    ]}
                    onPress={() => set('shipping')(s.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.chipText, { color: on ? '#000000' : colors.fg }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Only the categories that are — or come off — a car. */}
            {isVehicleCategory(form.category) && (
              <>
                <Label colors={colors}>The car</Label>
                <MakeModelFields
                  make={form.make}
                  model={form.model}
                  onMakeChange={set('make')}
                  onModelChange={set('model')}
                />
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

        {/* ── STEP 4: which car, and where it is ─────────────────────────── */}
        {step === 4 && (
          <View>
            <Label colors={colors} first>Link a car from your garage</Label>
            <Text style={[styles.hint, { color: colors.grey }]}>
              Optional. Picking one fills in the make and model, and the listing
              links back to the car so a buyer can see what it came off.
            </Text>
            {(garage?.entries?.length ?? 0) === 0 ? (
              <Text style={[styles.hint, { color: colors.grey }]}>Nothing in your garage yet.</Text>
            ) : (
              <View style={styles.chips}>
                {garage!.entries.map((car) => {
                  const on = form.car_id === car.internal_id;
                  return (
                    <TouchableOpacity
                      key={car.internal_id}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.card },
                        on && { backgroundColor: brand, borderColor: brand },
                      ]}
                      onPress={() => chooseCar(car.internal_id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, { color: on ? '#000000' : colors.fg }]} numberOfLines={1}>
                        {car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Label colors={colors}>Where it is</Label>
            {/* Defaulted from your profile, so nobody retypes their zip for
                every part they list — which is how a marketplace ends up
                unable to answer "near me". */}
            <Text style={[styles.hint, { color: colors.grey }]}>
              {me?.cityState
                ? `Left blank, this listing sits where you are — ${me.cityState}.`
                : 'Left blank, this listing sits wherever your profile says you are.'}
            </Text>
            <TextInput
              style={[ss.input, inputStyle(colors)]}
              value={form.zip}
              onChangeText={set('zip')}
              placeholder="Zip code (only if it's somewhere else)"
              placeholderTextColor={colors.grey}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        )}

        {/* ── STEP 5: who sees it ────────────────────────────────────────── */}
        {step === 5 && (
          <View>
            <Label colors={colors} first>Post to</Label>
            <Text style={[styles.hint, { color: colors.grey }]}>
              A listing in a group is for sale to that group. Pick both and it's
              in the public marketplace as well.
            </Text>
            <PostToSelector
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
      </ScrollView>

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
          if (overListingLimit) setVisible(false);
        }}
        title={upsell?.title ?? ''}
        message={upsell?.message ?? ''}
      />
    </SharedModal>
  );
}

// ── Condition ────────────────────────────────────────────────────────────────
/**
 * The 0-5 scale, as six stops on one track.
 *
 * A slider rather than six chips because condition is a scale and reads as one:
 * the stop you pick means "this good", and the ones either side mean more or
 * less of the same thing. Free text was what this replaced — "mint-ish", "good
 * for its age" — none of which a filter can do anything with.
 *
 * Not answering is a valid answer: a seller who doesn't know shouldn't be made
 * to guess, so the track starts unset and the label says so.
 */
function ConditionSlider({ value, labels, onChange }: {
  value: number | null;
  labels: string[];
  onChange: (next: number | null) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  return (
    <View style={cond.wrap}>
      <View style={cond.track}>
        {labels.map((label, i) => {
          const on = value !== null && i <= value;
          const exact = value === i;
          return (
            <TouchableOpacity
              key={label}
              style={cond.stopTap}
              // Tapping the stop you're on clears it — back to "not stated".
              onPress={() => onChange(exact ? null : i)}
              accessibilityRole="adjustable"
              accessibilityLabel={label}
              accessibilityState={{ selected: exact }}
            >
              {/* The bar behind the stops, drawn in segments so the filled part
                  stops where the choice does. */}
              <View style={[cond.bar, { backgroundColor: on ? brand : colors.segment }]} />
              <View style={[
                cond.stop,
                { backgroundColor: on ? brand : colors.segment, borderColor: exact ? colors.fg : 'transparent' },
                exact && cond.stopExact,
              ]} />
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[cond.label, { color: value === null ? colors.grey : colors.fg }]}>
        {value === null ? 'Not stated' : labels[value]}
      </Text>
    </View>
  );
}

const cond = StyleSheet.create({
  wrap:  { marginTop: 4, marginBottom: 4 },
  track: { flexDirection: 'row', alignItems: 'center', height: 34 },
  stopTap: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 34 },
  bar:   { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2 },
  stop:  { width: 14, height: 14, borderRadius: PILL_RADIUS, borderWidth: 2 },
  stopExact: { width: 20, height: 20 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 6 },
});

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

const inputStyle = (colors: ReturnType<typeof useColors>) => ({
  borderColor: colors.inputBorder,
  color: colors.fg,
  backgroundColor: colors.card,
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
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  label: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: 20, marginBottom: 8,
  },
  labelFirst: { marginTop: 0 },
  hint: { fontSize: 12.5, lineHeight: 18, marginBottom: 10, marginTop: -2 },
  spaced: { marginTop: 10 },

  kindGrid: { gap: 12 },
  kindTile: { borderRadius: 12, borderWidth: 1.5, padding: 14, gap: 8 },
  kindTileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindTitle: { fontSize: 16, fontWeight: '800' },
  kindHint:  { fontSize: 12.5, lineHeight: 18 },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS, borderWidth: 1, maxWidth: '100%',
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  /** The gold tag on a category a basic membership can't pick. */
  chipPro: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  thumbs:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  thumbWrap: { position: 'relative' },
  thumb:     { width: 74, height: 74, borderRadius: COMMON_RADIUS, backgroundColor: '#161616' },
  thumbX: {
    position: 'absolute', top: -5, right: -5,
    width: 20, height: 20, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },

  pairRow:  { flexDirection: 'row', gap: 10 },
  pairHalf: { flex: 1, marginBottom: 10 },
  smallLabel: { fontSize: 12, fontWeight: '700', marginBottom: 5 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, gap: 12,
  },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
});
