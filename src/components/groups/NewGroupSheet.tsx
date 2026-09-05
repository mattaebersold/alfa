import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { X } from 'lucide-react-native';
import SharedModal from '../ui/SharedModal';
import PhotoPickerField from '../ui/PhotoPickerField';
import { useCreateGroupMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { uploadFile } from '../../utils/upload';
import { GROUP_TYPES, groupCategoriesFor } from '../../constants/groupTypes';
import { REGIONS } from '../../constants/regions';

interface PickedImage { uri: string; name: string; type: string }

/**
 * Start a group.
 *
 * The button that opened this used to be admin-only and raised a "coming soon"
 * alert — there was no group creation on the phone at all, even though the
 * server has had the endpoint the whole time and doesn't restrict it beyond
 * being signed in. Pro membership is the gate the product wants, so that lives
 * on the button rather than in here.
 *
 * The form asks for what a group needs to be findable and nothing else: a name,
 * a line about it, what kind it is. Description, region and a cover photo are
 * all optional — a group with an empty description is a group people can still
 * join, and making them fill one in is how you get "asdf".
 */
export default function NewGroupSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  /** Handed the new group's id once the server has it. */
  onCreated?: (groupId: string) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);
  const [createGroup, { isLoading }] = useCreateGroupMutation();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('regional');
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [image, setImage] = useState<PickedImage | null>(null);

  const categories = groupCategoriesFor(type);

  const reset = () => {
    setTitle(''); setSubtitle(''); setBody('');
    setType('regional'); setCategory(''); setRegion('');
    setIsPrivate(false); setImage(null);
  };

  const close = () => { onClose(); };

  const pickImage = () => {
    Alert.alert('Cover Photo', 'How would you like to add one?', [
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
            const a = result.assets[0];
            setImage({
              uri: a.uri,
              name: a.fileName ?? `group_${Date.now()}.jpg`,
              type: a.mimeType ?? 'image/jpeg',
            });
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
          });
          if (!result.canceled) {
            const a = result.assets[0];
            setImage({
              uri: a.uri,
              name: a.fileName ?? `group_${Date.now()}.jpg`,
              type: a.mimeType ?? 'image/jpeg',
            });
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    const name = title.trim();
    if (!name || isLoading) return;

    const fd = new FormData();
    fd.append('title', name);
    if (subtitle.trim()) fd.append('subtitle', subtitle.trim());
    if (body.trim()) fd.append('body', body.trim());
    fd.append('type', type);
    // Only "Car Type" has categories, so anything else would be sending a value
    // the web form never sets.
    if (category && categories.length > 0) fd.append('category', category);
    if (region.trim()) fd.append('region', region.trim());
    // The server reads this as `body.private || false`, and a FormData value is
    // always a string — so it's appended only when it's actually true, or every
    // group would come out private.
    if (isPrivate) fd.append('private', 'true');
    if (image) fd.append('gallery', uploadFile(image.uri));

    try {
      const result = await createGroup(fd).unwrap();
      reset();
      onClose();
      if (result?._id) onCreated?.(result._id);
    } catch (err: any) {
      // The sheet stays open with everything typed still in it.
      Alert.alert(
        'Could not create group',
        err?.data?.error ?? err?.message ?? 'Please try again.',
      );
    }
  };

  const canSubmit = !!title.trim() && !isLoading;

  return (
    <SharedModal visible={visible} onClose={close} title="New Group" heightRatio={0.9}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Label colors={colors}>Name</Label>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.fg }]}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Pacific Northwest Air-cooled"
          placeholderTextColor={colors.grey}
          maxLength={80}
          autoFocus
        />

        <Label colors={colors}>Tagline</Label>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.fg }]}
          value={subtitle}
          onChangeText={setSubtitle}
          placeholder="One line about the group"
          placeholderTextColor={colors.grey}
          maxLength={120}
        />

        <Label colors={colors}>Type</Label>
        <View style={styles.chips}>
          {GROUP_TYPES.map((t) => {
            const on = type === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => {
                  setType(t.key);
                  // The old category belongs to the old type — keeping it would
                  // file the group under something that isn't offered any more.
                  setCategory('');
                }}
                style={[
                  styles.chip,
                  on ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.border },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, { color: on ? onBrand : colors.fg }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {categories.length > 0 && (
          <>
            <Label colors={colors}>Category</Label>
            <View style={styles.chips}>
              {categories.map((c) => {
                const on = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setCategory(on ? '' : c.key)}
                    style={[
                      styles.chip,
                      on ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.chipText, { color: on ? onBrand : colors.fg }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* The same five regions members are filed under, not free text.
            Typed, this produced "PNW", "Pacific NW" and "pacific northwest" as
            three different regions, none of which matched what the groups list
            filters by or what a member's own region is derived from. Picking
            from the set is what makes "groups near me" answerable. */}
        <Label colors={colors}>Region</Label>
        <View style={styles.chips}>
          {/* A group can genuinely have no region — an online club, a marque
              register — and that's a choice here rather than an empty field. */}
          <TouchableOpacity
            onPress={() => setRegion('')}
            style={[
              styles.chip,
              !region ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.border },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: !region }}
          >
            <Text style={[styles.chipText, { color: !region ? onBrand : colors.fg }]}>No region</Text>
          </TouchableOpacity>
          {REGIONS.map((r) => {
            const on = region === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                onPress={() => setRegion(on ? '' : r.key)}
                style={[
                  styles.chip,
                  on ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.border },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, { color: on ? onBrand : colors.fg }]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Label colors={colors}>About</Label>
        <TextInput
          style={[
            styles.input, styles.textarea,
            { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.fg },
          ]}
          value={body}
          onChangeText={setBody}
          placeholder="What the group is for, who it's for, how you run it."
          placeholderTextColor={colors.grey}
          multiline
          textAlignVertical="top"
        />

        <Label colors={colors}>Cover photo</Label>
        {image ? (
          <View style={styles.coverWrap}>
            <Image source={{ uri: image.uri }} style={styles.cover} contentFit="cover" />
            <TouchableOpacity
              style={styles.coverRemove}
              onPress={() => setImage(null)}
              accessibilityRole="button"
              accessibilityLabel="Remove cover photo"
            >
              <X size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <PhotoPickerField
            onPress={pickImage}
            title="Add a cover photo"
            hint="Optional — you can add one later"
          />
        )}

        <View style={[styles.privateRow, { borderColor: colors.border }]}>
          <View style={styles.privateText}>
            <Text style={[styles.privateTitle, { color: colors.fg }]}>Private group</Text>
            <Text style={[styles.privateHint, { color: colors.grey }]}>
              Hidden from the public list — members join by invitation.
            </Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ true: brand, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity
          style={[styles.submit, { backgroundColor: brand }, !canSubmit && styles.submitOff]}
          onPress={submit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {isLoading
            ? <ActivityIndicator size="small" color={onBrand} />
            : <Text style={[styles.submitText, { color: onBrand }]}>Create Group</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SharedModal>
  );
}

function Label({ children, colors }: { children: React.ReactNode; colors: any }) {
  return <Text style={[styles.label, { color: colors.grey }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  label: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 18, marginBottom: 8,
  },
  input: {
    minHeight: 46, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 15,
  },
  textarea: { height: 110, paddingTop: 12, paddingBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '700' },

  coverWrap: { position: 'relative' },
  cover:     { width: '100%', height: 150, borderRadius: 12 },
  coverRemove: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  privateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginTop: 22, paddingVertical: 14, paddingHorizontal: 14,
    borderWidth: 1, borderRadius: 12,
  },
  privateText:  { flex: 1 },
  privateTitle: { fontSize: 15, fontWeight: '700' },
  privateHint:  { fontSize: 12, marginTop: 2, lineHeight: 16 },

  submit: {
    marginTop: 24, height: 50, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  submitOff:  { opacity: 0.45 },
  submitText: { fontSize: 16, fontWeight: '800' },
});
