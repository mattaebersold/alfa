import React, { useMemo, useState } from 'react';
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
import { ImagePlus, Trash2, X } from 'lucide-react-native';
import {
  useGetListQuery, useUpdateListMutation, useDeleteListMutation,
  useCreateListItemMutation, useUpdateListItemMutation, useDeleteListItemMutation,
  useReorderListItemsMutation,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import Spinner from '../../components/ui/Spinner';
import ListCarPicker from '../../components/lists/ListCarPicker';
import ListItemsEditor from '../../components/lists/ListItemsEditor';
import { listCarLabel } from '../../components/lists/ListSummaryContent';
import ListItemSheet, { appendItemDraft, type ListItemDraft } from '../../components/lists/ListItemSheet';
import type { AppStackParamList } from '../../navigation/types';
import type { ListItem } from '../../types/api';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS } from '../../constants/radius';

type RouteType = RouteProp<AppStackParamList, 'EditList'>;

/**
 * Everything about a list that can change, on one screen: its details, the car
 * it's for, and its entries.
 *
 * The entries used to be managed on ListDetail, which made that screen both
 * the public view of a list and its owner's workbench. A list is read in a
 * summary panel now (see ListSummaryModal), so the workbench moved here, where
 * the panel's Edit button lands.
 *
 * Two kinds of saving, deliberately. The details are a form — change what you
 * like, then Save. Each entry saves as you finish it, because an entry carries
 * a photo upload, and batching five of those behind one button makes a save
 * that takes half a minute and fails as a unit.
 *
 * Not Pro-gated: a member whose Pro has lapsed keeps their lists and can still
 * tend them. Only making a new one is refused.
 */
export default function EditListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const { listId } = route.params;
  const colors = useColors();

  const { data: list, isLoading } = useGetListQuery(listId);
  const [updateList, { isLoading: isSaving }] = useUpdateListMutation();
  const [deleteList, { isLoading: isDeleting }] = useDeleteListMutation();
  const [createListItem, { isLoading: addingItem }] = useCreateListItemMutation();
  const [updateListItem, { isLoading: savingItem }] = useUpdateListItemMutation();
  const [deleteListItem] = useDeleteListItemMutation();
  const [reorderListItems, { isLoading: savingOrder }] = useReorderListItemsMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [carId, setCarId] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  /**
   * The order on screen, as ids, while it differs from the server's — `null`
   * once they agree. Ids rather than the items themselves, so an entry edited
   * while the order is unsaved shows its new words, not a stale copy.
   */
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  /** Which entry the sheet is open on: an item id, `'new'`, or closed. */
  const [sheet, setSheet] = useState<string | 'new' | null>(null);

  if (list && !initialized) {
    setTitle(list.title ?? '');
    // Stored as the description field's text, but older records hold markup.
    setDescription(list.body ? stripHtml(list.body) : '');
    setCategory(list.category ?? '');
    setIsPrivate(!!list.private);
    setCarId(list.car_id ?? '');
    setInitialized(true);
  }

  const items = useMemo(() => {
    const live = (list?.items ?? []).filter((i) => !i.deleted);
    if (!localOrder) return live;
    const byId = new Map(live.map((i) => [i.internal_id, i]));
    const ordered = localOrder.map((id) => byId.get(id)).filter((i): i is ListItem => !!i);
    // Anything added since the reorder began goes on the end, where the server put it.
    const rest = live.filter((i) => !localOrder.includes(i.internal_id));
    return [...ordered, ...rest];
  }, [list, localOrder]);

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

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title.');
      return;
    }

    const fd = new FormData();
    fd.append('internal_id', listId);
    fd.append('title', title.trim());
    fd.append('description', description);
    fd.append('category', category);
    fd.append('private', String(isPrivate));
    // Always sent, empty when cleared: leaving it out would mean "unchanged",
    // and detaching a list from its car has to be sayable.
    fd.append('car_id', carId);
    if (imageUri) {
      fd.append('gallery', uploadFile(imageUri));
      // Name the cover being replaced. The server appends a new upload after
      // whatever is there, and the cover shown is the *first* — so without
      // this the new image uploaded fine and the old one kept being displayed.
      const current = list?.gallery?.[0]?.filename;
      if (current) fd.append('modifyImage:remove:0', current);
    }

    try {
      await updateList(fd as any).unwrap();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.data?.error ?? 'Something went wrong. Please try again.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete list', `Delete "${list?.title ?? 'this list'}" and everything on it? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteList({ internal_id: listId }).unwrap();
            navigation.goBack();
          } catch (err: any) {
            Alert.alert("Couldn't delete", err?.data?.error ?? 'Something went wrong. Please try again.');
          }
        },
      },
    ]);
  };

  const editing = sheet && sheet !== 'new' ? items.find((i) => i.internal_id === sheet) ?? null : null;

  const saveItem = async (draft: ListItemDraft) => {
    const fd = new FormData();
    fd.append('list_id', listId);
    try {
      if (editing) {
        fd.append('item_internal_id', editing.internal_id);
        appendItemDraft(fd, draft, editing.gallery?.[0]?.filename);
        await updateListItem(fd as any).unwrap();
      } else {
        appendItemDraft(fd, draft);
        await createListItem(fd as any).unwrap();
      }
      setSheet(null);
    } catch (err: any) {
      // The sheet stays up with what was typed — an upload that failed on a
      // bad connection shouldn't cost the description too.
      Alert.alert("Couldn't save item", err?.data?.error ?? 'Something went wrong. Please try again.');
    }
  };

  const removeItem = (index: number) => {
    const item = items[index];
    if (!item) return;
    Alert.alert('Remove item', `Remove "${item.title}" from the list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await deleteListItem({ list_id: listId, item_internal_id: item.internal_id }).unwrap();
          } catch (err: any) {
            Alert.alert("Couldn't remove item", err?.data?.error ?? 'Something went wrong. Please try again.');
          }
        },
      },
    ]);
  };

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const ids = items.map((i) => i.internal_id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    setLocalOrder(ids);
  };

  const saveOrder = async () => {
    if (!localOrder) return;
    try {
      await reorderListItems({ list_id: listId, item_order: items.map((i) => i.internal_id) }).unwrap();
      setLocalOrder(null);
    } catch (err: any) {
      Alert.alert("Couldn't save the order", err?.data?.error ?? 'Something went wrong. Please try again.');
    }
  };

  if (isLoading || !initialized) return <Spinner fullScreen />;

  const existingCoverUri = firstGalleryUrl(list?.gallery);

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
            ) : existingCoverUri ? (
              <>
                <Image source={{ uri: existingCoverUri }} style={styles.imagePreview} contentFit="cover" />
                <View style={styles.changeOverlay}>
                  <Text style={styles.changeOverlayText}>Change Image</Text>
                </View>
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
              placeholder="List title..."
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

          {/* Items — saved one at a time, as each is finished. See the
              component comment for why they don't wait for Save Changes. */}
          <ListItemsEditor
            rows={items.map((it) => ({
              key: it.internal_id,
              title: it.title,
              description: it.description ? stripHtml(it.description) : '',
              photoUrl: firstGalleryUrl(it.gallery),
              link: it.link,
              linkLabel: it.link_label,
            }))}
            onAdd={() => setSheet('new')}
            onEdit={(index) => setSheet(items[index]?.internal_id ?? null)}
            onRemove={removeItem}
            onMove={moveItem}
            orderDirty={!!localOrder}
            onSaveOrder={saveOrder}
            savingOrder={savingOrder}
          />

          <ListCarPicker value={carId} valueLabel={listCarLabel(list?.car)} onChange={setCarId} />

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

          {/* Save */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primaryAlt, opacity: isSaving || !title.trim() ? 0.5 : 1 }]}
            onPress={handleSave}
            disabled={isSaving || !title.trim()}
          >
            <Text style={styles.submitBtnText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>

          {/* Last, apart, and quiet: it's the one thing here that can't be
              taken back, and it shouldn't sit where Save is reached for. */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={isDeleting}
            accessibilityRole="button"
          >
            <Trash2 size={15} color={colors.red} />
            <Text style={[styles.deleteBtnText, { color: colors.red }]}>
              {isDeleting ? 'Deleting...' : 'Delete list'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <ListItemSheet
        visible={sheet !== null}
        saving={addingItem || savingItem}
        initial={editing ? {
          title: editing.title,
          description: editing.description ? stripHtml(editing.description) : '',
          link: editing.link,
          linkLabel: editing.link_label,
          photoUrl: firstGalleryUrl(editing.gallery),
          photoIsSaved: true,
        } : null}
        onSubmit={saveItem}
        onClose={() => setSheet(null)}
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
  changeOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  changeOverlayText: { color: '#fff', fontSize: 15, fontWeight: '700' },
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
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 14, marginTop: 14,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700' },
});
