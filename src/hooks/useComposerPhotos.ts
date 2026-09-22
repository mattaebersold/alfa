import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { toUploadableJpeg, uploadFile } from '../utils/upload';

export interface ComposerPhoto {
  /** Local uri, already normalised to JPEG and ready to preview or upload. */
  uri: string;
}

/** Where a photo comes from — the two choices the attach button offers. */
export type PhotoSource = 'library' | 'camera';

/**
 * Adds photos to a FormData under the key the server reads.
 *
 * `gallery` is what commentController's createEntry passes to
 * images.processGallery — the same field the post forms use, and the one the
 * message routes take too. Standalone so a caller that clears its strip
 * before the send goes out (and gives it back on failure) can append from the
 * list it captured rather than from state that's already empty.
 */
export function appendPhotosTo(fd: FormData, photos: ComposerPhoto[]) {
  photos.forEach((p) => fd.append('gallery', uploadFile(p.uri)));
}

/**
 * The photo half of a comment or message composer.
 *
 * Owns the permission prompts, the picker, and the JPEG conversion, so the
 * Composer only has to render a strip of thumbnails and hand `appendTo` the
 * FormData on submit. Every surface that writes a comment or a message shares
 * this — the same `gallery` part name is what the comment, direct-message and
 * marketplace-message routes all read.
 *
 * `max` is the server's ceiling for the route the photos are going to, which
 * differs: a marketplace reply is `upload.single`, so a second file would be
 * rejected as an unexpected field, while a direct message takes four. The
 * picker asks for as many as are still allowed, and the attach button hides
 * once the strip is full.
 */
export function useComposerPhotos(max = 4) {
  const [photos, setPhotos] = useState<ComposerPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);

  const room = Math.max(0, max - photos.length);

  const add = useCallback(async (from: PhotoSource) => {
    if (room === 0) return;
    const permission = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert(
        'Permission needed',
        from === 'camera'
          ? 'Please allow camera access to take a photo.'
          : 'Please allow photo access to add a photo.',
      );
      return;
    }

    // No `allowsEditing`: a comment's list crops to 16:9 for the thumbnail, but
    // tapping it opens the photo whole — so cropping on the way in would throw
    // away the part the viewer exists to show.
    const result = from === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsMultipleSelection: room > 1,
        selectionLimit: room,
      });

    if (result.canceled) return;

    setPreparing(true);
    try {
      // iOS hands back HEIC, which the server's sharp/libvips can't decode.
      const picked = await Promise.all(
        result.assets.slice(0, room).map(async (a) => ({ uri: await toUploadableJpeg(a.uri) })),
      );
      setPhotos((prev) => [...prev, ...picked].slice(0, max));
    } finally {
      setPreparing(false);
    }
  }, [room, max]);

  const remove = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setPhotos([]), []);

  /** Puts the strip back — for a send that failed and shouldn't lose them. */
  const restore = useCallback((restored: ComposerPhoto[]) => setPhotos(restored), []);

  /** Adds every photo to a FormData under the key the server reads. */
  const appendTo = useCallback((fd: FormData) => appendPhotosTo(fd, photos), [photos]);

  return {
    photos,
    hasPhotos: photos.length > 0,
    /** True once the strip holds as many as the route will take. */
    full: room === 0,
    preparing,
    add,
    remove,
    clear,
    restore,
    appendTo,
  };
}

export type ComposerPhotos = ReturnType<typeof useComposerPhotos>;
