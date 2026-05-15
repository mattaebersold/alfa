import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp, NavigationProp } from '@react-navigation/native';
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, Check } from 'lucide-react-native';
import {
  useGetListQuery,
  useDeleteListItemMutation,
  useCreateListItemMutation,
  useReorderListItemsMutation,
} from '../../api/apiService';
import { useGetLoggedInUserQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import type { AppStackParamList } from '../../navigation/types';
import type { ListItem } from '../../types/api';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';

type RouteType = RouteProp<AppStackParamList, 'ListDetail'>;
type NavProp = NavigationProp<AppStackParamList>;

function ListItemRow({
  item, index, total, isOwner, listId, onDeleted, onMoveUp, onMoveDown,
}: {
  item: ListItem; index: number; total: number;
  isOwner: boolean; listId: string;
  onDeleted: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const colors = useColors();
  const [deleteListItem, { isLoading }] = useDeleteListItemMutation();
  const coverUri = firstGalleryUrl(item.gallery);

  const handleDelete = () => {
    Alert.alert('Remove Item', 'Remove this item from the list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await deleteListItem({ list_id: listId, item_internal_id: item.internal_id });
          onDeleted();
        },
      },
    ]);
  };

  return (
    <View style={[styles.itemRow, { borderBottomColor: colors.border }]}>
      {isOwner && (
        <View style={styles.reorderBtns}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={index === 0}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ opacity: index === 0 ? 0.2 : 0.6 }}
          >
            <ChevronUp size={18} color={colors.fg} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={index === total - 1}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ opacity: index === total - 1 ? 0.2 : 0.6 }}
          >
            <ChevronDown size={18} color={colors.fg} />
          </TouchableOpacity>
        </View>
      )}
      {coverUri && (
        <Image source={{ uri: coverUri }} style={styles.itemImage} contentFit="cover" />
      )}
      <View style={styles.itemBody}>
        <Text style={[styles.itemTitle, { color: colors.fg }]}>{item.title}</Text>
        {item.description ? (
          <Text style={[styles.itemDesc, { color: colors.muted }]} numberOfLines={2}>
            {stripHtml(item.description)}
          </Text>
        ) : null}
      </View>
      {isOwner && (
        <TouchableOpacity
          onPress={handleDelete}
          disabled={isLoading}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={16} color={colors.grey} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function AddItemSheet({ listId, onSuccess, onCancel }: { listId: string; onSuccess: () => void; onCancel: () => void }) {
  const colors = useColors();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createListItem, { isLoading }] = useCreateListItemMutation();

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.append('list_id', listId);
    fd.append('title', title.trim());
    fd.append('description', description);
    await createListItem(fd as any);
    onSuccess();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sheetTitle, { color: colors.fg }]}>Add Item</Text>
        <TextInput
          style={[ss.input, { backgroundColor: colors.secondary, color: colors.fg, borderColor: colors.border }]}
          placeholder="Title *"
          placeholderTextColor={colors.grey}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[ss.input, ss.inputMulti, { backgroundColor: colors.secondary, color: colors.fg, borderColor: colors.border }]}
          placeholder="Description (optional)"
          placeholderTextColor={colors.grey}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
        <View style={styles.sheetActions}>
          <TouchableOpacity onPress={onCancel} style={[styles.sheetBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.fg }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading || !title.trim()}
            style={[styles.sheetBtn, styles.sheetBtnPrimary, { opacity: isLoading || !title.trim() ? 0.5 : 1 }]}
          >
            <Text style={styles.sheetBtnPrimaryText}>{isLoading ? 'Saving...' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function ListDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { listId } = route.params;
  const colors = useColors();
  const [addOpen, setAddOpen] = useState(false);
  const [localItems, setLocalItems] = useState<ListItem[] | null>(null);
  const [reorderListItems, { isLoading: isSavingOrder }] = useReorderListItemsMutation();

  const { data: list, isLoading, refetch } = useGetListQuery(listId);
  const { data: currentUser } = useGetLoggedInUserQuery();

  const isOwner = !!(currentUser && list && currentUser.user_id === list.user_id);
  const activeItems = localItems ?? (list?.items ?? []).filter((i) => !i.deleted);
  const reorderDirty = localItems !== null;
  const coverUri = firstGalleryUrl(list?.gallery);

  useLayoutEffect(() => {
    if (!isOwner) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('EditList', { listId })}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Pencil size={18} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [isOwner, listId, navigation]);

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    setLocalItems((prev) => {
      const items = prev ?? (list?.items ?? []).filter((i) => !i.deleted);
      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, [list]);

  const handleSaveOrder = async () => {
    if (!localItems) return;
    await reorderListItems({
      list_id: listId,
      item_order: localItems.map((i) => i.internal_id),
    });
    setLocalItems(null);
    refetch();
  };

  if (isLoading) return <Spinner fullScreen />;
  if (!list) return <EmptyState title="List not found" />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {addOpen ? (
        <ScrollView keyboardShouldPersistTaps="handled">
          <AddItemSheet
            listId={listId}
            onSuccess={() => { setAddOpen(false); setLocalItems(null); refetch(); }}
            onCancel={() => setAddOpen(false)}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={activeItems}
          keyExtractor={(item) => item.internal_id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              {coverUri && (
                <Image source={{ uri: coverUri }} style={styles.cover} contentFit="cover" />
              )}
              <View style={styles.header}>
                {list.body ? (
                  <Text style={[styles.description, { color: colors.muted }]}>{stripHtml(list.body)}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  {list.category ? (
                    <View style={[styles.badge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Text style={[styles.badgeText, { color: colors.muted }]}>{list.category}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.itemCount, { color: colors.grey }]}>
                    {activeItems.length} items
                  </Text>
                  {reorderDirty && (
                    <Text style={[styles.reorderHint, { color: colors.grey }]}>· tap ✓ to save order</Text>
                  )}
                </View>
                {isOwner && (
                  <View style={styles.ownerActions}>
                    {reorderDirty && (
                      <TouchableOpacity
                        style={[styles.saveOrderBtn, { backgroundColor: colors.primaryAlt }]}
                        onPress={handleSaveOrder}
                        disabled={isSavingOrder}
                      >
                        <Check size={14} color="#fff" />
                        <Text style={styles.saveOrderBtnText}>
                          {isSavingOrder ? 'Saving...' : 'Save Order'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.addBtn, { backgroundColor: colors.primaryAlt }]}
                      onPress={() => setAddOpen(true)}
                    >
                      <Plus size={16} color="#fff" />
                      <Text style={styles.addBtnText}>Add Item</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <ListItemRow
              item={item}
              index={index}
              total={activeItems.length}
              isOwner={isOwner}
              listId={listId}
              onDeleted={() => { setLocalItems(null); refetch(); }}
              onMoveUp={() => moveItem(index, index - 1)}
              onMoveDown={() => moveItem(index, index + 1)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No items yet"
              message={isOwner ? 'Tap "Add Item" to get started.' : undefined}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40 },
  cover: { width: '100%', height: 220 },
  header: { padding: 16 },
  description: { fontSize: 14, marginBottom: 8, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 12, textTransform: 'capitalize' },
  itemCount: { fontSize: 13 },
  reorderHint: { fontSize: 12, fontStyle: 'italic' },
  ownerActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  saveOrderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
  },
  saveOrderBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  headerBtn: { marginRight: 4, padding: 4 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reorderBtns: { flexDirection: 'column', alignItems: 'center', gap: 2, marginRight: 8 },
  itemImage: { width: 52, height: 52, borderRadius: 8, marginRight: 12 },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemDesc: { fontSize: 13, marginTop: 2 },
  deleteBtn: { padding: 4, marginLeft: 8 },
  sheet: { margin: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sheetBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, alignItems: 'center',
  },
  sheetBtnPrimary: { backgroundColor: '#1C3738', borderColor: '#1C3738' },
  sheetBtnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
