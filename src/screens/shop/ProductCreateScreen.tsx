import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Platform, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { X, Plus, Trash2 } from 'lucide-react-native';
import {
  useCreateProductMutation,
  useUpdateProductMutation,
  useGetAdminProductsQuery,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import { normalizePickedAssets, uploadFile } from '../../utils/upload';
import { imageUrl } from '../../utils/image';
import PhotoPickerField from '../../components/ui/PhotoPickerField';
import EmptyState from '../../components/ui/EmptyState';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS } from '../../constants/radius';

/** A variant as it's being typed. Everything is text until submit. */
interface DraftVariant {
  label: string;
  price: string;
  quantity: string;
}

/**
 * Add or edit a product in the merch shop. Admin-only, on both ends: the
 * button that opens it is gated on `accountType`, and horacio's `adminOnly`
 * middleware rejects the write regardless of what the app decides to show.
 *
 * Prices are whole dollars, not cents — that's how the model stores them, so
 * the Venmo and PayPal links can put the amount straight into a URL.
 *
 * The purchase itself still happens on the web. This only creates the listing.
 */
export default function ProductCreateScreen() {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const editingId: string | undefined = route.params?.productId;

  const { userInfo } = useAppSelector((s) => s.auth);
  const isAdmin = userInfo?.accountType === 'admin';

  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  // The admin listing is already in the cache behind the button that got here,
  // so editing reads the product out of it rather than fetching it again.
  const { data: adminData } = useGetAdminProductsQuery(undefined, { skip: !editingId || !isAdmin });
  const existing = adminData?.entries.find((p) => p.internal_id === editingId);
  const isLoading = creating || updating;

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [trackQuantity, setTrackQuantity] = useState(true);
  const [category, setCategory] = useState('');
  const [shippingNote, setShippingNote] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [featured, setFeatured] = useState(false);
  const [variants, setVariants] = useState<DraftVariant[]>([]);
  /** Newly picked photos, local uris. Existing gallery images are shown separately. */
  const [photos, setPhotos] = useState<{ uri: string; name: string; type: string }[]>([]);

  // Prefill when editing.
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title ?? '');
    setSubtitle(existing.subtitle ?? '');
    setBody(existing.body ?? '');
    setPrice(existing.price != null ? String(existing.price) : '');
    setQuantity(String(existing.quantity ?? 0));
    setTrackQuantity(existing.track_quantity !== false);
    setCategory(existing.category ?? '');
    setShippingNote(existing.shipping_note ?? '');
    setStatus(existing.status === 'published' ? 'published' : 'draft');
    setFeatured(!!existing.featured);
    setVariants((existing.variants ?? []).map((v) => ({
      label: v.label ?? '',
      price: v.price != null ? String(v.price) : '',
      quantity: String(v.quantity ?? 0),
    })));
  }, [existing]);

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    const picked = await normalizePickedAssets(result.assets);
    setPhotos((prev) => [...prev, ...picked]);
  };

  const setVariantField = (index: number, field: keyof DraftVariant, value: string) =>
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));

  const handleSubmit = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Give the product a title.');
    const parsedPrice = Number(price);
    if (!price.trim() || !Number.isFinite(parsedPrice)) {
      return Alert.alert('Required', 'Give the product a price, in dollars.');
    }
    // A variant with no label is dropped server-side, so catch it here where
    // it can still be fixed rather than letting a row vanish on save.
    if (variants.some((v) => !v.label.trim())) {
      return Alert.alert('Unnamed option', 'Every option needs a label — "Large", "Black / XL".');
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    if (subtitle.trim()) fd.append('subtitle', subtitle.trim());
    if (body.trim()) fd.append('body', body.trim());
    fd.append('price', String(parsedPrice));
    fd.append('quantity', String(Number(quantity) || 0));
    fd.append('track_quantity', String(trackQuantity));
    if (category.trim()) fd.append('category', category.trim());
    if (shippingNote.trim()) fd.append('shipping_note', shippingNote.trim());
    fd.append('status', status);
    fd.append('featured', String(featured));
    // Sent even when empty on create, so a product that had options and lost
    // them all actually loses them — the server leaves variants alone only
    // when the field is absent entirely.
    if (variants.length || editingId) {
      fd.append('variants', JSON.stringify(variants.map((v) => ({
        label: v.label.trim(),
        price: v.price.trim() === '' ? null : Number(v.price),
        quantity: Number(v.quantity) || 0,
      }))));
    }
    photos.forEach((p) => fd.append('gallery', uploadFile(p.uri) as any));
    if (editingId) fd.append('internal_id', editingId);

    try {
      if (editingId) await updateProduct(fd).unwrap();
      else await createProduct(fd).unwrap();
      nav.goBack();
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.data?.error ?? `Could not ${editingId ? 'save' : 'create'} this product. Please try again.`,
      );
    }
  };

  // The server is the real gate; this is so a non-admin who reaches the route
  // by some other path gets an explanation rather than a 403 on submit.
  if (!isAdmin) {
    return (
      <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
        <EmptyState title="Admins only" message="Only society admins can add products to the shop." />
      </SafeAreaView>
    );
  }

  const inputStyle = [
    styles.input,
    { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card },
  ];

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.fieldLabel, { color: colors.grey }]}>Title *</Text>
        <TextInput
          style={inputStyle}
          value={title}
          onChangeText={setTitle}
          placeholder="ORS Rally Tee"
          placeholderTextColor={colors.grey}
        />

        <Text style={[styles.fieldLabel, { color: colors.grey }]}>Subtitle</Text>
        <TextInput
          style={inputStyle}
          value={subtitle}
          onChangeText={setSubtitle}
          placeholder="Heavyweight cotton, screen printed"
          placeholderTextColor={colors.grey}
        />

        <Text style={[styles.fieldLabel, { color: colors.grey }]}>Description</Text>
        <TextInput
          style={[...inputStyle, styles.multiline]}
          value={body}
          onChangeText={setBody}
          placeholder="What it is, how it fits, what it's printed on..."
          placeholderTextColor={colors.grey}
          multiline
        />

        {/* ── Price and stock ──────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.fg }]}>Price & Stock</Text>

        <View style={styles.row}>
          <View style={ss.fill}>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>Price (USD) *</Text>
            <TextInput
              style={inputStyle}
              value={price}
              onChangeText={setPrice}
              placeholder="35"
              placeholderTextColor={colors.grey}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={ss.fill}>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>Quantity</Text>
            <TextInput
              style={[...inputStyle, !trackQuantity && { opacity: 0.5 }]}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="0"
              placeholderTextColor={colors.grey}
              keyboardType="number-pad"
              editable={trackQuantity}
            />
          </View>
        </View>

        <ToggleRow
          label="Track stock"
          hint="Off for made-to-order — the shop never marks it sold out."
          value={trackQuantity}
          onChange={setTrackQuantity}
        />

        <Text style={[styles.fieldLabel, { color: colors.grey }]}>Category</Text>
        <TextInput
          style={inputStyle}
          value={category}
          onChangeText={setCategory}
          placeholder="apparel"
          placeholderTextColor={colors.grey}
          autoCapitalize="none"
        />

        <Text style={[styles.fieldLabel, { color: colors.grey }]}>Shipping note</Text>
        <TextInput
          style={inputStyle}
          value={shippingNote}
          onChangeText={setShippingNote}
          placeholder="Ships in 3–5 days, US only"
          placeholderTextColor={colors.grey}
        />

        {/* ── Options ──────────────────────────────────────────────────────── */}
        {/* Sizes and colourways. A product with none is the normal case: its
            own price and stock count are what sell. Once there's one option,
            each carries its own count, and a blank price falls back to the
            product's. */}
        <Text style={[styles.sectionTitle, { color: colors.fg }]}>Options</Text>
        <Text style={[styles.sectionHint, { color: colors.grey }]}>
          Sizes or colourways. Leave empty if there's only one of this thing.
        </Text>

        {variants.map((variant, i) => (
          <View key={i} style={[styles.variantCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.variantHead}>
              <Text style={[styles.variantLabel, { color: colors.grey }]}>OPTION {i + 1}</Text>
              <TouchableOpacity
                onPress={() => setVariants((prev) => prev.filter((_, index) => index !== i))}
                hitSlop={8}
                accessibilityLabel={`Remove option ${i + 1}`}
              >
                <Trash2 size={16} color={colors.grey} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={inputStyle}
              value={variant.label}
              onChangeText={(v) => setVariantField(i, 'label', v)}
              placeholder="Large"
              placeholderTextColor={colors.grey}
            />
            <View style={styles.row}>
              <TextInput
                style={[...inputStyle, ss.fill]}
                value={variant.price}
                onChangeText={(v) => setVariantField(i, 'price', v)}
                placeholder="Price (optional)"
                placeholderTextColor={colors.grey}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[...inputStyle, ss.fill]}
                value={variant.quantity}
                onChangeText={(v) => setVariantField(i, 'quantity', v)}
                placeholder="Qty"
                placeholderTextColor={colors.grey}
                keyboardType="number-pad"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addVariant, { borderColor: brand }]}
          onPress={() => setVariants((prev) => [...prev, { label: '', price: '', quantity: '0' }])}
          activeOpacity={0.8}
        >
          <Plus size={16} color={brand} />
          <Text style={[styles.addVariantText, { color: brand }]}>Add an option</Text>
        </TouchableOpacity>

        {/* ── Photos ───────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.fg }]}>Photos</Text>

        {/* Already uploaded, when editing. Shown so it's clear what's there
            already; new picks are appended rather than replacing them. */}
        {(existing?.gallery?.length ?? 0) > 0 && (
          <View style={styles.photoWrap}>
            {existing!.gallery!.map((g, i) => (
              <Image
                key={g.internal_id ?? g.filename ?? String(i)}
                source={{ uri: imageUrl(g.filename) ?? undefined }}
                style={[styles.photo, { backgroundColor: colors.segment }]}
                contentFit="cover"
              />
            ))}
          </View>
        )}

        {photos.length > 0 && (
          <View style={styles.photoWrap}>
            {photos.map((p, i) => (
              <View key={p.uri} style={styles.photoItem}>
                <Image source={{ uri: p.uri }} style={styles.photo} contentFit="cover" />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotos((prev) => prev.filter((_, index) => index !== i))}
                  hitSlop={6}
                  accessibilityLabel="Remove photo"
                >
                  <X size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <PhotoPickerField
          onPress={pickPhotos}
          title={photos.length ? 'Add More Photos' : 'Add Photos'}
          hint="The first one is the card image in the shop"
          compact={photos.length > 0}
        />

        {/* ── Publishing ───────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.fg }]}>Publishing</Text>

        <ToggleRow
          label="Published"
          hint="A draft is only visible to admins."
          value={status === 'published'}
          onChange={(v) => setStatus(v ? 'published' : 'draft')}
        />
        <ToggleRow
          label="Featured"
          hint="Pinned to the top of the shop."
          value={featured}
          onChange={setFeatured}
        />

        <TouchableOpacity
          style={[styles.submit, { backgroundColor: brand, opacity: isLoading ? 0.6 : 1 }]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading
            ? <ActivityIndicator size="small" color="#000000" />
            : <Text style={styles.submitText}>{editingId ? 'Save Changes' : 'Add Product'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A labelled switch with a line of explanation under it. */
function ToggleRow({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const colors = useColors();
  const brand = useBrandColor();
  return (
    <View style={[styles.toggleRow, { borderColor: colors.border }]}>
      <View style={ss.fill}>
        <Text style={[styles.toggleLabel, { color: colors.fg }]}>{label}</Text>
        {hint ? <Text style={[styles.toggleHint, { color: colors.grey }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: brand }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },

  sectionTitle: { fontSize: 19, fontWeight: '800', marginTop: 28 },
  sectionHint:  { fontSize: 13, lineHeight: 18, marginTop: 4 },

  variantCard: {
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    padding: 12, marginTop: 12, gap: 10,
  },
  variantHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  variantLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  addVariant: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: COMMON_RADIUS, borderWidth: 1, borderStyle: 'dashed', marginTop: 12,
  },
  addVariantText: { fontSize: 14, fontWeight: '700' },

  photoWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 4 },
  photoItem: { position: 'relative' },
  photo:     { width: 84, height: 84, borderRadius: 10 },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700' },
  toggleHint:  { fontSize: 12.5, lineHeight: 17, marginTop: 2 },

  submit: {
    height: 52, borderRadius: COMMON_RADIUS, marginTop: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#000000' },
});
