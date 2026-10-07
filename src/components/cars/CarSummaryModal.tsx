import React, { useCallback, useState , useRef} from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Check, Plus, Users, Car as CarIcon } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import { Skeleton, SkeletonLine, FadeIn } from '../ui/Skeleton';
import {
  useGetCarWithUserQuery,
  useGetUserByIdQuery,
  useGetCarFollowStatusQuery,
  useGetCarFollowerCountQuery,
  useFollowCarMutation,
  useUnfollowCarMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import type { GarageCar } from '../../types/api';
import { useColors } from '../../hooks/useColors';
import { usePosterRatio } from '../../hooks/usePosterRatio';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { TYPE_COLORS, formatLabel } from '../../constants/carTypes';
import { COMMON_RADIUS, COLOR_GRAY_22, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * One person on the car — the owner, or the second name on a shared one.
 *
 * A chip rather than a row, so two of them fit on one line where a stacked
 * name-and-avatar pair for each would have taken two.
 */
function OwnerChip({ user, co, onOpen }: {
  user?: { user_id: string; username?: string } | null;
  /** Marks the second name, so a shared car says which is which. */
  co?: boolean;
  onOpen: (user: { user_id: string; username?: string }) => void;
}) {
  const colors = useColors();
  if (!user) return null;
  return (
    <TouchableOpacity
      style={styles.ownerChip}
      onPress={() => onOpen(user)}
      activeOpacity={0.7}
    >
      <Avatar user={user as any} size={26} />
      <Text style={[styles.ownerName, { color: colors.fg }]} numberOfLines={1}>
        @{user.username ?? 'owner'}
      </Text>
      {co ? (
        <View style={[styles.coTag, { backgroundColor: colors.segment }]}>
          <Text style={[styles.coTagText, { color: colors.grey }]}>CO</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * Enough of a car to decide whether you want the whole page.
 *
 * Lists of cars — a group's garage, most of all — are lists of other people's
 * cars, and the question they raise is "whose is this, what is it, do I want to
 * follow it". Answering that used to cost a full screen push and a trip back.
 *
 * The panel itself, its animation and its "view more" button are SummaryModal's;
 * this only supplies what a car's summary is.
 */
/**
 * What a card already knows about a car, for the panel to open with while
 * the rest is fetched. `ratio` is the photo's width over its height, when the
 * card has measured it — the panel then opens at its final size.
 */
export type CarPreview = { title?: string; subtitle?: string; hero?: string | null; ratio?: number };

/** A preview from any car-shaped record a list holds. */
export const carPreview = (car: Partial<GarageCar> | null | undefined, ratio?: number): CarPreview | null => {
  if (!car) return null;
  const built = [car.year, car.make, car.model].filter(Boolean).join(' ');
  return {
    title: car.title || built || undefined,
    subtitle: car.title ? [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ') : car.trim,
    hero: firstGalleryUrl(car.gallery as any) ?? (car.profile_image ? imageUrl(car.profile_image) : null),
    ratio,
  };
};

export default function CarSummaryModal({
  carId,
  origin,
  preview,
  onClose,
}: {
  /** The car to summarise. `null` closes the panel. */
  carId: string | null;
  /** The card or row that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  /** What the tapped card already knew — shown until the fetch lands. */
  preview?: CarPreview | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { ratio: heroRatio, onLoad: onHeroLoad } = usePosterRatio(preview?.ratio);
  const { userInfo } = useAppSelector((s) => s.auth);

  // The id goes null the moment the close begins, but the panel is still
  // fading for 180ms: keep the last one so the content doesn't flip to a
  // spinner on its way out.
  const lastCarId = useRef<string | null>(null);
  if (carId) lastCarId.current = carId;
  const shownCarId = carId ?? lastCarId.current;
  const { data: car, isLoading } = useGetCarWithUserQuery(shownCarId ?? '', { skip: !shownCarId });
  const isOwner = !!car && (userInfo?.user_id === car.user_id || userInfo?.user_id === car.coowner_id);

  // The summary payload carries both of these now; the queries are the
  // fallback for a server that hasn't sent them.
  const { data: followStatus } = useGetCarFollowStatusQuery(carId ?? '', {
    skip: !carId || isOwner || car?.following !== undefined,
  });
  const { data: fetchedFollowerCount } = useGetCarFollowerCountQuery(carId ?? '', { skip: !carId || car?.followersCount != null });
  const followerCount = car?.followersCount ?? fetchedFollowerCount;
  // A car can be shared. The payload carries the owner, but only an id for the
  // second person, so they need their own lookup — cached, and skipped
  // entirely on the cars that have nobody.
  const { data: coowner } = useGetUserByIdQuery(car?.coowner_id ?? '', { skip: !car?.coowner_id });
  const [followCar, { isLoading: following }] = useFollowCarMutation();
  const [unfollowCar, { isLoading: unfollowing }] = useUnfollowCarMutation();
  const [localFollow, setLocalFollow] = useState<boolean | undefined>(undefined);
  const isFollowing = localFollow ?? followStatus?.following ?? car?.following ?? false;
  const busy = following || unfollowing;

  /** Close first: iOS won't present a screen over a modal that's still going. */
  const openUser = useCallback((user: { user_id: string; username?: string }) => {
    onClose();
    requestAnimationFrame(() =>
      nav.navigate('UserDetail', { userId: user.user_id, username: user.username }));
  }, [nav, onClose]);

  const toggleFollow = useCallback(async () => {
    if (!carId || busy) return;
    try {
      if (isFollowing) await unfollowCar({ car_id: carId }).unwrap();
      else await followCar({ car_id: carId }).unwrap();
      setLocalFollow(!isFollowing);
    } catch {
      Alert.alert(
        isFollowing ? "Couldn't unfollow" : "Couldn't follow",
        'Please try again.',
      );
    }
  }, [carId, busy, isFollowing, followCar, unfollowCar]);

  const title = car
    ? car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car'
    : '';
  // The badge is what the car is; the title is what it's called. When the owner
  // gave it no name of its own the title is already the year/make/model, so the
  // badge falls back to the trim rather than repeating it.
  const subtitle = car?.title
    ? [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')
    : car?.trim;

  const hero = car
    ? firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null)
    : null;
  const description = car?.body ? stripHtml(car.body).trim() : '';

  const typeBadge = TYPE_COLORS[car?.type ?? ''];
  const typeLabel = formatLabel(car?.type);
  const categoryLabel = formatLabel(car?.category);

  // Same list the car page shows, minus the ones already in the title above it.
  const specs = car
    ? ([
        { label: 'Color',     value: car.color },
        { label: 'Engine',    value: car.engine },
        { label: 'HP',        value: car.horsepower },
        { label: 'Torque',    value: car.torque },
        // Guarded on the parse, not on truthiness: a mileage of "unknown" is a
        // non-empty string that formats as "NaN mi".
        {
          label: 'Mileage',
          value: Number.isFinite(Number(car.mileage)) && Number(car.mileage) > 0
            ? `${Number(car.mileage).toLocaleString()} mi`
            : undefined,
        },
        { label: 'Condition', value: car.condition },
      ].filter((s) => s.value) as { label: string; value: string }[])
    : [];

  return (
    <SummaryModal
      visible={!!carId}
      onClose={onClose}
      origin={origin}
      actionLabel="View Car"
      onAction={carId ? () => nav.navigate('CarDetail', { carId }) : undefined}
    >
      {isLoading || !car ? (
        // The card's own photo and name, with grey stand-ins where the rest
        // will go — the panel opens showing the car, at the size it will be,
        // and the fetch fills in underneath. It was a spinner in a 260pt box
        // that then snapped to the real height.
        <View style={styles.scroll}>
          <View style={styles.heroWrap}>
            {preview?.hero ? (
              <Image source={{ uri: preview.hero }} style={[styles.hero, { aspectRatio: heroRatio }]} contentFit="cover" contentPosition="center" transition={0} onLoad={onHeroLoad} />
            ) : (
              <Skeleton style={{ width: '100%', aspectRatio: heroRatio }} radius={0} />
            )}
            {preview?.hero ? (
              <LinearGradient colors={['transparent', 'rgba(10,10,10,0.9)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            ) : null}
            <View style={styles.heroText}>
              <CarIcon size={22} color={COLOR_WHITE} strokeWidth={1.8} />
              {preview?.title ? <Text style={styles.heroTitle} numberOfLines={2}>{preview.title}</Text> : <SkeletonLine width="60%" height={22} style={{ marginTop: 4 }} />}
              {preview?.subtitle ? <Text style={styles.heroSub} numberOfLines={1}>{preview.subtitle}</Text> : null}
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.owners}>
              <Skeleton width={28} height={28} radius={14} />
              <SkeletonLine width={90} height={12} />
            </View>
            <Skeleton width={96} height={34} radius={17} />
          </View>
          <View style={styles.placeholderLines}>
            <SkeletonLine width="92%" />
            <SkeletonLine width="78%" />
            <SkeletonLine width="50%" />
          </View>
        </View>
      ) : (
        <FadeIn style={styles.scroll}>
          <View style={styles.heroWrap}>
            <Image
              source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
              style={[styles.hero, { aspectRatio: heroRatio }]}
              contentFit="cover"
              contentPosition="center"
              // The preview already showed this photo: no second fade of it.
              transition={hero && hero === preview?.hero ? 0 : 200}
              onLoad={onHeroLoad}
            />
            {/* The title sits on the photo, so the panel opens with the car
                rather than with a caption above it. */}
            <LinearGradient
              colors={['transparent', 'rgba(10,10,10,0.9)']}
              locations={[0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* The car card's arrangement, at panel scale: the name, the
                year/make/model under it as a small tracked-out line, and the
                coloured type badges below that. It was a dark pill above a
                title before, which is a shape nothing else in the app uses for
                a car. */}
            <View style={styles.heroText}>
              {/* The car's mark over its name, as the car cards wear it. */}
              <CarIcon size={22} color={COLOR_WHITE} strokeWidth={1.8} />
              <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
              {subtitle ? (
                <Text style={styles.heroSub} numberOfLines={1}>{subtitle}</Text>
              ) : null}
              {(typeLabel || categoryLabel) ? (
                <View style={styles.badges}>
                  {typeLabel && typeBadge ? (
                    <View style={[styles.badge, { backgroundColor: typeBadge.bg }]}>
                      <Text style={[styles.badgeText, { color: typeBadge.text }]}>{typeLabel}</Text>
                    </View>
                  ) : null}
                  {categoryLabel ? (
                    <View style={[styles.badge, styles.badgeDark]}>
                      <Text style={[styles.badgeText, { color: COLOR_WHITE }]}>{categoryLabel}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.row}>
            {/* Whose car this is — both people when it's shared. A co-owner was
                simply absent before, which on a jointly-owned car is the panel
                answering "whose is this" with half the answer. */}
            <View style={styles.owners}>
              <OwnerChip user={car.user} onOpen={openUser} />
              {coowner ? <OwnerChip user={coowner} co onOpen={openUser} /> : null}
              {/* A count, not a sentence — the icon already says what is being
                  counted. */}
              {(followerCount ?? 0) > 0 && (
                <View style={[styles.followerBadge, { backgroundColor: colors.segment }]}>
                  <Users size={10} color={colors.grey} />
                  <Text style={[styles.followerBadgeText, { color: colors.grey }]}>
                    {followerCount}
                  </Text>
                </View>
              )}
            </View>

            {/* Your own car has nothing to follow. */}
            {!isOwner && (
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  // Outlined in the brand colour to follow; the "Following"
                  // state sits on a dark segment with the foreground colour,
                  // so the two read as off and on rather than as two buttons.
                  isFollowing
                    ? { backgroundColor: colors.segment, borderColor: colors.border }
                    : { backgroundColor: 'transparent', borderColor: colors.primaryAlt },
                  busy && styles.followBtnBusy,
                ]}
                onPress={toggleFollow}
                disabled={busy}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: isFollowing, busy }}
              >
                {isFollowing
                  ? <Check size={14} color={colors.fg} strokeWidth={3} />
                  : <Plus size={14} color={colors.primaryAlt} strokeWidth={3} />}
                <Text style={[styles.followText, { color: isFollowing ? colors.fg : colors.primaryAlt }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* One line that scrolls, rather than a block that wraps. Six specs
              wrapped to three rows and made the panel taller than the car in
              it; sideways they stay a strip you skim. */}
          {specs.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.specsScroll}
              contentContainerStyle={styles.specs}
            >
              {specs.map((spec) => (
                <View key={spec.label} style={[styles.spec, { backgroundColor: colors.segment }]}>
                  <Text style={[styles.specLabel, { color: colors.grey }]}>{spec.label}</Text>
                  <Text style={[styles.specValue, { color: colors.fg }]} numberOfLines={1}>
                    {spec.value}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Stored as HTML by the web editor — unstripped it arrives as a
              paragraph of tags. */}
          {description ? (
            <Text style={[styles.body, { color: colors.muted }]} numberOfLines={3}>
              {description}
            </Text>
          ) : null}
        </FadeIn>
      )}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  scroll:  { paddingBottom: 16 },
  placeholderLines: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18, gap: 10 },

  // Rounded at the foot too, so the photo sits in the panel rather than
  // capping it; the overlay (name, chips) clips with it.
  heroWrap: { position: 'relative', borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden' },
  // The ratio comes from the photo — see usePosterRatio. A fixed 16:9 cropped
  // a portrait shot down to a letterbox, which on a car is usually the car.
  hero:     { width: '100%', backgroundColor: COLOR_GRAY_22 },
  // A little further in from the left than the panel's inset.
  heroText: { position: 'absolute', left: 12, right: 16, bottom: 12, alignItems: 'flex-start', gap: 4 },
  heroTitle: {
    fontSize: 21, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Small and quieter than the name, in its own case — as the grid cards write it.
  heroSub: {
    fontSize: 13, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.82)',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  badge:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  badgeDark: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)',
  },
  badgeText: {
    fontSize: 10, fontFamily: FONT_INTER.extrabold,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
  },
  // Wraps, so a car with two owners and a follower count doesn't squeeze the
  // Follow button off the end of the line.
  owners: {
    flex: 1, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6,
  },
  ownerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  ownerName: { fontSize: 14, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  coTag:     { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  coTagText: { fontSize: 9, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.4 },
  followerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 999,
  },
  followerBadgeText: { fontSize: 11, fontFamily: FONT_INTER.semibold },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    flexShrink: 0,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  followBtnBusy: { opacity: 0.6 },
  followText: { fontSize: 13, fontFamily: FONT_INTER.semibold },

  specsScroll: { flexGrow: 0, flexShrink: 0 },
  specs: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 12,
  },
  spec: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, minWidth: 84 },
  specLabel: { fontSize: 10, fontFamily: FONT_INTER.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  specValue: { fontSize: 14, fontFamily: FONT_INTER.semibold, marginTop: 2 },

  body: { fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingTop: 16 },
});
