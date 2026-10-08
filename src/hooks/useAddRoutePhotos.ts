import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAddRoutePhotosMutation, useRemoveRoutePhotoMutation } from '../api/apiService';
import { useAppSelector } from '../store/store';
import { normalizePickedAssets, uploadFile } from '../utils/upload';
import type { DrivingRoute, RouteGalleryItem } from '../types/api';

/** Everyone's photos on one route together. Mirrors horacio's MAX_PHOTOS_PER_ROUTE. */
export const MAX_ROUTE_PHOTOS = 60;
/** How many one add can carry — multer's ceiling on the gallery field. */
const MAX_PER_ADD = 10;

/**
 * Photos along a route: pick from the library and upload, to the route or to
 * one of its pit stops; and take one down again. The owner and anyone else
 * who can see the route may add — the same as a photography spot's photos.
 */
export function useRoutePhotos(route: Pick<DrivingRoute, 'internal_id' | 'user_id' | 'private' | 'gallery'>) {
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const accountType = useAppSelector((s) => s.auth.userInfo?.accountType);
  const [addPhotos] = useAddRoutePhotosMutation();
  const [removePhoto] = useRemoveRoutePhotoMutation();
  /** Which target is uploading: a pit stop's id, 'route', or null. */
  const [adding, setAdding] = useState<string | null>(null);

  const isOwner = !!myId && myId === route.user_id;
  const canAdd = !!myId && (!route.private || isOwner);

  /** Yours, or any if the route is yours. A photo without an uploader is the owner's. */
  const canRemove = (photo: RouteGalleryItem) =>
    !!myId && ((photo.user_id ?? route.user_id) === myId || isOwner || accountType === 'admin');

  const add = async (pitStopId?: string) => {
    const room = MAX_ROUTE_PHOTOS - (route.gallery?.length ?? 0);
    if (room <= 0) {
      Alert.alert('Full up', 'This route already has all the photos it can hold.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.min(room, MAX_PER_ADD),
      quality: 0.85,
    });
    if (result.canceled) return;

    setAdding(pitStopId ?? 'route');
    try {
      const picked = await normalizePickedAssets(result.assets);
      const fd = new FormData();
      fd.append('internal_id', route.internal_id);
      if (pitStopId) fd.append('pit_stop_id', pitStopId);
      picked.slice(0, Math.min(room, MAX_PER_ADD)).forEach((p) => fd.append('gallery', uploadFile(p.uri)));
      await addPhotos({ internal_id: route.internal_id, body: fd }).unwrap();
    } catch (err: any) {
      Alert.alert('Not added', err?.data?.error ?? "Those didn't upload. Try again in a moment.");
    } finally {
      setAdding(null);
    }
  };

  const remove = (photo: RouteGalleryItem) => {
    if (!photo.filename || !canRemove(photo)) return;
    Alert.alert('Remove this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removePhoto({ internal_id: route.internal_id, filename: photo.filename! }).unwrap();
          } catch (err: any) {
            Alert.alert('Not removed', err?.data?.error ?? 'Try again in a moment.');
          }
        },
      },
    ]);
  };

  return { canAdd, canRemove, add, adding, remove };
}
