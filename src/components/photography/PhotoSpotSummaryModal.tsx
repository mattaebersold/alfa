import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { MapPin, Clock, ShieldAlert, Navigation, Camera, Pencil, Trash2, ImagePlus } from 'lucide-react-native';
import SummaryModal from '../ui/SummaryModal';
import SpotContextRow from './SpotContextRow';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import {
  useGetPhotoSpotQuery, useDeletePhotoSpotMutation,
  useAddPhotoSpotPhotosMutation, useRemovePhotoSpotPhotoMutation,
} from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { normalizePickedAssets, uploadFile } from '../../utils/upload';
import { spotTypeLabel, spotCategoryLabel, spotTypeColor } from '../../constants/photoSpots';
import type { PhotoSpotPhoto } from '../../types/api';

/** The most photos one spot holds, everyone's together. Mirrors horacio's MAX_PHOTOS_PER_SPOT. */
const MAX_PHOTOS = 30;
/** How many one add can carry — multer's ceiling on the gallery field. */
const MAX_PER_ADD = 10;

/**
 * What a pin is, when you tap it.
 *
 * A summary rather than a screen: the map is the thing you're using, and a spot
 * is a paragraph and some photos — pushing a whole screen for that loses your
 * place on the map to read four lines.
 *
 * Fetched by id rather than handed the list row, because the map's listing is a
 * deliberately narrow projection (coordinate, title, owner) and everything worth
 * reading here — the body, the access note, the photos — isn't in it.
 */
export default function PhotoSpotSummaryModal({ spotId, onClose }: {
  spotId: string | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation<any>();
  const { data: spot } = useGetPhotoSpotQuery(spotId as string, { skip: !spotId });
  const me = useAppSelector((s) => s.auth.userInfo);
  const isOwner = !!spot && !!me?.user_id && (spot.user_id === me.user_id || me.accountType === 'admin');
  const [deleteSpot, { isLoading: deleting }] = useDeletePhotoSpotMutation();
  const [addPhotos] = useAddPhotoSpotPhotosMutation();
  const [removePhoto] = useRemovePhotoSpotPhotoMutation();
  const [adding, setAdding] = useState(false);

  /**
   * Anyone signed in can hang their own photos on a public spot — the point
   * of a pin is that other people go and shoot there. The owner has Edit for
   * the same thing, but a quick add from here is quicker than the form.
   */
  const canAdd = !!spot && !!me?.user_id && (!spot.private || isOwner);

  const addYourPhotos = async () => {
    if (!spot) return;
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

  /** Your own contribution, or anything on your own spot. */
  const mayRemove = (photo: PhotoSpotPhoto) =>
    !!me?.user_id && (photo.user_id === me.user_id || isOwner);

  const removeOne = (photo: PhotoSpotPhoto) => {
    if (!spot || !photo.filename) return;
    const whose = photo.user_id && photo.user_id !== me?.user_id
      ? `${photo.user?.username ?? 'their'}'s photo`
      : 'your photo';
    Alert.alert('Remove this photo?', `Takes ${whose} off the spot. This can't be undone.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removePhoto({ internal_id: spot.internal_id, filename: photo.filename! }).unwrap();
          } catch (err: any) {
            Alert.alert("Couldn't remove it", err?.data?.error ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  /** Your own pin: change it, or take it off the map. */
  const edit = () => {
    if (!spot) return;
    onClose();
    // After the summary has gone — iOS won't present a modal over one that's
    // still dismissing.
    setTimeout(() => nav.navigate('PhotoSpotCreate', { spotId: spot.internal_id }), 350);
  };
  const remove = () => {
    if (!spot) return;
    Alert.alert('Remove this spot?', `"${spot.title}" comes off the map for everyone. This can't be undone.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSpot(spot.internal_id).unwrap();
            onClose();
          } catch (err: any) {
            Alert.alert("Couldn't remove it", err?.data?.error ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const gallery = spot?.gallery ?? [];
  const avatarUrl = imageUrl(spot?.user?.profile?.[0] ?? spot?.user?.gallery?.[0]?.filename);
  const typeLabel = spotTypeLabel(spot?.type);
  const categoryLabel = spotCategoryLabel(spot?.category);

  /** Hand the coordinate to whichever map app the phone prefers. */
  const openInMaps = () => {
    if (!spot) return;
    const label = encodeURIComponent(spot.title || 'Photo spot');
    const url = Platform.OS === 'ios'
      ? `https://maps.apple.com/?ll=${spot.lat},${spot.lng}&q=${label}`
      : `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`;
    Linking.openURL(url);
  };

  return (
    <SummaryModal
      visible={!!spotId}
      onClose={onClose}
      actionLabel="Directions"
      onAction={openInMaps}
    >
      {!spot ? (
        <View style={styles.loading}>
          <Text style={{ color: colors.grey }}>Loading…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* The type's colour again, as a rule above the title — the same
              colour the pin was, so tapping one and reading this connect. */}
          <View style={[styles.livery, { backgroundColor: spotTypeColor(spot.type) }]} />

          <View style={styles.body}>
            <View style={styles.byline}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.segment }]} />
              )}
              <Text style={[styles.bylineText, { color: colors.grey }]} numberOfLines={1}>
                {spot.user?.username ? `Pinned by ${spot.user.username}` : 'Pinned'}
              </Text>
            </View>

            <Text style={[styles.title, { color: colors.fg }]}>{spot.title}</Text>

            {(typeLabel || categoryLabel) && (
              <View style={styles.badges}>
                {typeLabel && (
                  <View style={[styles.badge, { backgroundColor: spotTypeColor(spot.type) }]}>
                    <Text style={styles.badgeText}>{typeLabel}</Text>
                  </View>
                )}
                {categoryLabel && (
                  <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                    <Text style={[styles.badgeText, { color: colors.fg }]}>{categoryLabel}</Text>
                  </View>
                )}
              </View>
            )}

            {spot.location ? (
              <Row Icon={MapPin} text={spot.location} color={colors.grey} fg={colors.fg} />
            ) : null}
            {spot.best_time ? (
              <Row Icon={Clock} text={spot.best_time} color={colors.grey} fg={colors.fg} />
            ) : null}
            {spot.access_note ? (
              <Row Icon={ShieldAlert} text={spot.access_note} color={colors.grey} fg={colors.fg} />
            ) : null}

            {spot.body ? (
              <Text style={[styles.text, { color: colors.fg }]}>{spot.body}</Text>
            ) : null}
          </View>

          {/* Photos taken here — the evidence for the spot being worth the
              trip. The owner's carry no credit: the byline already says whose
              spot it is. One another member added is captioned with theirs.
              Hold a photo you may remove to take it down. */}
          {gallery.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shots}
            >
              {gallery.map((g, i) => {
                const url = imageUrl(g.filename);
                if (!url) return null;
                const credit = g.user_id && g.user_id !== spot.user_id ? g.user : null;
                const creditAvatar = imageUrl(credit?.profile?.[0] ?? credit?.gallery?.[0]?.filename);
                return (
                  <TouchableOpacity
                    key={g.filename ?? i}
                    activeOpacity={0.85}
                    onLongPress={mayRemove(g) ? () => removeOne(g) : undefined}
                    delayLongPress={350}
                    accessibilityRole="image"
                    accessibilityLabel={credit?.username ? `Photo by ${credit.username}` : 'Photo from this spot'}
                  >
                    <Image source={{ uri: url }} style={styles.shot} contentFit="cover" />
                    {credit && (
                      <View style={styles.credit}>
                        {creditAvatar ? (
                          <Image source={{ uri: creditAvatar }} style={styles.creditAvatar} contentFit="cover" />
                        ) : null}
                        <Text style={styles.creditText} numberOfLines={1}>
                          {credit.username ?? 'member'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {gallery.length === 0 && (
            <View style={[styles.noShots, { borderColor: colors.border }]}>
              <Camera size={14} color={colors.grey} />
              <Text style={[styles.noShotsText, { color: colors.grey }]}>
                No photos from here yet{canAdd ? ' — add yours' : ''}
              </Text>
            </View>
          )}

          {canAdd && (
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: brand }, adding && { opacity: 0.6 }]}
              onPress={addYourPhotos}
              disabled={adding}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Add your photos from this spot"
            >
              {adding
                ? <ActivityIndicator size="small" color={brand} />
                : <ImagePlus size={15} color={brand} strokeWidth={2.4} />}
              <Text style={[styles.addBtnText, { color: brand }]}>
                {adding ? 'Uploading…' : 'Add your photos'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Who and what is associated with this spot — the same tile row a
              post uses, reading the same generic Tag records. */}
          <SpotContextRow spotId={spot.internal_id} />

          {/* The owner's controls, at the foot where they don't compete with
              the spot itself. Edit reopens the pin form filled in; Remove asks
              first, since a spot is a place other people may have saved. */}
          {isOwner && (
            <View style={[styles.ownerRow, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.ownerBtn, { borderColor: colors.border }]}
                onPress={edit}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Edit this spot"
              >
                <Pencil size={14} color={colors.fg} />
                <Text style={[styles.ownerBtnText, { color: colors.fg }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ownerBtn, { borderColor: colors.border }, deleting && { opacity: 0.5 }]}
                onPress={remove}
                disabled={deleting}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Remove this spot"
              >
                <Trash2 size={14} color="#E23B3B" />
                <Text style={[styles.ownerBtnText, { color: '#E23B3B' }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.coords}>
            <Navigation size={11} color={colors.grey} />
            <Text style={[styles.coordsText, { color: colors.grey }]}>
              {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
            </Text>
          </View>
        </ScrollView>
      )}
    </SummaryModal>
  );
}

function Row({ Icon, text, color, fg }: {
  Icon: typeof MapPin; text: string; color: string; fg: string;
}) {
  return (
    <View style={styles.row}>
      <Icon size={13} color={color} />
      <Text style={[styles.rowText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  ownerRow: {
    flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ownerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
  },
  ownerBtnText: { fontSize: 13, fontWeight: '700' },
  livery:  { height: 4, borderRadius: 2, marginBottom: 14 },
  body:    { gap: 8 },

  byline:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar:     { width: 22, height: 22, borderRadius: 11 },
  bylineText: { fontSize: 12, fontWeight: '700' },

  title: { fontSize: 20, fontWeight: '800', lineHeight: 25 },

  badges:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  // Never uppercase, no letter-spacing — the house rule for every badge.
  badgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0 },

  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 2 },
  rowText: { flex: 1, fontSize: 13, lineHeight: 18 },

  text: { fontSize: 14, lineHeight: 20, marginTop: 4 },

  shots: { gap: 8, paddingTop: 14, paddingBottom: 6 },
  shot:  { width: 150, height: 110, borderRadius: 10 },
  // Over the photo's bottom-left corner: who took it, for a contributed one.
  credit: {
    position: 'absolute', left: 6, bottom: 6, maxWidth: 138,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  creditAvatar: { width: 14, height: 14, borderRadius: 7 },
  creditText:   { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700', flexShrink: 1 },

  addBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5,
    marginTop: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '700' },

  noShots: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderRadius: 10, borderStyle: 'dashed',
    paddingVertical: 16, marginVertical: 14,
  },
  noShotsText: { fontSize: 12, fontWeight: '600' },

  coords:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  coordsText: { fontSize: 11, fontVariant: ['tabular-nums'] },
});
