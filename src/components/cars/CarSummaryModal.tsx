import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Check, Plus, Users } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import Spinner from '../ui/Spinner';
import {
  useGetCarWithUserQuery,
  useGetUserByIdQuery,
  useGetCarFollowStatusQuery,
  useGetCarFollowerCountQuery,
  useFollowCarMutation,
  useUnfollowCarMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { usePosterRatio } from '../../hooks/usePosterRatio';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { TYPE_COLORS, formatLabel } from '../../constants/carTypes';

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
export default function CarSummaryModal({
  carId,
  origin,
  onClose,
}: {
  /** The car to summarise. `null` closes the panel. */
  carId: string | null;
  /** The card or row that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { ratio: heroRatio, onLoad: onHeroLoad } = usePosterRatio();
  const { userInfo } = useAppSelector((s) => s.auth);

  const { data: car, isLoading } = useGetCarWithUserQuery(carId ?? '', { skip: !carId });
  const isOwner = !!car && (userInfo?.user_id === car.user_id || userInfo?.user_id === car.coowner_id);

  const { data: followStatus } = useGetCarFollowStatusQuery(carId ?? '', {
    skip: !carId || isOwner,
  });
  const { data: followerCount } = useGetCarFollowerCountQuery(carId ?? '', { skip: !carId });
  // A car can be shared. The payload carries the owner, but only an id for the
  // second person, so they need their own lookup — cached, and skipped
  // entirely on the cars that have nobody.
  const { data: coowner } = useGetUserByIdQuery(car?.coowner_id ?? '', { skip: !car?.coowner_id });
  const [followCar, { isLoading: following }] = useFollowCarMutation();
  const [unfollowCar, { isLoading: unfollowing }] = useUnfollowCarMutation();
  const isFollowing = followStatus?.following ?? false;
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
        // Reserved height rather than a bare spinner: the panel takes its size
        // from its content, so an unsized loading state opens as a sliver and
        // then has to grow into the real thing.
        <View style={styles.loading}><Spinner /></View>
      ) : (
        <View style={styles.scroll}>
          <View style={styles.heroWrap}>
            <Image
              source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
              style={[styles.hero, { aspectRatio: heroRatio }]}
              contentFit="cover"
              contentPosition="center"
              transition={200}
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
                      <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>{categoryLabel}</Text>
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
                  isFollowing
                    ? { backgroundColor: colors.segment, borderColor: colors.border }
                    : { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
                  busy && styles.followBtnBusy,
                ]}
                onPress={toggleFollow}
                disabled={busy}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: isFollowing, busy }}
              >
                {/* Black on the brand fill; the "Following" state sits on a
                    dark segment instead and keeps the foreground colour. */}
                {isFollowing
                  ? <Check size={14} color={colors.fg} strokeWidth={3} />
                  : <Plus size={14} color="#000000" strokeWidth={3} />}
                <Text style={[styles.followText, { color: isFollowing ? colors.fg : '#000000' }]}>
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
        </View>
      )}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  scroll:  { paddingBottom: 16 },
  loading: { height: 260, alignItems: 'center', justifyContent: 'center' },

  heroWrap: { position: 'relative' },
  // The ratio comes from the photo — see usePosterRatio. A fixed 16:9 cropped
  // a portrait shot down to a letterbox, which on a car is usually the car.
  hero:     { width: '100%', backgroundColor: '#161616' },
  heroText: { position: 'absolute', left: 16, right: 16, bottom: 12, alignItems: 'flex-start', gap: 4 },
  heroTitle: {
    fontSize: 21, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // The car card's subtitle treatment: small, tracked out, quieter than the name.
  heroSub: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.82)',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  badge:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  badgeDark: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)',
  },
  badgeText: {
    fontSize: 10, fontWeight: '800',
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
  ownerName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  coTag:     { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  coTagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  followerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 999,
  },
  followerBadgeText: { fontSize: 11, fontWeight: '600' },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    flexShrink: 0,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  followBtnBusy: { opacity: 0.6 },
  followText: { fontSize: 13, fontWeight: '600' },

  specsScroll: { flexGrow: 0, flexShrink: 0 },
  specs: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 12,
  },
  spec: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, minWidth: 84 },
  specLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  specValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },

  body: { fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingTop: 16 },
});
