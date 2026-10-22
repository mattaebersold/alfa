import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from '../ui/Avatar';
import MentionText from '../ui/MentionText';
import Badge, { TYPE_LABELS, CATEGORY_LABELS } from '../ui/Badge';
import PostActionRail from '../social/PostActionRail';
import { usePostLike } from '../../hooks/usePostLike';
import { useLikeState } from '../../hooks/useLikeState';
import PostOptionsButton from '../social/PostOptionsButton';
import PostOwnerMenu from '../social/PostOwnerMenu';
import { useSummary } from '../../providers/SummaryProvider';
import { userPreview } from '../members/UserSummaryModal';
import { Images } from 'lucide-react-native';
import MessageAboutListingButton from '../social/MessageAboutListingButton';
import { useGetUserByIdQuery, useGetLikeUsersQuery, useGetPostTagsQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { imageUrl } from '../../utils/image';
import { postMediaList } from '../../utils/postMedia';
import { LinearGradient } from 'expo-linear-gradient';
import PostMediaCarousel, { PageDots } from '../media/PostMediaCarousel';
import SourceAppChip from '../social/SourceAppChip';
import LikeBurst from '../social/LikeBurst';
import SpotResultBody, {
  SpotResultAction, SpotExpandButton, SpotDateBadge, SpotCollapse, spotHasSeveral,
} from '../feed/SpotResultBody';

import { colors, BADGE_COLORS, CATEGORY_BADGE_COLORS } from '../../constants/colors';
import { DIECAST_BLUE } from '../../constants/diecast';

/**
 * The feed card's ground — a step below `colors.card` (#1e1e1e).
 *
 * The feed is a column of these against the page's #0A0A0A, and at card grey
 * they ran together as one continuous slab. Staying under it gives each card an
 * edge without needing a rule to draw one. Lifted a shade from #161616, which
 * was close enough to the page to lose its edge on a dim screen; still under
 * #202020, which sat above `card` and made the posts the brightest things on
 * the page, when the photos in them should be.
 */
const FEED_CARD_BG = COLOR_GRAY_26;

/** Lines of description a card shows before it offers "more". */
const BODY_LINES = 2;

/**
 * The visible lines, with their tail cut back to make room for "… more".
 *
 * The measuring twin reports the text of each line it laid out, so the
 * preview can be rebuilt from exactly the words the clamp would have shown,
 * minus the last few — about the width of the link in bold — cut back to a
 * word boundary so it never ends mid-word. Shorter than the line it replaces,
 * so it can't wrap; the link then rides the end of the second line instead of
 * sitting alone on a third.
 */
const MORE_ROOM = 10;
function clipForMore(lines: string[], room = MORE_ROOM): string {
  const shown = lines.join('').replace(/\s+$/, '');
  const cut = shown.slice(0, Math.max(0, shown.length - room));
  const atWord = cut.replace(/\S*$/, '').replace(/\s+$/, '');
  return atWord || cut;
}

/**
 * Words clamped to `lines`, with "… more" riding the end of the last line
 * when the clamp is hiding something.
 *
 * Tapping anywhere on the words does what "more" does while there's more to
 * show — one small underlined word is a hard target on a phone. Once it's all
 * showing (or it all fit), the tap goes to `onPress`, the card's destination.
 * It never re-collapses: closing under the finger that opened it is the wrong
 * surprise.
 *
 * Whether there's more is measured on an invisible, unclamped twin.
 * `onTextLayout` on the clamped copy reports only the lines it drew, so it
 * can't tell a post that happens to fit from one that was cut off. The twin
 * has the same text, style and width (absolute, both edges pinned), sits out
 * of flow, and unmounts once it has answered.
 */
function ClampedText({
  text, lines, expandable, startExpanded, wrapStyle, style, moreColor, moreRoom, onPress,
}: {
  text: string;
  lines: number;
  /** Off for a title, which clamps but has nothing behind it to open. */
  expandable: boolean;
  startExpanded: boolean;
  wrapStyle: any;
  style: any;
  moreColor: string;
  /** Characters cut from the last line to fit the link — wider for bigger type. */
  moreRoom: number;
  onPress?: () => void;
}) {
  const [expanded, setExpanded] = useState(startExpanded);
  const [lineCount, setLineCount] = useState<number | null>(null);
  /** The first `lines` lines as laid out — what the clamped preview shows. */
  const [clip, setClip] = useState<string | null>(null);
  const truncated = expandable && !expanded && lineCount !== null && lineCount > lines;
  // Only when there's something to cut and the clip is known; otherwise the
  // native clamp does what it always did.
  const inlineMore = truncated && clip !== null;
  const handlePress = truncated ? () => setExpanded(true) : onPress;

  return (
    <TouchableOpacity style={wrapStyle} onPress={handlePress} activeOpacity={0.95} disabled={!handlePress}>
      <MentionText
        text={inlineMore ? `${clipForMore([clip!], moreRoom)}… ` : text}
        style={style}
        numberOfLines={expanded ? undefined : lines}
        trailing={inlineMore ? (
          <Text
            style={[styles.moreLink, { color: moreColor }]}
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
          >
            more
          </Text>
        ) : null}
      />
      {expandable && !expanded && lineCount === null && (
        <View style={styles.bodyMeasure} pointerEvents="none" aria-hidden>
          <MentionText
            text={text}
            style={style}
            onTextLayout={(e) => {
              const laid: { text: string }[] = e.nativeEvent?.lines ?? [];
              setLineCount(laid.length);
              setClip(laid.slice(0, lines).map((l) => l.text).join(''));
            }}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}
import { useColors } from '../../hooks/useColors';
import type { FeedStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';
import { stripHtml } from '../../utils/text';
import { shortTimeAgo } from '../../utils/shortTimeAgo';
import PostContextRow from '../social/PostContextRow';
import PostPlaceLine from '../social/PostPlaceLine';
import LikersSheet from '../social/LikersSheet';
import PostPoll from '../social/PostPoll';
import { type SummaryOrigin } from '../ui/SummaryModal';
import {
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_FOREST,
  COLOR_GRAY_26,
  COLOR_WHITE,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

type NavProp = NativeStackNavigationProp<FeedStackParamList>;


interface FeedItemCardProps {
  post: Post;
  isLiked?: boolean;
  /**
   * Where tapping the card goes, when its host has somewhere to send it.
   *
   * The feed doesn't: everything a post has to say is on the card now — the
   * whole body opens in place, the comment button raises the thread, the
   * likers open a summary panel — so pushing a detail screen would land you on
   * the same content one screen deeper. Left undefined there, and a tap
   * expands the description instead.
   *
   * Surfaces with their own destination still pass one. A car's records open
   * that car's record pane, which is not this post on another screen.
   */
  onPress?: () => void;
  /** No longer used — the comment button opens its own panel (PostActionRail). Kept so hosts still compile. */
  onCommentPress?: () => void;
  /**
   * Whether this card is on screen. Forwarded to the media carousel so a
   * playing video stops when it scrolls away. Undefined means "don't manage
   * it" — surfaces without a list leave playback alone.
   */
  visible?: boolean;
  /** The group whose page this card is on, so its tile isn't shown — see PostContextRow. */
  omitGroupId?: string;
  /**
   * No card of its own — no fill, shadow or margin — for a host that is
   * already the card around it, like a summary panel.
   */
  bare?: boolean;
  /** The card's fill, for a host whose ground is the feed card's own — a group's page. */
  background?: string;
  /** The whole title and description, never clamped — for a sheet given over to the one post. */
  fullText?: boolean;
  /**
   * The owner's Edit, for a host that already holds the editor (the post's own
   * pane). Left out, Edit opens the post's pane with the editor up.
   */
  onEdit?: () => void;
  /** After the owner deletes it — the post's own pane closes itself. */
  onDeleted?: () => void;
}

export default function FeedItemCard({ post, isLiked, onPress, onCommentPress, visible, omitGroupId, bare = false, background, fullText = false, onEdit, onDeleted }: FeedItemCardProps) {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const blockedUserIds = useAppSelector((s) => (s as any).moderation?.blockedUserIds ?? []);
  // Non-null while the likers panel is open — it doubles as the rect the panel
  // grows out of.
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);
  /** The same, for the tagged members' panel. */
  const [taggedOrigin, setTaggedOrigin] = useState<SummaryOrigin | null | undefined>(undefined);
  /** A spot result starts folded to its header row — see SpotExpandButton. */
  const [spotOpen, setSpotOpen] = useState(false);

  // Photos and videos are one ordered list — see utils/postMedia. This also
  // folds in posts whose video predates typed gallery entries, so the card
  // doesn't need a separate branch for them any more.
  /**
   * A shared Car Spotter result draws its own middle — the zoomed puzzle photo
   * and the guess grid — in place of the title, words and media. Its body is
   * the emoji version of that grid, for surfaces that can only show text, and
   * would only repeat it here. Needs the `carspot` summary to draw from; a
   * result without one falls back to an ordinary text post.
   */
  const spotResult = post.type === 'spot_result' && post.carspot ? post.carspot : null;
  // Two or three of the day's games: each answers for itself in its own
  // sub-card, and the footer keeps just the icons.
  const spotSeveral = !!spotResult && spotHasSeveral(spotResult);
  const media = spotResult ? [] : postMediaList(post);
  const hasMedia = media.length > 0;
  const bodyText = !spotResult && post.body ? stripHtml(post.body).trim() : '';

  /**
   * Like state, from the feed when the feed knows it.
   *
   * The feed endpoint sends `likers`, `isLiked` and the liker names it
   * batched server-side, so a card being scrolled past asks for nothing. Cards
   * rendered from endpoints that don't enrich fall through to the query.
   *
   * Over both: what this session knows (useLikeState) — a like you made here,
   * settled from the server's own liker list. The payload predates it, and a
   * card rebuilt from the payload used to forget it.
   */
  const known = useLikeState(post.internal_id);
  const fedLikers: string[] | null = Array.isArray(post.likers) ? post.likers : null;
  const { data: likeData } = useGetLikeUsersQuery(post.internal_id, {
    skip: !post.internal_id || !!fedLikers,
  });

  const likers = known?.users ?? likeData?.users ?? fedLikers ?? [];
  const likeCount = known?.count ?? likeData?.total ?? post.like_count ?? post.likeCount ?? 0;
  const iLiked = known
    ? known.liked
    : likeData
      // `likers` is capped in the feed payload, so membership only answers
      // the question once we hold the real list.
      ? !!userInfo?.user_id && likers.includes(userInfo.user_id)
      : (isLiked ?? post.isLiked ?? false);

  const fedUser = post.user ?? post.user_objectid;
  const { data: fetchedUser } = useGetUserByIdQuery(post.user_id, {
    skip: !post.user_id || !!fedUser?.username,
  });
  const user = fetchedUser ?? fedUser;
  const displayName = user?.username || 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'post';  // for LikeButton API calls
  const badgeType = post.type ?? post.entry_type ?? 'post';  // what the user actually chose
  const timeAgo = shortTimeAgo(post.created_at);
  const mediaCount = media.length;

  /** Whose summary panel is open, if any. */
  const { openUser } = useSummary();

  /**
   * Like, comment, share, bookmark — a column over the photo, or a row in the
   * footer when there's no photo to float over. See PostActionRail.
   */
  /**
   * The like, held once for both hearts — the rail's and the likes row's —
   * so tapping either moves both. See usePostLike.
   */
  const like = usePostLike({
    postId: post.internal_id,
    entryType,
    ownerId: post.user_id,
    initialLiked: iLiked,
    initialCount: likeCount,
  });

  /**
   * Double-tap anywhere on the card to like it — the heart blooms where you
   * are rather than only in the rail's corner. Only ever likes: a second
   * double tap on something you've liked does nothing, the way it does
   * everywhere else people do this. Nothing on your own post.
   *
   * On top of the card's own taps, not instead of them: the words, the
   * author and the buttons keep their single tap with no wait for a possible
   * second one. A photo has no single tap of its own in the feed, so there
   * the double tap is all there is.
   */
  const [burst, setBurst] = useState(0);
  const doubleTap = useMemo(() => {
    const onDoubleTap = () => { if (like.like()) setBurst((n) => n + 1); };
    // A short leash on movement, so the start of a scroll or a swipe through
    // the photos is never counted as one of the taps.
    return Gesture.Tap().numberOfTaps(2).maxDelay(260).maxDistance(12).onEnd((_e, ok) => {
      if (ok) runOnJS(onDoubleTap)();
    });
  }, [like]);

  /**
   * Members tagged in it, for the rail. The feed sends tags with the post;
   * elsewhere they're asked for — the same request PostContextRow makes, so
   * it's shared rather than repeated.
   */
  const inlineTags = Array.isArray(post.tags) ? post.tags : null;
  const { data: fetchedTags } = useGetPostTagsQuery(post.internal_id, {
    skip: !!inlineTags || !post.internal_id,
  });
  const taggedIds = useMemo(
    () => [...new Set(
      (inlineTags ?? fetchedTags ?? [])
        .filter((t: any) => t.tag_entry_type === 'user' && t.tag_internal_id)
        .map((t: any) => t.tag_internal_id as string),
    )],
    [inlineTags, fetchedTags],
  );

  const rail = (vertical: boolean) => (
    <PostActionRail
      post={post}
      entryType={entryType}
      like={like}
      likers={likers}
      onOpenLikers={(origin) => setLikersOrigin(origin)}
      tagged={taggedIds}
      onOpenTagged={(origin) => setTaggedOrigin(origin)}
      vertical={vertical}
      // A game result isn't something to come back to.
      bookmark={!spotResult}
    />
  );

  const isListing = post.type === 'listing' || post.type === 'want';
  const isDiecast = post.category === 'diecast';
  const cardBg = isDiecast ? DIECAST_BLUE : background ?? FEED_CARD_BG;
  const fgColor = isDiecast ? COLOR_WHITE : colors.fg;
  const mutedColor = isDiecast ? 'rgba(255,255,255,0.7)' : colors.muted;
  // The time and the menu take the description's ink: the row's furniture
  // reads at one level, under the name.
  const timeColor = mutedColor;

  // When it was posted, and the ⋯ menu — the header's right end, or, on a
  // game result, the top of its opened part.
  const postMenu = userInfo?.user_id === post.user_id ? (
    <PostOwnerMenu postId={post.internal_id} color={mutedColor} onEdit={onEdit} onDeleted={onDeleted} />
  ) : (
    <PostOptionsButton postId={post.internal_id} author={user} size={18} color={mutedColor} />
  );
  // Grouped, and tighter than the header's own gap: the time is short now
  // ("3h"), and left at the header's spacing it floated off on its own.
  const postMeta = (
    <View style={styles.meta}>
      <Text style={[styles.time, { color: timeColor }]}>{timeAgo}</Text>
      {postMenu}
    </View>
  );
  const typeBadge = BADGE_COLORS[badgeType] ?? BADGE_COLORS.default;
  const categoryBadge = post.category
    ? (CATEGORY_BADGE_COLORS[post.category] ?? CATEGORY_BADGE_COLORS.default)
    : null;

  // Hidden (reported) or from a blocked user — return after all hooks to keep hook order stable.
  if (hiddenIds.includes(post.internal_id) || (post.user_id && blockedUserIds.includes(post.user_id))) return null;

  return (
    /**
     * A plain View, not a TouchableOpacity.
     *
     * The card used to be one big press target with the gallery inside it, and
     * on Android the outer touchable wins the responder negotiation against a
     * nested horizontal list often enough that swiping between a post's photos
     * mostly didn't work. Opening the post is now attached to the regions that
     * are only ever tapped — the words, and the single-image hero — leaving the
     * gallery's own gesture uncontested.
     */
    <GestureDetector gesture={doubleTap}>
    <View style={[styles.card, { backgroundColor: cardBg }, bare && styles.cardBare]}>
      {/* Header — avatar/name tap navigates to profile */}
      <View style={[styles.header, bare && styles.headerBare]}>
        {/* The author half is the link; the menu is not. Its own touchable, so
            tapping ⋯ doesn't also navigate to whoever posted. */}
        <TouchableOpacity
          style={styles.headerAuthor}
          // A summary over the feed, not a push to the profile. "Who is that"
          // is a glance, and answering it with a whole screen cost you the
          // scroll position you were reading from. The panel carries its own
          // View Profile for when the glance isn't enough.
          onPress={() => user?.user_id && openUser(user.user_id, null, userPreview(user))}
          activeOpacity={0.7}
        >
          {/* Squared to the app's corner rather than a circle — it sits in a
              card built from the same radius, and a lone circle in that row
              read as a different kind of object. */}
          {/* 30, not 36: the avatar is the tallest thing in the row, so it
              sets the header's height. */}
          <Avatar user={user} size={30} />
          <View style={styles.headerText}>
            <Text style={[styles.author, { color: fgColor }]} numberOfLines={spotResult ? 1 : undefined}>
              {displayName}
              {/* A game result says what it is in the header, so folded
                  down to this one row it still reads as something. */}
              {spotResult ? <Text style={[styles.played, { color: mutedColor }]}> played Guess the car</Text> : null}
            </Text>
          </View>
        </TouchableOpacity>
        {spotResult ? (
          <>
            <SpotDateBadge carspot={spotResult} />
            <SpotExpandButton open={spotOpen} onToggle={() => setSpotOpen((o) => !o)} color={mutedColor} />
          </>
        ) : postMeta}
      </View>

      {/* A game result's folded row is just who and when it was played; the
          menu comes with the rest of it, beside the like. */}
      {spotResult ? (
        <SpotCollapse open={spotOpen}>
          <SpotResultBody carspot={spotResult} author={user} action={spotSeveral} />
          <PostContextRow post={post} omitGroupId={omitGroupId} />
          <View style={styles.footerRow}>
            {/* A spot result's way into the game leads the row; the icons keep
                the right. */}
            <View style={styles.footerLeft}>
              {spotSeveral ? null : <SpotResultAction carspot={spotResult} author={user} />}
            </View>
            {rail(false)}
            {postMenu}
          </View>
        </SpotCollapse>
      ) : null}

      {/* The title, or the body standing in for it when there isn't one.
          Without a picture the words are the whole card, and at the size that
          sits under a photo they read as a caption for something missing.

          Padding lives on the wrapper, not the text: MentionText hands its
          style down to each inline segment, and a mention carrying the card's
          horizontal padding would sit in a gap of its own. */}
      {/* Where the post was made, when it wasn't made here. Under the author,
          because it's about the post's origin the way the author is, and
          above the post itself so it doesn't read as part of what was said. */}
      {/* Not on a spot result: the result body says where it's from, and
          offers its own way into the app. */}
      {post.source_app && !spotResult ? (
        <SourceAppChip app={post.source_app} sourceId={post.source_id} style={styles.sourceChip} />
      ) : null}


      {/* The words: the title, or the description standing in for one, then
          a taste of the description under a title. Whichever is the
          description clamps with a "more" — tapping the words opens them in
          place when they were cut off, and goes on to the post when there's
          nothing more to show. */}
      {!spotResult && (post.title || bodyText) && (
        <ClampedText
          text={post.title || bodyText}
          lines={hasMedia ? 2 : 5}
          // A title is a title; only the description has more to give.
          expandable={!post.title}
          startExpanded={fullText}
          wrapStyle={hasMedia ? styles.titleWrap : styles.titleAloneWrap}
          style={[hasMedia ? styles.title : styles.titleAlone, { color: fgColor }]}
          moreColor={fgColor}
          moreRoom={hasMedia ? 12 : 16}
          onPress={onPress}
        />
      )}

      {post.title && bodyText ? (
        <ClampedText
          text={bodyText}
          lines={BODY_LINES}
          expandable
          startExpanded={fullText}
          wrapStyle={styles.bodyPreviewWrap}
          style={[styles.bodyPreview, { color: mutedColor }]}
          moreColor={mutedColor}
          moreRoom={MORE_ROOM}
          onPress={onPress}
        />
      ) : null}

      {/* The poll, when the post has one — under the words and above the
          picture, because the question is what the words were leading up
          to. Renders nothing without a summary. */}
      {post.poll_summary ? <PostPoll post={post} style={styles.poll} /> : null}

      {/* The post's media — photos and videos in one strip, drawn at one
          shape so swiping doesn't resize the card. */}
      {hasMedia && (
          <View style={[styles.mediaFrame, bare && styles.mediaFrameBare]}>
            <PostMediaCarousel
              media={media}
              // The height follows the slide — landscape, square or portrait —
              // easing between them as you swipe. See PostMediaCarousel.
              adaptiveHeight
              // Dots at the foot of the photo, back again. The count badge says
              // how many there are and opens the viewer; it can't say which one
              // you're on, and without that a swipe gave no sign it had
              // landed anywhere. The carousel's dots are the same small
              // white/translucent row this card drew before it had one.
              visible={visible}
              // With no destination to go to, a tap on a photo opens the photo
              // — the same viewer the gallery badge opens. A video's first tap
              // is still its own: it starts playback.
              // A host with somewhere to go keeps the tap. Otherwise a photo has
              // no tap at all: a closer look is a pinch (below), and a double
              // tap is a like.
              onPressItem={onPress}
              pinchZoom
              // Dots drawn here, beside the gallery count, not at the foot's centre.
              showPageIndicator={false}
              overlay={({ active }) =>
                <>
                  {/* Type + category badges — top left, color coded */}
                  <View style={styles.imageBadgesLeft} pointerEvents="none">
                    <View style={[styles.imgBadge, { backgroundColor: typeBadge.bg }]}>
                      <Text style={[styles.imgBadgeText, { color: typeBadge.fg }]}>{TYPE_LABELS[badgeType] ?? badgeType}</Text>
                    </View>
                    {categoryBadge ? (
                      <View style={[styles.imgBadge, { backgroundColor: categoryBadge.bg }]}>
                        <Text style={[styles.imgBadgeText, { color: categoryBadge.fg }]}>{CATEGORY_LABELS[post.category!] ?? post.category}</Text>
                      </View>
                    ) : null}
                  </View>
                  {/* Price — top right.
                      `box-none` rather than `none`: the gallery count is a
                      button now, so the column has to let touches reach it
                      while still passing everything else through to the
                      carousel underneath. */}
                  <View style={styles.imageBadgesRight} pointerEvents="box-none">
                    {post.price ? (
                      <View style={styles.priceBadge} pointerEvents="none">
                        <Text style={styles.priceBadgeText}>${Number(post.price).toLocaleString()}</Text>
                      </View>
                    ) : null}
                  </View>
                  {/* A wash from the bottom-right corner, black fading to
                      nothing along the diagonal, so the rail's white icons
                      read over a bright photo. Under the controls. */}
                  <LinearGradient
                    colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0)']}
                    locations={[0, 0.45, 1]}
                    start={{ x: 1, y: 1 }}
                    end={{ x: 0.2, y: 0.2 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  {/* Bottom left: the gallery count, and the page dots
                      straight after it. A label now, not a button — the
                      photos are swiped through and pinched into right here. */}
                  {mediaCount > 1 && (
                    <View style={styles.galleryRow} pointerEvents="none">
                      <View
                        style={styles.multiImgBadge}
                        accessibilityLabel={`${mediaCount} photos`}
                      >
                        <Images size={16} color={COLOR_WHITE} strokeWidth={2} />
                        {/* The dots, in the pill — one per photo, so they're
                            the count too, and say which one you're on. */}
                        <PageDots count={mediaCount} active={active} />
                      </View>
                    </View>
                  )}
                  {/* The actions, down the right of the photo. */}
                  <View style={styles.rail} pointerEvents="box-none">{rail(true)}</View>
                </>
              }
            />
          </View>
      )}

      {/* Message the seller about a marketplace listing */}
      {isListing && user?.user_id && userInfo?.user_id !== post.user_id && (
        <View style={styles.messageWrap}>
          <MessageAboutListingButton sellerId={user.user_id} sellerUsername={user.username} listingTitle={post.title} />
        </View>
      )}

      {/* Liked-by row */}
      {/* What this post is attached to — its group, and whoever and whatever
          is tagged in it. Below the post rather than above it: the post is
          what you came to read, and this lands where "and where was this?"
          actually occurs to you. Above the likes, which belong with the
          actions they came from. */}
      {/* A spot result's sits in its opening part, above. */}
      {/* Members tagged in it are on the rail now (the tag and faces), not tiles here. */}
      {spotResult ? null : <PostContextRow post={post} omitGroupId={omitGroupId} omitUsers />}

      {/* Where it was made, under the post and whatever's tagged in it — a
          footnote, so small and in the muted ink. A tap opens the place, with
          every post made there; the line owns that panel. */}
      {spotResult ? null : <PostPlaceLine place={post.place} color={mutedColor} style={styles.placeLine} />}

      {/* No photo to carry the actions: they end the card in a row of their
          own instead, right-aligned. */}
      {!hasMedia && !spotResult && (
        <View style={styles.footerRow}>
          {rail(false)}
        </View>
      )}


      <LikersSheet
        entryId={post.internal_id}
        visible={likersOrigin !== undefined}
        origin={likersOrigin}
        onClose={() => setLikersOrigin(undefined)}
      />
      <LikersSheet
        entryId={post.internal_id}
        userIds={taggedIds}
        title="Tagged"
        visible={taggedOrigin !== undefined}
        origin={taggedOrigin}
        onClose={() => setTaggedOrigin(undefined)}
      />

      <LikeBurst trigger={burst} />
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  cardBare: { backgroundColor: 'transparent', marginVertical: 0, shadowOpacity: 0, elevation: 0, borderRadius: 0 },
  card: {
    // The card is full-bleed, so this rounds against the page rather than
    // inside a gutter — enough to read as a card, short of the point where a
    // tile cropped by the screen edge starts to look like a mistake.
    borderRadius: COMMON_RADIUS,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 12, paddingBottom: 10, gap: 8 },
  // In a panel, nearer its top — the panel's own edge is the room above —
  // and in from the side far enough that the avatar clears its rounded corner.
  headerBare:  { paddingTop: 8, paddingHorizontal: 16 },
  // Takes the row, so the timestamp and the menu stay pinned right.
  headerAuthor: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerText:  { flex: 1, minWidth: 0 },
  author:      { fontSize: 14, fontFamily: FONT_INTER.bold },
  played:      { fontFamily: FONT_INTER.medium },
  username:    { fontSize: 12, marginTop: 1 },
  time:        { fontSize: 11, fontStyle: 'italic' },
  meta:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  titleWrap:      { paddingHorizontal: 8, paddingBottom: 10 },
  title:          { fontSize: 14, fontFamily: FONT_INTER.semibold, lineHeight: 20 },
  titleAloneWrap: { paddingHorizontal: 8, paddingTop: 2, paddingBottom: 12 },
  titleAlone:     { fontSize: 18, fontFamily: FONT_INTER.bold, lineHeight: 24 },
  bodyPreviewWrap:{ paddingHorizontal: 8, paddingBottom: 10, marginTop: -6 },
  // Stepped back a touch from `muted`, so the title leads it more clearly.
  bodyPreview:    { fontSize: 13, lineHeight: 18, opacity: 0.85 },
  /**
   * Same width as the real one, invisible, out of flow.
   *
   * Zero rather than the wrapper's own 8: Yoga positions an absolute child
   * from the parent's *padding* edge, so 0 here is exactly the box the visible
   * text lays out in. Insetting by 8 again would measure a narrower column,
   * over-count the lines, and offer "more" on posts that already fit.
   */
  bodyMeasure: {
    position: 'absolute', left: 0, right: 0, top: 0,
    opacity: 0,
  },
  // Underlined and on its own line: inline it would have to sit inside the
  // clamped Text, where it'd be the first thing the clamp cut off.
  // Inline at the end of the preview's last line, in the preview's own size.
  moreLink: { fontFamily: FONT_INTER.bold, textDecorationLine: 'underline' },

  image:       { width: '100%' },
  // Rounded all round, the card's radius — a tile set into the card between
  // the words above it and what's under it.
  mediaFrame: { borderRadius: COMMON_RADIUS, overflow: 'hidden' },
  // Square in a panel: it runs edge to edge there, and rounded it read as a
  // card inside the card.
  mediaFrameBare: { borderRadius: 0 },

  imageBadgesLeft: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 5, flexWrap: 'wrap',
  },
  // At 80%, so the photo shows a little through the type and category.
  imgBadge:   {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
    opacity: 0.8,
  },
  imgBadgeText: { color: COLOR_WHITE, fontSize: 10, fontFamily: FONT_INTER.bold, letterSpacing: 0.3 },

  // Bottom left: the gallery count, then the page dots.
  galleryRow: {
    position: 'absolute', left: 10, bottom: 10,
    // Tight: the dots belong to the count beside them.
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  imageBadgesRight: {
    position: 'absolute', top: 10, right: 10, alignItems: 'flex-end', gap: 5,
  },
  priceBadge:    {
    backgroundColor: COLOR_FOREST,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: PILL_RADIUS,
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4
  },
  priceBadgeText: { fontSize: 13, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  multiImgBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    // Roomier than it was — it's a target, not a label, and at 11×7 around a
    // two-character count it was a very small thing to hit. `hitSlop` widens
    // the touch area again beyond what's drawn.
    paddingHorizontal: 13, paddingVertical: 9,
    borderRadius: PILL_RADIUS,
  },
  // Not bold: at 800 the count read as loudly as the post's own title.

  messageWrap: { paddingHorizontal: 8, paddingTop: 10 },
  // Tucked up under the author row; the card's own inset on the left.
  sourceChip:  { marginLeft: 8, marginTop: -2, marginBottom: 10 },
  poll:        { paddingHorizontal: 8, paddingBottom: 10 },
  // The card's own inset; under the photo or the tags, and room under it in
  // case the card ends here.
  placeLine:   { marginHorizontal: 8, marginTop: 6, marginBottom: 8 },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, gap: 8,
  },
  // Takes the row so the menu stays pinned right on a card with no likes.
  footerLeft:  { flex: 1, minWidth: 0 },
  // Over the photo, anchored at its bottom right.
  rail: { position: 'absolute', right: 4, bottom: 4 },
});
