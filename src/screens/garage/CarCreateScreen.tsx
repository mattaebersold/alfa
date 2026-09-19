import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, FlatList, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { X, Plus, Check, Trash2, Search, ChevronUp, PenSquare } from 'lucide-react-native';
import {
  useCreateCarMutation, useUpdateCarMutation,
  useGetCarQuery,
  useGetUserGroupsQuery,
  useGetUserGarageQuery,
  useGetJoinableGroupsQuery,
  useJoinGroupMutation,
  useCreateModMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Button from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useIsPro, useBrandColor } from '../../hooks/useBrandColor';
import { CAR_TYPES, CAR_CATEGORIES, MOD_TYPES, CONDITIONS, TYPE_COLORS } from '../../constants/carTypes';
import { categoryColor } from '../../utils/categoryColor';
import type { AppScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import PhotoPickerField from '../../components/ui/PhotoPickerField';
import MakeModelFields from '../../components/cars/MakeModelFields';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';
import SharedModal from '../../components/ui/SharedModal';
import { StepFormNav, StepFormProgress } from '../../components/ui/StepFormHeader';
import { useDebounced } from '../../hooks/useDebounced';

/**
 * The step names, which head the nav row rather than the scrolling content.
 *
 * They used to sit inside each step's own block, so the first thing you did on
 * arriving at a step was scroll past its title to reach the fields. Up here it
 * stays put, and the two chevrons either side of it say what it's for.
 *
 * The header and bar themselves are ui/StepFormHeader, shared with the group
 * and marketplace create forms.
 */
const STEP_TITLES = [
  'Basic Information',
  'Photos',
  'Specs',
  'Groups',
  'Modifications',
];

// ── Chip selector ─────────────────────────────────────────────────────────────
/**
 * A row of choices, each wearing the colour it will have once it's on the car.
 *
 * These used to be uniform grey outlines that turned brand-blue when picked,
 * so choosing a type told you nothing about how that type would look. The
 * badge colours are the same ones the car card and the feed use, which makes
 * this a preview rather than a form control — you pick the orange one because
 * you can see it's the orange one.
 *
 * Unpicked chips are dimmed rather than decoloured, so the set still reads as
 * a palette and the choice still reads as a choice.
 */
function ChipSelect<T extends { key: string; label: string }>({
  items, value, onChange, label, colorFor, style,
}: {
  items: T[];
  value: string;
  onChange: (k: string) => void;
  label: string;
  /** Overrides the row's spacing — see `tight` on the category row. */
  style?: any;
  /**
   * The badge colour for a key, as the rest of the app draws it.
   *
   * Omitted for rows that have no colour of their own — mod types and
   * conditions aren't badged anywhere, so inventing colours for them would
   * imply a meaning that doesn't exist.
   */
  colorFor?: (key: string) => { bg: string; text: string };
}) {
  const colors = useColors();
  const brand = useBrandColor();
  return (
    <View style={[cs.wrapper, style]}>
      <Text style={[cs.label, { color: colors.fg }]}>{label}</Text>
      <View style={cs.chips}>
        {items.map((item) => {
          const tone = colorFor?.(item.key);
          const on = value === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                cs.chip,
                tone
                  ? [{ backgroundColor: tone.bg }, !on && cs.chipOff]
                  : [
                      cs.chipPlain,
                      on
                        // Blue, or gold for Pro — the same fill every other
                        // selected control uses. Black on both: these are light
                        // fills and white on them is unreadable.
                        ? { backgroundColor: brand, borderColor: brand }
                        : { borderColor: colors.border, backgroundColor: colors.card },
                    ],
              ]}
              onPress={() => onChange(item.key)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text
                style={[
                  cs.chipText,
                  tone ? { color: tone.text } : { color: on ? '#000000' : colors.fg },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const cs = StyleSheet.create({
  // Clear of the field above — these read as their own decision, not as a
  // continuation of the text inputs.
  wrapper: { marginTop: 34, marginBottom: 20 },
  tight:   { marginTop: 12 },
  label:   { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS },
  chipOff: { opacity: 0.32 },
  // The uncoloured variant, for rows with no badge palette of their own.
  chipPlain:  { borderWidth: 1.5 },
  chipText:   { fontSize: 13, fontWeight: '700' },
});

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, numeric, optional, multiline, style,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; numeric?: boolean; optional?: boolean; multiline?: boolean;
  /** Overrides the field's own width — see the specs grid. */
  style?: any;
}) {
  const colors = useColors();
  return (
    <View style={[f.wrapper, style]}>
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

// ── Main screen ───────────────────────────────────────────────────────────────
type FormData = {
  title: string; year: string; make: string; model: string;
  type: string; category: string;
  trim: string; color: string; engine: string; mileage: string;
  horsepower: string; torque: string; vin: string; condition: string; body: string;
  group_id: string;
  mods: { title: string; type: string; body: string; images: { uri: string; name: string; type: string }[] }[];
  images: { uri: string; name: string; type: string }[];
};

const EMPTY_FORM: FormData = {
  title: '', year: '', make: '', model: '', type: 'daily', category: '',
  trim: '', color: '', engine: '', mileage: '', horsepower: '', torque: '',
  vin: '', condition: CONDITIONS[0]?.key ?? '', body: '', group_id: '',
  mods: [], images: [],
};

/** The starting form, with the type's first category already chosen. */
const freshForm = (): FormData => ({
  ...EMPTY_FORM,
  type: 'daily',
  category: CAR_CATEGORIES['daily'][0]?.key ?? '',
});

/**
 * A half-finished car, kept for as long as the app is running.
 *
 * Closing the pane pops the screen, which takes its state with it — so
 * stepping out to check a VIN or find a photo used to mean typing everything
 * again. This holds what was entered until the car is actually created.
 *
 * In memory rather than on disk: the only storage this app has is SecureStore,
 * which is for secrets and is the wrong place for a form. That means a draft
 * survives closing and reopening the pane, but not restarting the app — which
 * is the case being asked for, and anything longer-lived would also mean
 * holding on to image URIs that the OS is free to clear out from under us.
 *
 * The groups picked to join ride along with it. They aren't fields on the car,
 * but they are part of what was filled in, and dropping them meant reopening
 * to a form that looked complete while having quietly forgotten half a step.
 */
interface PickedGroup { id: string; title: string }

interface CarDraft {
  form: FormData;
  joinGroups: PickedGroup[];
}
let carDraft: CarDraft | null = null;

/** Nothing filled in yet — no point offering to clear an untouched form. */
const isBlank = (d: CarDraft) =>
  d.joinGroups.length === 0
  && JSON.stringify(d.form) === JSON.stringify(freshForm());

/**
 * The route: the sheet, popping the screen once it has slid away.
 *
 * Everything lives in `CarCreateSheet` so the same form can be hosted where a
 * navigation push can't reach — see NavDrawer, whose RN Modal would sit over a
 * native-stack modal presented from beneath it.
 */
export default function CarCreateScreen({ navigation, route }: AppScreenProps<'CarCreate'>) {
  return <CarCreateSheet carId={route.params?.carId} onDismissed={() => navigation.goBack()} />;
}

/**
 * The add/edit car form, as a self-dismissing sheet.
 *
 * Mount it to open it. It runs its own close animation and then calls
 * `onDismissed`, which is where the host unmounts it — the route pops the
 * screen, an inline host clears its state. Anything queued for after the
 * sheet (the "Car added!" alert) runs straight after that.
 */
export function CarCreateSheet({ carId, onDismissed }: {
  /** Edit this car; omitted to add a new one. */
  carId?: string;
  onDismissed: () => void;
}) {
  const colors = useColors();
  const keyboardHeight = useKeyboardHeight();
  const isPro = useIsPro();
  const brand = useBrandColor();
  // Already cached by the garage screen, so this is free on the common path in.
  const { data: garageData } = useGetUserGarageQuery();
  const garageCount = garageData?.entries?.length ?? 0;
  const isEditMode = !!carId;
  const { userInfo } = useAppSelector((s) => s.auth);

  // The sheet runs its own dismissal, then the screen pops behind it.
  const [visible, setVisible] = useState(true);
  /** Runs once the sheet is gone and the screen has popped. */
  const afterDismiss = useRef<(() => void) | null>(null);
  // Always back at step 1, even when the answers are remembered — reopening
  // mid-form and landing on "Modifications" gives you no idea what's already
  // filled in above it.
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(
    () => (!carId && carDraft ? carDraft.form : freshForm()),
  );
  /** Opened onto remembered answers, so there's something to offer to clear. */
  const [restored] = useState(() => !carId && !!carDraft && !isBlank(carDraft));
  const [expandedMods, setExpandedMods] = useState<boolean[]>([]);
  /**
   * Groups to ask to join once the car exists.
   *
   * Kept apart from `form` because these aren't fields on the car — they're
   * work to do after it's saved, and a draft restored later shouldn't silently
   * re-queue join requests the member has forgotten about.
   */
  const [joinGroups, setJoinGroups] = useState<PickedGroup[]>(
    () => (!carId && carDraft ? carDraft.joinGroups : []),
  );
  const [groupQuery, setGroupQuery] = useState('');
  const settledGroupQuery = useDebounced(groupQuery);
  const [createCar, { isLoading: creating }] = useCreateCarMutation();
  const [updateCar, { isLoading: updating }] = useUpdateCarMutation();
  const isLoading = creating || updating;

  useEffect(() => {
    if (isEditMode) return;
    const next: CarDraft = { form, joinGroups };
    carDraft = isBlank(next) ? null : next;
  }, [form, joinGroups, isEditMode]);

  const { data: existingCar } = useGetCarQuery(carId ?? '', { skip: !carId });
  const { data: userGroups = [] } = useGetUserGroupsQuery(userInfo?.user_id ?? '', { skip: !userInfo?.user_id });

  // Only asked for on the step that shows them, and steered by the car's make
  // so the first suggestions are the relevant ones.
  const { data: joinableData, isFetching: joinableLoading } = useGetJoinableGroupsQuery(
    { make: form.make || undefined, model: form.model || undefined, q: settledGroupQuery || undefined },
    { skip: step !== 4 },
  );
  const joinable = joinableData?.entries ?? [];

  const toggleJoinGroup = (g: { internal_id: string; title?: string }) =>
    setJoinGroups((prev) => (prev.some((p) => p.id === g.internal_id)
      ? prev.filter((p) => p.id !== g.internal_id)
      : [...prev, { id: g.internal_id, title: g.title || 'a group' }]));

  const [joinGroup] = useJoinGroupMutation();
  const [createMod] = useCreateModMutation();

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
        condition: existingCar.condition || CONDITIONS[0]?.key || '',
        body: existingCar.body ?? '',
        group_id: existingCar.group_id ?? '',
        mods: [],
        images: [],
      });
    }
  }, [existingCar, isEditMode]);

  /** Throw the remembered answers away and begin again. */
  const clearDraft = () => {
    Alert.alert(
      'Start over?',
      'This clears everything you\'ve filled in so far.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start over',
          style: 'destructive',
          onPress: () => {
            carDraft = null;
            setForm(freshForm());
            setJoinGroups([]);
            setExpandedMods([]);
            setStep(1);
          },
        },
      ],
    );
  };

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
  /**
   * Whether this step is complete enough to leave.
   *
   * Drives the `>` button's enabled state now rather than an alert on press:
   * a disabled chevron says "something above me is missing" before you try,
   * where the alert only said so afterwards and didn't say what.
   */
  const canAdvance = (): boolean => {
    if (step === 1) return !!(form.title && form.year && form.make && form.model && form.type);
    return true;
  };

  // Image picker
  const pickImage = () => {
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
          if (!result.canceled) {
            const picked = await normalizePickedAssets(result.assets);
            setForm((prev) => ({ ...prev, images: [...prev.images, ...picked].slice(0, 10) }));
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.85,
          });
          if (!result.canceled) {
            const picked = await normalizePickedAssets(result.assets);
            setForm((prev) => ({ ...prev, images: [...prev.images, ...picked].slice(0, 10) }));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /** Photos for one mod, kept on that mod rather than on the car. */
  const pickModImage = (i: number) => {
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
          if (!result.canceled) addModImages(i, await normalizePickedAssets(result.assets));
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85,
          });
          if (!result.canceled) addModImages(i, await normalizePickedAssets(result.assets));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addModImages = (i: number, picked: { uri: string; name: string; type: string }[]) =>
    setForm((prev) => {
      const mods = [...prev.mods];
      mods[i] = { ...mods[i], images: [...(mods[i].images ?? []), ...picked].slice(0, 10) };
      return { ...prev, mods };
    });

  const removeModImage = (i: number, uri: string) =>
    setForm((prev) => {
      const mods = [...prev.mods];
      mods[i] = { ...mods[i], images: (mods[i].images ?? []).filter((img) => img.uri !== uri) };
      return { ...prev, mods };
    });

  const addMod = () => {
    setForm((prev) => ({ ...prev, mods: [...prev.mods, { title: '', type: 'general', body: '', images: [] }] }));
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
    /**
     * Make and model must be picked, not just typed.
     *
     * Step 1's Next already won't go without them, but a make can be un-picked
     * on the way back through the steps, and saving a car with a blank make
     * would be the free-text problem again in another form. MakeModelFields
     * says under the field what's wrong; this takes you to it.
     */
    if (!form.make || !form.model) {
      Alert.alert(
        'Choose a make and model',
        'Pick your car\'s make and model from the lists on the first step.',
      );
      setStep(1);
      return;
    }
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
    fd.append('group_id', form.group_id ?? '');
    if (!isEditMode)     fd.append('entry_type', 'garagecar');

    form.images.forEach((img) => {
      fd.append('gallery', uploadFile(img.uri));
    });

    try {
      if (isEditMode) {
        await updateCar(fd).unwrap();
        setVisible(false);
      } else {
        const created: any = await createCar(fd).unwrap();
        // It exists now — nothing left to remember.
        carDraft = null;

        /**
         * Ask to join the groups they picked, bringing this car along.
         *
         * After creation, because a join request has to name a real car. Best
         * effort and in the background: the car is already saved, and a group
         * that refuses the request is not a reason to tell someone their car
         * didn't work. The server holds the car against the pending membership
         * and applies it if an admin approves.
         */
        const newCarId = created?._id ?? created?.internal_id;

        /**
         * The mods, as their own documents.
         *
         * Step 5 collected these into `form.mods` and nothing ever sent them —
         * they were dropped on submit, silently. Mods are separate records
         * keyed to the car, so they can only be written once the car has an
         * id, and each carries its own photos.
         */
        if (newCarId && form.mods.length) {
          await Promise.all(
            form.mods
              .filter((m) => m.title.trim())
              .map((m) => {
                const modFd = new FormData();
                modFd.append('car_id', newCarId);
                modFd.append('title', m.title.trim());
                modFd.append('type', m.type);
                if (m.body.trim()) modFd.append('body', m.body.trim());
                (m.images ?? []).forEach((img) => {
                  modFd.append('gallery', uploadFile(img.uri) as any);
                });
                return createMod(modFd).unwrap()
                  .catch((err: unknown) => console.warn('mod create failed', m.title, err));
              }),
          );
        }

        const requested: string[] = [];
        if (newCarId && joinGroups.length) {
          await Promise.all(
            joinGroups.map((g) =>
              joinGroup({ groupId: g.id, car_id: newCarId }).unwrap()
                .then(() => { requested.push(g.title); })
                .catch((err: unknown) => console.warn('join request failed', g.id, err)),
            ),
          );
        }
        // Queued rather than fired now: an alert over a sheet that's still
        // sliding out lands on top of it.
        afterDismiss.current = () =>
          Alert.alert(
            'Car added!',
            requested.length
              // Named, not counted: "2 groups" leaves you wondering which, and
              // these are requests someone may need to chase.
              ? `Your car has been added to your garage.\n\nRequested to join these groups:\n${
                requested.map((t) => `• ${t}`).join('\n')
              }\n\nThey'll be added once an admin approves.`
              : 'Your car has been added to your garage.',
          );
        setVisible(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.data?.error ?? `Failed to ${isEditMode ? 'update' : 'create'} car. Please try again.`);
    }
  };

  return (
    /**
     * A sheet, not a full screen.
     *
     * Presented over what you were doing, so it closes the way every other
     * pane in the app does: drag the grabber down, tap it, or tap the backdrop.
     * The header X is gone — it was a third control for the same job.
     */
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
          title={isEditMode ? 'Edit Garage Car' : 'Create Garage Car'}
          step={step}
          totalSteps={STEP_TITLES.length}
          onBack={() => setStep((s) => s - 1)}
          onNext={() => setStep((s) => s + 1)}
          // Off until this step's required fields are in — see canAdvance.
          canAdvance={canAdvance()}
          onSubmit={handleSubmit}
          submitLabel={isEditMode ? 'Save' : 'Create'}
          submitAccessibilityLabel={isEditMode ? 'Save changes' : 'Create car'}
          submitting={isLoading}
          leading={restored ? (
            /* Start over. Only on step 1, and only when this pane opened onto
               remembered answers — there's no back to go to from here, and a
               form you didn't expect to still be filled in needs a way out. */
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: colors.red }]}
              onPress={clearDraft}
              accessibilityRole="button"
              accessibilityLabel="Start over"
            >
              <Trash2 size={18} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          ) : undefined}
        />
      )}
      fullHeight
    >
      {/* The header carries the pane's name and the bar carries the position,
          so the caption is just what you're filling in. */}
      <StepFormProgress step={step} total={STEP_TITLES.length} caption={STEP_TITLES[step - 1]} />

      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 + keyboardHeight + (Platform.OS === 'android' ? 40 : 20) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── STEP 1: Required ───────────────────────────────────────── */}
          {step === 1 && (
            <View>
              <Field label="Title *" value={form.title} onChange={set('title')} />
              <Field label="Year *" value={form.year} onChange={set('year')} numeric />

              <MakeModelFields
                required
                make={form.make}
                model={form.model}
                onMakeChange={set('make')}
                onModelChange={set('model')}
              />

              <ChipSelect
                items={CAR_TYPES}
                value={form.type}
                onChange={handleTypeChange}
                label="Type *"
                colorFor={(k) => TYPE_COLORS[k] ?? { bg: colors.segment, text: colors.fg }}
              />

              {categories.length > 0 ? (
                <ChipSelect
                  items={categories}
                  value={form.category}
                  onChange={set('category')}
                  label="Category"
                  // Tighter than Type: this follows directly from it, where
                  // Type is what breaks from the text fields above.
                  style={cs.tight}
                  // categoryColor is the same hash the record and post rows use,
                  // so a category keeps one colour across the whole app.
                  colorFor={(k) => ({ bg: categoryColor(k), text: '#000000' })}
                />
              ) : (
                /**
                 * "Other" has no categories to choose from, so it takes one.
                 *
                 * `category` is a free string on the car, and every label
                 * lookup in the app falls back to title-casing the raw value —
                 * so whatever is typed here renders on the card and the detail
                 * page without needing to exist in a list anywhere. The colour
                 * comes from the same hash as the rest, which means a custom
                 * category still gets a consistent one of its own.
                 */
                <View style={styles.customCat}>
                  <Field
                    label="Category"
                    value={form.category}
                    onChange={set('category')}
                    optional
                  />
                  {!!form.category.trim() && (
                    <View style={[styles.customCatChip, { backgroundColor: categoryColor(form.category.trim()) }]}>
                      <Text style={styles.customCatChipText}>{form.category.trim()}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── STEP 2: Photos ─────────────────────────────────────────── */}
          {step === 2 && (
            <View>
              <Text style={[styles.stepSub, { color: colors.grey }]}>Add up to 10 photos. First photo will be the cover image.</Text>

              <PhotoPickerField
                onPress={pickImage}
                title={form.images.length ? 'Add More Photos' : 'Add Photos'}
                compact={form.images.length > 0}
              />

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

          {/* ── STEP 3: Optional specs ─────────────────────────────────── */}
          {step === 3 && (
            <View>
              <Field label="Description" value={form.body} onChange={set('body')} optional multiline />

              {/* Two up. These are all short values — a trim, a colour, a
                  number — and a column of full-width boxes made the step look
                  longer than it is. Description stays full width because prose
                  needs the room, and Condition is a chip row, not an input. */}
              <View style={styles.specGrid}>
                <Field style={styles.specHalf} label="Trim" value={form.trim} onChange={set('trim')} optional />
                <Field style={styles.specHalf} label="Color" value={form.color} onChange={set('color')} optional />
                <Field style={styles.specHalf} label="Engine" value={form.engine} onChange={set('engine')} optional />
                <Field style={styles.specHalf} label="Horsepower" value={form.horsepower} onChange={set('horsepower')} optional numeric />
                <Field style={styles.specHalf} label="Torque (lb-ft)" value={form.torque} onChange={set('torque')} optional numeric />
                <Field style={styles.specHalf} label="Mileage" value={form.mileage} onChange={set('mileage')} optional numeric />
                {/* Full width: 17 characters don't fit in half a form. Stated
                    explicitly — inside a wrapping row a child with no width
                    shrinks to its content rather than filling the line. */}
                <Field style={styles.specFull} label="VIN" value={form.vin} onChange={set('vin')} optional />
              </View>

              <ChipSelect
                items={CONDITIONS}
                value={form.condition}
                onChange={set('condition')}
                label="Condition"
                style={cs.tight}
              />
            </View>
          )}

          {/* ── STEP 4: Groups ─────────────────────────────────────────── */}
          {step === 4 && (
            <View>
              <Text style={[styles.stepSub, { color: colors.grey }]}>Associate this car with one of your groups so it shows up in that group's Cars tab.</Text>
              {userGroups.length === 0 ? (
                <></>
              ) : (
                <View style={cs.chips}>
                  {userGroups.map((g) => {
                    const active = form.group_id === g.internal_id;
                    return (
                      <TouchableOpacity
                        key={g.internal_id}
                        style={[
                          cs.chip, cs.chipPlain,
                          active
                            ? { backgroundColor: brand, borderColor: brand }
                            : { borderColor: colors.border, backgroundColor: colors.card },
                        ]}
                        onPress={() => set('group_id')(active ? '' : g.internal_id)}
                      >
                        <Text style={[cs.chipText, { color: active ? '#000000' : colors.fg }]}>
                          {g.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* ── Groups to join ─────────────────────────────────────
                  Someone adding their first BMW usually isn't in a BMW group
                  yet, and "go find one afterwards" is a step most people never
                  take. These are groups they aren't in, the ones matching this
                  car's make first. Tapping marks them; the requests go out
                  once the car actually exists. */}
              <Text style={[styles.joinHeading, { color: colors.fg }]}>
                {userGroups.length ? 'Join more groups' : 'Find groups for this car'}
              </Text>

              <View style={[styles.joinSearch, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
                <Search size={15} color={colors.grey} />
                <TextInput
                  style={[styles.joinSearchInput, { color: colors.fg }]}
                  value={groupQuery}
                  onChangeText={setGroupQuery}
                  placeholder={form.make ? `Search groups` : 'Search groups'}
                  placeholderTextColor={colors.grey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>

              {joinableLoading ? (
                <Text style={[styles.stepSub, { color: colors.grey }]}>Looking…</Text>
              ) : joinable.length === 0 ? (
                <Text style={[styles.stepSub, { color: colors.grey }]}>
                  {settledGroupQuery
                    ? `No groups matching "${settledGroupQuery}".`
                    : 'No other groups to join right now.'}
                </Text>
              ) : (
                <View style={styles.joinGrid}>
                  {joinable.map((g: any) => {
                    const picked = joinGroups.some((p) => p.id === g.internal_id);
                    return (
                      <TouchableOpacity
                        key={g.internal_id}
                        style={[
                          styles.joinCard,
                          picked
                            ? { borderColor: brand, backgroundColor: brand + '1F' }
                            : { borderColor: colors.border, backgroundColor: colors.card },
                        ]}
                        onPress={() => toggleJoinGroup(g)}
                        activeOpacity={0.8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: picked }}
                      >
                        <View style={[
                          styles.joinCheck,
                          picked
                            ? { backgroundColor: brand, borderColor: brand }
                            : { borderColor: colors.borderDark },
                        ]}>
                          {picked && <Check size={12} color="#000000" strokeWidth={3} />}
                        </View>
                        <Text style={[styles.joinTitle, { color: colors.fg }]} numberOfLines={2}>
                          {g.title}
                        </Text>
                        {!!g.group_make && (
                          <Text style={[styles.joinMake, { color: colors.grey }]} numberOfLines={1}>
                            {[g.group_make, g.group_model].filter(Boolean).join(' ')}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── STEP 5: Mods ───────────────────────────────────────────── */}
          {step === 5 && (
            <View>
              <Text style={[styles.stepSub, { color: colors.grey }]}>Add any mods you want to document. You can always add more later.</Text>

              {form.mods.map((mod, i) => {
                const isExpanded = expandedMods[i] !== false;
                return isExpanded ? (
                  <View key={i} style={[styles.modCard, { backgroundColor: colors.segment, borderColor: colors.borderDark }]}>
                    {/* No "Mod #1": the title field directly below says what
                        this is, and the number was counting rows rather than
                        telling anyone anything. */}
                    <TouchableOpacity
                      style={styles.modClose}
                      onPress={() => removeMod(i)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Remove this modification"
                    >
                      <X size={14} color="#FFFFFF" strokeWidth={2.6} />
                    </TouchableOpacity>
                    <Field
                      label="Title"
                      value={mod.title}
                      onChange={(v) => updateMod(i, 'title', v)}
                      style={styles.modTitleField}
                    />
                    <ChipSelect
                      items={MOD_TYPES}
                      value={mod.type}
                      onChange={(v) => updateMod(i, 'type', v)}
                      label="Category"
                      style={cs.tight}
                    />
                    <Field
                      label="Notes"
                      value={mod.body}
                      onChange={(v) => updateMod(i, 'body', v)}
                      optional
                      multiline
                    />

                    {/* Photos of the mod itself — the part, the install, the
                        before and after. They belong to the mod, not to the
                        car's own gallery. */}
                    <PhotoPickerField
                      onPress={() => pickModImage(i)}
                      title={mod.images?.length ? 'Add More Photos' : 'Add Photos'}
                      hint="Photos of this mod"
                      compact
                      style={styles.modPicker}
                    />
                    {!!mod.images?.length && (
                      <View style={styles.modThumbs}>
                        {mod.images.map((img) => (
                          <View key={img.uri} style={styles.modThumb}>
                            <Image source={{ uri: img.uri }} style={styles.modThumbImg} contentFit="cover" />
                            <TouchableOpacity
                              style={styles.modThumbX}
                              onPress={() => removeModImage(i, img.uri)}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel="Remove photo"
                            >
                              <X size={11} color="#FFFFFF" strokeWidth={2.8} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Folds the card away; it saves nothing. Nothing here is
                        written until the car is created — see handleSubmit,
                        which creates every mod once the car has an id. The old
                        "Save Mod" button did exactly this and claimed
                        otherwise. */}
                    <TouchableOpacity
                      style={styles.collapseMod}
                      onPress={() => collapseMod(i)}
                      activeOpacity={0.6}
                      accessibilityRole="button"
                      accessibilityLabel="Collapse this modification"
                    >
                      <ChevronUp size={14} color={colors.grey} />
                      <Text style={[styles.collapseModText, { color: colors.grey }]}>Collapse</Text>
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
                    {/* Both as dark discs with white glyphs, matching the ✕ on
                        the expanded card — a blue text link beside a red ✕
                        read as two unrelated things. */}
                    <View style={styles.modCollapsedRight}>
                      <TouchableOpacity
                        style={styles.modRowBtn}
                        onPress={() => expandMod(i)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Edit this modification"
                      >
                        <PenSquare size={13} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={styles.modRowBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modRowBtn}
                        onPress={() => removeMod(i)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Remove this modification"
                      >
                        <Trash2 size={13} color="#FFFFFF" strokeWidth={2.4} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.addModBtn, { borderColor: brand }]}
                onPress={addMod}
                activeOpacity={0.8}
              >
                <Plus size={16} color={brand} />
                <Text style={[styles.addModText, { color: brand }]}>Add Modification</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1 },
  scroll:    { paddingHorizontal: 16, paddingBottom: 24 },
  stepSub:   { fontSize: 14, marginBottom: 20, lineHeight: 20 },

  modCard: {
    borderRadius: COMMON_RADIUS, padding: 14,
    marginBottom: 14, borderWidth: 1,
  },
  // Top right, over the card's own padding — a small dark disc rather than a
  // bare red glyph, which read as an error rather than a control.
  modClose: {
    position: 'absolute', top: 8, right: 8, zIndex: 2,
    width: 26, height: 26, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // Clear of the close button, and tight to the Category row that follows it.
  modTitleField: { marginTop: 10, marginBottom: 4 },
  modPicker: { marginTop: 14 },
  modThumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  modThumb: { width: 64, height: 64 },
  modThumbImg: { width: 64, height: 64, borderRadius: 8 },
  modThumbX: {
    position: 'absolute', top: -5, right: -5,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  // Dashed and transparent, like the photo well — both are a place to add
  // something rather than a button that has already done something. Same
  // padding and full width as before; only the fill and the stroke change.
  addModBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: COMMON_RADIUS,
    borderWidth: 1.5, borderStyle: 'dashed',
  },
  addModText: { fontSize: 14, fontWeight: '700' },

  collapseMod: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: 14, paddingVertical: 8,
  },
  collapseModText: { fontSize: 13, fontWeight: '600' },

  modCollapsed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1,
  },
  modCollapsedLeft: { flex: 1, marginRight: 12 },
  modCollapsedTitle: { fontSize: 14, fontWeight: '700' },
  modCollapsedType: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  modCollapsedRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 7,
    borderRadius: COMMON_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modRowBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  photoPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 20, borderRadius: COMMON_RADIUS,
    backgroundColor: colors.primaryAlt,
    marginBottom: 16,
  },
  photoPickerText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  // Clear of the compact 'Add More Photos' bar above them.
  joinHeading: { fontSize: 16, fontWeight: '800', marginTop: 26, marginBottom: 12 },
  joinSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 14,
  },
  joinSearchInput: { flex: 1, fontSize: 15, padding: 0 },
  joinGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  joinCard: {
    width: '48%', marginBottom: 10,
    borderWidth: 1.5, borderRadius: COMMON_RADIUS, padding: 12,
    minHeight: 92,
  },
  joinCheck: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  joinTitle: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  joinMake:  { fontSize: 11, fontWeight: '600', marginTop: 3 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  specHalf: { width: '48%' },
  // Last in the grid, so it carries the gap down to Condition itself.
  specFull: { width: '100%', marginBottom: 10 },
  photoList: { marginTop: 18, marginBottom: 16 },
  photoThumb: {
    width: 100, height: 100, borderRadius: 8, marginRight: 8,
    overflow: 'hidden', position: 'relative',
  },
  photoImg:    { width: '100%', height: '100%' },
  coverBadge:  {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: colors.primaryAlt, borderRadius: PILL_RADIUS, paddingHorizontal: 5, paddingVertical: 2,
  },
  coverText:   { fontSize: 9, fontWeight: '800', color: '#000' },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },

  customCat: { marginTop: 12, marginBottom: 20 },
  // A preview of the badge it will become, so a typed category isn't a leap of
  // faith the way the picked ones aren't.
  customCatChip: {
    alignSelf: 'flex-start', marginTop: 2,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS,
  },
  customCatChipText: { fontSize: 13, fontWeight: '700', color: '#000000' },
  // The "start over" button handed to StepFormNav as its leading slot — sized
  // to match that header's own carets.
  navBtn: {
    width: 34, height: 34, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
});
