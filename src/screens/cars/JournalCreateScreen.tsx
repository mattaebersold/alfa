import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert, ScrollView, Keyboard, Platform, ActivityIndicator,
} from 'react-native';
import { Text, FormScrollView, KeyboardStickyView, KEYBOARD_GAP } from '@ors/kit';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardState } from 'react-native-keyboard-controller';
import * as ImagePicker from 'expo-image-picker';
import { X, Plus } from 'lucide-react-native';
import { Image } from '../../components/ui/AppImage';
import FormInput from '../../components/ui/FormInput';
import PhotoPickerField from '../../components/ui/PhotoPickerField';
import StickyFormFooter from '../../components/ui/StickyFormFooter';
import {
  useGetCarJournalQuery,
  useCreateCarJournalEntryMutation, useUpdateCarJournalEntryMutation,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { imageUrl } from '../../utils/image';
import { ss } from '../../styles/shared';
import type { AppScreenProps } from '../../navigation/types';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_BLACK, COLOR_WHITE, COMMON_RADIUS, PANE_BG } from '../../constants/config';

/** As many photos as a post takes. */
const MAX_PHOTOS = 10;
/** How tall the floating Done footer stands — the post form's. */
const DONE_FOOTER_H = 76;

/** A photo in the form: one already on the entry, by its filename, or one just picked. */
type Photo =
  | { key: string; existing: string; uri: string }
  | { key: string; existing?: undefined; uri: string; name: string; type: string };

/**
 * A journal entry for a car — a note, a memory, a bit of its history — new,
 * or `entryId` to edit one.
 *
 * The post form, cut down to what an entry is: photos, a title, the words.
 * Nothing to tag (it's already this car's) and nowhere to post it to (it
 * lives on the car's page). Laid out as the post form is, the photos first in
 * the same row of thumbnails with an Add tile at its end.
 */
export default function JournalCreateScreen({ navigation, route }: AppScreenProps<'JournalCreate'>) {
  const { carId, entryId } = route.params;
  const c = useColors();
  const brand = useBrandColor();
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardState((st) => st.isVisible);

  // Editing: the entry, from the journal's first page — the newest fifty,
  // which is where an edit is opened from.
  const { data: journal } = useGetCarJournalQuery({ carId, page: 0, limit: 50 }, { skip: !entryId });
  const entry = entryId ? journal?.entries.find((e) => e.internal_id === entryId) : undefined;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [picking, setPicking] = useState(false);

  // The entry's own words and photos, once, when it arrives.
  const seeded = useRef(false);
  useEffect(() => {
    if (!entry || seeded.current) return;
    seeded.current = true;
    setTitle(entry.title ?? '');
    setBody(entry.body ?? '');
    setPhotos((entry.gallery ?? [])
      .filter((g) => g.filename && g.type !== 'video')
      .map((g) => ({ key: g.filename!, existing: g.filename!, uri: imageUrl(g.filename)! })));
  }, [entry]);

  const [createEntry, { isLoading: creating }] = useCreateCarJournalEntryMutation();
  const [updateEntry, { isLoading: updating }] = useUpdateCarJournalEntryMutation();
  const saving = creating || updating;

  const addAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setPicking(true);
    try {
      const ready = await normalizePickedAssets(assets);
      setPhotos((prev) => [
        ...prev,
        ...ready.map((r, i) => ({ key: `${r.uri}-${Date.now()}-${i}`, ...r })),
      ].slice(0, MAX_PHOTOS));
    } finally {
      setPicking(false);
    }
  };

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
          if (!result.canceled) await addAssets(result.assets);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS - photos.length,
            quality: 0.85,
          });
          if (!result.canceled) await addAssets(result.assets);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Give this entry a title.');
      return;
    }
    const fd = new FormData();
    fd.append('car_id', carId);
    fd.append('title', title.trim());
    fd.append('body', body.trim());
    const added = photos.filter((p): p is Extract<Photo, { name: string }> => !p.existing);
    added.forEach((p) => fd.append('gallery', uploadFile(p.uri)));

    try {
      if (entry) {
        fd.append('internal_id', entry.internal_id);
        // What was taken out, by filename, and the order of what's left — the
        // gallery convention every edit form uses (see horacio's images.js).
        const kept = new Set(photos.map((p) => p.existing).filter(Boolean));
        (entry.gallery ?? []).forEach((g, i) => {
          if (g.filename && !kept.has(g.filename)) fd.append(`modifyImage:remove:${i}`, g.filename);
        });
        let n = 0;
        fd.append('modifyImage:order', JSON.stringify(photos.map((p) => p.existing ?? `new:${n++}`)));
        await updateEntry(fd).unwrap();
      } else {
        await createEntry(fd).unwrap();
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Couldn't save that", err?.data?.error ?? 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: PANE_BG }]} edges={['top']}>
      {/* A pane's grabber in place of a heading and an X: tap it to close,
          or pull the sheet down. The form says what it is. */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.grabberHit}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <View style={styles.grabber} />
      </TouchableOpacity>

      <FormScrollView
        keyboardDismissMode="on-drag"
        bottomOffset={KEYBOARD_GAP + DONE_FOOTER_H}
        extraKeyboardSpace={DONE_FOOTER_H}
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === 'android' ? 40 : 24) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Photos — the post form's well, then its row once there are some. */}
        {photos.length === 0 ? (
          <PhotoPickerField onPress={pickImage} title="Add Photos" style={styles.photoField} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbRow}
            contentContainerStyle={styles.thumbRowInner}
            keyboardShouldPersistTaps="handled"
          >
            {photos.map((p) => (
              <View key={p.key} style={styles.thumbWrap}>
                <Image small source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => setPhotos((prev) => prev.filter((x) => x.key !== p.key))}
                  hitSlop={6}
                  accessibilityLabel="Remove photo"
                >
                  <X size={11} color={COLOR_WHITE} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity
                style={[styles.thumb, styles.addTile, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}
                onPress={pickImage}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Add photos"
              >
                <Plus size={20} color={c.grey} strokeWidth={2.4} />
                <Text style={[styles.addTileText, { color: c.grey }]}>Add Photos</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
        {picking && <ActivityIndicator size="small" color={c.grey} style={styles.picking} />}

        {/* The title, then the words — placeholders as their labels. */}
        <View style={styles.inputBlock}>
          <FormInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            autoCapitalize="sentences"
            accessibilityLabel="Title"
          />
        </View>
        <View style={styles.inputBlock}>
          <FormInput
            value={body}
            onChangeText={setBody}
            placeholder="The story — a memory, a bit of history, a note"
            multiline
            numberOfLines={6}
            autoCapitalize="sentences"
            accessibilityLabel="Story"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: brand }, (saving || picking) && styles.submitBusy]}
          onPress={handleSubmit}
          disabled={saving || picking}
          accessibilityRole="button"
          accessibilityLabel={entryId ? 'Save entry' : 'Add entry'}
        >
          {saving
            ? <ActivityIndicator color={COLOR_BLACK} />
            : <Text style={styles.submitText}>{entryId ? 'Save' : 'Add to Journal'}</Text>}
        </TouchableOpacity>
      </FormScrollView>

      {/* The story field is multiline, so return is a newline; this is the way out of the keyboard. */}
      {keyboardUp && (
        <KeyboardStickyView style={styles.doneDock}>
          <StickyFormFooter color={PANE_BG} bottomInset={10} style={styles.doneFooter}>
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}
                onPress={() => Keyboard.dismiss()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss keyboard"
              >
                <Text style={[styles.doneText, { color: c.fg }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </StickyFormFooter>
        </KeyboardStickyView>
      )}
    </SafeAreaView>
  );
}

/** The form's side margin — the heading and the fields share it. */
const GUTTER_FORM = 14;

const styles = StyleSheet.create({
  // The panes' grabber (the post form's measures), centred at the top.
  grabberHit:    { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  grabber:       { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)' },

  // The post form's photo row and its tiles.
  photoField:    { marginHorizontal: GUTTER_FORM, marginTop: 12, marginBottom: 0 },
  thumbRow:      { paddingHorizontal: GUTTER_FORM },
  thumbRowInner: { paddingVertical: 12 },
  thumbWrap:     { marginRight: 8, position: 'relative' },
  thumb:         { width: 72, height: 72, borderRadius: 8 },
  addTile:       { borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  addTileText:   { fontSize: 10, fontFamily: FONT_INTER.bold, textAlign: 'center' },
  thumbRemove:   {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  picking:       { alignSelf: 'flex-start', marginLeft: GUTTER_FORM, marginTop: 4 },

  inputBlock:    { paddingHorizontal: 12, paddingTop: 12 },

  submitBtn: {
    marginHorizontal: 12, marginTop: 20,
    borderRadius: COMMON_RADIUS,
    paddingVertical: 14, paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  submitBusy:    { opacity: 0.7 },
  submitText:    { color: COLOR_BLACK, fontSize: 17, fontFamily: FONT_INTER.extrabold },

  doneDock:      { position: 'absolute', left: 0, right: 0, bottom: 0 },
  doneFooter:    { position: 'relative' },
  footerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  doneBtn:       { paddingVertical: 11, paddingHorizontal: 18, borderRadius: COMMON_RADIUS, borderWidth: 1 },
  doneText:      { fontSize: 15, fontFamily: FONT_INTER.bold },
});
