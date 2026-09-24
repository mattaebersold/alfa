import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { X } from 'lucide-react-native';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import PhotoPickerField from '../ui/PhotoPickerField';
import { useUpdateCarMutation, useCreateModMutation } from '../../api/apiService';
import { uploadFile } from '../../utils/upload';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { colors as palette } from '../../constants/colors';
import { COMMON_RADIUS } from '../../constants/radius';
import type { GarageCar } from '../../types/api';

type Step = 'photo' | 'specs' | 'mod';

const STEPS: { key: Step; title: string; sub: string }[] = [
  { key: 'photo', title: 'Add a photo',  sub: 'The first thing anyone sees of it' },
  { key: 'specs', title: 'Add the specs', sub: 'Engine, power, colour, miles' },
  { key: 'mod',   title: 'Add a mod',    sub: 'What you’ve changed, and why' },
];

/** The spec fields worth asking for here — the rest live in the full edit form. */
const SPEC_FIELDS: { key: keyof GarageCar; label: string; keyboard?: 'numeric' }[] = [
  { key: 'trim',       label: 'Trim' },
  { key: 'color',      label: 'Color' },
  { key: 'engine',     label: 'Engine' },
  { key: 'horsepower', label: 'Horsepower', keyboard: 'numeric' },
  { key: 'torque',     label: 'Torque',     keyboard: 'numeric' },
  { key: 'mileage',    label: 'Mileage',    keyboard: 'numeric' },
];

/**
 * "Finish setting up this car" — the car page's version of the menu's
 * profile checklist, shown to its owner while something basic is missing.
 *
 * Each step is checked against the car as it is: a photo, any spec beyond
 * year/make/model, a first mod. Doing one clears it on its own — saving
 * invalidates the car or its mods, the page refetches, and the step is gone.
 * Each opens in a summary panel over the page, with just that one thing to
 * fill in; the full edit form is still there for everything else.
 */
export default function CarSetupCard({ car, modCount }: {
  car: GarageCar;
  /** Mods on the car — from the page's own query, so there's one fetch. */
  modCount: number;
}) {
  const [open, setOpen] = useState<{ step: Step; origin: SummaryOrigin | null } | null>(null);

  const done: Record<Step, boolean> = {
    photo: !!car.gallery?.length || !!car.profile_image,
    specs: SPEC_FIELDS.some((f) => !!String(car[f.key] ?? '').trim()) || !!car.condition,
    mod: modCount > 0,
  };
  const remaining = STEPS.filter((s) => !done[s.key]);

  const close = () => setOpen(null);
  const panels = (
    <>
      <PhotoPanel car={car} visible={open?.step === 'photo'} origin={open?.origin} onClose={close} />
      <SpecsPanel car={car} visible={open?.step === 'specs'} origin={open?.origin} onClose={close} />
      <ModPanel car={car} visible={open?.step === 'mod'} origin={open?.origin} onClose={close} />
    </>
  );

  // The panel that finished the last step is still closing — it outlives the card.
  if (!remaining.length) return panels;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Finish setting up this car</Text>
      {remaining.map((step, i) => (
        <SummaryTouchable
          key={step.key}
          style={[styles.row, i > 0 && styles.rowDivided]}
          onPress={(origin) => setOpen({ step: step.key, origin })}
          activeOpacity={0.7}
          accessibilityLabel={step.title}
        >
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{i + 1}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{step.title}</Text>
            <Text style={styles.rowSub} numberOfLines={1}>{step.sub}</Text>
          </View>
        </SummaryTouchable>
      ))}
      {panels}
    </View>
  );
}

// ── The panels ────────────────────────────────────────────────────────────────

type PanelProps = { car: GarageCar; visible: boolean; origin?: SummaryOrigin | null; onClose: () => void };

function PanelHead({ title, hint }: { title: string; hint: string }) {
  const colors = useColors();
  return (
    <View style={styles.panelHead}>
      <Text style={[styles.panelTitle, { color: colors.fg }]}>{title}</Text>
      <Text style={[styles.panelHint, { color: colors.grey }]}>{hint}</Text>
    </View>
  );
}

function SaveButton({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy: boolean; disabled?: boolean }) {
  const brand = useBrandColor();
  return (
    <TouchableOpacity
      style={[styles.save, { backgroundColor: brand }, (disabled || busy) && styles.saveDisabled]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator size="small" color="#000000" /> : <Text style={styles.saveText}>{label}</Text>}
    </TouchableOpacity>
  );
}

type Picked = { uri: string };

/** Up to ten from the library, previewed in a row, removable before saving. */
function usePhotoPicks(visible: boolean) {
  const [picked, setPicked] = useState<Picked[]>([]);
  useEffect(() => { if (visible) setPicked([]); }, [visible]);
  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.85,
    });
    if (!result.canceled) setPicked((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri }))].slice(0, 10));
  };
  const remove = (uri: string) => setPicked((prev) => prev.filter((p) => p.uri !== uri));
  return { picked, pick, remove };
}

function PickedStrip({ picked, onRemove }: { picked: Picked[]; onRemove: (uri: string) => void }) {
  if (!picked.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {picked.map((p) => (
        <View key={p.uri}>
          <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
          <TouchableOpacity style={styles.thumbX} onPress={() => onRemove(p.uri)} hitSlop={6} accessibilityLabel="Remove photo">
            <X size={12} color="#FFFFFF" strokeWidth={2.8} />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function PhotoPanel({ car, visible, origin, onClose }: PanelProps) {
  const [updateCar, { isLoading }] = useUpdateCarMutation();
  const { picked, pick, remove } = usePhotoPicks(visible);

  const save = async () => {
    const fd = new FormData();
    fd.append('internal_id', car.internal_id);
    // Added to the car's gallery; the first becomes its cover.
    picked.forEach((p) => fd.append('gallery', uploadFile(p.uri)));
    try {
      await updateCar(fd).unwrap();
      onClose();
    } catch {
      Alert.alert('Error', "Couldn't upload those photos. Please try again.");
    }
  };

  return (
    <SummaryModal visible={visible} origin={origin} onClose={onClose}>
      <View style={styles.panelBody}>
        <PanelHead title="Add a photo" hint="The first one becomes the car's cover, on its card and at the top of this page." />
        <PhotoPickerField onPress={pick} compact={picked.length > 0} title={picked.length ? 'Add more' : 'Add Photos'} />
        <PickedStrip picked={picked} onRemove={remove} />
        <SaveButton label={picked.length > 1 ? `Save ${picked.length} photos` : 'Save photo'} onPress={save} busy={isLoading} disabled={!picked.length} />
      </View>
    </SummaryModal>
  );
}

function SpecsPanel({ car, visible, origin, onClose }: PanelProps) {
  const colors = useColors();
  const [updateCar, { isLoading }] = useUpdateCarMutation();
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => { if (visible) setValues({}); }, [visible]);

  const filled = Object.values(values).some((v) => v.trim());

  const save = async () => {
    const fd = new FormData();
    fd.append('internal_id', car.internal_id);
    // Only what was typed: the update writes the fields it's sent and leaves
    // the rest of the car alone.
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) fd.append(key, value.trim());
    }
    try {
      await updateCar(fd).unwrap();
      onClose();
    } catch {
      Alert.alert('Error', "Couldn't save those specs. Please try again.");
    }
  };

  return (
    <SummaryModal visible={visible} origin={origin} onClose={onClose}>
      <View style={styles.panelBody}>
        <PanelHead title="Add the specs" hint="Whatever you know — anything left blank can be added later from Edit Car." />
        <View style={styles.fields}>
          {SPEC_FIELDS.map((f) => (
            <View key={String(f.key)} style={styles.field}>
              <Text style={[styles.label, { color: colors.grey }]}>{f.label}</Text>
              <TextInput
                style={[styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
                value={values[f.key as string] ?? ''}
                onChangeText={(v) => setValues((prev) => ({ ...prev, [f.key as string]: v }))}
                keyboardType={f.keyboard ?? 'default'}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          ))}
        </View>
        <SaveButton label="Save specs" onPress={save} busy={isLoading} disabled={!filled} />
      </View>
    </SummaryModal>
  );
}

function ModPanel({ car, visible, origin, onClose }: PanelProps) {
  const colors = useColors();
  const [createMod, { isLoading }] = useCreateModMutation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const { picked, pick, remove } = usePhotoPicks(visible);
  useEffect(() => { if (visible) { setTitle(''); setBody(''); } }, [visible]);

  const save = async () => {
    const fd = new FormData();
    fd.append('car_id', car.internal_id);
    fd.append('title', title.trim());
    // The mod form's default; the full form can change it.
    fd.append('type', 'general');
    if (body.trim()) fd.append('body', body.trim());
    picked.forEach((p) => fd.append('gallery', uploadFile(p.uri)));
    try {
      await createMod(fd).unwrap();
      onClose();
    } catch {
      Alert.alert('Error', "Couldn't add that mod. Please try again.");
    }
  };

  return (
    <SummaryModal visible={visible} origin={origin} onClose={onClose}>
      <View style={styles.panelBody}>
        <PanelHead title="Add a mod" hint="The first thing you've changed on it. A photo is optional." />
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.grey }]}>What did you do?</Text>
          <TextInput
            style={[styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Coilovers, a new exhaust…"
            placeholderTextColor={colors.greyDark}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.grey }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="Parts, cost, how it drives now"
            placeholderTextColor={colors.greyDark}
          />
        </View>
        <PhotoPickerField onPress={pick} compact title={picked.length ? 'Add more' : 'Add a photo'} />
        <PickedStrip picked={picked} onRemove={remove} />
        <SaveButton label="Add mod" onPress={save} busy={isLoading} disabled={!title.trim()} />
      </View>
    </SummaryModal>
  );
}

/** The help prompts' ground — shared look with ProfileHelpCard. */
const HELP_BG = '#121212';

const styles = StyleSheet.create({
  // The menu checklist's look (ProfileSetupCard), on the page's dark ground.
  // No side margin: it sits in the car page's padded column, under Add Content.
  card: {
    marginVertical: 20,
    paddingHorizontal: 13, paddingTop: 12, paddingBottom: 4,
    borderRadius: COMMON_RADIUS,
    // Darker than the menu's tile grey: on the page it's a note, not a panel.
    backgroundColor: HELP_BG,
  },
  heading: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  bubble: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: palette.red,
    alignItems: 'center', justifyContent: 'center',
  },
  bubbleText: { fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
  rowSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  panelBody: { padding: 18, gap: 14 },
  panelHead: { gap: 4 },
  panelTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  panelHint: { fontSize: 13, lineHeight: 18 },
  fields: { gap: 10 },
  field: { gap: 4 },
  label: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1.5, borderRadius: COMMON_RADIUS,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  strip: { gap: 8 },
  thumb: { width: 72, height: 72, borderRadius: COMMON_RADIUS, backgroundColor: '#161616' },
  thumbX: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  save: {
    borderRadius: COMMON_RADIUS, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center', minHeight: 46,
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { fontSize: 15, fontWeight: '800', color: '#000000' },
});
