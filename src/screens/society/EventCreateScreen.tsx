import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '../../utils/upload';
import { ImagePlus, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCreateEventMutation } from '../../api/apiService';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

const EVENT_TYPES = [
  { key: 'meetup', label: 'Meetup' },
  { key: 'drive', label: 'Drive' },
  { key: 'other', label: 'Other' },
];

const EVENT_CATEGORIES: Record<string, { key: string; label: string }[]> = {
  meetup: [
    { key: 'carsandcoffee', label: 'Cars & Coffee' },
    { key: 'popup', label: 'Popup' },
    { key: 'show', label: 'Show' },
  ],
  drive: [],
  other: [
    { key: 'fundraiser', label: 'Fundraiser' },
    { key: 'nonprofit', label: 'Non-Profit' },
    { key: 'tech', label: 'Tech Session' },
    { key: 'other', label: 'Other' },
  ],
};

function SectionLabel({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionLabel, { color: colors.grey }]}>{text}</Text>;
}

export default function EventCreateScreen() {
  const nav = useNavigation<AppNav>();
  const colors = useColors();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('meetup');
  const [category, setCategory] = useState('');
  const [images, setImages] = useState<{ uri: string; name: string; type: string }[]>([]);

  const [createEvent, { isLoading }] = useCreateEventMutation();

  const currentCategories = EVENT_CATEGORIES[type] ?? [];

  const handleTypeChange = (t: string) => {
    setType(t);
    setCategory('');
  };

  const pickImage = useCallback(async () => {
    Keyboard.dismiss();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      const picked = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `photo_${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      }));
      setImages((prev) => [...prev, ...picked].slice(0, 10));
    }
  }, []);

  const removeImage = useCallback((idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert('Title required', 'Please add a title for the event.');
      return;
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('type', type);
    if (category) fd.append('category', category);
    if (body.trim()) fd.append('body', body.trim());
    if (eventDate.trim()) fd.append('event_date', eventDate.trim());
    if (eventTime.trim()) fd.append('event_time', eventTime.trim());
    if (location.trim()) fd.append('location', location.trim());

    images.forEach((img) => {
      fd.append('gallery', uploadFile(img.uri));
    });

    try {
      await createEvent(fd).unwrap();
      nav.goBack();
    } catch {
      Alert.alert('Error', 'Could not create event. Please try again.');
    }
  }, [title, type, category, body, eventDate, eventTime, location, images, createEvent, nav]);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Type chips */}
        <View style={[styles.chipRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {EVENT_TYPES.map(({ key, label }) => {
            const active = type === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.typeBtn, { borderColor: active ? colors.primaryAlt : colors.border }, active && { backgroundColor: colors.primaryAlt }]}
                onPress={() => handleTypeChange(key)}
              >
                <Text style={[styles.typeBtnText, { color: active ? '#FFFFFF' : colors.grey }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category chips */}
        {currentCategories.length > 0 && (
          <View style={[styles.chipRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {currentCategories.map(({ key, label }) => {
              const active = category === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.catChip, { borderColor: active ? colors.primaryAlt : colors.border }, active && { backgroundColor: colors.primaryAlt }]}
                  onPress={() => setCategory(active ? '' : key)}
                >
                  <Text style={[styles.catChipText, { color: active ? '#FFFFFF' : colors.grey }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Title */}
        <TextInput
          style={[styles.titleInput, { backgroundColor: colors.card, color: colors.fg, borderBottomColor: colors.border }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Event title *"
          placeholderTextColor={colors.grey}
          returnKeyType="next"
        />

        {/* Description */}
        <TextInput
          style={[styles.bodyInput, { backgroundColor: colors.card, color: colors.fg, borderBottomColor: colors.border }]}
          value={body}
          onChangeText={setBody}
          placeholder="Describe the event..."
          placeholderTextColor={colors.grey}
          multiline
          textAlignVertical="top"
        />

        {/* Date & Time */}
        <View style={[styles.fieldSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <SectionLabel text="DATE & TIME" />
          <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>Date</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.fg }]}
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.grey}
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.grey }]}>Time</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.fg }]}
              value={eventTime}
              onChangeText={setEventTime}
              placeholder="e.g. 10:00 AM"
              placeholderTextColor={colors.grey}
            />
          </View>
        </View>

        {/* Location */}
        <View style={[styles.fieldSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <SectionLabel text="LOCATION" />
          <TextInput
            style={[styles.locationInput, { color: colors.fg }]}
            value={location}
            onChangeText={setLocation}
            placeholder="Address or venue name"
            placeholderTextColor={colors.grey}
          />
        </View>

        {/* Photos */}
        <View style={[styles.photosSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
            <ImagePlus size={18} color={colors.primaryAlt} />
            <Text style={[styles.addPhotoText, { color: colors.primaryAlt }]}>Add Photos</Text>
          </TouchableOpacity>
          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
              {images.map((img, idx) => (
                <View key={idx} style={styles.thumbWrap}>
                  <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => removeImage(idx)}>
                    <X size={11} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Submit */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.submitText}>Create Event</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },

  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    padding: 12, borderBottomWidth: 1,
  },
  typeBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  typeBtnText: { fontSize: 12, fontWeight: '700' },
  catChip: {
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  catChipText: { fontSize: 12, fontWeight: '600' },

  titleInput: {
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 17, fontWeight: '700', borderBottomWidth: 1,
  },
  bodyInput: {
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, minHeight: 100, lineHeight: 22, borderBottomWidth: 1,
  },

  fieldSection: { borderBottomWidth: 1, paddingBottom: 4 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel:  { fontSize: 13, fontWeight: '600', width: 60 },
  fieldInput:  { flex: 1, fontSize: 14, paddingVertical: 11 },
  locationInput: {
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
  },

  photosSection: { borderBottomWidth: 1, paddingBottom: 10 },
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  addPhotoText: { fontSize: 14, fontWeight: '600' },
  thumbRow:  { paddingHorizontal: 14 },
  thumbWrap: { marginRight: 8 },
  thumb:     { width: 72, height: 72, borderRadius: 8 },
  thumbRemove: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },

  footer: {
    borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
  },
  submitBtn: {
    backgroundColor: colors.primaryAlt, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
