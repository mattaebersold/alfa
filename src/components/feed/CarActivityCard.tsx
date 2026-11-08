import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import { shortTimeAgo } from '../../utils/shortTimeAgo';
import { useNavigation } from '@react-navigation/native';
import { Wrench, Images, Car as CarIcon } from 'lucide-react-native';
import { useGetUserByIdQuery, useGetLikeUsersQuery } from '../../api/apiService';
import PostActionRail from '../social/PostActionRail';
import CarBookmarkButton from '../cars/CarBookmarkButton';
import { usePostLike } from '../../hooks/usePostLike';
import { useLikeState } from '../../hooks/useLikeState';
import type { Post } from '../../types/api';
import { firstGalleryUrl, carHeroUrl } from '../../utils/image';
import { CATEGORY_BADGE_COLORS } from '../../constants/colors';
import { stripHtml } from '../../utils/text';
import UserByline from '../members/UserByline';
import ReportButton from '../ui/ReportButton';
import { useSummary } from '../../providers/SummaryProvider';
import { userPreview } from '../members/UserSummaryModal';
import CarItemSummaryModal from '../cars/CarItemSummaryModal';
import type { SummaryOrigin } from '../ui/SummaryModal';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { usePosterRatio } from '../../hooks/usePosterRatio';
import LikeButton from '../social/LikeButton';
import CommentButton from '../social/CommentButton';
import CommentsSheet from '../social/CommentsSheet';
import type { CarActivityItem } from '../../types/api';
import {
  COMMON_RADIUS,
  FEED_CARD_GUTTER,
  FEED_CARD_GAP,
  COLOR_BLACK,
  COLOR_GRAY_187,
  COLOR_WHITE, SURFACE_MID
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

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
  const { openUser } = useSummary();
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

  /**
   * A gallery wears the feed post's rail — bookmark, comment, like, in the
   * photo's bottom-right corner, opening the same likes / comments panel —
   * where a mod keeps its footer. Held up here, ahead of the early return,
   * since they're hooks.
   */
  const isGallery = item.kind !== 'mod';
  const railEntryType = item.entry_type ?? (isGallery ? 'cargallery' : 'mod');
  const known = useLikeState(item.internal_id);
  const { data: likeData } = useGetLikeUsersQuery(item.internal_id, { skip: !isGallery || !item.internal_id });
  const like = usePostLike({
    postId: item.internal_id,
    entryType: railEntryType,
    // A gallery belongs to whoever owns the car.
    ownerId: car?.user_id,
    initialLiked: known ? known.liked : (likeData && userInfo?.user_id ? likeData.users.includes(userInfo.user_id) : item.isLiked ?? false),
    initialCount: known?.count ?? likeData?.total ?? item.like_count ?? 0,
  });
  const likers = known?.users ?? likeData?.users ?? [];

  if (!car) return null;

  const carName = car.title
    || [car.year, car.make, car.model].filter(Boolean).join(' ')
    || 'their car';
  // Short ("3h"), as on a post and the new-car card.
  const timeAgo = item.created_at ? shortTimeAgo(item.created_at) : '';

  const carThumb = carHeroUrl(car, 'thumb');
  // The item's own photo where it has one — that's the new thing.
  const ownPhoto = firstGalleryUrl(item.gallery);

  // Written in the web editor, so it arrives as HTML — unstripped it renders
  // as a line of tags where a sentence should be.
  const description = item.body ? stripHtml(item.body).trim() : '';

  const isMod = item.kind === 'mod';
  const Mark = isMod ? Wrench : Images;
  /**
   * A mod logged without a photo is a plain dark card: the wrench, the badge
   * and the title, and nothing pictured. The car's own photo used to stand in,
   * which made "installed new plugs" look like a picture of the plugs.
   */
  const bare = isMod && !ownPhoto;
  const hero = bare ? null : ownPhoto ?? carThumb;
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
  const openOwner = (origin: SummaryOrigin | null) => owner && openUser(owner.user_id, origin, userPreview(owner));

  const carChip = (
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
  );

  return (
    <View style={styles.wrap}>
      {/* Who did it, above the card rather than on it.
          The photograph is the thing that was added; a face and a sentence
          laid over it were covering the top third of it to say something that
          belongs beside the card, not inside it. Same arrangement a feed post
          uses — byline left, time and menu right. */}
      <View style={styles.byline}>
        <UserByline
          user={owner}
          size={30}
          fallback="Someone"
          sub={`${verb} ${carName}`}
          subColor={COLOR_WHITE}
          subStyle={styles.action}
          gap={9}
          fill
          style={styles.bylineWho}
          onPress={openOwner}
          disabled={!owner}
        />
        {/* Grouped tighter than the byline's gap, as on a post: the short time
            sits right by the menu rather than floating off on its own. */}
        <View style={styles.bylineMeta}>
          {timeAgo ? <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text> : null}
          {!isOwner && (
            <ReportButton
              contentType={isMod ? 'mod' : 'cargallery'}
              contentId={item.internal_id}
              size={18}
            />
          )}
        </View>
      </View>

      {/* The card opens what was added, not the page it lives on. Tapping a
          mod used to land you on the car with the photos you were looking at
          another tap away. The car chip is still the way to the car, and the
          panel has its own View Car. */}
      <TouchableOpacity
        ref={cardRef}
        style={[
          styles.card,
          // Bare, it's as tall as its words: there's no photo to give it a shape.
          { aspectRatio: bare ? undefined : ratio, borderColor: COLOR_GRAY_187 },
          bare && styles.cardBare,
          // A gallery is a photograph, edge to edge — no frame round it.
          isGallery && styles.cardBorderless,
        ]}
        onPress={openDetail}
        activeOpacity={0.92}
      >
        {!bare && (
          <>
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

            {/* One gradient, off the bottom edge only. The top is clear now
                that the attribution has moved off the photo, so a second scrim
                up there would be darkening the picture for nothing. */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.39)', 'rgba(0,0,0,0.66)']}
              locations={[0, 0.55, 1]}
              style={styles.scrim}
              pointerEvents="none"
            />
          </>
        )}

        {/* Anchored to the foot and ranged left, so the badge, the name and the
            description read as one block down the same edge. */}
        <View style={[styles.plate, bare && styles.plateBare, isGallery && styles.plateBesideRail]} pointerEvents="box-none">
          {/* The mark, at size, on its own — it's the one thing that says at a
              glance which of the two kinds this is, and shrunk into the badge
              it was competing with the word beside it. */}
          <Mark size={34} color={COLOR_WHITE} strokeWidth={1.6} />
          {/* A mod wears the mod colour the category badges use elsewhere;
              a gallery keeps the plain white pill. */}
          <View style={[styles.kindPill, isMod && { backgroundColor: CATEGORY_BADGE_COLORS.mod.bg }]}>
            <Text style={[styles.kindText, isMod && { color: CATEGORY_BADGE_COLORS.mod.fg }]}>{kindLabel}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.title || (isMod ? 'New mod' : 'New photos')}
          </Text>
          {description ? (
            <Text style={styles.body} numberOfLines={2}>{description}</Text>
          ) : null}
          {/* Which car, under the words — its own touchable, so this tap goes
              to the car rather than opening what was added. */}
          {carChip}
        </View>


        {/* The feed post's rail, in the same corner: bookmark (the car — a
            gallery has no bookmark of its own), comment and like, the like
            and comment opening the post's likes / comments panel. */}
        {isGallery && (
          <View style={styles.rail} pointerEvents="box-none">
            <PostActionRail
              post={{ internal_id: item.internal_id, comment_count: item.comment_count ?? 0 } as Post}
              entryType={railEntryType}
              like={like}
              likers={likers}
              bookmarkSlot={<CarBookmarkButton carId={car.internal_id} size={21} />}
            />
          </View>
        )}
      </TouchableOpacity>

      {/* A mod only — a gallery has the rail on its photo. */}
      {/* Like and comment, under the card — the same footer a post has.
          A mod and a set of photos are things people react to, and they had no
          way to, even though the server has always keyed likes and comments
          generically by document. */}
      {!isGallery && (
      <View style={styles.footer}>
        <View style={styles.actionsPill}>
          <LikeButton
            documentId={item.internal_id}
            entryType={entryType}
            // A mod or an album belongs to whoever owns the car.
            ownerId={car?.user_id}
            initialCount={item.like_count ?? 0}
            initialLiked={item.isLiked ?? false}
            color={COLOR_WHITE}
          />
          <CommentButton
            count={item.comment_count ?? 0}
            documentId={item.internal_id}
            onPress={() => setCommentsOpen(true)}
            color={COLOR_WHITE}
          />
        </View>
      </View>
      )}

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
          ownerId: car.user_id,
          like_count: item.like_count,
          isLiked: item.isLiked,
          comment_count: item.comment_count,
        }}
        origin={detailOrigin}
        onClose={() => setDetailOpen(false)}
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
  wrap: { marginBottom: FEED_CARD_GAP },

  byline: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: FEED_CARD_GUTTER, paddingTop: 8, paddingBottom: 8,
  },
  bylineWho:  { flex: 1 },
  // What they did, under the name — white and italic.
  action:     { fontStyle: 'italic' },
  time:       { fontSize: 11, fontStyle: 'italic' },
  bylineMeta: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  // A light grey edge, as the feed's new-car card wears: this is an object on the
  // page. Not a type colour, which would file it as a car.
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
    marginHorizontal: FEED_CARD_GUTTER,
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: SURFACE_MID,
  },
  cardBorderless: { borderWidth: 0 },
  // The rail, in the photo's bottom-right corner — the feed post's placing.
  rail: { position: 'absolute', right: 4, bottom: 4 },
  // Clear of the rail down the right, so the title and description don't run under it.
  plateBesideRail: { paddingRight: 56 },
  // Written out rather than spreading `StyleSheet.absoluteFillObject`, which
  // RN 0.86 removed — spreading it yields {} and the image loses its position
  // entirely, silently.
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // A photo-less mod: no picture to be, so a dark grey ground for the plate.
  cardBare: { backgroundColor: SURFACE_MID },
  // In the flow rather than pinned to the foot, so the card sizes to it.
  plateBare: { position: 'relative', paddingTop: 16 },

  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%' },

  plate: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'flex-start', gap: 6,
    paddingLeft: 14, paddingRight: 14, paddingBottom: 16,
  },
  kindPill: {
    // A little clear of the mark above it — the plate's gap alone had the two
    // touching visually, the glyph's stroke running to its box's edge.
    marginTop: 4,
    backgroundColor: COLOR_WHITE,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
  },
  kindText: {
    fontSize: 10, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK,
  },
  title: {
    fontSize: 22, fontFamily: FONT_INTER.bold, color: COLOR_WHITE,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  body: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.85)' },

  // At the foot of the plate, under the title and description.
  carChip: {
    marginTop: 4,
    maxWidth: '72%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.82)',
    paddingLeft: 4, paddingRight: 11, paddingVertical: 4,
    borderRadius: 999,
  },
  carChipText: { flexShrink: 1, fontSize: 13.5, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  carThumb: { width: 28, height: 28, borderRadius: 14 },
  carThumbBlank: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  footer: { paddingHorizontal: 12, paddingTop: 8 },
  actionsPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: COLOR_BLACK,
    paddingHorizontal: 6, paddingVertical: 4, borderRadius: 999,
  },
});
