import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAddPhotoSpotPhotosMutation } from '../api/orsApi';
import { useOrsSelector } from '../store/createStore';
import { normalizePickedAssets, uploadFile } from '../utils/upload';
import type { PhotoSpot } from '../types/ors';

/** The most photos one spot holds, everyone's together. Mirrors horacio's MAX_PHOTOS_PER_SPOT. */
export const MAX_PHOTOS = 30;
/** How many one add can carry — multer's ceiling on the gallery field. */
export const MAX_PER_ADD = 10;

/**
 * "Add your photos" to a spot: pick from the library, upload, done.
 *
 * Anyone signed in can hang their own photos on a public spot — the point of
 * a pin is that other people go and shoot there. Shared by the spot's summary
 * and the map's search card, which offers it when you've searched somewhere
 * that's already pinned.
 */
export function useAddSpotPhotos() {
  const me = useOrsSelector((s) => s.auth.userInfo);
  const [addPhotos] = useAddPhotoSpotPhotosMutation();
  const [adding, setAdding] = useState(false);

  /** Whether you may add to this spot — signed in, and it's public or yours. */
  const canAdd = (spot: PhotoSpot | null | undefined) =>
    !!spot && !!me?.user_id && (!spot.private || spot.user_id === me.user_id);

  const add = async (spot: PhotoSpot) => {
    const room = MAX_PHOTOS - (spot.gallery?.length ?? 0);
    if (room <= 0) {
      Alert.alert('Full up', 'This spot already has all the photos it can hold.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.min(room, MAX_PER_ADD),
      quality: 0.85,
    });
    if (result.canceled) return;

    setAdding(true);
    try {
      const picked = await normalizePickedAssets(result.assets);
      const fd = new FormData();
      fd.append('internal_id', spot.internal_id);
      // The same file part every upload form builds — see utils/upload.
      picked.slice(0, Math.min(room, MAX_PER_ADD)).forEach((p) => fd.append('gallery', uploadFile(p.uri)));
      await addPhotos({ internal_id: spot.internal_id, body: fd }).unwrap();
    } catch (err: any) {
      Alert.alert('Not added', err?.data?.error ?? "Those didn't upload. Try again in a moment.");
    } finally {
      setAdding(false);
    }
  };

  return { add, adding, canAdd };
}
