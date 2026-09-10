import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Clock, ShieldAlert, Navigation, Camera } from 'lucide-react-native';
import SummaryModal from '../ui/SummaryModal';
import SpotContextRow from './SpotContextRow';
import { useColors } from '../../hooks/useColors';
import { useGetPhotoSpotQuery } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { spotTypeLabel, spotCategoryLabel, spotTypeColor } from '../../constants/photoSpots';

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
  const { data: spot } = useGetPhotoSpotQuery(spotId as string, { skip: !spotId });

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

          {/* Photos taken here — the evidence for the spot being worth the trip. */}
          {gallery.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shots}
            >
              {gallery.map((g, i) => {
                const url = imageUrl(g.filename);
                if (!url) return null;
                return (
                  <Image
                    key={g.filename ?? i}
                    source={{ uri: url }}
                    style={styles.shot}
                    contentFit="cover"
                  />
                );
              })}
            </ScrollView>
          )}

          {gallery.length === 0 && (
            <View style={[styles.noShots, { borderColor: colors.border }]}>
              <Camera size={14} color={colors.grey} />
              <Text style={[styles.noShotsText, { color: colors.grey }]}>
                No photos from here yet
              </Text>
            </View>
          )}

          {/* Who and what is associated with this spot — the same tile row a
              post uses, reading the same generic Tag records. */}
          <SpotContextRow spotId={spot.internal_id} />

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

  shots: { gap: 8, paddingVertical: 14 },
  shot:  { width: 150, height: 110, borderRadius: 10 },

  noShots: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderRadius: 10, borderStyle: 'dashed',
    paddingVertical: 16, marginVertical: 14,
  },
  noShotsText: { fontSize: 12, fontWeight: '600' },

  coords:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  coordsText: { fontSize: 11, fontVariant: ['tabular-nums'] },
});
