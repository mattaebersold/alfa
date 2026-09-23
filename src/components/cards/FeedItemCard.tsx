import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from '../ui/Avatar';
import MentionText from '../ui/MentionText';
import Badge, { TYPE_LABELS, CATEGORY_LABELS } from '../ui/Badge';
import LikeButton from '../social/LikeButton';
import CommentButton from '../social/CommentButton';
import ReportButton from '../ui/ReportButton';
import PostOwnerMenu from '../social/PostOwnerMenu';
import ImageLightbox from '../ui/ImageLightbox';
import UserSummaryModal from '../members/UserSummaryModal';
import { Images } from 'lucide-react-native';
import MessageAboutListingButton from '../social/MessageAboutListingButton';
import { useGetUserByIdQuery, useGetLikeUsersQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { imageUrl } from '../../utils/image';
import { postMediaList, type PostMedia } from '../../utils/postMedia';
import PostMediaCarousel from '../media/PostMediaCarousel';
import SourceAppChip from '../social/SourceAppChip';
import SpotResultBody from '../feed/SpotResultBody';

import { colors, BADGE_COLORS, CATEGORY_BADGE_COLORS } from '../../constants/colors';
import { DIECAST_BLUE } from '../../constants/diecast';

/**
 * The feed card's ground — a step below `colors.card` (#1e1e1e).
 *
 * The feed is a column of these against the page's #0A0A0A, and at card grey
 * they ran together as one continuous slab. Staying under it gives each card an
 * edge without needing a rule to draw one. Darker than it was (#202020): that
 * sat a shade above `card`, which made the posts the brightest things on the
 * page, and the photos in them should be.
 */
const FEED_CARD_BG = '#161616';

/** Lines of description a card shows before it offers "more". */
const BODY_LINES = 2;
import { useColors } from '../../hooks/useColors';
import type { FeedStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';
import { stripHtml } from '../../utils/text';
import PostContextRow from '../social/PostContextRow';
import LikersSheet from '../social/LikersSheet';
import PostPoll from '../social/PostPoll';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

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
  onCommentPress?: () => void;
  /**
   * Whether this card is on screen. Forwarded to the media carousel so a
   * playing video stops when it scrolls away. Undefined means "don't manage
   * it" — surfaces without a list leave playback alone.
   */
  visible?: boolean;
}

// "Liked by matt and 3 others" — resolves the username of a representative liker
// (preferring someone other than the viewer) and appends the remaining count.
function LikedByLine({ likers, total, myId, names, onPressUser, color, style }: {
  likers: string[]; total: number; myId?: string;
  /** id -> username, when whatever loaded this post already resolved them. */
  names?: Record<string, string>;
  /**
   * A name was tapped.
   *
   * The line doesn't navigate any more — pushing a whole profile screen to
   * answer "who is that" meant leaving the feed and scrolling back to where you
   * were. The card opens a summary panel over the feed instead, and this is how
   * it hears which person.
   */
  onPressUser: (userId: string) => void;
  color: string; style: any;
}) {
  const colors = useColors();

  /**
   * Up to three names, other people first.
   *
   * Your own like is the one you already know about, so it goes to the back of
   * the queue — "liked by you and 4 others" tells you nothing you didn't do
   * yourself a second ago.
   */
  const candidates = [
    ...likers.filter((id) => id !== myId),
    ...likers.filter((id) => id === myId),
  ].slice(0, 3);

  // Three fixed lookups rather than a loop: hooks have to be called the same
  // number of times on every render, and a list of them is how that breaks.
  // The feed resolves these names server-side and sends them with the post, so
  // in the feed all three lookups sit out. Cards drawn from endpoints that
  // don't do that still fetch for themselves.
  const known = (id?: string) => (id && names?.[id]) || undefined;
  const q0 = useGetUserByIdQuery(candidates[0] ?? '', { skip: !candidates[0] || !!known(candidates[0]) });
  const q1 = useGetUserByIdQuery(candidates[1] ?? '', { skip: !candidates[1] || !!known(candidates[1]) });
  const q2 = useGetUserByIdQuery(candidates[2] ?? '', { skip: !candidates[2] || !!known(candidates[2]) });

  if (total <= 0) return null;

  const named = candidates
    .map((id, i) => {
      const username = known(id);
      if (username) return { user_id: id, username };
      return [q0.data, q1.data, q2.data][i];
    })
    .filter((u): u is NonNullable<typeof u> => !!u?.username);

  // Nothing resolved yet — the count is still true, and it beats an empty line
  // that pops into a sentence a moment later.
  if (named.length === 0) {
    return (
      <Text style={[style, { color }]}>
        {total === 1 ? 'Liked by someone' : `Liked by ${total} people`}
      </Text>
    );
  }

  const others = Math.max(0, total - named.length);

  /**
   * The separator before a name: nothing, a comma, or "and".
   *
   * "and" is only the last joint when nothing follows the names — with others
   * still to come, the last name takes a comma and "and" belongs to the tail.
   */
  const joint = (i: number) => {
    if (i === 0) return '';
    if (i === named.length - 1 && others === 0) return ' and ';
    return ', ';
  };

  return (
    <Text style={[style, { color }]}>
      Liked by{' '}
      {named.map((u, i) => (
        <Text key={u.user_id}>
          {joint(i)}
          {/* The names are the part of this line that lead somewhere, so they
              are the part you can press. Colour alone says so — it keeps the
              weight of the sentence they sit in. */}
          <Text
            style={{ color: colors.blueLight }}
            onPress={() => onPressUser(u.user_id)}
            suppressHighlighting
          >
            {u.username}
          </Text>
        </Text>
      ))}
      {others > 0 ? ` and ${others} ${others === 1 ? 'other' : 'others'}` : ''}
    </Text>
  );
}

export default function FeedItemCard({ post, isLiked, onPress, onCommentPress, visible }: FeedItemCardProps) {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const blockedUserIds = useAppSelector((s) => (s as any).moderation?.blockedUserIds ?? []);
  // Non-null while the likers panel is open — it doubles as the rect the panel
  // grows out of.
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);

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
  const media = spotResult ? [] : postMediaList(post);
  const hasMedia = media.length > 0;
  const bodyText = !spotResult && post.body ? stripHtml(post.body).trim() : '';

  /**
   * Like state, from the feed when the feed knows it.
   *
   * The feed endpoint now sends `likers`, `isLiked` and the liker names it
   * batched server-side, so a card being scrolled past asks for nothing. Cards
   * rendered from endpoints that don't enrich fall through to the query, as
   * does any card once you've touched its heart — from that point the liked-by
   * line has to track a change the payload predates.
   */
  const [likeTouched, setLikeTouched] = useState(false);
  const fedLikers: string[] | null = Array.isArray(post.likers) ? post.likers : null;
  const { data: likeData } = useGetLikeUsersQuery(post.internal_id, {
    skip: !post.internal_id || (!!fedLikers && !likeTouched),
  });

  const likers = likeData?.users ?? fedLikers ?? [];
  const likeCount = likeData?.total ?? post.like_count ?? post.likeCount ?? 0;
  const iLiked = likeData
    // `likers` is capped in the feed payload, so membership only answers the
    // question once we hold the real list.
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
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  const mediaCount = media.length;

  // Tap still opens the post — that's what a card in a feed is for. A pinch on
  // the photo opens the full-screen viewer instead, which is the gesture people
  // already reach for when they want a closer look, and it doesn't compete with
  // either the tap or the sideways swipe through the gallery.
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  /**
   * The description, clamped until asked otherwise.
   *
   * `bodyLines` is null until the first layout reports how many lines the text
   * wants; that measurement is what decides whether "more" has anything to
   * reveal. It never resets — a card doesn't re-collapse once opened, because
   * collapsing under the finger that expanded it is the wrong surprise.
   */
  /** Whose summary panel is open, if any. */
  const [summaryUserId, setSummaryUserId] = useState<string | null>(null);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [bodyLines, setBodyLines] = useState<number | null>(null);
  const bodyTruncated = !bodyExpanded && bodyLines !== null && bodyLines > BODY_LINES;

  /**
   * Tapping the words.
   *
   * A host with a destination wins — that's what `onPress` is for. Otherwise
   * the tap does what the "more" link does, so the whole card is the target
   * rather than one small underlined word.
   */
  const handleBodyPress = onPress ?? (bodyTruncated ? () => setBodyExpanded(true) : undefined);
  // The zoom viewer shows photos; a video has its own player and nothing to
  // pinch into.
  const galleryUrls = media
    .filter((m): m is Extract<PostMedia, { kind: 'image' }> => m.kind === 'image')
    .map((m) => m.url);
  const zoomGesture = Gesture.Pinch().onStart(() => {
    runOnJS(setZoomIndex)(0);
  });

  /**
   * Like and comment.
   *
   * Over the photo when there is one: they belong to the post, and the photo is
   * the post — down in the card they were a strip of chrome the eye had to
   * travel to. Over an unknown image they need their own ground, which is what
   * the pill is for.
   */
  const actionsRow = (
    <>
      <LikeButton
        documentId={post.internal_id}
        entryType={entryType}
        ownerId={post.user_id}
        initialCount={likeCount}
        initialLiked={iLiked}
        // Switches this card off the feed's snapshot and onto the live query,
        // so the liked-by line below reflects what you just did.
        onToggle={() => setLikeTouched(true)}
        color="#FFFFFF"
      />
      <CommentButton
        count={post.comment_count ?? post.commentCount ?? 0}
        documentId={post.internal_id}
        onPress={onCommentPress}
        color="#FFFFFF"
      />
    </>
  );

  const isListing = post.type === 'listing' || post.type === 'want';
  const isDiecast = post.category === 'diecast';
  const cardBg = isDiecast ? DIECAST_BLUE : FEED_CARD_BG;
  const fgColor = isDiecast ? '#FFFFFF' : colors.fg;
  const mutedColor = isDiecast ? 'rgba(255,255,255,0.7)' : colors.muted;
  const timeColor = isDiecast ? 'rgba(255,255,255,0.6)' : colors.grey;
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
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Header — avatar/name tap navigates to profile */}
      <View style={styles.header}>
        {/* The author half is the link; the menu is not. Its own touchable, so
            tapping ⋯ doesn't also navigate to whoever posted. */}
        <TouchableOpacity
          style={styles.headerAuthor}
          // A summary over the feed, not a push to the profile. "Who is that"
          // is a glance, and answering it with a whole screen cost you the
          // scroll position you were reading from. The panel carries its own
          // View Profile for when the glance isn't enough.
          onPress={() => user?.user_id && setSummaryUserId(user.user_id)}
          activeOpacity={0.7}
        >
          {/* Squared to the app's corner rather than a circle — it sits in a
              card built from the same radius, and a lone circle in that row
              read as a different kind of object. */}
          <Avatar user={user} size={36} radius={COMMON_RADIUS} />
          <View style={styles.headerText}>
            <Text style={[styles.author, { color: fgColor }]}>@{displayName}</Text>
          </View>
        </TouchableOpacity>
        <Text style={[styles.time, { color: timeColor }]}>{timeAgo}</Text>
        {userInfo?.user_id === post.user_id ? (
          <PostOwnerMenu postId={post.internal_id} color={isDiecast ? '#FFFFFF' : colors.grey} />
        ) : (
          <ReportButton contentType="post" contentId={post.internal_id} size={18} />
        )}
      </View>

      {/* The title, or the body standing in for it when there isn't one.
          Without a picture the words are the whole card, and at the size that
          sits under a photo they read as a caption for something missing.

          Padding lives on the wrapper, not the text: MentionText hands its
          style down to each inline segment, and a mention carrying the card's
          horizontal padding would sit in a gap of its own. */}
      {/* Where the post was made, when it wasn't made here. Under the author,
          because it's about the post's origin the way the author is, and
          above the post itself so it doesn't read as part of what was said. */}
      {post.source_app ? (
        <SourceAppChip app={post.source_app} sourceId={post.source_id} style={styles.sourceChip} />
      ) : null}

      {spotResult ? <SpotResultBody carspot={spotResult} /> : null}

      {!spotResult && (post.title || bodyText) && (
        <TouchableOpacity
          style={hasMedia ? styles.titleWrap : styles.titleAloneWrap}
          onPress={handleBodyPress}
          activeOpacity={0.95}
        >
          <MentionText
            text={post.title || bodyText}
            style={[hasMedia ? styles.title : styles.titleAlone, { color: fgColor }]}
            numberOfLines={hasMedia ? 2 : 5}
          />
        </TouchableOpacity>
      )}

      {/* A taste of the body under the title — enough to know whether to open
          it, not enough to be the post. Skipped when the body *is* the line
          above. */}
      {post.title && bodyText ? (
        <TouchableOpacity
          style={styles.bodyPreviewWrap}
          onPress={handleBodyPress}
          activeOpacity={0.95}
          disabled={!handleBodyPress}
        >
          <MentionText
            text={bodyText}
            style={[styles.bodyPreview, { color: mutedColor }]}
            numberOfLines={bodyExpanded ? undefined : BODY_LINES}
          />

          {/**
            * An invisible copy, purely to count lines.
            *
            * `onTextLayout` reports the lines it actually drew, so asking the
            * clamped copy how long the text is always answers "two" — there is
            * no way to tell a post that happens to fit from one that was cut
            * off, which is why "more" never appeared. Measuring the visible
            * copy unclamped for one frame would work but flashes the whole
            * body before collapsing it.
            *
            * So the measurement happens on a twin: same text, same style, same
            * width (absolute with both edges pinned), no line limit, zero
            * opacity, out of the layout flow so it displaces nothing. It
            * unmounts the moment it has answered, so this costs one extra text
            * layout per card and nothing after that.
            */}
          {bodyLines === null && (
            <View style={styles.bodyMeasure} pointerEvents="none" aria-hidden>
              <MentionText
                text={bodyText}
                style={[styles.bodyPreview, { color: mutedColor }]}
                onTextLayout={(e) => setBodyLines(e.nativeEvent?.lines?.length ?? 0)}
              />
            </View>
          )}
          {/* Only when the clamp is hiding something. A "more" that opens
              nothing is worse than no affordance at all. */}
          {bodyTruncated && (
            <Text
              style={[styles.moreLink, { color: mutedColor }]}
              onPress={() => setBodyExpanded(true)}
              accessibilityRole="button"
            >
              more
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {/* The poll, when the post has one — under the words and above the
          picture, because the question is what the words were leading up
          to. Renders nothing without a summary. */}
      {post.poll_summary ? <PostPoll post={post} style={styles.poll} /> : null}

      {/* The post's media — photos and videos in one strip, drawn at one
          shape so swiping doesn't resize the card. */}
      {hasMedia && (
        <GestureDetector gesture={zoomGesture}>
          <View>
            <PostMediaCarousel
              media={media}
              // Dots at the foot of the photo, back again. The count badge says
              // how many there are and opens the viewer; it can't say which one
              // you're on, and without that a swipe gave no sign it had
              // landed anywhere. The carousel's dots are the same small
              // white/translucent row this card drew before it had one.
              showPageIndicator
              visible={visible}
              // With no destination to go to, a tap on a photo opens the photo
              // — the same viewer the gallery badge opens. A video's first tap
              // is still its own: it starts playback.
              onPressItem={onPress ?? (() => setZoomIndex(0))}
              overlay={
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
                  {/* Price + media count — top right column.
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
                    {mediaCount > 1 && (
                      /* The count was a label saying there were more photos,
                         with no way to get to them but a pinch nobody guesses.
                         It opens the viewer now — a badge that states a number
                         you can act on should be the thing you act on. */
                      <TouchableOpacity
                        style={styles.multiImgBadge}
                        onPress={() => setZoomIndex(0)}
                        activeOpacity={0.85}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`View all ${mediaCount} photos`}
                      >
                        <Images size={16} color="#FFFFFF" strokeWidth={2} />
                        <Text style={styles.multiImgCount}>{mediaCount}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              }
            />
          </View>
        </GestureDetector>
      )}

      <ImageLightbox
        images={galleryUrls}
        initialIndex={zoomIndex ?? 0}
        visible={zoomIndex !== null}
        onClose={() => setZoomIndex(null)}
      />

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
      <PostContextRow post={post} />

      {/* The line opens the full list; the name inside it still goes straight
          to that person, since a nested Text's own press wins. */}
      <View style={styles.footerRow}>
        {/* The pill keeps the translucent ground and rounded shape it had over
            the photo; it just shares the line now. */}
        <View style={styles.actionsPill}>{actionsRow}</View>
        <View style={styles.footerLeft}>
          {likeCount > 0 && (
            <SummaryTouchable
              onPress={(origin) => setLikersOrigin(origin)}
              accessibilityLabel={`See everyone who liked this`}
            >
              <LikedByLine
                likers={likers}
                total={likeCount}
                myId={userInfo?.user_id}
                names={likeData ? undefined : post.liker_names}
                onPressUser={setSummaryUserId}
                color={mutedColor}
                style={styles.likedBy}
              />
            </SummaryTouchable>
          )}
        </View>
      </View>

      <UserSummaryModal
        userId={summaryUserId}
        onClose={() => setSummaryUserId(null)}
      />

      <LikersSheet
        entryId={post.internal_id}
        visible={likersOrigin !== undefined}
        origin={likersOrigin}
        onClose={() => setLikersOrigin(undefined)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // The card is full-bleed, so this rounds against the page rather than
    // inside a gutter — enough to read as a card, short of the point where a
    // tile cropped by the screen edge starts to look like a mistake.
    borderRadius: COMMON_RADIUS,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 12, paddingBottom: 10, gap: 8 },
  // Takes the row, so the timestamp and the menu stay pinned right.
  headerAuthor: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText:  { flex: 1, minWidth: 0 },
  author:      { fontSize: 14, fontWeight: '700' },
  username:    { fontSize: 12, marginTop: 1 },
  time:        { fontSize: 11, fontStyle: 'italic' },
  titleWrap:      { paddingHorizontal: 8, paddingBottom: 10 },
  title:          { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  titleAloneWrap: { paddingHorizontal: 8, paddingTop: 2, paddingBottom: 12 },
  titleAlone:     { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  bodyPreviewWrap:{ paddingHorizontal: 8, paddingBottom: 10, marginTop: -4 },
  bodyPreview:    { fontSize: 13, lineHeight: 18 },
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
  moreLink: {
    fontSize: 13, lineHeight: 18, fontWeight: '700',
    textDecorationLine: 'underline',
    alignSelf: 'flex-start', marginTop: 1,
  },

  image:       { width: '100%' },

  imageBadgesLeft: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 5, flexWrap: 'wrap',
  },
  imgBadge:   {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: PILL_RADIUS,
  },
  imgBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  imageBadgesRight: {
    position: 'absolute', top: 10, right: 10, alignItems: 'flex-end', gap: 5,
  },
  priceBadge:    {
    backgroundColor: '#3a8a3a',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: PILL_RADIUS,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4
  },
  priceBadgeText: { fontSize: 13, fontWeight: '800', color: '#000' },
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
  multiImgCount: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  messageWrap: { paddingHorizontal: 8, paddingTop: 10 },
  // Tucked up under the author row; the card's own inset on the left.
  sourceChip:  { marginLeft: 8, marginTop: -2, marginBottom: 10 },
  poll:        { paddingHorizontal: 8, paddingBottom: 10 },
  footerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, gap: 8,
  },
  // Takes the row so the menu stays pinned right on a card with no likes.
  footerLeft:  { flex: 1, minWidth: 0 },
  likedBy:     { fontSize: 12, fontWeight: '600' },
  // No rule above the actions: the card already ends here, and a line across
  // it read as a divider between two things rather than as the foot of one.
  // The row is full width so the pill can sit at its left edge; the pill keeps
  // the shape and ground it had over the photo.
  actionsPill: {
    // Never squeezed by a long list of likers — the names truncate, not this.
    flexShrink: 0,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
