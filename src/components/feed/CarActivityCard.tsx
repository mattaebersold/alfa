import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { Wrench, Images, Car as CarIcon } from 'lucide-react-native';
import { useGetUserByIdQuery } from '../../api/apiService';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import Avatar from '../ui/Avatar';
import ReportButton from '../ui/ReportButton';
import UserSummaryModal from '../members/UserSummaryModal';
import CarItemSummaryModal from '../cars/CarItemSummaryModal';
import type { SummaryOrigin } from '../ui/SummaryModal';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { usePosterRatio } from '../../hooks/usePosterRatio';
import LikeButton from '../social/LikeButton';
import CommentButton from '../social/CommentButton';
import CommentsSheet from '../social/CommentsSheet';
import type { CarActivityItem } from '../../types/api';

/**
 * Feed row for something added to a car you follow — a mod, or a set of photos.
 *
 * Following a car only ever produced a notification before, which is the wrong
 * shape for "here's what happened": notifications are read once and cleared,
 * and the photos never appeared at all. This puts the work itself in the feed.
 *
 * ## The shape
 *
 * A poster, like the card a new car gets — the whole thing is the photograph
 * and everything else rides on top of it. It used to be a photo with a caption
 * block bolted underneath and a sentence above, which made one event read as
 * three stacked pieces.
 *
 * Two deliberate differences from `CarPosterCard`:
 *
 * - **No coloured border and no glow.** Those say "this is a car, and this is
 *   what kind" — a tint the type badge earns. A mod is not a car, and giving
 *   it the same frame would file it as one in the middle of a feed.
 * - **The mark is the work, not the subject.** A wrench for a mod, a stack of
 *   frames for a gallery. The car mark belongs on cards that *are* the car.
 *
 * The two things this event connects — who did it and which car it was to —
 * sit as chips in the bottom corners rather than in a sentence up top. They're
 * separately tappable that way, which the sentence never was.
 */
export default function CarActivityCard({ item }: { item: CarActivityItem }) {
  const colors = useColors();
  const nav = useNavigation();
  const { userInfo } = useAppSelector((st) => st.auth);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [summaryUserId, setSummaryUserId] = useState<string | null>(null);
  /** The mod/gallery panel: whether it's open, and the rect it grows from. */
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrigin, setDetailOrigin] = useState<SummaryOrigin | null>(null);
  const cardRef = useRef<View>(null);
  // The card takes its shape from the photo in it — see usePosterRatio.
  const { ratio, onLoad } = usePosterRatio();

  /** Measure the card, then open — so the panel grows out of what was tapped. */
  const openDetail = () => {
    const node = cardRef.current;
    if (!node) { setDetailOrigin(null); setDetailOpen(true); return; }
    node.measureInWindow((x, y, w, h) => {
      setDetailOrigin({ x, y, w, h });
      setDetailOpen(true);
    });
  };
  const car = item.car;
  const { data: owner } = useGetUserByIdQuery(car?.user_id ?? '', { skip: !car?.user_id });

  if (!car) return null;

  const carName = car.title
    || [car.year, car.make, car.model].filter(Boolean).join(' ')
    || 'their car';
  const timeAgo = item.created_at
    ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
    : '';

  // The item's own photo where it has one — that's the new thing. The car's
  // picture stands in when a mod was logged without one, so the row still shows
  // what it's about rather than an empty grey block.
  const hero = firstGalleryUrl(item.gallery)
    ?? firstGalleryUrl(car.gallery)
    ?? (car.profile_image ? imageUrl(car.profile_image) : null);
  const carThumb = firstGalleryUrl(car.gallery)
    ?? (car.profile_image ? imageUrl(car.profile_image) : null);

  // Written in the web editor, so it arrives as HTML — unstripped it renders
  // as a line of tags where a sentence should be.
  const description = item.body ? stripHtml(item.body).trim() : '';

  const isMod = item.kind === 'mod';
  const Mark = isMod ? Wrench : Images;
  const photoCount = item.gallery?.length ?? 0;
  // Named in full: "Mod" alone reads as a category on a card that could be
  // about anything, and the card is always about a car.
  const kindLabel = isMod ? 'Car Mod' : 'Car Gallery';
  const verb = isMod
    ? 'added a mod to'
    : photoCount > 1 ? `added ${photoCount} photos to` : 'added photos to';

  /**
   * What likes and comments attach to.
   *
   * The server's stored `entry_type` when it sends one, and the same values
   * derived otherwise — a mod is "mod", a gallery is "cargallery". Guessing
   * from `kind` alone would write a gallery's likes as "gallery", which is not
   * what the 88 existing gallery rows call themselves.
   */
  const entryType = item.entry_type ?? (isMod ? 'mod' : 'cargallery');
  const isOwner = userInfo?.user_id === car.user_id;

  const openCar = () => (nav as any).navigate('CarDetail', { carId: car.internal_id });
  const openOwner = () => owner && setSummaryUserId(owner.user_id);

  return (
    <View style={styles.wrap}>
      {/* Who did it, above the card rather than on it.
          The photograph is the thing that was added; a face and a sentence
          laid over it were covering the top third of it to say something that
          belongs beside the card, not inside it. Same arrangement a feed post
          uses — byline left, time and menu right. */}
      <View style={styles.byline}>
        <TouchableOpacity
          style={styles.bylineWho}
          onPress={openOwner}
          disabled={!owner}
          activeOpacity={0.7}
        >
          <Avatar user={owner} size={30} />
          <View style={styles.bylineText}>
            <Text style={[styles.bylineName, { color: colors.fg }]} numberOfLines={1}>
              @{owner?.username ?? 'Someone'}
            </Text>
            <Text style={[styles.bylineSub, { color: colors.grey }]} numberOfLines={1}>
              {verb} {carName}
            </Text>
          </View>
        </TouchableOpacity>
        {timeAgo ? <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text> : null}
        {!isOwner && (
          <ReportButton
            contentType={isMod ? 'mod' : 'cargallery'}
            contentId={item.internal_id}
            size={18}
          />
        )}
      </View>

      {/* The card opens what was added, not the page it lives on. Tapping a
          mod used to land you on the car with the photos you were looking at
          another tap away. The car chip is still the way to the car, and the
          panel has its own View Car. */}
      <TouchableOpacity
        ref={cardRef}
        style={[styles.card, { aspectRatio: ratio, borderColor: colors.borderDark }]}
        onPress={openDetail}
        activeOpacity={0.92}
      >
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={styles.image}
          contentFit="cover"
          // Centred, so a crop takes from both edges evenly rather than
          // keeping the top-left corner and dropping the rest.
          contentPosition="center"
          transition={200}
          onLoad={onLoad}
        />

        {/* One gradient, off the bottom edge only. The top is clear now that
            the attribution has moved off the photo, so a second scrim up there
            would be darkening the picture for nothing. */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.55, 1]}
          style={styles.scrim}
          pointerEvents="none"
        />

        {/* Anchored to the foot and ranged left, so the badge, the name and the
            description read as one block down the same edge. */}
        <View style={styles.plate} pointerEvents="none">
          {/* The mark, at size, on its own — it's the one thing that says at a
              glance which of the two kinds this is, and shrunk into the badge
              it was competing with the word beside it. */}
          <Mark size={34} color="#FFFFFF" strokeWidth={1.6} />
          <View style={styles.kindPill}>
            <Text style={styles.kindText}>{kindLabel}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.title || (isMod ? 'New mod' : 'New photos')}
          </Text>
          {description ? (
            <Text style={styles.body} numberOfLines={2}>{description}</Text>
          ) : null}
        </View>

        {/* Which car, bottom right — its own touchable, so this tap goes to the
            car rather than to whatever the card is doing. */}
        <TouchableOpacity
          style={styles.carChip}
          onPress={openCar}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={carName}
        >
          {carThumb ? (
            <Image source={{ uri: carThumb }} style={styles.carThumb} contentFit="cover" />
          ) : (
            <View style={[styles.carThumb, styles.carThumbBlank]}>
              <CarIcon size={14} color="rgba(255,255,255,0.8)" />
            </View>
          )}
          <Text style={styles.carChipText} numberOfLines={1}>{carName}</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Like and comment, under the card — the same footer a post has.
          A mod and a set of photos are things people react to, and they had no
          way to, even though the server has always keyed likes and comments
          generically by document. */}
      <View style={styles.footer}>
        <View style={styles.actionsPill}>
          <LikeButton
            documentId={item.internal_id}
            entryType={entryType}
            initialCount={item.like_count ?? 0}
            initialLiked={item.isLiked ?? false}
            color="#FFFFFF"
          />
          <CommentButton
            count={item.comment_count ?? 0}
            onPress={() => setCommentsOpen(true)}
            color="#FFFFFF"
          />
        </View>
      </View>

      <CarItemSummaryModal
        item={!detailOpen ? null : {
          internal_id: item.internal_id,
          kind: item.kind,
          entryType,
          title: item.title,
          body: item.body,
          type: item.type,
          gallery: item.gallery,
          carId: car.internal_id,
          carName,
          like_count: item.like_count,
          isLiked: item.isLiked,
          comment_count: item.comment_count,
        }}
        origin={detailOrigin}
        onClose={() => setDetailOpen(false)}
      />

      <UserSummaryModal
        userId={summaryUserId}
        onClose={() => setSummaryUserId(null)}
      />

      <CommentsSheet
        postId={item.internal_id}
        entryType={entryType}
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },

  byline: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
  },
  bylineWho:  { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bylineText: { flex: 1, minWidth: 0 },
  bylineName: { fontSize: 14, fontWeight: '700' },
  bylineSub:  { fontSize: 12, marginTop: 1 },
  time:       { fontSize: 11, fontStyle: 'italic' },

  // A grey edge rather than the type-coloured one a car card wears: this is
  // still an object on the page, but the colour would file it as a car.
  /**
   * The ratio lives on the card, not the image — and is supplied at render
   * time from the photo's own proportions.
   *
   * With `aspectRatio` on the image, the card's height came from the image's,
   * which came from `width × 3/4` where that width was the card's box *minus*
   * its 2px of border. The two roundings disagreed by a sub-pixel and the
   * card's own background showed through underneath as a hairline. Sizing the
   * card and letting the image fill it absolutely leaves nothing to disagree.
   */
  card: {
    position: 'relative',
    marginHorizontal: 12,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#111111',
  },
  // Written out rather than spreading `StyleSheet.absoluteFillObject`, which
  // RN 0.86 removed — spreading it yields {} and the image loses its position
  // entirely, silently.
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%' },

  plate: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'flex-start', gap: 6,
    paddingLeft: 14, paddingRight: 14, paddingBottom: 16,
  },
  kindPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
  },
  kindText: {
    fontSize: 10, fontWeight: '800', color: '#000000',
  },
  title: {
    fontSize: 22, fontWeight: '800', color: '#FFFFFF',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  body: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.85)' },

  // Top left, sized to the car's name. Along the foot it was competing with
  // the title for the same edge; up here it sits on the clear half of the
  // photo and leaves the whole bottom to the text.
  carChip: {
    position: 'absolute', top: 12, left: 12,
    maxWidth: '72%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingLeft: 4, paddingRight: 11, paddingVertical: 4,
    borderRadius: 999,
  },
  carChipText: { flexShrink: 1, fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
  carThumb: { width: 28, height: 28, borderRadius: 14 },
  carThumbBlank: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  footer: { paddingHorizontal: 12, paddingTop: 8 },
  actionsPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6, borderRadius: 999,
  },
});
