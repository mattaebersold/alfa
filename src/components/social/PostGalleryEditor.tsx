import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import * as ImagePicker from 'expo-image-picker';
import { X, Plus } from 'lucide-react-native';
import { imageUrl } from '../../utils/image';
import { normalizePickedAssets } from '../../utils/upload';
import { useColors } from '../../hooks/useColors';
import type { GalleryItem } from '../../types/api';

/**
 * One slot in the editor. `existing` images are already on the server and are
 * identified by filename; `new` ones are local files not yet uploaded.
 */
export type EditorImage =
  | { key: string; kind: 'existing'; filename: string }
  | { key: string; kind: 'new'; uri: string; name: string; type: string };

let _seq = 0;
const nextKey = () => `img_${++_seq}_${Date.now()}`;

/** Seed the editor from a post's saved gallery. */
export function toEditorImages(gallery?: GalleryItem[] | null): EditorImage[] {
  // A gallery holds videos too now; the editor only deals in photos, and an
  // entry without a filename is not one.
  return (gallery ?? [])
    .flatMap((g) => (g?.filename
      ? [{ key: nextKey(), kind: 'existing' as const, filename: g.filename }]
      : []));
}

interface Props {
  images: EditorImage[];
  onChange: (next: EditorImage[]) => void;
  max?: number;
}

const THUMB = 92;

export default function PostGalleryEditor({ images, onChange, max = 10 }: Props) {
  const c = useColors();

  const addImages = async () => {
    const remaining = max - images.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', `A post can have up to ${max} images.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;

    const picked = await normalizePickedAssets(result.assets);
    const next = picked.slice(0, remaining).map((p) => ({
      key: nextKey(),
      kind: 'new' as const,
      uri: p.uri,
      name: p.name,
      type: p.type,
    }));

    onChange([...images, ...next]);
  };

  const removeAt = (key: string) => onChange(images.filter((i) => i.key !== key));

  const renderItem = ({ item, drag, isActive }: RenderItemParams<EditorImage>) => {
    const uri = item.kind === 'existing' ? imageUrl(item.filename) ?? undefined : item.uri;

    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          delayLongPress={180}
          activeOpacity={0.9}
          style={styles.thumbWrap}
        >
          <Image source={{ uri }} style={styles.thumb} contentFit="cover" />

          {/* New images aren't on the server yet — mark them so it's obvious
              what will be uploaded on save. */}
          {item.kind === 'new' && (
            <View style={[styles.newTag, { backgroundColor: c.primaryAlt }]}>
              <Text style={styles.newTagText}>NEW</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => removeAt(item.key)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Remove image"
          >
            <X size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: c.grey }]}>PHOTOS</Text>
        <Text style={[styles.hint, { color: c.greyDark }]}>
          {images.length}/{max} · hold to reorder
        </Text>
      </View>

      {images.length > 0 ? (
        <DraggableFlatList
          data={images}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          onDragEnd={({ data }) => onChange(data)}
          activationDistance={12}
          renderItem={renderItem}
          containerStyle={styles.listContainer}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <Text style={[styles.empty, { color: c.greyDark }]}>No photos on this post.</Text>
      )}

      <TouchableOpacity
        style={[styles.addBtn, { borderColor: c.border }]}
        onPress={addImages}
        activeOpacity={0.8}
      >
        <Plus size={15} color={c.primaryAlt} />
        <Text style={[styles.addBtnText, { color: c.primaryAlt }]}>Add Photos</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label:    { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  hint:     { fontSize: 11 },

  listContainer: { height: THUMB + 8 },
  listContent:   { paddingRight: 8 },

  thumbWrap: { width: THUMB, height: THUMB, marginRight: 8 },
  thumb:     { width: '100%', height: '100%', borderRadius: 10 },

  // Inset from the corner rather than hanging off it, so the button never gets
  // clipped by the row's bounds or the neighbouring thumbnail.
  removeBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  newTag: {
    position: 'absolute', bottom: 5, left: 5,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  newTagText: { fontSize: 9, fontWeight: '800', color: '#000000', letterSpacing: 0.4 },

  empty: { fontSize: 13, fontStyle: 'italic', paddingVertical: 12 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: 10, borderWidth: 1, marginTop: 10,
  },
  addBtnText: { fontSize: 14, fontWeight: '700' },
});
