import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { MapPin, Clock, Users, Navigation } from 'lucide-react-native';
import { useGetRallyQuery } from '../../api/apiService';
import RouteMap from '../../components/routes/RouteMap';
import RallyRegistrationForm from '../../components/society/RallyRegistrationForm';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { isRallyUpcoming, toRallyFormEmbedUrl } from '../../utils/rally';
import type { SocietyScreenProps } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';

/**
 * Full-screen rally detail — reached from deep links and notifications. The
 * sheet at components/society/RallyDetailSheet.tsx is the same content in the
 * list context; the two are kept in step deliberately.
 *
 * Registration runs through the rally's own Airtable form rather than an RSVP
 * on our side, so there are no attend/decline controls here.
 */
export default function RallyDetailScreen({ route }: SocietyScreenProps<'RallyDetail'>) {
  const { rallyId } = route.params;
  const colors = useColors();
  const { data: rally, isLoading } = useGetRallyQuery(rallyId);

  const handleOpenMaps = useCallback(() => {
    if (!rally) return;
    if (rally.location_lat && rally.location_lng) {
      Linking.openURL(`https://maps.apple.com/?ll=${rally.location_lat},${rally.location_lng}&q=${encodeURIComponent(rally.location ?? '')}`);
    } else if (rally.location) {
      Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(rally.location)}`);
    }
  }, [rally]);

  if (isLoading || !rally) return <Spinner fullScreen />;

  const gallery = rally.gallery ?? [];
  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(gallery);
  const date = rally.event_date ? format(new Date(rally.event_date), 'EEEE, MMMM d, yyyy') : null;
  const formUrl = toRallyFormEmbedUrl(rally.form_id);
  // Registration is embedded below, but only while there's still a rally to
  // register for — a past rally's form is a dead end.
  const showRegistration = !!formUrl && isRallyUpcoming(rally);
  const hasCoords = Number.isFinite(rally.location_lat) && Number.isFinite(rally.location_lng);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        {hero
          ? <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
          : <View style={styles.heroPlaceholder} />
        }

        {/* Gallery strip */}
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
              <Text style={[styles.metaText, { color: colors.grey }]}>{date}{rally.event_time ? ` · ${rally.event_time}` : ''}</Text>
            </View>
          )}

          {rally.location ? (
            <TouchableOpacity style={styles.metaRow} onPress={handleOpenMaps}>
              <MapPin size={15} color={colors.primaryAlt} />
              <Text style={[styles.metaText, styles.metaLink]}>{rally.location}</Text>
            </TouchableOpacity>
          ) : null}

          {rally.attendee_limit != null && (
            <View style={styles.metaRow}>
              <Users size={15} color={colors.grey} />
              <Text style={[styles.metaText, { color: colors.grey }]}>{rally.attendee_limit} car limit</Text>
            </View>
          )}

          {rally.slots_available != null && (
            <Text style={styles.slots}>{rally.slots_available} slots available</Text>
          )}

          {rally.body ? (
            <Text style={[styles.description, { color: colors.fg }]}>{stripHtml(rally.body)}</Text>
          ) : null}
        </View>

        {/* Registration sits directly under the details, ahead of the map:
            signing up is the point of an upcoming rally, and it shouldn't be
            below the thing that tells you how to drive there. */}
        {showRegistration && <RallyRegistrationForm url={formUrl as string} />}

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
                style={ss.fill}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:          { paddingBottom: 32 },
  hero:            { width: '100%', aspectRatio: 16 / 9 },
  heroPlaceholder: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.primaryAlt },
  galleryStrip:    { padding: 8, gap: 6 },
  galleryThumb:    { width: 80, height: 60, borderRadius: 6 },
  body:            { padding: 16 },
  title:           { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  metaText:        { fontSize: 14 },
  metaLink:        { color: colors.primaryAlt, fontWeight: '600' },
  slots:           { fontSize: 13, fontWeight: '700', color: colors.primaryAlt, marginBottom: 12 },
  description:     { fontSize: 15, lineHeight: 22 },

  mapSection:      { paddingHorizontal: 16, gap: 10 },
  mapWrap:         { height: 180, borderRadius: 12, overflow: 'hidden' },
  directionsBtn:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1,
  },
  directionsText:  { fontSize: 14, fontWeight: '700' },
});
