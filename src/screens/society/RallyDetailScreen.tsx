import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, FlatList,
  type NativeSyntheticEvent, type NativeScrollEvent, type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Clock, Users, Navigation } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useGetRallyQuery } from '../../api/apiService';
import RouteMap from '../../components/routes/RouteMap';
import RallyRegistrationForm from '../../components/society/RallyRegistrationForm';
import RallyDays from '../../components/society/RallyDays';
import RallyFaq from '../../components/society/RallyFaq';
import RallySubNav, { type RallySection } from '../../components/society/RallySubNav';
import Avatar from '../../components/ui/Avatar';
import ImageLightbox from '../../components/ui/ImageLightbox';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { isRallyUpcoming, toRallyFormEmbedUrl, rallyDateRange } from '../../utils/rally';
import type { SocietyScreenProps } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';

/**
 * Full-screen rally detail — reached from deep links and notifications. The
 * sheet at components/society/RallyDetailSheet.tsx is the same content in the
 * list context; the two are kept in step deliberately.
 *
 * Laid out to match the web rally page: a hero, sticky section tabs, then
 * details, itinerary, registration and FAQ in that order.
 *
 * Registration runs through the rally's own Airtable form rather than an RSVP
 * on our side, so there are no attend/decline controls here.
 */
export default function RallyDetailScreen({ route }: SocietyScreenProps<'RallyDetail'>) {
  const { rallyId } = route.params;
  const c = useColors();
  const navigation = useNavigation<any>();
  const { data: rally, isLoading, refetch } = useGetRallyQuery(rallyId);
  const refreshControl = useRefreshControl(refetch);

  const scrollRef = useRef<ScrollView>(null);
  /** Where each section starts, filled in by onLayout as the page is built. */
  const offsets = useRef<Record<string, number>>({});
  const [active, setActive] = useState<string>('details');
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  const handleOpenMaps = useCallback(() => {
    if (!rally) return;
    if (rally.location_lat && rally.location_lng) {
      Linking.openURL(`https://maps.apple.com/?ll=${rally.location_lat},${rally.location_lng}&q=${encodeURIComponent(rally.location ?? '')}`);
    } else if (rally.location) {
      Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(rally.location)}`);
    }
  }, [rally]);

  /** Records a section's y position so the tabs can jump to it. */
  const measure = useCallback((id: string) => (e: LayoutChangeEvent) => {
    offsets.current[id] = e.nativeEvent.layout.y;
  }, []);

  const goToSection = useCallback((id: string) => {
    const y = offsets.current[id];
    if (y == null) return;
    setActive(id);
    // Less the tab bar's own height, so the heading lands below it rather than
    // under it.
    scrollRef.current?.scrollTo({ y: Math.max(y - TAB_BAR_HEIGHT, 0), animated: true });
  }, []);

  if (isLoading || !rally) return <Spinner fullScreen />;

  const gallery = rally.gallery ?? [];
  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(gallery);
  const dateLine = rallyDateRange(rally, { month: 'long' });
  const formUrl = toRallyFormEmbedUrl(rally.form_id);
  // Registration is embedded below, but only while there's still a rally to
  // register for — a past rally's form is a dead end.
  const showRegistration = !!formUrl && isRallyUpcoming(rally);
  const hasCoords = Number.isFinite(rally.location_lat) && Number.isFinite(rally.location_lng);
  const mapImage = rally.map_image ? imageUrl(rally.map_image) : null;
  const attending = rally.attending_members_data ?? [];
  const hasDays = (rally.days?.length ?? 0) > 0;
  const hasFaqs = (rally.faqs?.length ?? 0) > 0;

  // Only the sections this rally actually has get a tab, listed in the order
  // they appear down the page so scrolling moves the highlight along rather
  // than jumping about.
  const sections: RallySection[] = [
    { id: 'details', label: 'Details' },
    ...(hasDays ? [{ id: 'itinerary', label: 'Itinerary' }] : []),
    ...(showRegistration ? [{ id: 'register', label: 'RSVP' }] : []),
    ...(hasFaqs ? [{ id: 'faq', label: 'FAQ' }] : []),
  ];

  /**
   * The last section whose top has passed the tab bar wins, which is what makes
   * reading down the page move the highlight rather than the highlight only
   * following taps.
   */
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y + TAB_BAR_HEIGHT + 8;
    let current = sections[0]?.id;
    for (const section of sections) {
      const top = offsets.current[section.id];
      if (top != null && top <= y) current = section.id;
    }
    if (current && current !== active) setActive(current);
  };

  const galleryUrls = gallery
    .map((g) => imageUrl(g.filename))
    .filter((u): u is string => !!u);

  // One viewer for every photo on the page, in the order they appear: the hero
  // (when it's its own image rather than the first gallery shot), the gallery,
  // then the route map. The offsets below index into this.
  const heroIsOwnImage = !!rally.hero_image && !!hero;
  const viewerImages = [
    ...(heroIsOwnImage ? [hero as string] : []),
    ...galleryUrls,
    ...(mapImage ? [mapImage] : []),
  ];
  const galleryOffset = heroIsOwnImage ? 1 : 0;
  const mapOffset = galleryOffset + galleryUrls.length;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: c.bg }]} edges={['bottom']}>
      <ScrollView
        ref={scrollRef}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        // Index 1 is the tab bar: it pins under the header once the hero has
        // scrolled past, the way the web page's does.
        stickyHeaderIndices={sections.length > 1 ? [1] : undefined}
      >
        {/* Hero + gallery strip — one child, so the sticky index below is
            stable whether or not there's a gallery. */}
        <View>
          {hero
            ? (
              <TouchableOpacity activeOpacity={0.95} onPress={() => setZoomIndex(0)}>
                <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
              </TouchableOpacity>
            )
            : <View style={styles.heroPlaceholder} />
          }

          {gallery.length > 1 && (
            <FlatList
              data={gallery}
              keyExtractor={(g) => g.filename}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryStrip}
              renderItem={({ item, index }) => (
                <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomIndex(galleryOffset + index)}>
                  <Image source={{ uri: imageUrl(item.filename) ?? undefined }} style={styles.galleryThumb} contentFit="cover" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        <RallySubNav sections={sections} active={active} onSelect={goToSection} />

        <View onLayout={measure('details')} style={styles.body}>
          <Text style={[styles.title, { color: c.fg }]}>{rally.title}</Text>

          {dateLine && (
            <View style={styles.metaRow}>
              <Clock size={15} color={c.grey} />
              <Text style={[styles.metaText, { color: c.grey }]}>
                {dateLine}{rally.event_time ? ` · ${rally.event_time}` : ''}
              </Text>
            </View>
          )}

          {rally.location ? (
            <TouchableOpacity style={styles.metaRow} onPress={handleOpenMaps}>
              <MapPin size={15} color={c.primaryAlt} />
              <Text style={[styles.metaText, styles.metaLink]}>{rally.location}</Text>
            </TouchableOpacity>
          ) : null}

          {rally.attendee_limit != null && (
            <View style={styles.metaRow}>
              <Users size={15} color={c.grey} />
              <Text style={[styles.metaText, { color: c.grey }]}>{rally.attendee_limit} car limit</Text>
            </View>
          )}

          {rally.slots_available != null && (
            <Text style={styles.slots}>{rally.slots_available} slots available</Text>
          )}

          {rally.body ? (
            <Text style={[styles.description, { color: c.fg }]}>{stripHtml(rally.body)}</Text>
          ) : null}
        </View>

        <View onLayout={measure('itinerary')}>
          <RallyDays days={rally.days} />
        </View>

        {/* Route map. Full width and contained — a route is only useful
            uncropped — and tappable, so it can be opened and zoomed, which a
            printed-detail map usually needs. */}
        {mapImage && (
          <View style={styles.section}>
            <Text style={[styles.heading, { color: c.fg }]}>Route Map</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setZoomIndex(mapOffset)}
              style={[styles.mapImageWrap, { backgroundColor: c.segment }]}
            >
              <Image source={{ uri: mapImage }} style={styles.mapImage} contentFit="contain" />
            </TouchableOpacity>
            <Text style={[styles.hint, { color: c.grey }]}>Tap the map to open it full size.</Text>
          </View>
        )}

        {attending.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.heading, { color: c.fg }]}>Attending Members</Text>
            <View style={styles.memberWrap}>
              {attending.map((member) => (
                <TouchableOpacity
                  key={member.user_id}
                  style={[styles.memberChip, { backgroundColor: c.card, borderColor: c.border }]}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('UserDetail', {
                    userId: member.user_id,
                    username: member.username,
                  })}
                >
                  <Avatar user={member} size={26} />
                  <Text style={[styles.memberName, { color: c.fg }]} numberOfLines={1}>
                    {member.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Registration sits under the itinerary, ahead of the map: signing up
            is the point of an upcoming rally, and it shouldn't be below the
            thing that tells you how to drive there. */}
        {showRegistration && (
          <View onLayout={measure('register')} style={styles.registerSection}>
            <Text style={[styles.heading, styles.registerHeading, { color: c.fg }]}>RSVP</Text>
            <RallyRegistrationForm url={formUrl as string} />
          </View>
        )}

        <View onLayout={measure('faq')}>
          <RallyFaq faqs={rally.faqs} />
        </View>

        {hasCoords && (
          <View style={styles.mapSection}>
            <View style={styles.mapWrap} pointerEvents="none">
              <RouteMap
                path={[]}
                center={{ lat: rally.location_lat as number, lng: rally.location_lng as number }}
                zoom={14}
                color={c.primaryAlt}
                markers={[{
                  lat: rally.location_lat as number,
                  lng: rally.location_lng as number,
                  label: rally.location || rally.title,
                }]}
                style={ss.fill}
              />
            </View>
            <TouchableOpacity
              style={[styles.directionsBtn, { borderColor: c.border, backgroundColor: c.card }]}
              onPress={handleOpenMaps}
              activeOpacity={0.8}
            >
              <Navigation size={15} color={c.primaryAlt} />
              <Text style={[styles.directionsText, { color: c.fg }]}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ImageLightbox
        images={viewerImages}
        initialIndex={zoomIndex ?? 0}
        visible={zoomIndex !== null}
        onClose={() => setZoomIndex(null)}
      />
    </SafeAreaView>
  );
}

/** Height of the sticky tab bar — 13pt padding either side of a 14pt line. */
const TAB_BAR_HEIGHT = 46;

const styles = StyleSheet.create({
  scroll:          { paddingBottom: 40 },
  hero:            { width: '100%', aspectRatio: 2996 / 1417 },
  heroPlaceholder: { width: '100%', aspectRatio: 2996 / 1417, backgroundColor: colors.primaryAlt },
  galleryStrip:    { padding: 8, gap: 6 },
  galleryThumb:    { width: 80, height: 60, borderRadius: 6 },
  body:            { padding: 16 },
  title:           { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  metaText:        { fontSize: 14 },
  metaLink:        { color: colors.primaryAlt, fontWeight: '600' },
  slots:           { fontSize: 13, fontWeight: '700', color: colors.primaryAlt, marginBottom: 12 },
  description:     { fontSize: 15, lineHeight: 22 },

  // Shared shape with RallyDays/RallyFaq, so the page reads as one rhythm.
  section:         { paddingHorizontal: 16, paddingTop: 28 },
  heading:         { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  hint:            { fontSize: 12, marginTop: 8 },
  mapImageWrap:    { borderRadius: 12, overflow: 'hidden' },
  mapImage:        { width: '100%', aspectRatio: 4 / 3 },

  memberWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip:      {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 6, paddingRight: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%',
  },
  memberName:      { fontSize: 13, fontWeight: '600', flexShrink: 1 },

  registerSection: { paddingTop: 28 },
  registerHeading: { paddingHorizontal: 16 },

  mapSection:      { paddingHorizontal: 16, paddingTop: 28, gap: 10 },
  mapWrap:         { height: 180, borderRadius: 12, overflow: 'hidden' },
  directionsBtn:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1,
  },
  directionsText:  { fontSize: 14, fontWeight: '700' },
});
