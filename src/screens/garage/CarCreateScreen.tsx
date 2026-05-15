import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { X, Plus, Camera } from 'lucide-react-native';
import {
  useCreateCarMutation, useUpdateCarMutation,
  useGetCarBrandsQuery, useGetCarModelsQuery, useGetCarQuery,
} from '../../api/apiService';
import Button from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { CAR_TYPES, CAR_CATEGORIES, MOD_TYPES, CONDITIONS } from '../../constants/carTypes';
import type { AppScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

// ── Step progress bar ────────────────────────────────────────────────────────
function ProgressBar({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <View style={pb.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[pb.segment, i < step && pb.filled, i === step - 1 && pb.current]}
        />
      ))}
    </View>
  );
}
const pb = StyleSheet.create({
  container: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 12 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.secondary },
  filled:  { backgroundColor: colors.primaryAlt },
  current: { backgroundColor: colors.primaryAlt },
});

// ── Chip selector ─────────────────────────────────────────────────────────────
function ChipSelect<T extends { key: string; label: string }>({
  items, value, onChange, label,
}: { items: T[]; value: string; onChange: (k: string) => void; label: string }) {
  const colors = useColors();
  return (
    <View style={cs.wrapper}>
      <Text style={[cs.label, { color: colors.fg }]}>{label}</Text>
      <View style={cs.chips}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[cs.chip, { borderColor: colors.border, backgroundColor: colors.card }, value === item.key && cs.chipActive]}
            onPress={() => onChange(item.key)}
          >
            <Text style={[cs.chipText, { color: colors.fg }, value === item.key && cs.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const cs = StyleSheet.create({
  wrapper: { marginBottom: 20 },
  label:   { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  chipText:   { fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
});

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, numeric, optional, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; numeric?: boolean; optional?: boolean; multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={f.wrapper}>
      <Text style={[f.label, { color: colors.fg }]}>
        {label} {optional && <Text style={[f.opt, { color: colors.grey }]}>(optional)</Text>}
      </Text>
      <TextInput
        style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }, multiline && ss.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? ''}
        placeholderTextColor={colors.grey}
        keyboardType={numeric ? 'numeric' : 'default'}
        autoCapitalize="none"
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );
}
const f = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label:   { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  opt:     { fontWeight: '400', fontSize: 12 },
});

// ── Make/Model autocomplete picker ────────────────────────────────────────────
function MakeModelPicker({
  make, model, onMakeChange, onModelChange,
}: {
  make: string; model: string;
  onMakeChange: (v: string) => void; onModelChange: (v: string) => void;
}) {
  const colors = useColors();
  const [makeQuery, setMakeQuery] = useState(make);
  const [showMakeSuggestions, setShowMakeSuggestions] = useState(false);

  useEffect(() => { setMakeQuery(make); }, [make]);

  const { data: brands = [] } = useGetCarBrandsQuery();
  const { data: models = [] } = useGetCarModelsQuery(make, { skip: !make });

  const filteredBrands = makeQuery.length > 0
    ? brands.filter((b) => b.toLowerCase().startsWith(makeQuery.toLowerCase())).slice(0, 6)
    : [];

  const handleMakeSelect = (b: string) => {
    setMakeQuery(b);
    onMakeChange(b);
    onModelChange('');
    setShowMakeSuggestions(false);
  };

  return (
    <View>
      <View style={mm.wrapper}>
        <Text style={[mm.label, { color: colors.fg }]}>Make *</Text>
        <TextInput
          style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
          value={makeQuery}
          onChangeText={(v) => { setMakeQuery(v); setShowMakeSuggestions(true); }}
          onBlur={() => { if (makeQuery !== make) onMakeChange(makeQuery); setShowMakeSuggestions(false); }}
          placeholder="e.g. Porsche"
          placeholderTextColor={colors.grey}
          autoCapitalize="words"
        />
        {showMakeSuggestions && filteredBrands.length > 0 && (
          <View style={[mm.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {filteredBrands.map((b) => (
              <TouchableOpacity key={b} style={[mm.suggestion, { borderBottomColor: colors.border }]} onPress={() => handleMakeSelect(b)}>
                <Text style={[mm.suggestionText, { color: colors.fg }]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={mm.wrapper}>
        <Text style={[mm.label, { color: colors.fg }]}>Model *</Text>
        {models.length > 0 ? (
          <View style={mm.modelChips}>
            {models.map((m) => (
              <TouchableOpacity
                key={m}
                style={[mm.modelChip, { borderColor: colors.border, backgroundColor: colors.card }, model === m && mm.modelChipActive]}
                onPress={() => onModelChange(m)}
              >
                <Text style={[mm.modelChipText, { color: colors.fg }, model === m && mm.modelChipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TextInput
            style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
            value={model}
            onChangeText={onModelChange}
            placeholder="e.g. 911"
            placeholderTextColor={colors.grey}
            autoCapitalize="words"
          />
        )}
      </View>
    </View>
  );
}
const mm = StyleSheet.create({
  wrapper: { marginBottom: 16, position: 'relative' },
  label:   { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  suggestions: {
    position: 'absolute', top: 70, left: 0, right: 0, zIndex: 99,
    borderRadius: 8, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  suggestion: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  suggestionText: { fontSize: 15 },
  modelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modelChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5 },
  modelChipActive: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  modelChipText: { fontSize: 13, fontWeight: '600' },
  modelChipTextActive: { color: '#FFFFFF' },
});

// ── Main screen ───────────────────────────────────────────────────────────────
type FormData = {
  title: string; year: string; make: string; model: string;
  type: string; category: string;
  trim: string; color: string; engine: string; mileage: string;
  horsepower: string; torque: string; vin: string; condition: string; body: string;
  mods: { title: string; type: string; body: string }[];
  images: { uri: string; name: string; type: string }[];
};

const EMPTY_FORM: FormData = {
  title: '', year: '', make: '', model: '', type: 'daily', category: '',
  trim: '', color: '', engine: '', mileage: '', horsepower: '', torque: '',
  vin: '', condition: '', body: '',
  mods: [], images: [],
};

export default function CarCreateScreen({ navigation, route }: AppScreenProps<'CarCreate'>) {
  const colors = useColors();
  const carId = route.params?.carId;
  const isEditMode = !!carId;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM, type: 'daily', category: CAR_CATEGORIES['daily'][0]?.key ?? '' });
  const [expandedMods, setExpandedMods] = useState<boolean[]>([]);
  const [createCar, { isLoading: creating }] = useCreateCarMutation();
  const [updateCar, { isLoading: updating }] = useUpdateCarMutation();
  const isLoading = creating || updating;

  const { data: existingCar } = useGetCarQuery(carId ?? '', { skip: !carId });

  useEffect(() => {
    if (existingCar && isEditMode) {
      setForm({
        title: existingCar.title ?? '',
        year: existingCar.year ?? '',
        make: existingCar.make ?? '',
        model: existingCar.model ?? '',
        type: existingCar.type ?? 'daily',
        category: existingCar.category ?? '',
        trim: existingCar.trim ?? '',
        color: existingCar.color ?? '',
        engine: existingCar.engine ?? '',
        mileage: existingCar.mileage ?? '',
        horsepower: existingCar.horsepower ?? '',
        torque: existingCar.torque ?? '',
        vin: existingCar.vin ?? '',
        condition: existingCar.condition ?? '',
        body: existingCar.body ?? '',
        mods: [],
        images: [],
      });
    }
  }, [existingCar, isEditMode]);

  const set = (key: keyof FormData) => (val: any) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // When type changes, reset category to first in list
  const handleTypeChange = (t: string) => {
    setForm((prev) => ({
      ...prev, type: t,
      category: CAR_CATEGORIES[t]?.[0]?.key ?? '',
    }));
  };

  const categories = CAR_CATEGORIES[form.type] ?? [];

  // Step validation
  const canAdvance = (): boolean => {
    if (step === 1) return !!(form.title && form.year && form.make && form.model && form.type);
    return true;
  };

  // Image picker
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      const newImages = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `photo_${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      }));
      setForm((prev) => ({ ...prev, images: [...prev.images, ...newImages].slice(0, 10) }));
    }
  };

  const addMod = () => {
    setForm((prev) => ({ ...prev, mods: [...prev.mods, { title: '', type: 'general', body: '' }] }));
    setExpandedMods((prev) => [...prev, true]);
  };

  const updateMod = (i: number, key: string, val: string) =>
    setForm((prev) => {
      const mods = [...prev.mods];
      mods[i] = { ...mods[i], [key]: val };
      return { ...prev, mods };
    });

  const removeMod = (i: number) => {
    setForm((prev) => ({ ...prev, mods: prev.mods.filter((_, idx) => idx !== i) }));
    setExpandedMods((prev) => prev.filter((_, idx) => idx !== i));
  };

  const collapseMod = (i: number) =>
    setExpandedMods((prev) => prev.map((v, idx) => (idx === i ? false : v)));

  const expandMod = (i: number) =>
    setExpandedMods((prev) => prev.map((v, idx) => (idx === i ? true : v)));

  // Final submit
  const handleSubmit = async () => {
    const fd = new FormData();
    if (isEditMode) fd.append('internal_id', carId!);
    fd.append('title', form.title);
    fd.append('year', form.year);
    fd.append('make', form.make);
    fd.append('model', form.model);
    fd.append('make_handle', form.make.toLowerCase());
    fd.append('model_handle', form.model.toLowerCase());
    fd.append('type', form.type);
    fd.append('category', form.category);
    if (form.trim)       fd.append('trim', form.trim);
    if (form.color)      fd.append('color', form.color);
    if (form.engine)     fd.append('engine', form.engine);
    if (form.mileage)    fd.append('mileage', form.mileage);
    if (form.horsepower) fd.append('horsepower', form.horsepower);
    if (form.torque)     fd.append('torque', form.torque);
    if (form.vin)        fd.append('vin', form.vin);
    if (form.condition)  fd.append('condition', form.condition);
    if (form.body)       fd.append('body', form.body);
    if (!isEditMode)     fd.append('entry_type', 'garagecar');

    form.images.forEach((img) => {
      fd.append('gallery', { uri: img.uri, name: img.name, type: img.type } as any);
    });

    try {
      if (isEditMode) {
        await updateCar(fd).unwrap();
        navigation.goBack();
      } else {
        await createCar(fd).unwrap();
        navigation.goBack();
        Alert.alert('Car added!', 'Your car has been added to your garage.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.data?.error ?? `Failed to ${isEditMode ? 'update' : 'create'} car. Please try again.`);
    }
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ProgressBar step={step} />

      {/* Nav buttons always visible at top */}
      <View style={[styles.nav, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {step > 1 ? (
          <Button
            label="← Back"
            onPress={() => setStep((s) => s - 1)}
            variant="secondary"
            size="default"
          />
        ) : <View />}
        <View style={styles.navRight}>
          {step < 4 ? (
            <Button
              label="Next →"
              onPress={() => {
                if (!canAdvance()) {
                  Alert.alert('Required fields', 'Please fill in all required fields.');
                  return;
                }
                setStep((s) => s + 1);
              }}
              variant="dark"
              size="default"
            />
          ) : (
            <Button
              label={isEditMode ? 'Save Changes' : 'Add to Garage'}
              onPress={handleSubmit}
              loading={isLoading}
              variant="primary"
              size="default"
            />
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── STEP 1: Required ───────────────────────────────────────── */}
          {step === 1 && (
            <View>
              <Text style={[styles.stepTitle, { color: colors.fg }]}>Step 1 — The Basics</Text>

              <Field label="Title *" value={form.title} onChange={set('title')} placeholder="e.g. Weekend Track Build" />
              <Field label="Year *" value={form.year} onChange={set('year')} placeholder="e.g. 1991" numeric />

              <MakeModelPicker
                make={form.make}
                model={form.model}
                onMakeChange={set('make')}
                onModelChange={set('model')}
              />

              <ChipSelect items={CAR_TYPES} value={form.type} onChange={handleTypeChange} label="Type *" />

              {categories.length > 0 && (
                <ChipSelect items={categories} value={form.category} onChange={set('category')} label="Category" />
              )}
            </View>
          )}

          {/* ── STEP 2: Optional specs ─────────────────────────────────── */}
          {step === 2 && (
            <View>
              <Text style={[styles.stepTitle, { color: colors.fg }]}>Step 2 — Specs</Text>
              <Field label="Description" value={form.body} onChange={set('body')} placeholder="Tell us about it..." optional multiline />
              <Field label="Trim" value={form.trim} onChange={set('trim')} placeholder="e.g. Turbo S" optional />
              <Field label="Color" value={form.color} onChange={set('color')} placeholder="e.g. Guards Red" optional />
              <Field label="Engine" value={form.engine} onChange={set('engine')} placeholder="e.g. 3.8L Flat-6" optional />
              <Field label="Horsepower" value={form.horsepower} onChange={set('horsepower')} placeholder="e.g. 450" optional numeric />
              <Field label="Torque (lb-ft)" value={form.torque} onChange={set('torque')} placeholder="e.g. 390" optional numeric />
              <Field label="Mileage" value={form.mileage} onChange={set('mileage')} placeholder="e.g. 42000" optional numeric />
              <Field label="VIN" value={form.vin} onChange={set('vin')} placeholder="e.g. WP0ZZZ99ZTS392124" optional />
              <ChipSelect items={CONDITIONS} value={form.condition} onChange={set('condition')} label="Condition" />
            </View>
          )}

          {/* ── STEP 3: Mods ───────────────────────────────────────────── */}
          {step === 3 && (
            <View>
              <Text style={[styles.stepTitle, { color: colors.fg }]}>Step 3 — Modifications</Text>
              <Text style={[styles.stepSub, { color: colors.grey }]}>Add any mods you want to document. You can always add more later.</Text>

              {form.mods.map((mod, i) => {
                const isExpanded = expandedMods[i] !== false;
                return isExpanded ? (
                  <View key={i} style={[styles.modCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.modHeader}>
                      <Text style={styles.modIndex}>Mod #{i + 1}</Text>
                      <TouchableOpacity onPress={() => removeMod(i)}>
                        <X size={16} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                    <Field
                      label="Title"
                      value={mod.title}
                      onChange={(v) => updateMod(i, 'title', v)}
                      placeholder="e.g. Bilstein PSS10 Coilovers"
                    />
                    <ChipSelect
                      items={MOD_TYPES}
                      value={mod.type}
                      onChange={(v) => updateMod(i, 'type', v)}
                      label="Category"
                    />
                    <Field
                      label="Notes"
                      value={mod.body}
                      onChange={(v) => updateMod(i, 'body', v)}
                      placeholder="Additional details..."
                      optional
                      multiline
                    />
                    <TouchableOpacity style={[styles.saveModBtn, { backgroundColor: colors.primaryAlt }]} onPress={() => collapseMod(i)}>
                      <Text style={styles.saveModBtnText}>Save Mod</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    key={i}
                    style={[styles.modCollapsed, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => expandMod(i)}
                  >
                    <View style={styles.modCollapsedLeft}>
                      <Text style={[styles.modCollapsedTitle, { color: colors.fg }]} numberOfLines={1}>
                        {mod.title || `Mod #${i + 1}`}
                      </Text>
                      <Text style={[styles.modCollapsedType, { color: colors.grey }]}>{mod.type}</Text>
                    </View>
                    <View style={styles.modCollapsedRight}>
                      <Text style={[styles.modEditLink, { color: colors.primaryAlt }]}>Edit</Text>
                      <TouchableOpacity onPress={() => removeMod(i)} hitSlop={8}>
                        <X size={14} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={styles.addModBtn} onPress={addMod}>
                <Plus size={16} color={colors.primaryAlt} />
                <Text style={styles.addModText}>Add Modification</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 4: Photos ─────────────────────────────────────────── */}
          {step === 4 && (
            <View>
              <Text style={[styles.stepTitle, { color: colors.fg }]}>Step 4 — Photos</Text>
              <Text style={[styles.stepSub, { color: colors.grey }]}>Add up to 10 photos. First photo will be the cover image.</Text>

              <TouchableOpacity style={styles.photoPickerBtn} onPress={pickImage}>
                <Camera size={22} color="#FFFFFF" />
                <Text style={styles.photoPickerText}>Choose Photos</Text>
              </TouchableOpacity>

              {form.images.length > 0 && (
                <FlatList
                  data={form.images}
                  keyExtractor={(item) => item.uri}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoList}
                  renderItem={({ item, index }) => (
                    <View style={styles.photoThumb}>
                      <Image source={{ uri: item.uri }} style={styles.photoImg} contentFit="cover" />
                      {index === 0 && (
                        <View style={styles.coverBadge}>
                          <Text style={styles.coverText}>Cover</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.photoRemove}
                        onPress={() =>
                          setForm((prev) => ({
                            ...prev,
                            images: prev.images.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <X size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1 },
  scroll:    { paddingHorizontal: 16, paddingBottom: 24 },
  stepTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6, marginTop: 4 },
  stepSub:   { fontSize: 14, marginBottom: 20, lineHeight: 20 },

  modCard: {
    borderRadius: 10, padding: 14,
    marginBottom: 14, borderWidth: 1,
  },
  modHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modIndex:  { fontSize: 13, fontWeight: '700', color: colors.primaryAlt },
  addModBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: colors.primaryAlt,
  },
  addModText: { fontSize: 14, fontWeight: '700', color: colors.primaryAlt },

  saveModBtn: {
    marginTop: 8, paddingVertical: 12, borderRadius: 8,
    alignItems: 'center',
  },
  saveModBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  modCollapsed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1,
  },
  modCollapsedLeft: { flex: 1, marginRight: 12 },
  modCollapsedTitle: { fontSize: 14, fontWeight: '700' },
  modCollapsedType: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  modCollapsedRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modEditLink: { fontSize: 13, fontWeight: '700' },

  photoPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 20, borderRadius: 12,
    backgroundColor: colors.primaryAlt,
    marginBottom: 16,
  },
  photoPickerText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  photoList: { marginBottom: 16 },
  photoThumb: {
    width: 100, height: 100, borderRadius: 8, marginRight: 8,
    overflow: 'hidden', position: 'relative',
  },
  photoImg:    { width: '100%', height: '100%' },
  coverBadge:  {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: colors.primaryAlt, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  coverText:   { fontSize: 9, fontWeight: '800', color: '#000' },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navRight: { marginLeft: 'auto' },
});
