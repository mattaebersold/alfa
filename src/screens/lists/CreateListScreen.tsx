import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { toUploadableJpeg, uploadFile } from '../../utils/upload';
import { ImagePlus, X } from 'lucide-react-native';
import { useCreateListMutation, useCreateListItemMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import ListCarPicker from '../../components/lists/ListCarPicker';
import ListItemsEditor from '../../components/lists/ListItemsEditor';
import ListItemSheet, { appendItemDraft, type ListItemDraft } from '../../components/lists/ListItemSheet';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import { LIST_UPSELL } from '../../constants/limits';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS } from '../../constants/radius';

type RouteType = RouteProp<AppStackParamList, 'CreateList'>;

/** A staged entry: the draft plus a key that survives reordering. */
type StagedItem = ListItemDraft & { key: string };

export default function CreateListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const colors = useColors();
  const isPro = useIsPro();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  // From "add a list" on a car's page. Still just the form's starting answer.
  const [carId, setCarId] = useState(route.params?.carId ?? '');
  const [imageUri, setImageUri] = useState<string | null>(null);

  /**
   * The entries, held here until there's a list to hang them on.
   *
   * The API has no "create a list with its items" — an item is its own
   * multipart request with its own photo, against a list id that doesn't exist
   * yet. Rather than make the member save an empty list and then go and fill
   * it (which is how this screen used to work, and why lists got abandoned at
   * zero items), the form collects them and `handleSubmit` sends them in order
   * once the list is made.
   */
  const [items, setItems] = useState<StagedItem[]>([]);
  const nextKey = useRef(0);
  /** Which entry the sheet is open on: an index, `'new'`, or closed. */
  const [sheet, setSheet] = useState<number | 'new' | null>(null);

  const [createList] = useCreateListMutation();
  const [createListItem] = useCreateListItemMutation();
  const [submitting, setSubmitting] = useState(false);

  /**
   * The upsell, over the form rather than instead of it — the marketplace
   * form's arrangement. The buttons that lead here already show this card to a
   * basic member without opening the form at all; this is for the ways in that
   * don't pass a button (a link, a stale screen from before Pro lapsed).
   */
  const [upsell, setUpsell] = useState<{ title: string; message: string } | null>(
    isPro ? null : LIST_UPSELL,
  );
  // `userInfo` can land after the first render on a cold start — in either
  // direction, so a Pro member isn't left looking at a pitch for what they have.
  useEffect(() => {
    setUpsell((u) => (isPro ? (u === LIST_UPSELL ? null : u) : u ?? LIST_UPSELL));
  }, [isPro]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      // iOS hands back HEIC, which the server can't decode — see utils/upload.
      setImageUri(await toUploadableJpeg(result.assets[0].uri));
    }
  };

  const saveItem = (draft: ListItemDraft) => {
    setItems((prev) => (
      sheet === 'new' || sheet == null
        ? [...prev, { ...draft, key: `staged_${nextKey.current++}` }]
        : prev.map((it, i) => (i === sheet ? { ...draft, key: it.key } : it))
    ));
    setSheet(null);
  };

  const moveItem = (from: number, to: number) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for your list.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Add an item', 'A list needs at least one item on it.');
      return;
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('description', description);
    fd.append('category', category);
    fd.append('private', String(isPrivate));
    if (carId) fd.append('car_id', carId);
    if (imageUri) fd.append('gallery', uploadFile(imageUri));

    setSubmitting(true);
    let listId: string | undefined;
    try {
      const created = await createList(fd as any).unwrap();
      listId = created?._id ?? created?.entry?.internal_id;
    } catch (err: any) {
      setSubmitting(false);
      /**
       * The refusal worth its own words. The check above normally gets there
       * first — this is a membership that lapsed while the form was open, or
       * a cached "pro" the server no longer agrees with.
       */
      if (err?.data?.code === 'pro_required') {
        setUpsell({ title: LIST_UPSELL.title, message: err?.data?.error ?? LIST_UPSELL.message });
        return;
      }
      // Everything else the server refuses with its own sentence —
      // `list_limit_reached` (fifty lists, Pro or not), `car_not_owned` — and
      // those sentences are better than anything guessed at here.
      Alert.alert("Couldn't create list", err?.data?.error ?? 'Something went wrong. Please try again.');
      return;
    }

    // One at a time and in order: the server appends, so the order they
    // arrive in *is* the ranking. In parallel, number one would be whichever
    // photo uploaded fastest.
    let failed = 0;
    /** The first refusal's own words — `invalid_link`, `list_item_limit_reached`. */
    let firstError: string | null = null;
    if (listId) {
      for (const item of items) {
        const itemFd = new FormData();
        itemFd.append('list_id', listId);
        appendItemDraft(itemFd, item);
        try {
          await createListItem(itemFd as any).unwrap();
        } catch (err: any) {
          failed += 1;
          firstError = firstError ?? err?.data?.error ?? null;
        }
      }
    }
    setSubmitting(false);

    if (failed > 0 && listId) {
      // The list exists, so don't pretend it doesn't — land on its editor,
      // where what made it is visible and what didn't can be added again.
      const id = listId;
      Alert.alert(
        'List created',
        `${failed} of ${items.length} items couldn't be added${firstError ? ` — ${firstError}` : '.'} You can add ${failed === 1 ? 'it' : 'them'} again from the list.`,
        [{ text: 'OK', onPress: () => navigation.replace('EditList', { listId: id }) }],
      );
      return;
    }
    navigation.goBack();
  };

  const editing = typeof sheet === 'number' ? items[sheet] : null;
  const canSubmit = !submitting && !!title.trim() && items.length > 0;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Cover image */}
          <TouchableOpacity onPress={pickImage} style={[styles.imagePicker, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => setImageUri(null)}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImagePlus size={24} color={colors.grey} />
                <Text style={[styles.imagePlaceholderText, { color: colors.grey }]}>Add cover image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>Title *</Text>
            <TextInput
              style={[ss.input, { backgroundColor: colors.card, color: colors.fg, borderColor: colors.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Top 5 favourite car designers"
              placeholderTextColor={colors.grey}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>Description</Text>
            <TextInput
              style={[ss.input, ss.inputMulti, { backgroundColor: colors.card, color: colors.fg, borderColor: colors.border }]}
              value={description}
              onChangeText={setDescription}
              placeholder="What's this list about?"
              placeholderTextColor={colors.grey}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Items — before the housekeeping fields, because they're the list. */}
          <ListItemsEditor
            rows={items.map((it) => ({
              key: it.key,
              title: it.title,
              description: it.description,
              photoUrl: it.photoUri,
              link: it.link,
              linkLabel: it.linkLabel,
            }))}
            onAdd={() => setSheet('new')}
            onEdit={(index) => setSheet(index)}
            onRemove={(index) => setItems((prev) => prev.filter((_, i) => i !== index))}
            onMove={moveItem}
          />

          <ListCarPicker value={carId} onChange={setCarId} />

          {/* Category */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>Category</Text>
            <TextInput
              style={[ss.input, { backgroundColor: colors.card, color: colors.fg, borderColor: colors.border }]}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Design, Wish list, Roads..."
              placeholderTextColor={colors.grey}
            />
          </View>

          {/* Private toggle */}
          <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.toggleLabel, { color: colors.fg }]}>Private</Text>
              <Text style={[styles.toggleSub, { color: colors.grey }]}>Only visible to you</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ true: colors.primaryAlt }}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primaryAlt, opacity: canSubmit ? 1 : 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Creating...' : 'Create List'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <ListItemSheet
        visible={sheet !== null}
        initial={editing ? {
          title: editing.title,
          description: editing.description,
          link: editing.link,
          linkLabel: editing.linkLabel,
          photoUrl: editing.photoUri,
          photoIsSaved: false,
        } : null}
        onSubmit={saveItem}
        onClose={() => setSheet(null)}
      />

      {/* Closing the pitch closes the form for a basic member: there is
          nothing behind it they can finish. A Pro who was refused by the
          server keeps the form, and whatever they'd typed into it. */}
      <ProUpsellModal
        visible={!!upsell}
        onClose={() => {
          setUpsell(null);
          if (!isPro) navigation.goBack();
        }}
        title={upsell?.title ?? ''}
        message={upsell?.message ?? ''}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  imagePicker: {
    width: '100%', height: 180, borderRadius: 14,
    borderWidth: 1, overflow: 'hidden', marginBottom: 16,
  },
  imagePreview: { width: '100%', height: '100%' },
  removeImage: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 4,
  },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePlaceholderText: { fontSize: 14 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  toggleSub: { fontSize: 12, marginTop: 2 },
  submitBtn: {
    paddingVertical: 15, borderRadius: COMMON_RADIUS, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
