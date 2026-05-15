import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { ImagePlus, X, ChevronDown, ChevronUp, Check, Search, User, Car as CarIcon, Flag } from 'lucide-react-native';
import {
  useCreatePostMutation, useGetUserGarageQuery, useGetUserGroupsQuery,
  useSearchQuery, useGetPreviouslyTaggedUsersQuery, useGetPreviouslyTaggedCarsQuery,
  useGetPreviouslyTaggedEventsQuery, useSyncPostTagsMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

// ── Post types ────────────────────────────────────────────────────────────────

type PostType = 'general' | 'record' | 'listing' | 'want' | 'spot';

const POST_TYPES: { type: PostType; label: string; color: string }[] = [
  { type: 'general',  label: 'General',    color: colors.primaryAlt },
  { type: 'record',   label: 'Car Record', color: colors.teal },
  { type: 'listing',  label: 'Listing',    color: '#00C851' },
  { type: 'want',     label: 'Want Ad',    color: '#F1184C' },
  { type: 'spot',     label: 'Spotted',    color: colors.tangerine },
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

// ── Tag types ─────────────────────────────────────────────────────────────────

type TagKind = 'user' | 'car' | 'event';
interface TagItem { id: string; label: string; kind: TagKind }

// ── Section ───────────────────────────────────────────────────────────────────

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

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.grey }]}>{label}</Text>
      <View style={styles.fieldValue}>{children}</View>
    </View>
  );
}

// ── TagChip ───────────────────────────────────────────────────────────────────

function TagChip({ tag, onRemove }: { tag: TagItem; onRemove: () => void }) {
  const colors = useColors();
  const kindColor = tag.kind === 'user' ? colors.primaryAlt : tag.kind === 'car' ? colors.teal : colors.tangerine;
  return (
    <View style={[styles.tagChip, { backgroundColor: kindColor + '22', borderColor: kindColor + '55' }]}>
      <Text style={[styles.tagChipText, { color: kindColor }]} numberOfLines={1}>{tag.label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={6}>
        <X size={12} color={kindColor} />
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const appNav = useNavigation<AppNav>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  // Core
  const [postType, setPostType]   = useState<PostType>('general');
  const [category, setCategory]   = useState('');
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [images, setImages]       = useState<{ uri: string; name: string; type: string }[]>([]);

  // Optional fields
  const [year, setYear]           = useState('');
  const [make, setMake]           = useState('');
  const [model, setModel]         = useState('');
  const [trim, setTrim]           = useState('');
  const [price, setPrice]         = useState('');
  const [mileage, setMileage]     = useState('');
  const [condition, setCondition] = useState('');
  const [vin, setVin]             = useState('');
  const [partNumber, setPartNumber] = useState('');

  // Car association (garage car → car_id on post)
  const [selectedCarId, setSelectedCarId] = useState('');

  // Groups
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [alsoPublic, setAlsoPublic]             = useState(false);

  // Tags (people, cars, events)
  const [taggedUsers, setTaggedUsers]   = useState<TagItem[]>([]);
  const [taggedCars, setTaggedCars]     = useState<TagItem[]>([]);
  const [taggedEvents, setTaggedEvents] = useState<TagItem[]>([]);
  const [tagSearch, setTagSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(tagSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [tagSearch]);

  const [createPost, { isLoading: submitting }] = useCreatePostMutation();
  const [syncTags] = useSyncPostTagsMutation();
  const { data: garageData } = useGetUserGarageQuery();
  const { data: userGroups = [] } = useGetUserGroupsQuery(userInfo?.user_id ?? '', {
    skip: !userInfo?.user_id,
  });
  const { data: searchData } = useSearchQuery(debouncedSearch, { skip: debouncedSearch.length < 2 });
  const { data: prevUsersData }  = useGetPreviouslyTaggedUsersQuery();
  const { data: prevCarsData }   = useGetPreviouslyTaggedCarsQuery();
  const { data: prevEventsData } = useGetPreviouslyTaggedEventsQuery();

  const garageCars = garageData?.entries ?? [];

  const currentCategories = CATEGORIES[postType];
  const displayName = userInfo
    ? `${userInfo.firstName} ${userInfo.lastName}`.trim() || userInfo.username
    : '';

  const showPrice    = postType === 'listing' || postType === 'want';
  const showMileage  = postType === 'listing' || postType === 'record';

  const handleTypeChange = (t: PostType) => { setPostType(t); setCategory(''); };

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

  // ── Tag helpers ─────────────────────────────────────────────────────────────

  const toggleTag = useCallback((tag: TagItem) => {
    const setter = tag.kind === 'user' ? setTaggedUsers : tag.kind === 'car' ? setTaggedCars : setTaggedEvents;
    setter((prev) => {
      const exists = prev.some(t => t.id === tag.id);
      return exists ? prev.filter(t => t.id !== tag.id) : [...prev, tag];
    });
  }, []);

  const isTagged = useCallback((id: string, kind: TagKind) => {
    const list = kind === 'user' ? taggedUsers : kind === 'car' ? taggedCars : taggedEvents;
    return list.some(t => t.id === id);
  }, [taggedUsers, taggedCars, taggedEvents]);

  // ── Group toggle ─────────────────────────────────────────────────────────────

  const toggleGroup = useCallback((gid: string) => {
    setSelectedGroupIds((prev) => {
      const next = prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid];
      if (next.length === 0) setAlsoPublic(false);
      return next;
    });
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    if (!title.trim() && !body.trim() && images.length === 0) {
      Alert.alert('Content required', 'Please add a title, body, or photo.');
      return;
    }

    const fd = new FormData();
    fd.append('type', postType);
    fd.append('entry_type', postType);
    if (category)           fd.append('category', category);
    if (title.trim())       fd.append('title', title.trim());
    if (body.trim())        fd.append('body', body.trim());
    if (year.trim())        fd.append('year', year.trim());
    if (make.trim())        fd.append('make', make.trim());
    if (model.trim())       fd.append('model', model.trim());
    if (trim.trim())        fd.append('trim', trim.trim());
    if (price.trim())       fd.append('price', price.trim());
    if (mileage.trim())     fd.append('mileage', mileage.trim());
    if (condition.trim())   fd.append('condition', condition.trim());
    if (vin.trim())         fd.append('vin', vin.trim());
    if (partNumber.trim())  fd.append('part_number', partNumber.trim());
    if (selectedCarId)      fd.append('car_id', selectedCarId);

    if (selectedGroupIds.length > 0) {
      fd.append('group_ids', JSON.stringify(selectedGroupIds));
      if (alsoPublic) fd.append('also_public', 'true');
    }

    images.forEach((img) => {
      fd.append('gallery', {
        uri: Platform.OS === 'ios' ? img.uri.replace('file://', '') : img.uri,
        name: img.name,
        type: img.type,
      } as any);
    });

    try {
      const result = await createPost(fd).unwrap();
      const hasAnyTags = taggedUsers.length > 0 || taggedCars.length > 0 || taggedEvents.length > 0;
      if (hasAnyTags && (result as any)?.internal_id) {
        syncTags({
          post_id: (result as any).internal_id,
          tagged_users: taggedUsers.map(t => t.id),
          tagged_cars: taggedCars.map(t => t.id),
          tagged_events: taggedEvents.map(t => t.id),
        }).catch(() => {});
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      appNav.goBack();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Could not create post. Please try again.');
    }
  }, [
    postType, category, title, body, year, make, model, trim, price, mileage,
    condition, vin, partNumber, selectedCarId, selectedGroupIds, alsoPublic,
    taggedUsers, taggedCars, taggedEvents, images, createPost, syncTags, appNav,
  ]);

  // ── Derived search / recently-tagged data ────────────────────────────────────

  const searchUsers  = (debouncedSearch.length >= 2 ? (searchData?.users  ?? []) : (prevUsersData?.users   ?? [])) as any[];
  const searchCars   = (debouncedSearch.length >= 2 ? (searchData?.cars   ?? []) : (prevCarsData?.cars     ?? [])) as any[];
  const searchEvents = (debouncedSearch.length >= 2 ? (searchData?.events ?? []) : (prevEventsData?.events ?? [])) as any[];

  const allTags = [...taggedUsers, ...taggedCars, ...taggedEvents];

  const inputStyle = [styles.input, { color: colors.fg, borderBottomColor: colors.border }];

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>

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
                style={[styles.typeBtn, { borderColor: active ? color : colors.border }, active && { backgroundColor: color }]}
                onPress={() => handleTypeChange(type)}
              >
                <Text style={[styles.typeLabel, { color: active ? '#FFFFFF' : colors.grey }]}>{label}</Text>
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
                  style={[styles.catChip, { borderColor: active ? colors.primaryAlt : colors.border }, active && { backgroundColor: colors.primaryAlt }]}
                  onPress={() => setCategory(active ? '' : key)}
                >
                  <Text style={[styles.catLabel, { color: active ? '#FFFFFF' : colors.grey }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Author */}
        <View style={[styles.authorRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Avatar filename={userInfo?.gallery?.[0]?.filename ?? userInfo?.profilePicture} name={displayName} size={38} />
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

        {/* ── Tag a car (garage association) ── */}
        {garageCars.length > 0 && (
          <Section label="Associate a Car">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {garageCars.map((car) => {
                const active = selectedCarId === car.internal_id;
                return (
                  <TouchableOpacity
                    key={car.internal_id}
                    style={[styles.assocChip, { borderColor: active ? colors.primaryAlt : colors.border }, active && { backgroundColor: colors.primaryAlt }]}
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

        {/* ── Tag people, cars & events ── */}
        <Section label="Tag People, Cars & Events">
          {/* Selected tags */}
          {allTags.length > 0 && (
            <View style={styles.selectedTags}>
              {allTags.map((tag) => (
                <TagChip key={`${tag.kind}-${tag.id}`} tag={tag} onRemove={() => toggleTag(tag)} />
              ))}
            </View>
          )}

          {/* Search input */}
          <View style={[styles.tagSearchRow, { borderBottomColor: colors.border }]}>
            <Search size={15} color={colors.grey} />
            <TextInput
              style={[styles.tagSearchInput, { color: colors.fg }]}
              value={tagSearch}
              onChangeText={setTagSearch}
              placeholder="Search people, cars, events…"
              placeholderTextColor={colors.grey}
              returnKeyType="search"
              autoCorrect={false}
            />
            {tagSearch.length > 0 && (
              <TouchableOpacity onPress={() => setTagSearch('')} hitSlop={6}>
                <X size={14} color={colors.grey} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results / recently tagged */}
          <View style={{ paddingBottom: 8 }}>
            {/* Users */}
            {searchUsers.length > 0 && (
              <View>
                <View style={[styles.tagGroupHeader, { borderBottomColor: colors.border }]}>
                  <User size={12} color={colors.grey} />
                  <Text style={[styles.tagGroupLabel, { color: colors.grey }]}>
                    {debouncedSearch.length >= 2 ? 'People' : 'Recently Tagged People'}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagResultRow}>
                  {searchUsers.slice(0, 10).map((u: any) => {
                    const uid = u.user_id || u.internal_id;
                    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
                    const tagged = isTagged(uid, 'user');
                    return (
                      <TouchableOpacity
                        key={uid}
                        style={[styles.tagResultChip, { borderColor: tagged ? colors.primaryAlt : colors.border }, tagged && { backgroundColor: colors.primaryAlt }]}
                        onPress={() => toggleTag({ id: uid, label: name, kind: 'user' })}
                      >
                        {tagged && <Check size={11} color="#FFF" />}
                        <Text style={[styles.tagResultText, { color: tagged ? '#FFF' : colors.fg }]} numberOfLines={1}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Cars */}
            {searchCars.length > 0 && (
              <View>
                <View style={[styles.tagGroupHeader, { borderBottomColor: colors.border }]}>
                  <CarIcon size={12} color={colors.grey} />
                  <Text style={[styles.tagGroupLabel, { color: colors.grey }]}>
                    {debouncedSearch.length >= 2 ? 'Cars' : 'Recently Tagged Cars'}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagResultRow}>
                  {searchCars.slice(0, 10).map((c: any) => {
                    const cid = c.internal_id;
                    const label = [c.year, c.make, c.model].filter(Boolean).join(' ') || c.title || 'Car';
                    const tagged = isTagged(cid, 'car');
                    return (
                      <TouchableOpacity
                        key={cid}
                        style={[styles.tagResultChip, { borderColor: tagged ? colors.teal : colors.border }, tagged && { backgroundColor: colors.teal }]}
                        onPress={() => toggleTag({ id: cid, label, kind: 'car' })}
                      >
                        {tagged && <Check size={11} color="#FFF" />}
                        <Text style={[styles.tagResultText, { color: tagged ? '#FFF' : colors.fg }]} numberOfLines={1}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Events */}
            {searchEvents.length > 0 && (
              <View>
                <View style={[styles.tagGroupHeader, { borderBottomColor: colors.border }]}>
                  <Flag size={12} color={colors.grey} />
                  <Text style={[styles.tagGroupLabel, { color: colors.grey }]}>
                    {debouncedSearch.length >= 2 ? 'Events' : 'Recently Tagged Events'}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagResultRow}>
                  {searchEvents.slice(0, 10).map((e: any) => {
                    const eid = e.internal_id;
                    const tagged = isTagged(eid, 'event');
                    return (
                      <TouchableOpacity
                        key={eid}
                        style={[styles.tagResultChip, { borderColor: tagged ? colors.tangerine : colors.border }, tagged && { backgroundColor: colors.tangerine }]}
                        onPress={() => toggleTag({ id: eid, label: e.title || 'Event', kind: 'event' })}
                      >
                        {tagged && <Check size={11} color="#FFF" />}
                        <Text style={[styles.tagResultText, { color: tagged ? '#FFF' : colors.fg }]} numberOfLines={1}>{e.title || 'Event'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {searchUsers.length === 0 && searchCars.length === 0 && searchEvents.length === 0 && (
              <Text style={[styles.tagEmpty, { color: colors.grey }]}>
                {debouncedSearch.length >= 2 ? 'No results found' : 'Type to search people, cars, and events'}
              </Text>
            )}
          </View>
        </Section>

        {/* ── Post to group ── */}
        {(userGroups as any[]).length > 0 && (
          <Section label="Post to Group">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {(userGroups as any[]).map((group) => {
                const gid = group.internal_id;
                const active = selectedGroupIds.includes(gid);
                return (
                  <TouchableOpacity
                    key={gid}
                    style={[styles.assocChip, { borderColor: active ? colors.primaryAlt : colors.border }, active && { backgroundColor: colors.primaryAlt }]}
                    onPress={() => toggleGroup(gid)}
                  >
                    {active && <Check size={12} color="#FFFFFF" />}
                    <Text style={[styles.assocChipText, { color: active ? '#FFFFFF' : colors.fg }]} numberOfLines={1}>
                      {group.title ?? 'Group'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedGroupIds.length > 0 && (
              <TouchableOpacity
                style={[styles.alsoPublicRow, { borderTopColor: colors.border }]}
                onPress={() => setAlsoPublic(v => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, { borderColor: colors.primaryAlt }, alsoPublic && { backgroundColor: colors.primaryAlt }]}>
                  {alsoPublic && <Check size={11} color="#FFF" />}
                </View>
                <Text style={[styles.alsoPublicLabel, { color: colors.fg }]}>Also post publicly</Text>
              </TouchableOpacity>
            )}
          </Section>
        )}
      </ScrollView>

      {/* ── Fixed Post button ── */}
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
  scroll:       { flex: 1 },

  typeRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderBottomWidth: 1 },
  typeBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  typeLabel:    { fontSize: 12, fontWeight: '700' },

  catRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  catChip:      { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  catLabel:     { fontSize: 12, fontWeight: '600' },

  authorRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  authorName:   { fontSize: 14, fontWeight: '700' },

  titleInput:   { paddingHorizontal: 14, paddingVertical: 13, fontSize: 17, fontWeight: '700', borderBottomWidth: 1 },
  bodyInput:    { paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, minHeight: 100, lineHeight: 22, borderBottomWidth: 1 },

  photosSection:{ borderBottomWidth: 1, paddingBottom: 10 },
  addPhotoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  addPhotoText: { fontSize: 14, fontWeight: '600' },
  thumbRow:     { paddingHorizontal: 14 },
  thumbWrap:    { marginRight: 8, position: 'relative' },
  thumb:        { width: 72, height: 72, borderRadius: 8 },
  thumbRemove:  {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  sectionLabel:  { fontSize: 14, fontWeight: '700' },
  fieldRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  fieldLabel:    { fontSize: 13, fontWeight: '600', width: 90 },
  fieldValue:    { flex: 1 },
  input:         { flex: 1, fontSize: 14, paddingVertical: 11 },

  chipScroll:    { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  assocChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, maxWidth: 200 },
  assocChipText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },

  // Tags
  selectedTags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingTop: 10 },
  tagChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tagChipText:     { fontSize: 12, fontWeight: '600', maxWidth: 120 },
  tagSearchRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tagSearchInput:  { flex: 1, fontSize: 14 },
  tagGroupHeader:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  tagGroupLabel:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  tagResultRow:    { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  tagResultChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  tagResultText:   { fontSize: 13, fontWeight: '600', maxWidth: 160 },
  tagEmpty:        { paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 },

  // Group options
  alsoPublicRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  checkbox:        { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  alsoPublicLabel: { fontSize: 14, fontWeight: '600' },

  footer:          { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  submitBtn:       { backgroundColor: colors.primaryAlt, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:      { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
