import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { User as UserIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import GarageDoor from '../ui/GarageDoor';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import RegionBadge from '../ui/RegionBadge';
import { regionForCityState } from '../../constants/regions';
import { Skeleton, SkeletonLine, FadeIn } from '../ui/Skeleton';
import FollowButton from '../social/FollowButton';
import {
  useGetPublicUserByIdQuery,
  useGetCarsQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import type { GarageCar, User } from '../../types/api';
import { useColors } from '../../hooks/useColors';
import { stripHtml } from '../../utils/text';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { carDisplayName } from '../../utils/mentions';
import SummaryMessageButton from './SummaryMessageButton';
import { FONT_INTER } from '../../constants/fonts'
import { COLOR_BLACK, COLOR_GRAY_38, COLOR_WHITE } from '../../constants/config';

/**
 * Enough of a member to decide whether you want their profile.
 *
 * A group's roster is a list of people you mostly don't know yet, and the
 * questions it raises — who is this, are they worth following, can I message
 * them — all used to cost a screen push or a menu. This answers them in place.
 *
 * The panel, its animation and its "view more" button are SummaryModal's; this
 * only supplies what a member's summary is.
 */
/** What a card already knows about a member, for the panel to open with. */
export type UserPreview = Pick<User, 'user_id' | 'username' | 'gallery' | 'profilePicture' | 'avatarColor' | 'accountType' | 'cityState'>;

export const userPreview = (user: Partial<User> | null | undefined): UserPreview | null =>
  user && user.user_id ? {
    user_id: user.user_id, username: user.username, gallery: user.gallery, profilePicture: user.profilePicture,
    avatarColor: user.avatarColor, accountType: user.accountType, cityState: user.cityState,
  } as UserPreview : null;

export default function UserSummaryModal({
  userId,
  origin,
  preview,
  onClose,
}: {
  /** The member to summarise. `null` closes the panel. */
  userId: string | null;
  /** The row that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  /** What the tapped card already knew — shown until the fetch lands. */
  preview?: UserPreview | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { userInfo } = useAppSelector((s) => s.auth);

  // The id goes null the moment the close begins, but the panel is still
  // fading for 180ms: keep the last one so the content doesn't flip to a
  // spinner on its way out.
  const lastUserId = useRef<string | null>(null);
  if (userId) lastUserId.current = userId;
  const shownUserId = userId ?? lastUserId.current;
  const { data: user, isLoading: userLoading } = useGetPublicUserByIdQuery(shownUserId ?? '', { skip: !shownUserId });
  // A handful of the cars themselves, not just how many: "what do they drive"
  // is the question a summary gets asked most — by an admin weighing a join
  // request above all — and a count doesn't answer it.
  const { data: carsData, isLoading: carsLoading } = useGetCarsQuery({ user_id: shownUserId ?? '', limit: GARAGE_PREVIEW }, { skip: !shownUserId });
  const garage = carsData?.entries ?? [];
  // The stand-ins stay up until both have landed: the garage arriving a beat
  // after the profile made the panel grow twice, the View Profile button
  // riding its foot each time.
  const isLoading = userLoading || carsLoading;

  /**
   * Somewhere to go once the panel has finished closing — a car tapped in the
   * garage. Closed first and run from `onClosed`: iOS won't push a screen over
   * a modal that's still on its way out, and the panel must not be left up
   * over the page it opened.
   */
  const afterClose = useRef<(() => void) | null>(null);
  const closeThen = (run: () => void) => {
    afterClose.current = run;
    onClose();
  };
  const runAfterClose = () => {
    const run = afterClose.current;
    afterClose.current = null;
    run?.();
  };

  const isMe = !!user && user.user_id === userInfo?.user_id;
  const bio = user?.bio ? stripHtml(user.bio) : '';
  const bannerUri = user?.banners?.[0]?.filename ? imageUrl(user.banners[0].filename) : null;
  // The banner's own shape once it loads, kept within BANNER_RATIO's bounds.
  const [bannerRatio, setBannerRatio] = useState(BANNER_RATIO.initial);
  useEffect(() => { setBannerRatio(BANNER_RATIO.initial); }, [bannerUri]);

  return (
    <SummaryModal
      visible={!!userId}
      onClose={onClose}
      onClosed={runAfterClose}
      origin={origin}
      // With no banner the avatar sits in the top-left corner, so the corner
      // rounds around it: the avatar's radius plus the body's padding, the
      // same centre for both curves. The top-right matches, so the top edge
      // stays symmetrical.
      topLeftRadius={bannerUri && !isLoading ? undefined : TOP_RADIUS}
      topRightRadius={bannerUri && !isLoading ? undefined : TOP_RADIUS}
      actionLabel="View Profile"
      actionIcon={UserIcon}
      actionRounded
      bottomRadius={BOTTOM_RADIUS}
      onAction={userId ? () => nav.navigate('UserDetail', { userId, username: user?.username }) : undefined}
    >
      {isLoading || !user ? (
        // Their avatar and handle from the card that was tapped, with grey
        // stand-ins for the bio and the garage underneath.
        <View>
          <View style={styles.body}>
            <View style={styles.head}>
              {preview ? <Avatar user={preview as any} size={AVATAR} /> : <Skeleton width={AVATAR} height={AVATAR} radius={AVATAR / 2} />}
              <View style={styles.headText}>
                {preview?.username
                  ? <Text style={[styles.username, { color: colors.fg }]} numberOfLines={1}>@{preview.username}</Text>
                  : <SkeletonLine width="55%" height={18} />}
                <SkeletonLine width="40%" height={12} style={{ marginTop: 8 }} />
              </View>
            </View>
            <SkeletonLine width="90%" style={{ marginTop: 14 }} />
            <SkeletonLine width="65%" style={{ marginTop: 10 }} />
          </View>
        </View>
      ) : (
        <FadeIn>
          {/* Their banner, where they have one — it's the thing they chose to
              represent themselves with, and the panel opened with an avatar on
              a flat grey instead. */}
          {/* At its own shape, within bounds, and fading into the panel's
              black at the foot, where the avatar and name float over it — the
              make and model pages' banner. */}
          {bannerUri ? (
            <View style={[styles.bannerWrap, { aspectRatio: bannerRatio }]}>
              <Image
                source={{ uri: bannerUri }}
                style={styles.banner}
                contentFit="cover"
                onLoad={({ source }) => {
                  if (source?.width && source?.height) {
                    setBannerRatio(Math.min(BANNER_RATIO.widest, Math.max(BANNER_RATIO.tallest, source.width / source.height)));
                  }
                }}
              />
              <LinearGradient
                colors={BANNER_FADE.colors}
                locations={BANNER_FADE.locations}
                style={styles.bannerFade}
                pointerEvents="none"
              />
            </View>
          ) : null}

          <View style={[styles.body, bannerUri ? styles.bodyOverBanner : null]}>
            <View style={styles.head}>
              <Avatar user={user} size={AVATAR} />
              <View style={styles.headText}>
                {/* The handle alone. A real name under it was a second name
                    for the same person in a panel that has one line to say
                    who they are. */}
                <Text style={[styles.username, { color: colors.fg }]} numberOfLines={1}>
                  @{user.username}
                </Text>
                {/* Where they are, said twice over: the town in words, and
                    the part of the country as a shape. Neither means much to
                    a stranger on its own. */}
                {user.cityState ? (
                  <View style={styles.placeRow}>
                    <RegionBadge region={regionForCityState(user.cityState)?.key} size={34} />
                    <Text style={[styles.place, { color: colors.grey }]} numberOfLines={1}>
                      {user.cityState}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {bio ? (
              <Text style={[styles.bio, { color: colors.muted }]} numberOfLines={6}>{bio}</Text>
            ) : null}

            {/* What's in the garage, as cards you can swipe through — the car's
                photo and its name, so "what do they drive" is answered at a
                glance. Bled to the panel's edges so the row runs off them. */}
            {garage.length > 0 && (
              <GarageCarousel
                cars={garage}
                total={carsData?.total ?? garage.length}
                onOpenCar={(carId) => closeThen(() => nav.navigate('CarDetail', { carId }))}
                onOpenGarage={() => closeThen(() => nav.navigate('UserDetail', { userId: user.user_id, username: user.username }))}
              />
            )}

          {/* Nothing to follow or send when it's you. */}
          {!isMe && (
            <View style={styles.actions}>
              {/* Both buttons in the same grey — they're a pair of things you
                  can do to this person, not one offer and one afterthought.
                  The label still says which state Follow is in. */}
              {/* Each takes half the row — FollowButton has no style prop of
                  its own, so it fills a growing wrapper. */}
              {user.username ? (
                <View style={styles.actionSlot}>
                  <FollowButton username={user.username} variant="secondary" />
                </View>
              ) : null}
              <SummaryMessageButton userId={user.user_id} username={user.username} style={styles.actionGrow} />
            </View>
          )}
          </View>
        </FadeIn>
      )}
    </SummaryModal>
  );
}

/**
 * The garage as a row of cards: photo over name, opening the car. A last card
 * says how many more there are and opens their profile, where the rest are.
 *
 * A tap hands the car up to the panel, which closes and then navigates — see
 * afterClose.
 */
function GarageCarousel({ cars, total, onOpenCar, onOpenGarage }: {
  cars: GarageCar[];
  total: number;
  onOpenCar: (carId: string) => void;
  onOpenGarage: () => void;
}) {
  const colors = useColors();
  const more = total - cars.length;

  /**
   * The cards' size, from the width they have: one car takes the whole row,
   * two split it, three or more become a carousel showing a little over two
   * so the next one peeks in. Height is the photo's 4:3, but never taller
   * than 16:8 of the full row — a lone car at 4:3 was most of the panel.
   */
  const [rowW, setRowW] = useState(0);
  const count = cars.length + (more > 0 ? 1 : 0);
  const cardW = !rowW ? 0
    : count === 1 ? rowW
    : count === 2 ? (rowW - CAR_CARD_GAP) / 2
    : (rowW - CAR_CARD_GAP * 2) / PEEK_CARDS;
  const cardH = Math.min(cardW * 3 / 4, rowW / 2);
  const scrolls = count > 2;

  return (
    <View style={styles.garageWrap} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
      <View style={styles.garageHead}>
        <GarageDoor size={18} color={colors.fg} strokeWidth={2.2} />
        <Text style={[styles.garageTitle, { color: colors.fg }]}>Garage</Text>
        <View style={styles.garageCount}>
          <Text style={styles.garageCountText}>{total}</Text>
        </View>
      </View>
      {/* Measured before anything is drawn, so the cards never lay out at a
          guessed size and then jump. */}
      {rowW > 0 ? (
      <ScrollView
        horizontal
        scrollEnabled={scrolls}
        showsHorizontalScrollIndicator={false}
        style={styles.garageScroller}
        contentContainerStyle={styles.garageRow}
        snapToInterval={scrolls ? cardW + CAR_CARD_GAP : undefined}
        decelerationRate="fast"
      >
        {cars.map((car) => {
          const uri = car.profile_image ? imageUrl(car.profile_image) : firstGalleryUrl(car.gallery);
          const name = carDisplayName(car);
          // What it is, under what it's called: "1987 Porsche 911 · 964 · Carrera".
          const details = [
            [car.year, car.make, car.model].filter(Boolean).join(' '),
            car.generation, car.trim,
          ].filter(Boolean).join(' · ');
          return (
            <TouchableOpacity
              key={car.internal_id}
              style={[styles.carCard, { width: cardW, height: cardH, backgroundColor: colors.segment }]}
              onPress={() => onOpenCar(car.internal_id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={name}
            >
              {uri
                ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.borderDark }]} />}
              {/* The name on the photo, bottom left, over a fade to near-black
                  — the feed card's scrim — so it reads on any picture. */}
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.39)', 'rgba(0,0,0,0.72)']}
                locations={[0, 0.5, 1]}
                style={styles.carScrim}
                pointerEvents="none"
              />
              <View style={styles.carText}>
                <Text style={styles.carName} numberOfLines={1}>{name}</Text>
                {details ? <Text style={styles.carDetails} numberOfLines={1}>{details}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}
        {more > 0 ? (
          <TouchableOpacity
            style={[styles.carCard, styles.moreCard, { width: cardW, height: cardH, backgroundColor: colors.segment }]}
            onPress={onOpenGarage}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${more} more cars — view profile`}
          >
            <Text style={[styles.moreCount, { color: colors.fg }]}>+{more}</Text>
            <Text style={[styles.moreLabel, { color: colors.grey }]}>more cars</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      ) : null}
    </View>
  );
}

/** The space between garage cards. */
const CAR_CARD_GAP = 10;
/** How many cards a carousel shows across — a little over two, so the next peeks in. */
const PEEK_CARDS = 2.3;

/** Cars named in the summary before "+N more". */
const GARAGE_PREVIEW = 6;
/** The avatar's size, and the body's padding — together they set the panel's top-left corner. */
const AVATAR = 72;
const BODY_PAD = 18;
const TOP_RADIUS = AVATAR / 2 + BODY_PAD;
// Rounder than the panel's own 32 at the foot, toward the View Profile pill's ends.
const BOTTOM_RADIUS = 40;

/**
 * The banner's shape: its own, between a 2.4:1 strip and a 5:4 photo — a
 * panorama stays a strip and a portrait shows more than a slice. 16:9 until
 * it loads.
 */
const BANNER_RATIO = { initial: 16 / 9, widest: 2.4, tallest: 5 / 4 };
/**
 * The banner's fade into the panel: long and eased — slow to start, slow to
 * finish — so it never shows an edge. A straight ramp to black over the last
 * stretch read as a line across the photo.
 */
const BANNER_FADE = {
  colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.92)', COLOR_BLACK] as const,
  locations: [0, 0.2, 0.4, 0.58, 0.74, 0.88, 1] as const,
};
/** How far the avatar and name sit up over the banner's fade. */
const BANNER_OVERLAP = 76;

const styles = StyleSheet.create({
  garageWrap:  { gap: 10, marginTop: 2 },
  garageHead:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  garageTitle: { fontSize: 14, fontFamily: FONT_INTER.bold },
  // A small dark-grey disc with the number in it, stepped back.
  garageCount: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR_GRAY_38,
  },
  garageCountText: { fontSize: 11, fontFamily: FONT_INTER.bold, color: 'rgba(255,255,255,0.6)' },
  // Out to the panel's edges, with the body's inset carried as padding.
  garageScroller: { marginHorizontal: -BODY_PAD },
  garageRow:   { gap: CAR_CARD_GAP, paddingHorizontal: BODY_PAD },
  carCard:     { borderRadius: 14, overflow: 'hidden' },
  carScrim:    { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  carText: { position: 'absolute', left: 10, right: 10, bottom: 9 },
  carName: { fontSize: 15, lineHeight: 18, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  carDetails: { fontSize: 11.5, lineHeight: 14, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  // No height of its own: the row stretches it to match the cards beside it.
  moreCard:    { alignItems: 'center', justifyContent: 'center' },
  moreCount:   { fontSize: 20, fontFamily: FONT_INTER.extrabold },
  moreLabel:   { fontSize: 12, fontFamily: FONT_INTER.semibold, marginTop: 2 },
  // The shape is set inline (BANNER_RATIO).
  bannerWrap: { width: '100%' },
  banner:     { width: '100%', height: '100%' },
  // A point past the foot, so no hairline of photo shows under it.
  bannerFade: { position: 'absolute', left: 0, right: 0, bottom: -1, height: '100%' },
  // The avatar and name pulled up onto the banner's faded foot.
  bodyOverBanner: { marginTop: -BANNER_OVERLAP },
  body:    { padding: BODY_PAD, paddingBottom: 22, gap: 14 },

  head:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headText: { flex: 1, alignItems: 'flex-start', gap: 4 },
  username: { fontSize: 19, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  place: { fontSize: 13, fontFamily: FONT_INTER.semibold, flexShrink: 1 },

  bio: { fontSize: 13, lineHeight: 19 },

  // Close over the panel's own "View Profile" footer: the body's foot padding
  // and the footer's top padding are given back here, down to the same 8 the
  // pair keep between them, so the two rows of buttons read as one group.
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: -28 },
  actionSlot: { flex: 1 },
  actionGrow: { flex: 1, justifyContent: 'center' },
});
