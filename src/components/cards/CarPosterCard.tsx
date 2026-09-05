import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import {
  Car as CarIcon, Wrench, Settings, Users, Star, Plus,
  PenSquare, Trash2, MessageSquarePlus, Images,
} from 'lucide-react-native';
import {
  useGetUserByIdQuery, useDeleteCarMutation, useGetCarFollowerCountQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import ActionSheet from '../ui/ActionSheet';
import Avatar from '../ui/Avatar';
import type { GarageCar } from '../../types/api';

// Murray-style badge colors per car type. Exported so anything that badges a car
// — the feed, the car's own screen — reads the same way this card does.
export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'daily':        { bg: '#F0D689', text: '#000' },
  'weekend':      { bg: '#35B5FF', text: '#000' },
  'project':      { bg: '#F36943', text: '#000' },
  'garage-queen': { bg: '#FF479C', text: '#000' },
  'part-out':     { bg: '#00FF3F', text: '#000' },
  'other':        { bg: '#F0D689', text: '#000' },
};

export const formatLabel = (key?: string) =>
  key ? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null;

interface CarPosterCardProps {
  car: GarageCar;
  /** Called before navigating — use to close a parent modal/sheet. */
  onBeforeNavigate?: () => void;
  onTasksPress?: () => void;
  taskCount?: number;
  onEditPress?: () => void;
  /**
   * The feed's framing: "@someone added a car to their garage", with a
   * timestamp. Only true where the *event* is the point rather than the car.
   */
  attribution?: boolean;
  /**
   * A quiet owner chip in the corner, for lists of cars belonging to different
   * people. Off in a garage or a profile, where the whole surface has already
   * said whose cars these are.
   */
  showOwner?: boolean;
  /**
   * Narrow variant for carousels and grids, where the parent owns the width.
   * Drops the margins, the big mark and the owner controls, and scales the
   * name down to something that fits in half a screen.
   */
  compact?: boolean;
  /** Shows a "Featured" badge over the image. */
  featured?: boolean;
  /**
   * Override the outer frame — width, margins.
   *
   * For carousels that size their own cards but still want the full-size
   * plate, which `compact` would scale down.
   */
  style?: any;
}

/**
 * A car, as a poster.
 *
 * Every surface that lists cars used to draw them as a photo with a caption
 * block bolted underneath — image, then a white strip holding the name, the
 * year/make/model, and a row of owner chips. Six screens, one shape, and the
 * caption strip took up as much room as the car did while telling you what the
 * photo already had.
 *
 * This is one object instead: the whole card is the photograph, and everything
 * else — who added it, what it's called, what kind of car it is — rides on top
 * of it under a pair of gradients. Two scrims rather than one flat dim, because
 * a single wash would grey out the middle of the picture, which is the part
 * worth showing.
 *
 * The type colour edges the card at low alpha. It's a tint you register in
 * passing, not a frame competing with the photo inside it.
 */
export default function CarPosterCard({
  car,
  onBeforeNavigate,
  onTasksPress,
  taskCount = 0,
  onEditPress,
  attribution = false,
  showOwner = false,
  compact = false,
  featured = false,
  style,
}: CarPosterCardProps) {
  const c = useColors();
  const nav = useNavigation();
  const { userInfo } = useAppSelector((s) => s.auth);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const blockedUserIds = useAppSelector((s) => (s as any).moderation?.blockedUserIds ?? []);
  const [deleteCar] = useDeleteCarMutation();
  // Two sheets rather than one with every option in it: adding to a car and
  // administering it are different errands, and the + is the one people reach
  // for often.
  const [addSheet, setAddSheet] = useState(false);
  const [manageSheet, setManageSheet] = useState(false);

  const needOwner = attribution || showOwner;
  const { data: owner } = useGetUserByIdQuery(car.user_id, { skip: !car.user_id || !needOwner });

  // Follower count — prefer a value already on the payload, else fetch a lightweight count.
  const inlineFollowerCount = (car as any).followersCount as number | undefined;
  const { data: fetchedFollowerCount } = useGetCarFollowerCountQuery(car.internal_id, {
    skip: inlineFollowerCount != null || !car.internal_id || compact,
  });
  const followerCount = inlineFollowerCount ?? fetchedFollowerCount ?? 0;

  const isOwner = userInfo?.user_id === car.user_id;

  // Hidden (reported) or from a blocked user — returned after all hooks so hook
  // order stays stable.
  if (hiddenIds.includes(car.internal_id) || (car.user_id && blockedUserIds.includes(car.user_id))) return null;

  const carTitle = [car.year, car.make, car.model].filter(Boolean).join(' ');
  const displayTitle = car.title || carTitle || 'a car';
  // Only when the owner named it — otherwise the subtitle repeats the title
  // word for word.
  const subtitle = car.title
    ? [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')
    : car.trim;
  const displayName = car.title || carTitle || 'this car';

  const typeBadge = TYPE_COLORS[car.type ?? ''];
  const typeLabel = formatLabel(car.type);
  const categoryLabel = formatLabel(car.category);

  const timeAgo = car.created_at
    ? formatDistanceToNow(new Date(car.created_at), { addSuffix: true })
    : '';

  const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);

  // The border and the glow are the same colour at different strengths — one
  // hairline of it on the edge, one soft pool of it underneath.
  const tint = typeBadge ? typeBadge.bg : c.borderDark;

  // Controls belong to the owner, and a carousel card is too small to hold them.
  const showControls = isOwner && !compact;

  const confirmDelete = () => {
    Alert.alert(
      'Delete Car',
      `Remove ${displayName} from your garage? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteCar({ internal_id: car.internal_id }).unwrap();
            } catch {
              Alert.alert('Error', 'Could not delete car. Please try again.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handlePress = () => {
    onBeforeNavigate?.();
    (nav as any).navigate('CarDetail', { carId: car.internal_id });
  };

  return (
    /**
     * The glow lives on a wrapper, not on the card.
     *
     * iOS `overflow: 'hidden'` sets `clipsToBounds`, which clips the layer's
     * shadow along with its children — a rounded card that crops its own
     * picture cannot also cast anything. So the clipping stays on the card and
     * the shadow moves one level out, onto a view of the same size and radius.
     *
     * It's opaque rather than transparent because Android derives its elevation
     * shadow from the view's outline, and an outline needs a background to
     * exist. The card covers it exactly, so the fill is never seen.
     */
    <View
      style={[
        styles.glow,
        compact && styles.glowCompact,
        // Android honours shadowColor from API 28; below that this is a soft
        // neutral shadow rather than a tinted one, which is a fine floor.
        { shadowColor: tint },
        style,
      ]}
    >
      <TouchableOpacity
        style={[styles.card, { borderColor: typeBadge ? `${typeBadge.bg}80` : c.borderDark }]}
        onPress={handlePress}
        activeOpacity={0.92}
      >
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={styles.image}
          contentFit="cover"
          transition={250}
        />

        <LinearGradient
          colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.25)', 'transparent']}
          locations={[0, 0.55, 1]}
          style={styles.scrimTop}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.5, 1]}
          style={styles.scrimBottom}
          pointerEvents="none"
        />

        {/* ── Top left: who, or what kind of card this is ── */}
        <View style={[styles.topLeft, compact && styles.topLeftCompact]}>
          {featured && (
            <View style={styles.featuredBadge}>
              <Star size={10} color="#000" fill="#000" />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
          )}

          {attribution && (
            <TouchableOpacity
              style={styles.attribution}
              onPress={() => owner && (nav as any).navigate('UserDetail', { userId: owner.user_id, username: owner.username })}
              activeOpacity={0.7}
              disabled={!owner}
            >
              <Avatar user={owner} size={28} />
              <View style={styles.attributionText}>
                <Text style={styles.line} numberOfLines={1}>
                  <Text style={styles.name}>@{owner?.username ?? 'Someone'}</Text>
                  <Text style={styles.lineMuted}> added a car to their garage</Text>
                </Text>
                {timeAgo ? <Text style={styles.time}>{timeAgo}</Text> : null}
              </View>
            </TouchableOpacity>
          )}

          {/* The chip form: enough to say whose car this is, without the sentence
              the feed needs. */}
          {showOwner && !attribution && owner && (
            <TouchableOpacity
              style={styles.ownerChip}
              onPress={() => (nav as any).navigate('UserDetail', { userId: owner.user_id, username: owner.username })}
              activeOpacity={0.7}
            >
              <Avatar user={owner} size={20} />
              <Text style={styles.ownerName} numberOfLines={1}>@{owner.username}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Top right: what the owner can do to it ── */}
        {(showControls || (onTasksPress && taskCount > 0)) && (
          <View style={styles.topRight}>
            {onTasksPress && taskCount > 0 && (
              <TouchableOpacity style={styles.taskBadge} onPress={onTasksPress} hitSlop={4}>
                <Wrench size={10} color="#000" />
                <Text style={styles.taskBadgeText}>Tasks · {taskCount}</Text>
              </TouchableOpacity>
            )}
            {showControls && (
              <>
                {/* Post about it, mod it, add photos — the three things owners
                    actually do to a car, from wherever the car is shown. */}
                <TouchableOpacity
                  onPress={() => setAddSheet(true)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Add to ${displayName}`}
                >
                  <View style={styles.circleBtn}>
                    <Plus size={16} color="#FFFFFF" strokeWidth={2.6} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setManageSheet(true)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Manage ${displayName}`}
                >
                  <View style={styles.circleBtn}>
                    <Settings size={14} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── The plate ── */}
        <View style={[styles.plate, compact && styles.plateCompact]} pointerEvents="none">
          {!compact && <CarIcon size={38} color="#FFFFFF" strokeWidth={1.6} />}
          <Text
            style={[styles.title, compact && styles.titleCompact]}
            numberOfLines={2}
          >
            {displayTitle}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, compact && styles.subtitleCompact]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
          {(typeLabel || categoryLabel || followerCount > 0) && (
            <View style={styles.badges}>
              {typeLabel && typeBadge && (
                <View style={[styles.badge, { backgroundColor: typeBadge.bg }]}>
                  <Text style={[styles.badgeText, { color: typeBadge.text }]}>{typeLabel}</Text>
                </View>
              )}
              {categoryLabel && (
                <View style={[styles.badge, styles.badgeDark]}>
                  <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>{categoryLabel}</Text>
                </View>
              )}
              {/* Followers ride with the other badges rather than floating in a
                  corner of their own — it's another fact about the car. */}
              {followerCount > 0 && (
                <View style={[styles.badge, styles.badgeDark, styles.followerBadge]}>
                  <Users size={10} color="#FFFFFF" />
                  <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>{followerCount}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Only the owner can open either of these, and a feed full of other
            people's cars shouldn't carry a menu per card. */}
        {showControls && (
          <>
            <ActionSheet
              visible={addSheet}
              onClose={() => setAddSheet(false)}
              title={`Add to ${displayName}`}
              options={[
                {
                  label: 'New Post',
                  Icon: MessageSquarePlus,
                  // The car arrives already tagged — a post started from a car is
                  // about that car, and making you search for it afterwards was
                  // the step everyone forgot.
                  onPress: () => {
                    onBeforeNavigate?.();
                    (nav as any).navigate('Create', { carId: car.internal_id, carTitle: displayName });
                  },
                },
                {
                  label: 'Add Mod',
                  Icon: Wrench,
                  onPress: () => {
                    onBeforeNavigate?.();
                    (nav as any).navigate('ModCreate', { carId: car.internal_id, carTitle: displayName });
                  },
                },
                {
                  label: 'Add Gallery',
                  Icon: Images,
                  // The gallery composer lives on the car's own screen, so this
                  // opens the car with that sheet already up.
                  onPress: () => {
                    onBeforeNavigate?.();
                    (nav as any).navigate('CarDetail', { carId: car.internal_id, action: 'gallery' });
                  },
                },
              ]}
            />

            <ActionSheet
              visible={manageSheet}
              onClose={() => setManageSheet(false)}
              title={displayName}
              options={[
                {
                  label: 'Edit Car',
                  Icon: PenSquare,
                  // Most surfaces hand in their own edit route (closing a sheet
                  // on the way); the rest get the plain one.
                  onPress: () => {
                    if (onEditPress) return onEditPress();
                    onBeforeNavigate?.();
                    (nav as any).navigate('CarCreate', { carId: car.internal_id });
                  },
                },
                { label: 'Delete Car', Icon: Trash2, destructive: true, onPress: confirmDelete },
              ]}
            />
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    marginHorizontal: 12, marginVertical: 8,
    borderRadius: 16,
    backgroundColor: '#111111',
    // Offset down and spread wide: a pool of the car's own colour under the
    // card, not a hard drop shadow behind it. Low opacity on purpose — it
    // should register as warmth around the edge, not as a halo.
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 8,
  },
  // The parent owns the width and the gutters; a card in a carousel sits too
  // close to its neighbours for a wide glow, so it gets a tighter one.
  glowCompact: {
    marginHorizontal: 0, marginVertical: 0,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  card: {
    position: 'relative',
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.25,
    backgroundColor: '#111111',
  },
  image: { width: '100%', aspectRatio: 1 },

  scrimTop:    { position: 'absolute', left: 0, right: 0, top: 0, height: '34%' },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },

  topLeft: {
    position: 'absolute', top: 0, left: 0, right: 56,
    alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  topLeftCompact: { right: 0, paddingHorizontal: 10, paddingVertical: 9 },

  attribution: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'stretch' },
  attributionText: { flex: 1 },
  line:      { fontSize: 13, lineHeight: 17, color: '#FFFFFF' },
  lineMuted: { color: 'rgba(255,255,255,0.78)' },
  name:      { fontWeight: '800', color: '#FFFFFF' },
  time:      { fontSize: 11, marginTop: 1, color: 'rgba(255,255,255,0.6)' },

  ownerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    maxWidth: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingLeft: 3, paddingRight: 9, paddingVertical: 3,
    borderRadius: 999,
  },
  ownerName: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.pro,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  featuredBadgeText: {
    fontSize: 11, fontWeight: '800', color: '#000',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  topRight: {
    position: 'absolute', top: 12, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  circleBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  taskBadge: {
    backgroundColor: colors.pro, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, gap: 3,
  },
  taskBadgeText: { fontSize: 12, fontWeight: '800', color: '#000' },

  plate: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingBottom: 20,
  },
  plateCompact: { gap: 5, paddingHorizontal: 12, paddingBottom: 12 },
  title: {
    fontSize: 30, fontWeight: '800', color: '#FFFFFF', textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  titleCompact: { fontSize: 17, letterSpacing: -0.2 },
  subtitle: {
    fontSize: 12, fontWeight: '700', textAlign: 'center',
    color: 'rgba(255,255,255,0.82)',
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: -2,
  },
  subtitleCompact: { fontSize: 9.5, letterSpacing: 0.6, marginTop: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: 6 },
  badge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeDark: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)',
  },
  followerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
});
