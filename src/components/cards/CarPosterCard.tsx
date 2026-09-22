import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import {
  Car as CarIcon, Wrench, Settings, Users, Star, Plus,
  PenSquare, Trash2, MessageSquarePlus, Images, ArrowRightLeft,
} from 'lucide-react-native';
import {
  useGetUserByIdQuery, useGetCarFollowerCountQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { usePosterRatio } from '../../hooks/usePosterRatio';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import ActionSheet from '../ui/ActionSheet';
import CarDeleteOptionsModal from '../cars/CarDeleteOptionsModal';
import Avatar from '../ui/Avatar';
import UserSummaryModal from '../members/UserSummaryModal';
import CarSummaryModal from '../cars/CarSummaryModal';
import RegionBadge from '../ui/RegionBadge';
import { regionForCityState } from '../../constants/regions';
import ReportButton from '../ui/ReportButton';
import LikeButton from '../social/LikeButton';
import CommentButton from '../social/CommentButton';
import CommentsSheet from '../social/CommentsSheet';
import { type SummaryOrigin } from '../ui/SummaryModal';
import { TYPE_COLORS, formatLabel } from '../../constants/carTypes';
import type { GarageCar } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

interface CarPosterCardProps {
  car: GarageCar;
  /** Called before navigating — use to close a parent modal/sheet. */
  onBeforeNavigate?: () => void;
  /**
   * Take over the tap entirely. For a host that has to get out of the way
   * before anything can be pushed — the garage panel is a Modal, and iOS
   * won't run a stack transition over one that's still closing.
   */
  onPress?: () => void;
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
  /**
   * The picture with a name on it, and little else.
   *
   * For the garage panel, where the cards are yours and stacked: the type and
   * category pills, the follower count and the task chip are all things you
   * know about your own car, and on a column of them they were chrome repeated
   * down the screen. The name goes small and to the left, the way a caption
   * sits, with a smaller mark above it, and the owner's controls stay.
   */
  plain?: boolean;
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
 * No coloured edge and no glow. The type colour used to frame the card at
 * low alpha and pool underneath it as a tinted shadow; the badge already says
 * what the car is, and on a screen of cards the colour added up to haze
 * around every one. The photo is the card.
 */
/** A garage card is more picture than card, so it takes the taller pair. */
const CARD_SHAPES = { landscape: 3 / 2, portrait: 2 / 3 };

export default function CarPosterCard({
  car,
  onBeforeNavigate,
  onPress,
  onTasksPress,
  taskCount = 0,
  onEditPress,
  attribution = false,
  showOwner = false,
  compact = false,
  plain = false,
  featured = false,
  style,
}: CarPosterCardProps) {
  const c = useColors();
  const nav = useNavigation();
  const { userInfo } = useAppSelector((s) => s.auth);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const blockedUserIds = useAppSelector((s) => (s as any).moderation?.blockedUserIds ?? []);
  // Two sheets rather than one with every option in it: adding to a car and
  // administering it are different errands, and the + is the one people reach
  // for often.
  const [addSheet, setAddSheet] = useState(false);
  const [manageSheet, setManageSheet] = useState(false);
  /**
   * Which step of the remove sheet is open, or null for closed.
   *
   * One instance rather than one per entry point: this card renders once per
   * car in a grid, and every mounted SharedModal carries its own animations
   * and keyboard listeners whether or not it's visible.
   */
  const [removeStep, setRemoveStep] = useState<'choose' | 'transfer' | null>(null);
  /**
   * Whose summary is open.
   *
   * Tapping the person on a card opens a panel over the feed rather than
   * pushing their profile — see FeedItemCard for the reasoning; it's the same
   * question and the same answer wherever a byline appears.
   */
  const [summaryUserId, setSummaryUserId] = useState<string | null>(null);
  /** The car's own summary panel, and the card it grows from. */
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryOrigin, setSummaryOrigin] = useState<SummaryOrigin | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const cardRef = useRef<View>(null);
  // Feed cards take their shape from the photo. Everywhere else the card is
  // square, because those surfaces are grids and carousels that need one shape.
  /**
   * The card's shape follows its photo: a wide picture gets a 3:2 card, a
   * tall one 2:3. It used to be square outside the feed, which cropped every
   * car — landscape shots lost their ends, portrait shots lost the car.
   */
  const { ratio, onLoad } = usePosterRatio(undefined, CARD_SHAPES);

  const needOwner = attribution || showOwner;
  const { data: owner } = useGetUserByIdQuery(car.user_id, { skip: !car.user_id || !needOwner });

  // Follower count — prefer a value already on the payload, else fetch a lightweight count.
  const inlineFollowerCount = (car as any).followersCount as number | undefined;
  const { data: fetchedFollowerCount } = useGetCarFollowerCountQuery(car.internal_id, {
    skip: inlineFollowerCount != null || !car.internal_id || compact,
  });
  const followerCount = inlineFollowerCount ?? fetchedFollowerCount ?? 0;

  // A co-owner gets the owner's controls too: the car is as much theirs to
  // post about, mod and edit, and a garage that shows it without them reads
  // as read-only for half of the people it belongs to.
  const isOwner = !!userInfo?.user_id
    && (userInfo.user_id === car.user_id || userInfo.user_id === (car as any).coowner_id);

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

  // Controls belong to the owner, and a carousel card is too small to hold them.
  const showControls = isOwner && !compact;


  const handlePress = () => {
    if (onPress) return onPress();
    onBeforeNavigate?.();
    (nav as any).navigate('CarDetail', { carId: car.internal_id });
  };

  /**
   * In the feed, a tap summarises rather than travels.
   *
   * Measured off the card first, so the panel grows out of what was pressed.
   * Everywhere else the card still goes straight to the car — a garage or a
   * profile is already the place you'd summarise from.
   */
  const openSummary = () => {
    const node = cardRef.current;
    if (!node) { setSummaryOrigin(null); setSummaryOpen(true); return; }
    node.measureInWindow((x, y, w, h) => {
      setSummaryOrigin({ x, y, w, h });
      setSummaryOpen(true);
    });
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
    <View style={attribution ? styles.feedWrap : undefined}>
      {/* In the feed the byline sits above the card, not on the photograph —
          same as a mod or a gallery. The car is what was added; a face and a
          sentence laid over it were covering the top of it to say something
          that belongs beside the card. */}
      {attribution && (
        <View style={styles.byline}>
          <TouchableOpacity
            style={styles.bylineWho}
            onPress={() => owner && setSummaryUserId(owner.user_id)}
            activeOpacity={0.7}
            disabled={!owner}
          >
            <Avatar user={owner} size={30} />
            <View style={styles.bylineText}>
              <Text style={[styles.bylineName, { color: c.fg }]} numberOfLines={1}>
                @{owner?.username ?? 'Someone'}
              </Text>
              <Text style={[styles.bylineSub, { color: c.grey }]} numberOfLines={1}>
                added a car to their garage
              </Text>
            </View>
          </TouchableOpacity>
          {timeAgo ? <Text style={[styles.bylineTime, { color: c.grey }]}>{timeAgo}</Text> : null}
          {!isOwner && (
            <ReportButton contentType="garagecar" contentId={car.internal_id} size={18} />
          )}
        </View>
      )}

    <View
      style={[
        styles.frame,
        compact && styles.frameCompact,
        // The feed card sits in its own wrapper, which owns the margins.
        attribution && styles.frameInFeed,
        style,
      ]}
    >
      <TouchableOpacity
        ref={cardRef}
        style={[
          styles.card,
          { aspectRatio: ratio },
          // In the feed, the same hairline the mod and photo cards wear, so a
          // column of mixed cards reads as one kind of thing. Elsewhere the
          // card is borderless — the photo is the card.
          attribution && { borderWidth: 1, borderColor: c.borderDark },
        ]}
        onPress={attribution ? openSummary : handlePress}
        activeOpacity={0.92}
      >
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          // Written out rather than spreading `StyleSheet.absoluteFillObject`,
          // which RN 0.86 removed — spreading it yields {} and the image loses
          // its position silently.
          style={styles.imageFill}
          contentFit="cover"
          // Centred, so a crop takes from both edges evenly rather than
          // keeping the top-left corner and dropping the rest.
          contentPosition="center"
          transition={250}
          onLoad={onLoad}
        />

        {/* Only where something still sits up top. In the feed the byline has
            moved off the photo, so this would be darkening it for nothing. */}
        {(!attribution || featured || showControls) && (
          <LinearGradient
            colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.25)', 'transparent']}
            locations={[0, 0.55, 1]}
            style={styles.scrimTop}
            pointerEvents="none"
          />
        )}
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

          {/* The chip form: enough to say whose car this is, without the sentence
              the feed needs. */}
          {showOwner && !attribution && owner && (
            <TouchableOpacity
              style={styles.ownerChip}
              onPress={() => setSummaryUserId(owner.user_id)}
              activeOpacity={0.7}
            >
              <Avatar user={owner} size={20} />
              <Text style={styles.ownerName} numberOfLines={1}>@{owner.username}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Top right: what the owner can do to it ── */}
        {(showControls || (onTasksPress && taskCount > 0)) && (
          <View style={[styles.topRight, plain && styles.topRightPlain]}>
            {/* Where its owner is, on the cards that show an owner at all —
                the featured row, and any list of other people's cars. A car
                in your own garage needs no map to say where it is. */}
            {needOwner && <RegionBadge region={car.owner_region ?? regionForCityState(owner?.cityState)?.key} size={32} />}
            {onTasksPress && taskCount > 0 && !plain && (
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
                  <View style={[styles.circleBtn, plain && styles.circleBtnPlain]}>
                    <Plus size={plain ? 20 : 16} color="#FFFFFF" strokeWidth={2.6} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setManageSheet(true)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Manage ${displayName}`}
                >
                  <View style={[styles.circleBtn, plain && styles.circleBtnPlain]}>
                    <Settings size={plain ? 18 : 14} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── The plate ── */}
        <View
          style={[
            styles.plate,
            compact && styles.plateCompact,
            (attribution || plain) && styles.plateLeft,
            plain && styles.platePlain,
          ]}
          pointerEvents="none"
        >
          {!compact && <CarIcon size={plain ? 26 : 38} color="#FFFFFF" strokeWidth={1.6} />}
          <Text
            style={[
              styles.title,
              compact && styles.titleCompact,
              (attribution || plain) && styles.textLeft,
              plain && styles.titlePlain,
            ]}
            numberOfLines={2}
          >
            {displayTitle}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                compact && styles.subtitleCompact,
                (attribution || plain) && styles.textLeft,
                plain && styles.subtitlePlain,
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
          {!plain && (typeLabel || categoryLabel || followerCount > 0) && (
            <View style={[styles.badges, attribution && styles.badgesLeft]}>
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
                // Handing a car over is something you set out to do, so it's
                // its own row rather than something to find inside "Remove".
                {
                  label: 'Transfer Car',
                  Icon: ArrowRightLeft,
                  onPress: () => { setManageSheet(false); setRemoveStep('transfer'); },
                },
                // Not a confirm any more: archiving, transferring and erasing
                // are three different answers, and the sheet asks which.
                {
                  label: 'Remove Car',
                  Icon: Trash2,
                  destructive: true,
                  onPress: () => { setManageSheet(false); setRemoveStep('choose'); },
                },
              ]}
            />

            <CarDeleteOptionsModal
              visible={removeStep !== null}
              car={car}
              initialStep={removeStep ?? 'choose'}
              onClose={() => setRemoveStep(null)}
            />
          </>
        )}
      </TouchableOpacity>
    </View>

      {/* Like and comment on the car itself — the same document the car's own
          page counts, so a like here shows there and vice versa. */}
      {attribution && (
        <View style={styles.footer}>
          <View style={styles.actionsPill}>
            <LikeButton
              documentId={car.internal_id}
              entryType="garagecar"
              ownerId={car.user_id}
              initialCount={car.like_count ?? 0}
              initialLiked={car.isLiked ?? false}
              color="#FFFFFF"
            />
            <CommentButton
              count={car.comment_count ?? 0}
              documentId={car.internal_id}
              onPress={() => setCommentsOpen(true)}
              color="#FFFFFF"
            />
          </View>
        </View>
      )}

      {attribution && (
        <CommentsSheet
          postId={car.internal_id}
          entryType="garagecar"
          visible={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
      )}

      <CarSummaryModal
        carId={summaryOpen ? car.internal_id : null}
        origin={summaryOrigin}
        onClose={() => setSummaryOpen(false)}
      />

      <UserSummaryModal
        userId={summaryUserId}
        onClose={() => setSummaryUserId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The wrapper that used to carry the glow. No shadow now — the tinted pool
   * under each card was warmth on a dark ground, and on a screen of cards it
   * added up to haze. Kept as a wrapper because it still owns the margins.
   */
  frame: { marginHorizontal: 12, marginVertical: 8, borderRadius: 16 },
  // The parent owns the width and the gutters for a card in a carousel.
  frameCompact: { marginHorizontal: 0, marginVertical: 0 },
  card: {
    position: 'relative',
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    backgroundColor: '#111111',
  },
  feedWrap: { marginBottom: 6 },
  byline: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
  },
  bylineWho:  { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bylineText: { flex: 1, minWidth: 0 },
  bylineName: { fontSize: 14, fontWeight: '700' },
  bylineSub:  { fontSize: 12, marginTop: 1 },
  bylineTime: { fontSize: 11, fontStyle: 'italic' },

  /**
   * The ratio lives on the card in the feed, not on the image.
   *
   * With it on the image, the card's height came from the image's, which came
   * from a width already reduced by the card's own border — the two roundings
   * disagreed and the card's background showed through as a hairline. Sizing
   * the card and letting the image fill it leaves nothing to resolve twice.
   */
  imageFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  frameInFeed: { marginHorizontal: 12, marginVertical: 0 },

  plateLeft: { alignItems: 'flex-start', paddingHorizontal: 14 },
  textLeft:  { textAlign: 'left' },
  badgesLeft: { justifyContent: 'flex-start' },

  footer: { paddingHorizontal: 12, paddingTop: 8 },
  actionsPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6, borderRadius: 999,
  },

  scrimTop:    { position: 'absolute', left: 0, right: 0, top: 0, height: '34%' },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },

  topLeft: {
    position: 'absolute', top: 0, left: 0, right: 56,
    alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  topLeftCompact: { right: 0, paddingHorizontal: 10, paddingVertical: 9 },


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
  },

  topRight: {
    position: 'absolute', top: 12, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  circleBtn: {
    width: 28, height: 28, borderRadius: COMMON_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Bigger and closer to the corner on the garage panel's cards: they're the
  // only chrome left on those, so they can carry a real touch target, and
  // tucked in they read as the card's corner rather than as things laid on
  // the photo.
  circleBtnPlain: { width: 36, height: 36 },
  topRightPlain:  { top: 8, right: 8, gap: 8 },
  taskBadge: {
    backgroundColor: colors.pro, borderRadius: PILL_RADIUS,
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
  // A caption, not a headline: the garage panel's cards are yours, stacked,
  // and each name only has to be findable.
  titlePlain:    { fontSize: 18, letterSpacing: -0.3 },
  subtitlePlain: { fontSize: 10.5, letterSpacing: 0.7, marginTop: 0 },
  platePlain:    { gap: 3, paddingHorizontal: 14, paddingBottom: 14 },
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
  badgeText: { fontSize: 10, fontWeight: '800' },
});
