import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';
import {
  useCreateSocietyEventMutation,
  useUpdateSocietyEventMutation,
  useGetSocietyEventQuery,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { EVENT_CATEGORIES, toDayKey } from '../../constants/eventTypes';
import { uploadFile } from '../../utils/upload';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { ss } from '../../styles/shared';

const FREQUENCIES = [
  { key: 'single',   label: 'Single Day' },
  { key: 'weekly',   label: 'Every Week' },
  { key: 'biweekly', label: 'Every Other Week' },
  { key: 'monthly',  label: 'Monthly' },
  { key: 'annually', label: 'Annually' },
];

const WEEKDAYS = [
  { key: 0, short: 'Sun' }, { key: 1, short: 'Mon' }, { key: 2, short: 'Tue' },
  { key: 3, short: 'Wed' }, { key: 4, short: 'Thu' }, { key: 5, short: 'Fri' },
  { key: 6, short: 'Sat' },
];

const ORDINALS = [
  { key: 1, label: 'First' }, { key: 2, label: 'Second' }, { key: 3, label: 'Third' },
  { key: 4, label: 'Fourth' }, { key: -1, label: 'Last' },
];

/** Toggle pill, shared by categories, frequency, weekdays and ordinals. */
function Pill({ active, label, color, onPress }: { active: boolean; label: string; color?: string; onPress: () => void }) {
  const colors = useColors();
  const brand = useBrandColor();
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        { borderColor: colors.border, backgroundColor: colors.card },
        active && { backgroundColor: color ?? brand, borderColor: color ?? brand },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.pillText, { color: active ? '#000000' : colors.fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Two plain HH:MM fields. A native time picker is heavier than this needs to
 * be — the value is stored as a wall-clock string either way.
 */
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const colors = useColors();

  // Digits only, auto-inserting the colon so "830" becomes "8:30".
  const handle = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 4);
    if (digits.length <= 2) return onChange(digits);
    onChange(`${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`);
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.fieldLabel, { color: colors.grey }]}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
        value={value}
        onChangeText={handle}
        placeholder="18:30"
        placeholderTextColor={colors.grey}
        keyboardType="number-pad"
        maxLength={5}
      />
    </View>
  );
}

/**
 * Create or edit a society event. Open to any member; editing is reached from
 * the owner menu on the detail, which passes the event's id.
 */
export default function SocietyEventCreateScreen() {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation();
  const route = useRoute<any>();
  const editingId: string | undefined = route.params?.eventId;
  const insets = useSafeAreaInsets();
  const [createEvent, { isLoading: creating }] = useCreateSocietyEventMutation();
  const [updateEvent, { isLoading: updating }] = useUpdateSocietyEventMutation();
  const { data: existing } = useGetSocietyEventQuery(editingId ?? '', { skip: !editingId });
  const { openEventSheet } = useEventSheet();
  const isLoading = creating || updating;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('cars-and-coffee');
  const [frequency, setFrequency] = useState('single');
  const [date, setDate] = useState('');            // YYYY-MM-DD
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [ordinals, setOrdinals] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState<string | null>(null);

  // Prefill when editing.
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title ?? '');
    setBody(existing.body ?? '');
    setCategory(existing.category ?? 'cars-and-coffee');
    setFrequency(existing.frequency ?? 'single');
    setDate(existing.date ? toDayKey(existing.date) : '');
    setWeekdays(existing.weekdays ?? []);
    setOrdinals(existing.week_ordinals ?? []);
    setStartTime(existing.start_time ?? '');
    setEndTime(existing.end_time ?? '');
    setLocation(existing.location ?? '');
  }, [existing]);

  const needsDate = frequency === 'single' || frequency === 'annually';
  const needsWeekdays = frequency === 'weekly' || frequency === 'biweekly' || frequency === 'monthly';
  const needsOrdinals = frequency === 'monthly';

  const toggle = (list: number[], setList: (v: number[]) => void, value: number) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Give the event a title.');
    if (needsDate && !date) return Alert.alert('Required', 'Pick a date for this event.');
    if (needsWeekdays && weekdays.length === 0) {
      return Alert.alert('Required', 'Pick at least one day of the week.');
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    if (body.trim()) fd.append('body', body.trim());
    fd.append('category', category);
    fd.append('frequency', frequency);
    if (needsDate) fd.append('date', date);
    if (needsWeekdays) fd.append('weekdays', JSON.stringify(weekdays));
    if (needsOrdinals && ordinals.length) fd.append('week_ordinals', JSON.stringify(ordinals));
    if (startTime) fd.append('start_time', startTime);
    if (endTime) fd.append('end_time', endTime);
    if (location.trim()) fd.append('location', location.trim());
    if (image) fd.append('gallery', uploadFile(image) as any);
    if (editingId) fd.append('internal_id', editingId);

    try {
      const saved = editingId
        ? await updateEvent(fd).unwrap()
        : await createEvent(fd).unwrap();
      // Dismiss this modal first — iOS won't present the sheet until the
      // create modal has finished going away.
      nav.goBack();
      const openDetail = () => openEventSheet({ eventId: saved.internal_id ?? editingId! });
      if (Platform.OS === 'ios') setTimeout(openDetail, 350);
      else openDetail();
    } catch {
      Alert.alert('Error', `Could not ${editingId ? 'save' : 'create'} this event. Please try again.`);
    }
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.fieldLabel, { color: colors.grey }]}>Title *</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Saturday morning cars & coffee"
          placeholderTextColor={colors.grey}
        />

        <Text style={[styles.fieldLabel, { color: colors.grey }]}>Category</Text>
        <View style={styles.pillRow}>
          {EVENT_CATEGORIES.map((c) => (
            <Pill
              key={c.key}
              label={c.label}
              color={c.color}
              active={category === c.key}
              onPress={() => setCategory(c.key)}
            />
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.grey }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
          value={body}
          onChangeText={setBody}
          placeholder="What happens, who it's for, what to bring..."
          placeholderTextColor={colors.grey}
          multiline
        />

        {/* ── Schedule ─────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.fg }]}>When</Text>

        <Text style={[styles.fieldLabel, { color: colors.grey }]}>How often</Text>
        <View style={styles.pillRow}>
          {FREQUENCIES.map((f) => (
            <Pill key={f.key} label={f.label} active={frequency === f.key} onPress={() => setFrequency(f.key)} />
          ))}
        </View>

        {needsDate && (
          <>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>
              {frequency === 'annually' ? 'First date (repeats yearly)' : 'Date'}
            </Text>
            <TextInput
              style={[styles.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
              value={date}
              onChangeText={(raw) => {
                // Digits only, auto-formatted as YYYY-MM-DD while typing.
                const d = raw.replace(/[^0-9]/g, '').slice(0, 8);
                const parts = [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean);
                setDate(parts.join('-'));
              }}
              placeholder="2026-10-17"
              placeholderTextColor={colors.grey}
              keyboardType="number-pad"
              maxLength={10}
            />
          </>
        )}

        {needsWeekdays && (
          <>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>Which day(s)</Text>
            <View style={styles.pillRow}>
              {WEEKDAYS.map((d) => (
                <Pill
                  key={d.key}
                  label={d.short}
                  active={weekdays.includes(d.key)}
                  onPress={() => toggle(weekdays, setWeekdays, d.key)}
                />
              ))}
            </View>
          </>
        )}

        {needsOrdinals && (
          <>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>
              Which week(s) — leave empty for every one
            </Text>
            <View style={styles.pillRow}>
              {ORDINALS.map((o) => (
                <Pill
                  key={o.key}
                  label={o.label}
                  active={ordinals.includes(o.key)}
                  onPress={() => toggle(ordinals, setOrdinals, o.key)}
                />
              ))}
            </View>
          </>
        )}

        <View style={styles.timeRow}>
          <TimeField label="Start time" value={startTime} onChange={setStartTime} />
          <TimeField label="End time" value={endTime} onChange={setEndTime} />
        </View>

        {/* ── Place ────────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.fg }]}>Where</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
          value={location}
          onChangeText={setLocation}
          placeholder="Cafe name, address, or meeting point"
          placeholderTextColor={colors.grey}
        />

        {/* ── Image ────────────────────────────────────────────────────────── */}
        <Text style={[styles.fieldLabel, { color: colors.grey }]}>Image</Text>
        {image ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
            <TouchableOpacity style={styles.imageRemove} onPress={() => setImage(null)} hitSlop={6}>
              <X size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            <ImagePlus size={20} color={colors.grey} />
            <Text style={[styles.imagePickerText, { color: colors.grey }]}>Add a photo</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.submit, { backgroundColor: brand, opacity: isLoading ? 0.6 : 1 }]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading
            ? <ActivityIndicator size="small" color="#000000" />
            : <Text style={styles.submitText}>{editingId ? 'Save Changes' : 'Create Event'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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

  sectionTitle: { fontSize: 19, fontWeight: '800', marginTop: 28 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  pillText:{ fontSize: 13, fontWeight: '700' },

  timeRow: { flexDirection: 'row', gap: 12 },

  imageWrap:   { position: 'relative', marginTop: 4 },
  image:       { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  imageRemove: {
    position: 'absolute', top: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  imagePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 92, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
  },
  imagePickerText: { fontSize: 14, fontWeight: '600' },

  submit: {
    height: 52, borderRadius: 12, marginTop: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#000000' },
});
