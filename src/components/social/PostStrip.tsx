import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { Text } from '@ors/kit';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from '../ui/AppImage';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Plus } from 'lucide-react-native';
import UserByline from '../members/UserByline';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { postMediaList } from '../../utils/postMedia';
import PostMediaCarousel from '../media/PostMediaCarousel';
import { stripHtml } from '../../utils/text';
import type { Post } from '../../types/api';
import { CATEGORY_LABELS } from '../ui/Badge';
import { categoryColor, pillTextColor } from '../../utils/categoryColor';
import { POST_TYPES } from '../../constants/postTypes';
import { COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'
import { SpotDateBadge } from '../feed/SpotResultBody';
import { pairCardWidth } from '../cars/CarShelf';

/** As many as fit before "View all" is the better answer. */
export const STRIP_PREVIEW_COUNT = 6;
const CARD_WIDTH = 168;
const CARD_GAP = 10;
const ROW_PAD_LEFT = 16;
const MEDIA_RATIO = 4 / 3;
/** What fits in a text post's preview at `leadText`'s size before the "…". */
const TEXT_LEAD_LINES = 4;
/** Same bar FeedList sets for "being watched" — most of the card, not a sliver. */
const VISIBLE_FRACTION = 0.6;

/**
 * A shelf of posts — a handful of them, sideways, with the rest behind a
 * button.
 *
 * Wherever a page is *about* something that posts attach to (a car, a member),
 * the posts themselves are the evidence, and a count on a tile is a poor
 * substitute for seeing them. This is the taste; the pane behind "View all" is
 * the archive.
 *
 * Purely presentational — the host owns the fetching, the paging and what a tap
 * does, because a profile and a car page answer those differently.
 */
export default function PostStrip({
  title,
  posts,
  total,
  showByline = true,
  cardBackground,
  showTime = true,
  largeCaption = false,
  onPostPress,
  onViewAll,
  alwaysViewAll = false,
  onAdd,
  addLabel,
  ruled = false,
  ruleGap,
  cardWidth: givenWidth = CARD_WIDTH,
  splitPair = false,
  captionLines = 2,
  captionOnImage = false,
  bylineOnImage = false,
  kindBadge = false,
}: {
  title: string;
  posts: Post[];
  /** How many exist in total — "View all" only appears when there are more. */
  total?: number;
  /** Off where every post has the same author, e.g. a profile. */
  showByline?: boolean;
  /**
   * The cards' fill, and a text post's preview with it. Defaults to the card
   * colour; the profile passes a darker one to match its tiles.
   */
  cardBackground?: string;
  /** The "3 hours ago" line. Off where the byline alone is enough. */
  showTime?: boolean;
  /** A bigger caption, still two lines — for a shelf that's more read than scanned. */
  largeCaption?: boolean;
  onPostPress: (post: Post) => void;
  onViewAll: () => void;
  /**
   * Show "View all" even when everything is already on the shelf — for a page
   * whose full list is also where things get added, like a car's records.
   */
  alwaysViewAll?: boolean;
  /** Owner only: a button beside View all that opens the form for one more. */
  onAdd?: () => void;
  /** "Add record" — the button's words. */
  addLabel?: string;
  /** A rule above, setting this shelf apart from the one before it. */
  ruled?: boolean;
  /** Room above the rule, when the default 26 is too much for what's above. */
  ruleGap?: number;
  /** The cards' width — wider for a shelf that's read more than scanned. */
  cardWidth?: number;
  /** Exactly two: half the row each, side by side, nothing to scroll. */
  splitPair?: boolean;
  /** Lines of caption before it trails off. */
  captionLines?: number;
  /**
   * The caption over the foot of the picture, on a fade to black, rather than
   * under it — the card becomes the picture. A text post keeps its words in
   * the picture's place as before.
   */
  captionOnImage?: boolean;
  /** Who posted it, as a pill on the picture's top-left corner instead of under it. */
  bylineOnImage?: boolean;
  /**
   * What kind of post it is, as a colour-coded pill on the picture's top-left —
   * its category where it has one (Maintenance, Restoration…), else its type.
   */
  kindBadge?: boolean;
}) {
  const split = splitPair && posts.length === 2;
  const cardWidth = split ? pairCardWidth(ROW_PAD_LEFT) : givenWidth;
  const colors = useColors();
  const brand = useBrandColor();

  /**
   * Which cards are in view, by index, so a video stops when it's swiped out
   * of the row.
   *
   * A ScrollView has no viewability callbacks, but it doesn't need them: every
   * card is the same width at a known step, so which ones are showing falls
   * straight out of the scroll offset. Held as a joined string so a scroll
   * event that changes nothing about the answer doesn't re-render the row.
   *
   * This only covers sideways. The shelf sits inside a page that scrolls
   * vertically and has no way to hear about that; leaving the screen is
   * handled by the carousel itself, which stops on navigation blur.
   */
  const offsetX = useRef(0);
  const viewportWidth = useRef(0);
  const [visibleKey, setVisibleKey] = useState('');
  const measure = useCallback(() => {
    const shown: number[] = [];
    for (let i = 0; i < posts.length; i++) {
      const left = ROW_PAD_LEFT + i * (cardWidth + CARD_GAP) - offsetX.current;
      const onScreen = Math.min(left + cardWidth, viewportWidth.current) - Math.max(left, 0);
      if (onScreen >= cardWidth * VISIBLE_FRACTION) shown.push(i);
    }
    const key = shown.join(',');
    setVisibleKey((prev) => (prev === key ? prev : key));
  }, [posts.length, cardWidth]);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewportWidth.current = e.nativeEvent.layout.width;
    measure();
  }, [measure]);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetX.current = e.nativeEvent.contentOffset.x;
    measure();
  }, [measure]);
  const visible = useMemo(() => new Set(visibleKey.split(',').filter(Boolean).map(Number)), [visibleKey]);

  // Nothing to show is nothing to say — an empty shelf reads as something
  // failing to load.
  // Except to the owner, who gets the heading and its Add.
  const empty = posts.length === 0;
  if (empty && !onAdd) return null;
  const hasMore = !empty && (alwaysViewAll || (total ?? posts.length) > posts.length);

  return (
    <View style={[styles.wrap, ruled && [styles.ruled, { borderTopColor: colors.border }, ruleGap != null && { marginTop: ruleGap }]]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
        <View style={styles.headActions}>
          {/* Just a +, in the account's colour — the one thing here only the
              owner can do. Its words are for the screen reader. */}
          {onAdd ? (
            <TouchableOpacity
              style={[styles.addCircle, { backgroundColor: brand }]}
              onPress={onAdd}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={addLabel ?? 'Add'}
            >
              <Plus size={16} color={COLOR_BLACK} strokeWidth={2.8} />
            </TouchableOpacity>
          ) : null}
          {hasMore && (
            <TouchableOpacity
              style={[styles.viewAllBtn, { borderColor: colors.borderDark }]}
              onPress={onViewAll}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`View all ${total} posts`}
            >
              <Text style={[styles.viewAllText, { color: colors.fg }]}>View all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!empty && (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        scrollEnabled={!split}
        snapToInterval={cardWidth + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={100}
      >
        {posts.map((post, index) => {
          /**
           * The post's lead item only — its first photo, or its video.
           *
           * The whole gallery would be a swipeable strip inside a row that
           * already swipes the same way, and the two would fight over every
           * drag. The card is a preview; the rest is one tap away.
           */
          return (
            <PostCard
              key={post.internal_id}
              post={post}
              width={cardWidth}
              visible={visible.has(index)}
              onPress={() => onPostPress(post)}
              cardBackground={cardBackground}
              showByline={showByline}
              showTime={showTime}
              largeCaption={largeCaption}
              captionLines={captionLines}
              captionOnImage={captionOnImage}
              bylineOnImage={bylineOnImage}
              kindBadge={kindBadge}
            />
          );
        })}
        <RowEndSpacer />
      </ScrollView>
      )}
    </View>
  );
}

/**
 * How a post card looks — the options a shelf and the list behind its "View
 * all" share, so the two draw the same card.
 */
export interface PostCardLook {
  /** The card's fill, and a text post's preview with it. */
  cardBackground?: string;
  /** Off where every post has the same author, e.g. a profile. */
  showByline?: boolean;
  /** The "3 hours ago" line. */
  showTime?: boolean;
  /** A bigger caption under the picture. */
  largeCaption?: boolean;
  /** Lines of caption before it trails off. */
  captionLines?: number;
  /** The caption over the foot of the picture, on a fade to black. */
  captionOnImage?: boolean;
  /** Who posted it, as a pill on the picture's top-left. */
  bylineOnImage?: boolean;
  /** The post's category (or type), colour-coded, on the picture's top-left. */
  kindBadge?: boolean;
  /**
   * The picture at its exact shape rather than the shelf's 4:3 — for a
   * mosaic, where cards of different heights are the point.
   */
  naturalRatio?: boolean;
}

/**
 * One post as a card — a shelf's, and the grid's behind its "View all".
 * See PostStrip for what each part is for.
 */
export function PostCard({
  post, width, visible, onPress,
  cardBackground, showByline = true, showTime = true, largeCaption = false,
  captionLines = 2, captionOnImage = false, bylineOnImage = false, kindBadge = false, naturalRatio = false,
}: PostCardLook & {
  post: Post;
  width: number;
  /** Whether it's on screen, so a video stops when it isn't. */
  visible?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const lead = postMediaList(post)[0];
  /**
   * A guessing game result: named as the game is everywhere in the app — not
   * by the app it was shared from — with the day it was played in a badge
   * under the name, and its picture shaded back.
   */
  const spot = post.type === 'spot_result' && post.carspot ? post.carspot : null;
  const caption = spot ? 'ORS Guessing Game' : (post.title || (post.body ? stripHtml(post.body) : ''));
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';

  return (
    /* A View rather than one big touchable, because the media and the
       words are separate targets — but both open the post, video tiles
       included: a card this size is a preview, and the post is where a
       video is worth watching. */
    <View
      style={[styles.card, { width, backgroundColor: cardBackground ?? colors.card, borderColor: colors.borderDark }]}
    >
      {spot ? (
        // A game result has no photo of its own. The car placeholder stands
        // in, shaded dark, so it reads as a picture block apart from the card
        // — the game's name centred on it, the day it was played beneath.
        <TouchableOpacity style={styles.image} onPress={onPress} activeOpacity={0.85}>
          <Image source={require('../../../assets/car-placeholder.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.spotShade} pointerEvents="none" />
          <View style={styles.spotCenter} pointerEvents="none">
            <Text style={styles.spotTitle} numberOfLines={2}>ORS Guessing Game</Text>
          </View>
        </TouchableOpacity>
      ) : lead ? (
        <View style={styles.mediaClip}>
          <PostMediaCarousel
            media={[lead]}
            // Fixed rather than taken from the photo, so every card in
            // the row stays the same height.
            ratio={naturalRatio ? undefined : MEDIA_RATIO}
            // In a mosaic, the card is exactly the photo's shape — nothing cropped.
            adaptiveHeight={naturalRatio}
            exactShape={naturalRatio}
            showPageIndicator={false}
            visible={visible}
            onPressItem={onPress}
            videoOpensItem
          />
        </View>
      ) : (
        // Text posts keep the same footprint, so the row stays even —
        // and fill it with their words rather than an icon, which said
        // "a post" and nothing about which. The caption below would
        // only repeat it, so it goes.
        <TouchableOpacity
          style={[styles.image, caption ? styles.imageText : styles.imageBlank, { backgroundColor: cardBackground ?? colors.segment }]}
          onPress={onPress}
          activeOpacity={0.85}
        >
          {caption ? (
            <Text style={[styles.leadText, { color: colors.fg }]} numberOfLines={TEXT_LEAD_LINES}>
              {caption}
            </Text>
          ) : (
            <MessageSquare size={20} color={colors.grey} />
          )}
        </TouchableOpacity>
      )}
      {/* The caption on a fade at the foot of the card — the card's foot,
          not the picture's: the row stretches every card to its tallest,
          and pinned to the picture the fade stopped short of a card
          that had been stretched. */}
      {captionOnImage && caption && lead ? (
        <>
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.78)']}
            locations={[0, 0.45, 1]}
            style={styles.scrim}
            pointerEvents="none"
          />
          <Text style={styles.captionOver} numberOfLines={captionLines} pointerEvents="none">{caption}</Text>
        </>
      ) : null}
      {kindBadge && kindOf(post) ? (
        <View style={[styles.kindPill, { backgroundColor: kindOf(post)!.color }]} pointerEvents="none">
          <Text style={[styles.kindPillText, { color: pillTextColor(kindOf(post)!.color) }]} numberOfLines={1}>
            {kindOf(post)!.label}
          </Text>
        </View>
      ) : null}
      {/* The author, on the picture — whose story the car turned up in. */}
      {bylineOnImage && post.user ? (
        <UserByline user={post.user} size={20} gap={6} color="#FFFFFF" nameStyle={styles.bylinePillText} style={styles.bylinePill} />
      ) : null}
      {(caption && lead && !captionOnImage) || spot || (showByline && !bylineOnImage) || (showTime && timeAgo) ? (
      <TouchableOpacity style={styles.body} onPress={onPress} activeOpacity={0.85}>
        {/* A game result's title row: the day it was played, where another
            card's title sits. */}
        {spot ? <View style={styles.spotDate}><SpotDateBadge carspot={spot} dark /></View> : null}
        {caption && lead && !captionOnImage ? (
          <Text style={[styles.caption, largeCaption && styles.captionLarge, { color: colors.fg }]} numberOfLines={captionLines}>{caption}</Text>
        ) : null}
        {showByline && !bylineOnImage ? (
          <UserByline
            user={post.user}
            size={18}
            fallback=""
            meta={showTime ? timeAgo : null}
            gap={6}
            color={colors.grey}
            nameStyle={styles.bylineName}
            style={styles.pinBottom}
          />
        ) : showTime && timeAgo ? (
          <Text style={[styles.bylineText, styles.pinBottom, { color: colors.grey }]} numberOfLines={1}>{timeAgo}</Text>
        ) : null}
      </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A post's kind for its badge: its category, coloured as everywhere else, or its type. */
function kindOf(post: Post): { label: string; color: string } | null {
  if (post.category && post.category !== 'general') {
    return { label: CATEGORY_LABELS[post.category] ?? post.category, color: categoryColor(post.category) };
  }
  const type = POST_TYPES.find((t) => t.type === post.type);
  return type ? { label: type.label, color: type.color } : null;
}

/** The cards' corners — a touch tighter than the app's 20, at this size. */
const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  // Room between one shelf and the next.
  wrap: { paddingTop: 30 },
  // A full-width rule with room either side of it.
  ruled: { marginTop: 26, paddingTop: 26, borderTopWidth: 1 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    // Buttons tucked nearer the edge than the title is.
    paddingLeft: 16, paddingRight: 10, paddingBottom: 10,
  },
  title:    { fontSize: 17, fontFamily: FONT_INTER.semibold },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Outlined, and as tall as the + beside it.
  viewAllBtn: { height: 28, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewAllText: { fontSize: 12.5, fontFamily: FONT_INTER.semibold },
  addCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Every card as tall as the tallest, so the row reads as one shelf.
  row:  { paddingLeft: ROW_PAD_LEFT, gap: CARD_GAP },
  card: { width: CARD_WIDTH, borderRadius: CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  // Rounded at the foot as well as the card's top corners, so the picture
  // reads as its own tile sitting on the card.
  image: {
    width: '100%', aspectRatio: MEDIA_RATIO,
    borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS, overflow: 'hidden',
  },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  kindPill: {
    position: 'absolute', top: 8, left: 8, maxWidth: '80%',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  kindPillText: { fontSize: 11.5, fontFamily: FONT_INTER.bold },
  bylinePill: {
    // Passes taps through to the picture under it — style-level, as the
    // byline takes no `pointerEvents` prop.
    position: 'absolute', top: 8, left: 8, maxWidth: '85%', pointerEvents: 'none',
    paddingLeft: 3, paddingRight: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bylinePillText: { fontSize: 12, fontFamily: FONT_INTER.semibold },
  captionOver: {
    position: 'absolute', left: 10, right: 10, bottom: 9,
    fontSize: 14, fontFamily: FONT_INTER.semibold, lineHeight: 18, color: '#FFFFFF',
  },
  mediaClip: { borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS, overflow: 'hidden' },
  // A guessing game's picture, shaded back — a bright share card outshone
  // every post beside it.
  // Dark enough that the picture reads as its own block over the title under it.
  spotShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.65)' },
  spotCenter: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12,
  },
  spotTitle: { color: '#FFFFFF', fontSize: 15, fontFamily: FONT_INTER.bold, textAlign: 'center' },
  spotDate:  { alignSelf: 'flex-start' },
  imageBlank: { alignItems: 'center', justifyContent: 'center' },
  imageText:  { padding: 12, justifyContent: 'center' },
  leadText:   { fontSize: 16, fontFamily: FONT_INTER.bold, lineHeight: 21 },
  // Grows to the card's height, and pins the byline to the bottom: the extra
  // height a shorter card takes on goes between the caption and the byline,
  // not in a block of empty card beneath it.
  body:    { padding: 10, gap: 6, flexGrow: 1 },
  // `auto` rather than space-between on the body, which would lift a lone
  // byline (a text post's, with its words up in the preview) to the top.
  pinBottom: { marginTop: 'auto' },
  caption: { fontSize: 13, fontFamily: FONT_INTER.semibold, lineHeight: 17 },
  captionLarge: { fontSize: 15, lineHeight: 20 },
  bylineName: { fontSize: 11, fontFamily: FONT_INTER.regular },
  bylineText: { fontSize: 11, flexShrink: 1 },
});
