import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, ImagePlus, Check, Sparkles } from 'lucide-react-native';
import { useAnalyzeDiecastMutation, useCreatePostMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import {
  DIECAST_BRANDS, DIECAST_CONDITIONS, DIECAST_RARITIES, DIECAST_BLUE, DIECAST_BLUE_DARK,
} from '../../constants/diecast';
import type { AppStackParamList } from '../../navigation/types';
import type { DiecastAnalysis } from '../../types/api';
import { uploadFile } from '../../utils/upload';
import { ss } from '../../styles/shared';

type AppNav = NativeStackNavigationProp<AppStackParamList>;
type Photo = { uri: string; name: string; type: string };
type Step = 'photo' | 'analyzing' | 'confirm';

interface DiecastForm {
  title: string;
  body: string;
  price: string;
  brand: string;
  rarity: string;
  make: string;
  model: string;
  series: string;
  year: string;
  condition: string;
  in_packaging: boolean;
  is_limited_edition: boolean;
}

function suggestedPrice(r: DiecastAnalysis): string {
  if (r.ebayAvgPrice != null) return String(Math.round(r.ebayAvgPrice));
  if (r.estimatedValueHigh != null) return String(Math.ceil(r.estimatedValueHigh * 0.9));
  return '';
}

// ── Chip selector ────────────────────────────────────────────────────────────

function ChipSelect({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.grey }]}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, { borderColor: active ? DIECAST_BLUE : colors.border }, active && { backgroundColor: DIECAST_BLUE }]}
              onPress={() => onChange(active ? '' : opt)}
            >
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.fg }]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function CheckRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, { borderColor: DIECAST_BLUE }, value && { backgroundColor: DIECAST_BLUE }]}>
        {value && <Check size={12} color="#FFF" />}
      </View>
      <Text style={[styles.checkLabel, { color: colors.fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function DiecastCreateScreen() {
  const appNav = useNavigation<AppNav>();
  const colors = useColors();

  const [step, setStep] = useState<Step>('photo');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [result, setResult] = useState<DiecastAnalysis | null>(null);
  const [form, setForm] = useState<DiecastForm>({
    title: '', body: '', price: '', brand: '', rarity: '', make: '', model: '',
    series: '', year: '', condition: '', in_packaging: false, is_limited_edition: false,
  });

  const [analyzeDiecast, { isLoading: analyzing }] = useAnalyzeDiecastMutation();
  const [createPost, { isLoading: publishing }] = useCreatePostMutation();

  const setField = <K extends keyof DiecastForm>(key: K, val: DiecastForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const pickFrom = useCallback(async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Camera access needed', 'Please allow camera access in Settings.'); return; }
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPhoto({ uri: a.uri, name: a.fileName ?? `diecast_${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' });
    }
  }, []);

  const pickImage = useCallback(() => {
    Alert.alert('Add Photo', 'Snap or choose a photo of your diecast to analyze.', [
      { text: 'Take Photo', onPress: () => pickFrom('camera') },
      { text: 'Choose from Library', onPress: () => pickFrom('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickFrom]);

  const handleAnalyze = useCallback(async () => {
    if (!photo) return;
    setStep('analyzing');
    const fd = new FormData();
    fd.append('photo', uploadFile(photo.uri));
    try {
      const { result: r } = await analyzeDiecast(fd).unwrap();
      setResult(r);
      setForm({
        title: r.suggestedTitle ?? '',
        body: r.suggestedDescription ?? '',
        price: suggestedPrice(r),
        brand: r.brand ?? '',
        rarity: r.rarity ?? '',
        make: r.make ?? '',
        model: r.model ?? '',
        series: r.series ?? '',
        year: r.year != null ? String(r.year) : '',
        condition: r.condition ?? '',
        in_packaging: r.in_packaging ?? false,
        is_limited_edition: r.is_limited_edition ?? false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('confirm');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err?.status === 422) {
        Alert.alert('Not a diecast', err?.data?.error ?? "This doesn't appear to be a die-cast model car. Try another photo.");
      } else {
        Alert.alert('Analysis failed', 'Could not analyze the photo. Please try again.');
      }
      setStep('photo');
    }
  }, [photo, analyzeDiecast]);

  const handlePublish = useCallback(async () => {
    if (!form.title.trim() || !form.price.trim()) {
      Alert.alert('Required', 'A title and price are required to publish.');
      return;
    }
    const fd = new FormData();
    fd.append('type', 'listing');
    fd.append('category', 'diecast');
    fd.append('status', 'published');
    fd.append('title', form.title.trim());
    if (form.body.trim())      fd.append('body', form.body.trim());
    fd.append('price', form.price.trim());
    if (form.condition)        fd.append('condition', form.condition);
    if (form.brand)            fd.append('diecast_brand', form.brand);
    if (form.rarity)           fd.append('diecast_rarity', form.rarity);
    if (form.make.trim())      fd.append('make', form.make.trim());
    if (form.model.trim())     fd.append('model', form.model.trim());
    if (form.year.trim())      fd.append('year', form.year.trim());
    fd.append('in_packaging', form.in_packaging ? 'true' : 'false');
    fd.append('is_limited_edition', form.is_limited_edition ? 'true' : 'false');
    if (result?.aiNotes)               fd.append('ai_notes', result.aiNotes);
    if (result?.estimatedValueLow != null)  fd.append('estimated_value_low', String(result.estimatedValueLow));
    if (result?.estimatedValueHigh != null) fd.append('estimated_value_high', String(result.estimatedValueHigh));
    if (photo) {
      fd.append('gallery', uploadFile(photo.uri));
    }
    try {
      await createPost(fd).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      appNav.goBack();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Could not publish the listing. Please try again.');
    }
  }, [form, result, photo, createPost, appNav]);

  // ── Photo step ───────────────────────────────────────────────────────────
  if (step === 'photo' || step === 'analyzing') {
    const busy = step === 'analyzing' || analyzing;
    return (
      <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.photoStep}>
          <View style={[styles.hero, { backgroundColor: DIECAST_BLUE }]}>
            <Sparkles size={26} color="#FFFFFF" />
            <Text style={styles.heroTitle}>Diecast Listing</Text>
            <Text style={styles.heroSub}>Snap a photo and we'll identify the brand, model, and suggest a price.</Text>
          </View>

          <TouchableOpacity
            style={[styles.photoDrop, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={pickImage}
            activeOpacity={0.85}
            disabled={busy}
          >
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Camera size={30} color={colors.grey} />
                <Text style={[styles.photoPlaceholderText, { color: colors.grey }]}>Tap to add a photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {photo && !busy && (
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={pickImage}>
              <ImagePlus size={16} color={colors.fg} />
              <Text style={[styles.secondaryBtnText, { color: colors.fg }]}>Change Photo</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: DIECAST_BLUE }, (!photo || busy) && styles.btnDisabled]}
            onPress={handleAnalyze}
            disabled={!photo || busy}
          >
            {busy ? (
              <View style={styles.analyzingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.primaryBtnText}>Analyzing photo…</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>Analyze Photo</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Confirm step ─────────────────────────────────────────────────────────
  const estLow = result?.estimatedValueLow;
  const estHigh = result?.estimatedValueHigh;
  const inputStyle = [styles.input, { color: colors.fg, borderColor: colors.border, backgroundColor: colors.card }];

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {/* Analysis summary card */}
        <View style={[styles.summaryCard, { backgroundColor: DIECAST_BLUE }]}>
          {photo && (
            <View style={[styles.summaryThumb, { backgroundColor: DIECAST_BLUE_DARK }]}>
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          )}
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryTitle} numberOfLines={2}>
              {[result?.brand, result?.make, result?.model].filter(Boolean).join(' ') || 'Diecast'}
            </Text>
            {result?.ebayAvgPrice != null ? (
              <Text style={styles.summaryMeta}>
                eBay avg ${Math.round(result.ebayAvgPrice)}
                {result.ebayListingCount ? ` · ${result.ebayListingCount} listings` : ''}
              </Text>
            ) : (estLow != null || estHigh != null) ? (
              <Text style={styles.summaryMeta}>Est. ${estLow ?? '?'} – ${estHigh ?? '?'}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>Title *</Text>
            <TextInput style={inputStyle} value={form.title} onChangeText={(v) => setField('title', v)} placeholder="Listing title" placeholderTextColor={colors.grey} />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>Description</Text>
            <TextInput
              style={[inputStyle, styles.inputMulti]}
              value={form.body}
              onChangeText={(v) => setField('body', v)}
              placeholder="Describe the item…"
              placeholderTextColor={colors.grey}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>Price ($) *</Text>
            <TextInput style={inputStyle} value={form.price} onChangeText={(v) => setField('price', v)} placeholder="0" placeholderTextColor={colors.grey} keyboardType="numeric" />
          </View>

          <ChipSelect label="Brand" options={DIECAST_BRANDS} value={form.brand} onChange={(v) => setField('brand', v)} />
          <ChipSelect label="Rarity" options={DIECAST_RARITIES} value={form.rarity} onChange={(v) => setField('rarity', v)} />
          <ChipSelect label="Condition" options={DIECAST_CONDITIONS} value={form.condition} onChange={(v) => setField('condition', v)} />

          <View style={styles.row}>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={[styles.fieldLabel, { color: colors.grey }]}>Make</Text>
              <TextInput style={inputStyle} value={form.make} onChangeText={(v) => setField('make', v)} placeholder="Ford" placeholderTextColor={colors.grey} />
            </View>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={[styles.fieldLabel, { color: colors.grey }]}>Model</Text>
              <TextInput style={inputStyle} value={form.model} onChangeText={(v) => setField('model', v)} placeholder="Mustang" placeholderTextColor={colors.grey} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={[styles.fieldLabel, { color: colors.grey }]}>Series</Text>
              <TextInput style={inputStyle} value={form.series} onChangeText={(v) => setField('series', v)} placeholder="Treasure Hunt" placeholderTextColor={colors.grey} />
            </View>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={[styles.fieldLabel, { color: colors.grey }]}>Year</Text>
              <TextInput style={inputStyle} value={form.year} onChangeText={(v) => setField('year', v)} placeholder="2024" placeholderTextColor={colors.grey} keyboardType="numeric" />
            </View>
          </View>

          <CheckRow label="In original packaging" value={form.in_packaging} onToggle={() => setField('in_packaging', !form.in_packaging)} />
          <CheckRow label="Limited edition" value={form.is_limited_edition} onToggle={() => setField('is_limited_edition', !form.is_limited_edition)} />

          {result?.aiNotes ? (
            <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.notesLabel, { color: colors.grey }]}>AI NOTES</Text>
              <Text style={[styles.notesText, { color: colors.muted }]}>{result.aiNotes}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: DIECAST_BLUE }, publishing && styles.btnDisabled]}
          onPress={handlePublish}
          disabled={publishing}
        >
          {publishing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryBtnText}>Publish Listing</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  photoStep:   { padding: 16, gap: 16 },
  hero:        { borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  heroTitle:   { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  heroSub:     { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', lineHeight: 19 },

  photoDrop:   { height: 260, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoPlaceholderText: { fontSize: 14, fontWeight: '600' },

  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },

  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  summaryThumb: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden' },
  summaryInfo: { flex: 1 },
  summaryTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  summaryMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 3, fontWeight: '600' },

  fields:      { padding: 16, gap: 16 },
  field:       { gap: 7 },
  fieldLabel:  { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  input:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  inputMulti:  { minHeight: 90, paddingTop: 11 },

  row:         { flexDirection: 'row', gap: 12 },
  rowItem:     { flex: 1 },

  chipWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText:    { fontSize: 13, fontWeight: '600' },

  checkRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkLabel:  { fontSize: 15, fontWeight: '600' },

  notesCard:   { borderRadius: 10, borderWidth: 1, padding: 12, gap: 5 },
  notesLabel:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  notesText:   { fontSize: 13, lineHeight: 19 },

  footer:      { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  primaryBtn:  { borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
