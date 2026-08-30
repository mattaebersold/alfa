import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { toUploadableJpeg, uploadFile } from '../utils/upload';

export interface PickedPhoto {
  /** Local uri, already normalised to JPEG and ready to preview or upload. */
  uri: string;
}

/**
 * The photo half of a comment composer.
 *
 * Owns the "pick or shoot" choice, the permission prompts and the JPEG
 * conversion, so CommentsSheet and InlineComments only have to render a button,
 * a preview, and hand `appendTo` the FormData on submit.
 */
export function useCommentPhoto() {
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const take = useCallback(async (from: 'library' | 'camera') => {
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

    const result = from === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 });

    if (result.canceled) return;

    // No `allowsEditing`: the comment list crops to 16:9 for the thumbnail, but
    // tapping it opens the photo whole — so cropping on the way in would throw
    // away the part the viewer exists to show.
    setPreparing(true);
    try {
      // iOS hands back HEIC, which the server's sharp/libvips can't decode.
      const uri = await toUploadableJpeg(result.assets[0].uri);
      setPhoto({ uri });
    } finally {
      setPreparing(false);
    }
  }, []);

  const clear = useCallback(() => setPhoto(null), []);

  /** Adds the photo to a comment's FormData under the key the server reads. */
  const appendTo = useCallback((fd: FormData) => {
    if (!photo) return;
    // `gallery` is what commentController's createEntry passes to
    // images.processGallery — the same field the post forms use.
    fd.append('gallery', uploadFile(photo.uri));
  }, [photo]);

  return {
    photo,
    hasPhoto: !!photo,
    preparing,
    pickerOpen,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
    /** Options for the ActionSheet that asks where the photo comes from. */
    pickFromLibrary: () => take('library'),
    pickFromCamera: () => take('camera'),
    clear,
    appendTo,
  };
}
