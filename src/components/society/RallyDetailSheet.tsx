import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Clock, Navigation, Users } from 'lucide-react-native';
import SharedModal from '../ui/SharedModal';
import { useGetRallyQuery } from '../../api/apiService';
import RouteMap from '../routes/RouteMap';
import RallyRegistrationForm from './RallyRegistrationForm';
import RallyDays from './RallyDays';
import RallyFaq from './RallyFaq';
import Spinner from '../ui/Spinner';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { isRallyUpcoming, toRallyFormEmbedUrl, rallyDateRange } from '../../utils/rally';
import { stripHtml } from '../../utils/text';

interface Props {
  rallyId: string | null;
  onClose: () => void;
}

/** Shared rally-detail modal — used from the Society feed and the Rallys list. */
export default function RallyDetailSheet({ rallyId, onClose }: Props) {
  const colors = useColors();
  const { data: rally, isLoading } = useGetRallyQuery(rallyId!, { skip: !rallyId });

  const handleOpenMaps = useCallback(() => {
    if (!rally) return;
    if (rally.location_lat && rally.location_lng) {
      Linking.openURL(`https://maps.apple.com/?ll=${rally.location_lat},${rally.location_lng}&q=${encodeURIComponent(rally.location ?? '')}`);
    } else if (rally.location) {
      Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(rally.location)}`);
    }
  }, [rally]);

  const gallery = rally?.gallery ?? [];
  const hero = rally?.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(gallery);
  const date = rallyDateRange(rally, { month: 'long' });
  const formUrl = toRallyFormEmbedUrl(rally?.form_id);
  // Registration is embedded below, but only while there's still a rally to
  // register for — a past rally's form is a dead end.
  const showRegistration = !!formUrl && isRallyUpcoming(rally);
  const hasCoords = Number.isFinite(rally?.location_lat) && Number.isFinite(rally?.location_lng);

  return (
    <SharedModal
      visible={!!rallyId}
      onClose={onClose}
      title={rally?.title ?? 'Rally'}
      // The embedded form is tall and its inputs need the keyboard, so the sheet
      // takes the whole screen rather than sizing to content.
      fullHeight={showRegistration}
    >
      {isLoading || !rally ? (
        <Spinner />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {hero
            ? <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
            : <View style={[styles.hero, { backgroundColor: colors.primaryAlt }]} />
          }

          {gallery.length > 1 && (
            <FlatList
              data={gallery}
              keyExtractor={(g) => g.filename}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryStrip}
              renderItem={({ item }) => (
                <Image source={{ uri: imageUrl(item.filename) ?? undefined }} style={styles.galleryThumb} contentFit="cover" />
              )}
            />
          )}

          <View style={styles.body}>
            <Text style={[styles.title, { color: colors.fg }]}>{rally.title}</Text>

            {date && (
              <View style={styles.metaRow}>
                <Clock size={15} color={colors.grey} />
                <Text style={[styles.metaText, { color: colors.grey }]}>
                  {date}{rally.event_time ? ` · ${rally.event_time}` : ''}
                </Text>
              </View>
            )}

            {rally.location ? (
              <TouchableOpacity style={styles.metaRow} onPress={handleOpenMaps}>
                <MapPin size={15} color={colors.primaryAlt} />
                <Text style={[styles.metaText, { color: colors.primaryAlt, fontWeight: '600' }]}>{rally.location}</Text>
              </TouchableOpacity>
            ) : null}

            {rally.attendee_limit != null && (
              <View style={styles.metaRow}>
                <Users size={15} color={colors.grey} />
                <Text style={[styles.metaText, { color: colors.grey }]}>{rally.attendee_limit} car limit</Text>
              </View>
            )}

            {rally.slots_available != null && (
              <Text style={[styles.slots, { color: colors.primaryAlt }]}>{rally.slots_available} slots available</Text>
            )}

            {rally.body ? (
              <Text style={[styles.description, { color: colors.fg }]}>{stripHtml(rally.body)}</Text>
            ) : null}
          </View>

          {/* The itinerary and FAQ are the same components the full screen
              uses, so the two stay in step. There are no section tabs here —
              a sheet is a peek, and tabs inside one are furniture. */}
          <RallyDays days={rally.days} />

          {/* Registration sits under the itinerary, ahead of the map: signing
              up is the point of an upcoming rally, and it shouldn't be below
              the thing that tells you how to drive there. */}
          {showRegistration && <RallyRegistrationForm url={formUrl as string} />}

          <RallyFaq faqs={rally.faqs} />

          {/* A native map rather than an embedded Google Maps iframe: expo-maps
              is already in the app for driving routes, it renders far better on
              a phone than a boxed web map, and it needs no API key in a WebView. */}
          {hasCoords && (
            <View style={styles.mapSection}>
              <View style={styles.mapWrap} pointerEvents="none">
                <RouteMap
                  path={[]}
                  center={{ lat: rally.location_lat as number, lng: rally.location_lng as number }}
                  zoom={14}
                  color={colors.primaryAlt}
                  markers={[{
                    lat: rally.location_lat as number,
                    lng: rally.location_lng as number,
                    label: rally.location || rally.title,
                  }]}
                  style={styles.map}
                />
              </View>
              <TouchableOpacity
                style={[styles.directionsBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={handleOpenMaps}
                activeOpacity={0.8}
              >
                <Navigation size={15} color={colors.primaryAlt} />
                <Text style={[styles.directionsText, { color: colors.fg }]}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  scroll:  { paddingBottom: 40 },
  hero:    { width: '100%', aspectRatio: 16 / 9 },
  galleryStrip: { padding: 8, gap: 6 },
  galleryThumb: { width: 80, height: 60, borderRadius: 6 },
  body:    { padding: 16 },
  title:   { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  metaText:{ fontSize: 14 },
  slots:   { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  description: { fontSize: 15, lineHeight: 22 },

  mapSection: { paddingHorizontal: 16, gap: 10 },
  // The map is a picture of where this is, not something to pan around inside a
  // scrolling sheet — `pointerEvents="none"` on the wrapper keeps every drag
  // going to the sheet, and the button below handles the one real interaction.
  mapWrap:  { height: 180, borderRadius: 12, overflow: 'hidden' },
  map:      { flex: 1 },
  directionsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1,
  },
  directionsText: { fontSize: 14, fontWeight: '700' },
});
