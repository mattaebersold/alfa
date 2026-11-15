import React, { useEffect, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import {
  View, StyleSheet, TouchableOpacity, Alert, Image, Modal, ScrollView,
} from 'react-native';
import { Text } from '../../theme/Text';
import FormScrollView from '../../keyboard/FormScrollView';
import { PortalHost } from '../Portal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, X, ChevronDown } from 'lucide-react-native';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { finishOnboarding } from '../../store/authSlice';
import { useCreateCarMutation, useGetCarsQuery } from '../../api/apiService';
import Button from '../ui/Button';
import FormInput from '../ui/FormInput';
import MakeModelFields from '../cars/MakeModelFields';
import GenerationField from '../cars/GenerationField';
import { toUploadableJpeg, uploadFile } from '../../utils/upload';
import { carHeroUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import { APP_BG, COLOR_BORDER, COLOR_WHITE, COLOR_BLACK, COLOR_PRIMARY, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const EMPTY = {
  title: '', year: '', make: '', model: '', generation: '',
  mileage: '', color: '', trim: '', engine: '', horsepower: '', body: '',
};
type CarForm = typeof EMPTY;

/** Optional details, in the accordion. */
const OPTIONAL: { key: keyof CarForm; label: string; numeric?: boolean }[] = [
  { key: 'mileage',    label: 'Mileage', numeric: true },
  { key: 'color',      label: 'Color' },
  { key: 'trim',       label: 'Trim' },
  { key: 'engine',     label: 'Engine' },
  { key: 'horsepower', label: 'Horsepower', numeric: true },
];

/**
 * "Create your first garage car" — over the app, the first time a brand-new
 * account signs in. Shown by RootNavigator while `auth.onboarding` is set;
 * saving the car or "Set up later" clears it.
 */
export default function FirstCarOnboarding() {
  const visible = useAppSelector((s) => s.auth.onboarding);
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [form, setForm] = useState<CarForm>(EMPTY);
  const [photo, setPhoto] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createCar, { isLoading: saving }] = useCreateCarMutation();
  const { data: recent } = useGetCarsQuery({ limit: 8 }, { skip: !visible });

  const set = (key: keyof CarForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const canSave = !!(form.year && form.make && form.model);
  const done = () => dispatch(finishOnboarding());

  const pickPhoto = async () => {
    // The system picker needs no permission — see utils/permissionAlert.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const toggleMore = () => {
    setMoreOpen((o) => !o);
  };

  const save = async () => {
    if (!canSave) {
      Alert.alert('Almost there', 'Add the year, make and model.');
      return;
    }
    const fd = new FormData();
    // A car needs a name; left blank, its year/make/model stands in.
    fd.append('title', form.title.trim() || `${form.year} ${form.make} ${form.model}`);
    fd.append('year', form.year);
    fd.append('make', form.make);
    fd.append('model', form.model);
    fd.append('make_handle', form.make.toLowerCase());
    fd.append('model_handle', form.model.toLowerCase());
    if (form.generation.trim()) fd.append('generation', form.generation.trim());
    // The add-car form's defaults: the first type, and its first category.
    fd.append('type', 'daily');
    fd.append('category', 'groceryGetter');
    for (const { key } of OPTIONAL) if (form[key]) fd.append(key, form[key]);
    if (form.body.trim()) fd.append('body', form.body.trim());
    fd.append('entry_type', 'garagecar');
    try {
      if (photo) {
        // iOS delivers HEIC, which the server can't decode.
        fd.append('gallery', uploadFile(await toUploadableJpeg(photo)));
      }
      await createCar(fd).unwrap();
      setForm(EMPTY);
      setPhoto(null);
      done();
    } catch (err: any) {
      Alert.alert('Couldn\'t save your car', err?.data?.error || 'Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={done}>
      {/* A Modal is its own window, so the app root's PortalHost is beneath it —
          the make/model suggestions were drawn there, behind this pane. With a
          host in here they draw over the form, above the field and clear of
          the keyboard. */}
      <PortalHost>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <FormScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Create your first garage car</Text>

          {/* ── Photo ── */}
          {photo ? (
            <View style={styles.photo}>
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)} accessibilityLabel="Remove photo" hitSlop={8}>
                <X size={16} color={COLOR_WHITE} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoEmpty} onPress={pickPhoto} activeOpacity={0.8}>
              <Camera size={24} color={colors.grey} />
              <Text style={[styles.photoLabel, { color: colors.grey }]}>Add a photo</Text>
            </TouchableOpacity>
          )}

          {/* ── The car ── */}
          {/* Name and year share a line; the year is only as wide as four digits. */}
          <View style={styles.nameRow}>
            <Field style={styles.nameField} label="Name" value={form.title} onChange={set('title')} />
            <Field
              style={styles.yearField}
              label="Year *"
              value={form.year}
              onChange={(v) => set('year')(v.replace(/[^0-9]/g, ''))}
              numeric
              maxLength={4}
            />
          </View>
          <MakeModelFields
            required
            // Side by side, half each; the generation below runs full width.
            columns
            make={form.make}
            model={form.model}
            onMakeChange={set('make')}
            onModelChange={set('model')}
            afterModel={(
              <GenerationField
                make={form.make}
                model={form.model}
                year={form.year}
                value={form.generation}
                onChange={set('generation')}
              />
            )}
          />

          {/* ── Optional details ── */}
          <View style={styles.accordion}>
            <TouchableOpacity style={styles.accordionHead} onPress={toggleMore} activeOpacity={0.7}>
              <Text style={styles.accordionTitle}>
                More details <Text style={{ color: colors.grey, fontFamily: FONT_INTER.regular }}>(optional)</Text>
              </Text>
              <Chevron open={moreOpen} />
            </TouchableOpacity>
            <Collapsible open={moreOpen}>
              <View style={styles.accordionBody}>
                <View style={styles.grid}>
                  {OPTIONAL.map(({ key, label, numeric }) => (
                    <Field key={key} style={styles.half} label={label} value={form[key]} onChange={set(key)} numeric={numeric} />
                  ))}
                </View>
                <Field label="Bio" value={form.body} onChange={set('body')} multiline />
              </View>
            </Collapsible>
          </View>

          {/* The basic membership's blue — every new account is basic, and the
              primary variant's teal read as a different app. */}
          <Button label="Add to my garage" onPress={save} loading={saving} disabled={!canSave} size="full" variant="primary" background={COLOR_PRIMARY} />

          <TouchableOpacity style={styles.later} onPress={done} hitSlop={8}>
            <Text style={[styles.laterText, { color: colors.grey }]}>Set up later</Text>
          </TouchableOpacity>

          {/* ── Recently added — for company, not links: this step is the
              only thing between a new member and the app. ── */}
          {recent?.entries?.length ? (
            <View style={styles.recent}>
              <Text style={[styles.recentLabel, { color: colors.grey }]}>Recently added by members</Text>
              {/* Out past the page's padding, so the row runs to the screen's edges. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.recentScroll}
                contentContainerStyle={styles.recentRow}
              >
                {recent.entries.map((car) => {
                  const ymm = [car.year, car.make, car.model].filter(Boolean).join(' ');
                  const uri = carHeroUrl(car, 'small');
                  return (
                    <View key={car.internal_id} style={styles.recentCard}>
                      <View style={styles.recentImage}>
                        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} /> : null}
                      </View>
                      <Text style={styles.recentTitle} numberOfLines={1}>{car.title || ymm}</Text>
                      {car.title && ymm ? (
                        <Text style={[styles.recentSub, { color: colors.grey }]} numberOfLines={1}>{ymm}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </FormScrollView>
      </View>
      </PortalHost>
    </Modal>
  );
}

const EXPAND = { duration: 240, easing: Easing.out(Easing.cubic) };

/**
 * Opens to its content's height and back, animated.
 *
 * LayoutAnimation did this before and doesn't run reliably under the new
 * architecture (and not at all in a Modal on some builds), so the panel just
 * appeared. The content is laid out once at full height out of the flow,
 * measured, and the visible box animates between 0 and that.
 */
function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => { progress.value = withTiming(open ? 1 : 0, EXPAND); }, [open, progress]);
  const style = useAnimatedStyle(() => ({ height: height * progress.value, opacity: progress.value }));
  return (
    <Animated.View style={[styles.collapsible, style]} pointerEvents={open ? 'auto' : 'none'}>
      <View style={styles.collapsibleInner} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

/** The accordion's chevron, turning with it. */
function Chevron({ open }: { open: boolean }) {
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => { turn.value = withTiming(open ? 1 : 0, EXPAND); }, [open, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <ChevronDown size={16} color={COLOR_WHITE} />
    </Animated.View>
  );
}

function Field({ label, value, onChange, numeric, multiline, maxLength, style }: {
  label: string; value: string; onChange: (v: string) => void;
  numeric?: boolean; multiline?: boolean; maxLength?: number; style?: any;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <FormInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'number-pad' : 'default'}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_BG },
  content: { paddingHorizontal: 20, paddingTop: 24 },
  title: { fontSize: 22, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, marginBottom: 20 },

  photo: { aspectRatio: 16 / 10, borderRadius: 20, overflow: 'hidden', marginBottom: 20, backgroundColor: COLOR_BLACK },
  // Shorter than the photo it becomes — a target, not a preview.
  photoEmpty: {
    width: '100%', height: 110, borderRadius: 20, marginBottom: 20,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderStyle: 'dashed', borderColor: COLOR_BORDER,
  },
  photoLabel: { fontSize: 14, fontFamily: FONT_INTER.semibold },
  photoRemove: {
    position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLOR_BLACK, alignItems: 'center', justifyContent: 'center',
  },

  field: { marginBottom: 12 },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameField: { flex: 1 },
  yearField: { width: 76 },
  label: { fontSize: 12, fontFamily: FONT_INTER.semibold, marginBottom: 4, color: COLOR_WHITE },

  // Not a box: the heading and its fields sit on the page like the fields above.
  accordion: { marginTop: 16, marginBottom: 20 },
  accordionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  accordionTitle: { fontSize: 14, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },
  accordionBody: { paddingTop: 4, paddingBottom: 6 },
  collapsible: { overflow: 'hidden' },
  // Out of the flow, so it's measured at full height whatever the box is now.
  collapsibleInner: { position: 'absolute', left: 0, right: 0, top: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  half: { width: '48%' },

  later: { alignSelf: 'center', marginTop: 16, paddingVertical: 6 },
  laterText: { fontSize: 14, fontFamily: FONT_INTER.semibold },

  recent: { marginTop: 36 },
  recentLabel: { fontSize: 13, fontFamily: FONT_INTER.semibold, marginBottom: 10 },
  // Cancels the page's 20px padding; the row puts it back inside the scroll.
  recentScroll: { marginHorizontal: -20 },
  recentRow: { gap: 10, paddingHorizontal: 20 },
  recentCard: { width: 132 },
  recentImage: { aspectRatio: 4 / 3, borderRadius: 12, overflow: 'hidden', backgroundColor: SURFACE_MID },
  recentTitle: { marginTop: 6, fontSize: 12, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  recentSub: { fontSize: 11 },
});
