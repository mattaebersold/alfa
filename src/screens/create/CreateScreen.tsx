import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ImagePlus, X, ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import { useCreatePostMutation, useGetUserGarageQuery, useGetUserGroupsQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

// ── Post types (matching Murray) ─────────────────────────────────────────────

type PostType = 'general' | 'record' | 'listing' | 'want' | 'spot';

const POST_TYPES: { type: PostType; label: string; color: string }[] = [
  { type: 'general',  label: 'General',    color: Colors.brg },
  { type: 'record',   label: 'Car Record', color: Colors.teal },
  { type: 'listing',  label: 'Listing',    color: '#00C851' },
  { type: 'want',     label: 'Want Ad',    color: '#F1184C' },
  { type: 'spot',     label: 'Spotted',    color: Colors.tangerine },
];

const CATEGORIES: Record<PostType, { key: string; label: string }[]> = {
  general: [
    { key: 'show',  label: 'Show' },
    { key: 'misc',  label: 'Misc.' },
  ],
  record: [
    { key: 'general',      label: 'General' },
    { key: 'mod',          label: 'Mod' },
    { key: 'restoration',  label: 'Restoration' },
    { key: 'maintenance',  label: 'Maintenance' },
    { key: 'detailing',    label: 'Detailing' },
  ],
  listing: [
    { key: 'new',         label: 'New Part' },
    { key: 'used',        label: 'Used Part' },
    { key: 'car',         label: 'Car' },
    { key: 'accessories', label: 'Accessories' },
    { key: 'other',       label: 'Other' },
  ],
  want: [
    { key: 'part',  label: 'Part' },
    { key: 'car',   label: 'Car' },
    { key: 'other', label: 'Other' },
  ],
  spot: [
    { key: 'show',    label: 'Show' },
    { key: 'museum',  label: 'Museum' },
    { key: 'wild',    label: 'In the wild' },
  ],
};

// ── Small collapsible section ─────────────────────────────────────────────────

function Section({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const colors = useColors();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
      <TouchableOpacity
        style={[styles.sectionHeader, { backgroundColor: colors.card }]}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
      >
        <Text style={[styles.sectionLabel, { color: colors.fg }]}>{label}</Text>
        {open ? <ChevronUp size={16} color={colors.grey} /> : <ChevronDown size={16} color={colors.grey} />}
      </TouchableOpacity>
      {open && <View style={{ backgroundColor: colors.card }}>{children}</View>}
    </View>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.grey }]}>{label}</Text>
      <View style={styles.fieldValue}>{children}</View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const appNav = useNavigation<AppNav>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  // Core
  const [postType, setPostType]       = useState<PostType>('general');
  const [category, setCategory]       = useState('');
  const [title, setTitle]             = useState('');
  const [body, setBody]               = useState('');
  const [images, setImages]           = useState<{ uri: string; name: string; type: string }[]>([]);

  // Optional
  const [year, setYear]               = useState('');
  const [make, setMake]               = useState('');
  const [model, setModel]             = useState('');
  const [trim, setTrim]               = useState('');
  const [price, setPrice]             = useState('');
  const [mileage, setMileage]         = useState('');
  const [condition, setCondition]     = useState('');
  const [vin, setVin]                 = useState('');
  const [partNumber, setPartNumber]   = useState('');

  // Associations
  const [selectedCarId, setSelectedCarId]   = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const [createPost, { isLoading: submitting }] = useCreatePostMutation();
  const { data: garageData } = useGetUserGarageQuery();
  const { data: userGroups = [] } = useGetUserGroupsQuery(userInfo?.user_id ?? '', {
    skip: !userInfo?.user_id,
  });

  const garageCars = garageData ?? [];

  const currentCategories = CATEGORIES[postType];
  const displayName = userInfo
    ? `${userInfo.firstName} ${userInfo.lastName}`.trim() || userInfo.username
    : '';

  const showPrice    = postType === 'listing' || postType === 'want';
  const showMileage  = postType === 'listing' || postType === 'record';
  const showCarField = postType !== 'general';

  // Reset category when type changes
  const handleTypeChange = (t: PostType) => {
    setPostType(t);
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
      setImages((prev) => [...prev, ...picked].slice(0, 8));
    }
  }, []);

  const removeImage = useCallback((idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    if (!title.trim() && !body.trim() && images.length === 0) {
      Alert.alert('Content required', 'Please add a title, body, or photo.');
      return;
    }

    const fd = new FormData();
    fd.append('type', postType);
    fd.append('entry_type', postType);
    if (category)        fd.append('category', category);
    if (title.trim())    fd.append('title', title.trim());
    if (body.trim())     fd.append('body', body.trim());
    if (year.trim())     fd.append('year', year.trim());
    if (make.trim())     fd.append('make', make.trim());
    if (model.trim())    fd.append('model', model.trim());
    if (trim.trim())     fd.append('trim', trim.trim());
    if (price.trim())    fd.append('price', price.trim());
    if (mileage.trim())  fd.append('mileage', mileage.trim());
    if (condition.trim()) fd.append('condition', condition.trim());
    if (vin.trim())      fd.append('vin', vin.trim());
    if (partNumber.trim()) fd.append('part_number', partNumber.trim());
    if (selectedCarId)   fd.append('car_id', selectedCarId);
    if (selectedGroupId) fd.append('group_id', selectedGroupId);

    images.forEach((img) => {
      fd.append('gallery', {
        uri: Platform.OS === 'ios' ? img.uri.replace('file://', '') : img.uri,
        name: img.name,
        type: img.type,
      } as any);
    });

    try {
      await createPost(fd).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      appNav.goBack();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Could not create post. Please try again.');
    }
  }, [postType, category, title, body, year, make, model, trim, price, mileage, condition, vin, partNumber, selectedCarId, selectedGroupId, images, createPost, appNav]);

  const inputStyle = [styles.input, { color: colors.fg, borderBottomColor: colors.border }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>

      {/* ── Scrollable form ── */}
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Type selector */}
        <View style={[styles.typeRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {POST_TYPES.map(({ type, label, color }) => {
            const active = postType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeBtn,
                  { borderColor: active ? color : colors.border },
                  active && { backgroundColor: color },
                ]}
                onPress={() => handleTypeChange(type)}
              >
                <Text style={[styles.typeLabel, { color: active ? '#FFFFFF' : colors.grey }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category chips */}
        {currentCategories.length > 0 && (
          <View style={[styles.catRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {currentCategories.map(({ key, label }) => {
              const active = category === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.catChip,
                    { borderColor: active ? Colors.brg : colors.border },
                    active && { backgroundColor: Colors.brg },
                  ]}
                  onPress={() => setCategory(active ? '' : key)}
                >
                  <Text style={[styles.catLabel, { color: active ? '#FFFFFF' : colors.grey }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Author */}
        <View style={[styles.authorRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Avatar
            filename={userInfo?.gallery?.[0]?.filename ?? userInfo?.profilePicture}
            name={displayName}
            size={38}
          />
          <Text style={[styles.authorName, { color: colors.fg }]}>{displayName}</Text>
        </View>

        {/* Title */}
        <TextInput
          style={[styles.titleInput, { backgroundColor: colors.card, color: colors.fg, borderBottomColor: colors.border }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Title..."
          placeholderTextColor={colors.grey}
          returnKeyType="next"
        />

        {/* Body */}
        <TextInput
          style={[styles.bodyInput, { backgroundColor: colors.card, color: colors.fg, borderBottomColor: colors.border }]}
          value={body}
          onChangeText={setBody}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.grey}
          multiline
          textAlignVertical="top"
        />

        {/* Photos */}
        <View style={[styles.photosSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
            <ImagePlus size={18} color={Colors.brg} />
            <Text style={[styles.addPhotoText, { color: Colors.brg }]}>Add Photos</Text>
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

        {/* ── Optional fields ── */}
        <Section label="Optional Fields">
          <FieldRow label="Year">
            <TextInput style={inputStyle} value={year} onChangeText={setYear} placeholder="e.g. 2003" placeholderTextColor={colors.grey} keyboardType="numeric" />
          </FieldRow>
          <FieldRow label="Make">
            <TextInput style={inputStyle} value={make} onChangeText={setMake} placeholder="e.g. Porsche" placeholderTextColor={colors.grey} />
          </FieldRow>
          <FieldRow label="Model">
            <TextInput style={inputStyle} value={model} onChangeText={setModel} placeholder="e.g. 911" placeholderTextColor={colors.grey} />
          </FieldRow>
          <FieldRow label="Trim">
            <TextInput style={inputStyle} value={trim} onChangeText={setTrim} placeholder="e.g. Carrera S" placeholderTextColor={colors.grey} />
          </FieldRow>
          {showPrice && (
            <FieldRow label="Price ($)">
              <TextInput style={inputStyle} value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor={colors.grey} keyboardType="numeric" />
            </FieldRow>
          )}
          {showMileage && (
            <FieldRow label="Mileage">
              <TextInput style={inputStyle} value={mileage} onChangeText={setMileage} placeholder="0" placeholderTextColor={colors.grey} keyboardType="numeric" />
            </FieldRow>
          )}
          <FieldRow label="Condition">
            <TextInput style={inputStyle} value={condition} onChangeText={setCondition} placeholder="e.g. Excellent" placeholderTextColor={colors.grey} />
          </FieldRow>
          <FieldRow label="VIN">
            <TextInput style={inputStyle} value={vin} onChangeText={setVin} placeholder="Vehicle ID" placeholderTextColor={colors.grey} autoCapitalize="characters" />
          </FieldRow>
          <FieldRow label="Part #">
            <TextInput style={inputStyle} value={partNumber} onChangeText={setPartNumber} placeholder="Part number" placeholderTextColor={colors.grey} />
          </FieldRow>
        </Section>

        {/* ── Tag a car ── */}
        {garageCars.length > 0 && (
          <Section label="Tag a Car">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {garageCars.map((car) => {
                const active = selectedCarId === car.internal_id;
                return (
                  <TouchableOpacity
                    key={car.internal_id}
                    style={[styles.assocChip, { borderColor: active ? Colors.brg : colors.border }, active && { backgroundColor: Colors.brg }]}
                    onPress={() => setSelectedCarId(active ? '' : car.internal_id)}
                  >
                    {active && <Check size={12} color="#FFFFFF" />}
                    <Text style={[styles.assocChipText, { color: active ? '#FFFFFF' : colors.fg }]} numberOfLines={1}>
                      {[car.year, car.make, car.model].filter(Boolean).join(' ') || car.title || 'Car'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Section>
        )}

        {/* ── Post to group ── */}
        {userGroups.length > 0 && (
          <Section label="Post to Group">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {userGroups.map((group: any) => {
                const gid = group.internal_id;
                const active = selectedGroupId === gid;
                return (
                  <TouchableOpacity
                    key={gid}
                    style={[styles.assocChip, { borderColor: active ? Colors.brg : colors.border }, active && { backgroundColor: Colors.brg }]}
                    onPress={() => setSelectedGroupId(active ? '' : gid)}
                  >
                    {active && <Check size={12} color="#FFFFFF" />}
                    <Text style={[styles.assocChipText, { color: active ? '#FFFFFF' : colors.fg }]} numberOfLines={1}>
                      {group.title ?? 'Group'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Section>
        )}
      </ScrollView>

      {/* ── Fixed Post button — always above keyboard ── */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  scroll:       { flex: 1 },

  // Type selector
  typeRow:      {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    padding: 12, borderBottomWidth: 1,
  },
  typeBtn:      {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  typeLabel:    { fontSize: 12, fontWeight: '700' },

  // Category chips
  catRow:       {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  catChip:      {
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  catLabel:     { fontSize: 12, fontWeight: '600' },

  // Author
  authorRow:    {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  authorName:   { fontSize: 14, fontWeight: '700' },

  // Title / body
  titleInput:   {
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 17, fontWeight: '700',
    borderBottomWidth: 1,
  },
  bodyInput:    {
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, minHeight: 100, lineHeight: 22,
    borderBottomWidth: 1,
  },

  // Photos
  photosSection:{ borderBottomWidth: 1, paddingBottom: 10 },
  addPhotoBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  addPhotoText: { fontSize: 14, fontWeight: '600' },
  thumbRow:     { paddingHorizontal: 14 },
  thumbWrap:    { marginRight: 8, position: 'relative' },
  thumb:        { width: 72, height: 72, borderRadius: 8 },
  thumbRemove:  {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },

  // Sections
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  sectionLabel: { fontSize: 14, fontWeight: '700' },
  fieldRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  fieldLabel:   { fontSize: 13, fontWeight: '600', width: 90 },
  fieldValue:   { flex: 1 },
  input:        { flex: 1, fontSize: 14, paddingVertical: 11 },

  // Association chips
  chipScroll:   { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  assocChip:    {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    maxWidth: 200,
  },
  assocChipText:{ fontSize: 13, fontWeight: '600', flexShrink: 1 },

  // Footer
  footer:       {
    borderTopWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  submitBtn:    {
    backgroundColor: Colors.brg, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:   { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
