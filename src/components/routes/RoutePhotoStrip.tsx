import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { ImagePlus } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import ImageLightbox from '../ui/ImageLightbox';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import type { RouteGalleryItem } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';

/**
 * A row of a route's photos — the whole drive's, or one pit stop's — with
 * whoever took each in its corner, and an add tile at the end for anyone who
 * may add. Tap opens the photos full screen; a long press on one you may
 * remove offers to.
 */
export default function RoutePhotoStrip({
  photos, size = 112, canAdd, adding, onAdd, canRemove, onRemove, addLabel = 'Add photos', showUploader = true,
}: {
  photos: RouteGalleryItem[];
  size?: number;
  canAdd: boolean;
  adding: boolean;
  onAdd: () => void;
  canRemove: (photo: RouteGalleryItem) => boolean;
  onRemove: (photo: RouteGalleryItem) => void;
  addLabel?: string;
  /** Off where the strip is already one person's gallery, under their name. */
  showUploader?: boolean;
}) {
  const colors = useColors();
  const [openAt, setOpenAt] = useState<number | null>(null);
  const urls = photos.map((p) => imageUrl(p.filename)).filter(Boolean) as string[];

  if (!photos.length && !canAdd) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {photos.map((photo, i) => (
          <TouchableOpacity
            key={photo.filename ?? i}
            onPress={() => setOpenAt(i)}
            onLongPress={canRemove(photo) ? () => onRemove(photo) : undefined}
            activeOpacity={0.85}
            accessibilityRole="imagebutton"
            accessibilityLabel={photo.user?.username ? `Photo by @${photo.user.username}` : 'Route photo'}
          >
            <Image
              source={{ uri: imageUrl(photo.filename) ?? undefined }}
              style={[styles.photo, { width: size, height: size, backgroundColor: colors.card }]}
              contentFit="cover"
              transition={150}
            />
            {showUploader && photo.user ? (
              <View style={styles.by} pointerEvents="none">
                <Avatar user={photo.user as any} size={20} />
              </View>
            ) : null}
          </TouchableOpacity>
        ))}

        {canAdd && (
          <TouchableOpacity
            style={[styles.add, { width: size, height: size, borderColor: colors.inputBorder }]}
            onPress={onAdd}
            disabled={adding}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={addLabel}
          >
            {adding
              ? <ActivityIndicator color={colors.grey} />
              : (
                <>
                  <ImagePlus size={20} color={colors.grey} />
                  <Text style={[styles.addText, { color: colors.grey }]}>{addLabel}</Text>
                </>
              )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <ImageLightbox
        images={urls}
        initialIndex={openAt ?? 0}
        visible={openAt !== null}
        onClose={() => setOpenAt(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row:   { gap: 8 },
  photo: { borderRadius: 12 },
  // Who took it, in the corner — a ring of shadow so it reads on any photo.
  by: {
    position: 'absolute', left: 6, bottom: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.5)',
  },
  add: {
    borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8,
  },
  addText: { fontSize: 12, fontFamily: FONT_INTER.semibold, textAlign: 'center' },
});
