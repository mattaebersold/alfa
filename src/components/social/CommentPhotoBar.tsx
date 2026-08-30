import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, X, Camera, Images } from 'lucide-react-native';
import ActionSheet from '../ui/ActionSheet';
import { useColors } from '../../hooks/useColors';
import type { useCommentPhoto } from '../../hooks/useCommentPhoto';

type Photo = ReturnType<typeof useCommentPhoto>;

/**
 * The gallery button that sits beside a comment field.
 *
 * Split from the preview below because the two live in different places: the
 * button belongs in the composer row next to Post, the preview belongs above
 * the field where it can be seen at a usable size.
 */
export function CommentPhotoButton({ photo, tint }: { photo: Photo; tint: string }) {
  return (
    <TouchableOpacity
      onPress={photo.openPicker}
      disabled={photo.preparing}
      hitSlop={8}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Add a photo to your comment"
    >
      {photo.preparing
        ? <ActivityIndicator size="small" color={tint} />
        : <ImagePlus size={21} color={tint} />}
    </TouchableOpacity>
  );
}

/**
 * The picked photo, above the field, with a way to take it back off. Renders
 * nothing until there's a photo — and always renders the picker sheet, which
 * is what the button opens.
 */
export function CommentPhotoPreview({ photo }: { photo: Photo }) {
  const c = useColors();

  return (
    <>
      {photo.photo && (
        <View style={styles.previewRow}>
          <View style={[styles.previewBox, { borderColor: c.borderDark }]}>
            <Image source={{ uri: photo.photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={photo.clear}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
            >
              <X size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ActionSheet
        visible={photo.pickerOpen}
        onClose={photo.closePicker}
        title="Add a photo"
        options={[
          { label: 'Take Photo', Icon: Camera, onPress: photo.pickFromCamera },
          { label: 'Choose Photo', Icon: Images, onPress: photo.pickFromLibrary },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4, alignItems: 'center', justifyContent: 'center' },
  previewRow: { paddingHorizontal: 16, paddingTop: 10 },
  // 16:9, matching how it will sit in the thread once it's posted.
  previewBox: {
    width: 132, aspectRatio: 16 / 9, borderRadius: 10, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
});
