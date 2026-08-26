import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Check, Plus, Users } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import Spinner from '../ui/Spinner';
import {
  useGetCarWithUserQuery,
  useGetCarFollowStatusQuery,
  useGetCarFollowerCountQuery,
  useFollowCarMutation,
  useUnfollowCarMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';

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
  const { userInfo } = useAppSelector((s) => s.auth);

  const { data: car, isLoading } = useGetCarWithUserQuery(carId ?? '', { skip: !carId });
  const isOwner = !!car && (userInfo?.user_id === car.user_id || userInfo?.user_id === car.coowner_id);

  const { data: followStatus } = useGetCarFollowStatusQuery(carId ?? '', {
    skip: !carId || isOwner,
  });
  const { data: followerCount } = useGetCarFollowerCountQuery(carId ?? '', { skip: !carId });
  const [followCar, { isLoading: following }] = useFollowCarMutation();
  const [unfollowCar, { isLoading: unfollowing }] = useUnfollowCarMutation();
  const isFollowing = followStatus?.following ?? false;
  const busy = following || unfollowing;

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
              style={styles.hero}
              contentFit="cover"
              transition={200}
            />
            {/* The title sits on the photo, so the panel opens with the car
                rather than with a caption above it. */}
            <LinearGradient
              colors={['transparent', 'rgba(10,10,10,0.9)']}
              locations={[0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.heroText}>
              {/* What the car *is*, as a badge — the name above it is whatever
                  its owner chose to call it, and the two shouldn't read as one
                  run-on caption. */}
              {subtitle ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>{subtitle}</Text>
                </View>
              ) : null}
              <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.owner}
              onPress={() => {
                if (!car.user) return;
                onClose();
                requestAnimationFrame(() =>
                  nav.navigate('UserDetail', { userId: car.user!.user_id, username: car.user!.username }));
              }}
              disabled={!car.user}
              activeOpacity={0.7}
            >
              <Avatar
                user={car.user}
                size={34}
              />
              <View style={styles.ownerText}>
                <Text style={[styles.ownerName, { color: colors.fg }]} numberOfLines={1}>
                  @{car.user?.username ?? 'owner'}
                </Text>
                {/* A count, not a sentence — the icon already says what is
                    being counted. */}
                {(followerCount ?? 0) > 0 && (
                  <View style={[styles.followerBadge, { backgroundColor: colors.segment }]}>
                    <Users size={10} color={colors.grey} />
                    <Text style={[styles.followerBadgeText, { color: colors.grey }]}>
                      {followerCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

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
                {isFollowing
                  ? <Check size={14} color={colors.fg} strokeWidth={3} />
                  : <Plus size={14} color="#FFFFFF" strokeWidth={3} />}
                <Text style={[styles.followText, { color: isFollowing ? colors.fg : '#FFFFFF' }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {specs.length > 0 && (
            <View style={styles.specs}>
              {specs.map((spec) => (
                <View key={spec.label} style={[styles.spec, { backgroundColor: colors.segment }]}>
                  <Text style={[styles.specLabel, { color: colors.grey }]}>{spec.label}</Text>
                  <Text style={[styles.specValue, { color: colors.fg }]} numberOfLines={1}>
                    {spec.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Stored as HTML by the web editor — unstripped it arrives as a
              paragraph of tags. */}
          {description ? (
            <Text style={[styles.body, { color: colors.muted }]} numberOfLines={6}>
              {description}
            </Text>
          ) : null}
        </View>
      )}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  scroll:  { paddingBottom: 20 },
  loading: { height: 260, alignItems: 'center', justifyContent: 'center' },

  heroWrap: { position: 'relative' },
  hero:     { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#161616' },
  heroText: { position: 'absolute', left: 16, right: 60, bottom: 14, alignItems: 'flex-start', gap: 6 },
  heroTitle: {
    fontSize: 22, fontWeight: '800', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11, fontWeight: '800', color: '#FFFFFF',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 14,
  },
  owner:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ownerText: { flex: 1 },
  ownerName: { fontSize: 15, fontWeight: '800' },
  followerBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 999, marginTop: 3,
  },
  followerBadgeText: { fontSize: 11, fontWeight: '800' },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  followBtnBusy: { opacity: 0.6 },
  followText: { fontSize: 13, fontWeight: '800' },

  specs: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingTop: 16,
  },
  spec: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 92 },
  specLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  specValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  body: { fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingTop: 16 },
});
