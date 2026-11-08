import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, FlatList, Linking,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { useNavigation } from '@react-navigation/native';
import { MapPin, Clock, Navigation, Users, Trash2, Settings, Pencil, UserPlus, UserCheck } from 'lucide-react-native';
import ActionSheet from '../ui/ActionSheet';
import SharedModal, { PANE_GUTTER } from '../ui/SharedModal';
import { useGetRallyQuery, useGetMyRallysQuery, useToggleRallyInterestMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useBrandColor } from '../../hooks/useBrandColor';
import RouteMap from '../routes/RouteMap';
import RallyRegistrationForm from './RallyRegistrationForm';
import RallyDays from './RallyDays';
import RallyFaq from './RallyFaq';
import UserByline from '../members/UserByline';
import ImageLightbox from '../ui/ImageLightbox';
import Spinner from '../ui/Spinner';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { isRallyUpcoming, toRallyFormEmbedUrl, rallyDateRange, RALLY_DATE_TBA } from '../../utils/rally';
import { stripHtml } from '../../utils/text';
import { useRallyDelete } from '../../hooks/useRallyDelete';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE, PILL_RADIUS } from '../../constants/config';

/** The website, for what only it can do — editing a rally. */
const WEB_BASE = 'https://openroadsociety.co';
import { FONT_INTER } from '../../constants/fonts'
import { openInMaps } from '../../utils/openInMaps';

interface Props {
  rallyId: string | null;
  onClose: () => void;
}

/** Shared rally-detail modal — used from the Society feed and the Rallys list. */
export default function RallyDetailSheet({ rallyId, onClose }: Props) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { data: rally, isLoading } = useGetRallyQuery(rallyId!, { skip: !rallyId });
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  /** The cog's menu. */
  const [menuOpen, setMenuOpen] = useState(false);
  // The rally is gone once this resolves, so the sheet closes rather than
  // sitting on a stale copy of it.
  const { canDelete, confirmDelete, isDeleting } = useRallyDelete(rally, onClose);

  // "I'm interested": read off your My Events rallys, set optimistically.
  const brand = useBrandColor();
  const loggedIn = !!useAppSelector((s) => s.auth.userInfo);
  const { data: myRallys } = useGetMyRallysQuery(undefined, { skip: !loggedIn || !rallyId });
  const serverInterested = !!myRallys?.entries.some((r) => r.internal_id === rallyId);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  useEffect(() => { setOptimistic(null); }, [serverInterested, rallyId]);
  const interested = optimistic ?? serverInterested;
  const [toggleInterest, { isLoading: togglingInterest }] = useToggleRallyInterestMutation();
  const onToggleInterest = async () => {
    if (!rallyId) return;
    setOptimistic(!interested);
    try {
      const res = await toggleInterest({ rally_id: rallyId }).unwrap();
      setOptimistic(res.is_interested);
    } catch {
      setOptimistic(null);
    }
  };

  const handleOpenMaps = useCallback(() => {
    if (!rally) return;
    openInMaps(rally);
  }, [rally]);

  // A member chip leaves the sheet behind: the profile is a screen, and
  // stacking it under an open modal leaves the sheet floating over it.
  const goToUser = useCallback((userId: string, username?: string) => {
    onClose();
    requestAnimationFrame(() => nav.navigate('UserDetail', { userId, username }));
  }, [nav, onClose]);

  const gallery = rally?.gallery ?? [];
  const hero = rally?.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(gallery);
  const date = rally ? rallyDateRange(rally, { month: 'long' }) ?? RALLY_DATE_TBA : null;
  const formUrl = toRallyFormEmbedUrl(rally?.form_id);
  // Registration is embedded below, but only while there's still a rally to
  // register for — a past rally's form is a dead end.
  const showRegistration = !!formUrl && isRallyUpcoming(rally);
  const hasCoords = Number.isFinite(rally?.location_lat) && Number.isFinite(rally?.location_lng);
  const mapImage = rally?.map_image ? imageUrl(rally.map_image) : null;
  const attending = rally?.attending_members_data ?? [];

  // One viewer for every photo in the sheet, in the order they appear: the hero
  // (when it's its own image rather than the first gallery shot), the gallery,
  // then the route map. The offsets below index into this.
  const galleryUrls = gallery
    .map((g) => imageUrl(g.filename))
    .filter((u): u is string => !!u);
  const heroIsOwnImage = !!rally?.hero_image && !!hero;
  const viewerImages = [
    ...(heroIsOwnImage ? [hero as string] : []),
    ...galleryUrls,
    ...(mapImage ? [mapImage] : []),
  ];
  const galleryOffset = heroIsOwnImage ? 1 : 0;
  const mapOffset = galleryOffset + galleryUrls.length;

  return (
    <SharedModal
      visible={!!rallyId}
      onClose={onClose}
      // No title bar: the hero runs to the pane's top, the grabber over it,
      // and the title is under the photo.
      hideHeader
      // The embedded form is tall and its inputs need the keyboard, so the sheet
      // takes the whole screen rather than sizing to content.
      fullHeight={showRegistration}
      // Otherwise nearly the whole screen, whatever the rally holds — it's a
      // page's worth of itinerary, FAQ and map, not a peek.
      heightRatio={showRegistration ? undefined : 0.92}
    >
      {isLoading || !rally ? (
        <Spinner />
      ) : (
        <>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {hero
            ? (
              <TouchableOpacity activeOpacity={0.95} onPress={() => setZoomIndex(0)}>
                <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
              </TouchableOpacity>
            )
            : <View style={[styles.hero, { backgroundColor: colors.primaryAlt }]} />
          }

          {gallery.length > 1 && (
            <FlatList
              data={gallery}
              keyExtractor={(g, i) => g.internal_id ?? g.filename ?? String(i)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryStrip}
              renderItem={({ item, index }) => (
                <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomIndex(galleryOffset + index)}>
                  <Image source={{ uri: imageUrl(item.filename, 'small') ?? undefined }} style={styles.galleryThumb} contentFit="cover" />
                </TouchableOpacity>
              )}
            />
          )}

          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.fg }]}>{rally.title}</Text>
            </View>

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

            {/* Interest — puts the rally in your My Events, as Attend does an event. */}
            {loggedIn && (
              <TouchableOpacity
                style={[styles.interestBtn, { backgroundColor: interested ? brand : colors.card }, togglingInterest && { opacity: 0.6 }]}
                onPress={onToggleInterest}
                disabled={togglingInterest}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: interested }}
              >
                {interested
                  ? <UserCheck size={17} color={COLOR_BLACK} strokeWidth={2.6} />
                  : <UserPlus size={17} color={colors.fg} strokeWidth={2.6} />}
                <Text style={[styles.interestText, { color: interested ? COLOR_BLACK : colors.fg }]}>
                  {interested ? 'Interested' : "I'm Interested"}
                </Text>
              </TouchableOpacity>
            )}

            {rally.body ? (
              <Text style={[styles.description, { color: colors.fg }]}>{stripHtml(rally.body)}</Text>
            ) : null}
          </View>

          {/* The itinerary and FAQ are the same components the full screen
              uses, so the two stay in step. There are no section tabs here —
              a sheet is a peek, and tabs inside one are furniture. */}
          <RallyDays days={rally.days} />

          {/* Route map. Full width and contained — a route is only useful
              uncropped — and tappable, so it opens in the viewer, which a
              printed-detail map usually needs. */}
          {mapImage && (
            <View style={styles.section}>
              <Text style={[styles.heading, { color: colors.fg }]}>Route Map</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setZoomIndex(mapOffset)}
                style={[styles.mapImageWrap, { backgroundColor: colors.segment }]}
              >
                <Image source={{ uri: mapImage }} style={styles.mapImage} contentFit="contain" />
              </TouchableOpacity>
              <Text style={[styles.hint, { color: colors.grey }]}>Tap the map to open it full size.</Text>
            </View>
          )}

          {attending.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.heading, { color: colors.fg }]}>Attending Members</Text>
              <View style={styles.memberWrap}>
                {attending.map((member) => (
                  <UserByline
                    key={member.user_id}
                    user={member}
                    size={26}
                    gap={8}
                    nameStyle={styles.memberName}
                    style={[styles.memberChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                    activeOpacity={0.8}
                    onPress={() => goToUser(member.user_id, member.username)}
                  />
                ))}
              </View>
            </View>
          )}

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

        {/* The organiser's (or an admin's) options — a cog over the hero's
            top-right corner, clear of the grabber, as on an event. */}
        {canDelete && (
          <>
            <TouchableOpacity
              style={[styles.cog, isDeleting && { opacity: 0.5 }]}
              onPress={() => setMenuOpen(true)}
              disabled={isDeleting}
              hitSlop={8}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Rally options"
            >
              <Settings size={19} color={COLOR_WHITE} strokeWidth={2.2} />
            </TouchableOpacity>
            <ActionSheet
              visible={menuOpen}
              onClose={() => setMenuOpen(false)}
              title="Rally"
              options={[
                // No rally editor in the app — the web form, at the same rally.
                { label: 'Edit rally', Icon: Pencil, onPress: () => Linking.openURL(`${WEB_BASE}/edit/rally/${rally.internal_id}`) },
                { label: 'Delete rally', Icon: Trash2, destructive: true, onPress: confirmDelete },
              ]}
            />
          </>
        )}
        </>
      )}

      <ImageLightbox
        images={viewerImages}
        initialIndex={zoomIndex ?? 0}
        visible={zoomIndex !== null}
        onClose={() => setZoomIndex(null)}
      />
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  scroll:  { paddingBottom: 40 },
  hero:    { width: '100%', aspectRatio: 16 / 9 },
  galleryStrip: { padding: 8, gap: 6 },
  galleryThumb: { width: 80, height: 60, borderRadius: 6 },
  body:    { padding: PANE_GUTTER },
  titleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title:   { fontSize: 22, fontFamily: FONT_INTER.bold, marginBottom: 12, flex: 1 },
  // Over the hero's top-right corner, on a dark disc so it reads on any photo.
  cog: {
    position: 'absolute', top: 10, right: 12, zIndex: 4,
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  metaText:{ fontSize: 14 },
  slots:   { fontSize: 13, fontFamily: FONT_INTER.bold, marginBottom: 12 },
  description: { fontSize: 15, lineHeight: 22 },
  // The event pane's Attend pill.
  interestBtn: {
    height: 48, borderRadius: PILL_RADIUS, marginTop: 4, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  interestText: { fontSize: 14.5, fontFamily: FONT_INTER.extrabold },

  // Shared shape with RallyDays/RallyFaq, so the sheet reads as one rhythm.
  section:  { paddingHorizontal: PANE_GUTTER, paddingTop: 28 },
  heading:  { fontSize: 20, fontFamily: FONT_INTER.bold, marginBottom: 12 },
  hint:     { fontSize: 12, marginTop: 8 },
  mapImageWrap: { borderRadius: 12, overflow: 'hidden' },
  mapImage: { width: '100%', aspectRatio: 4 / 3 },

  memberWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: {
    paddingLeft: 6, paddingRight: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%',
  },
  memberName: { fontSize: 13, fontFamily: FONT_INTER.semibold },

  mapSection: { paddingHorizontal: PANE_GUTTER, gap: 10 },
  // The map is a picture of where this is, not something to pan around inside a
  // scrolling sheet — `pointerEvents="none"` on the wrapper keeps every drag
  // going to the sheet, and the button below handles the one real interaction.
  mapWrap:  { height: 180, borderRadius: 12, overflow: 'hidden' },
  map:      { flex: 1 },
  directionsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  directionsText: { fontSize: 14, fontFamily: FONT_INTER.bold },
});
