import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, Alert, Dimensions, Linking, Pressable, BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { X, MessageCircle, Link as LinkIcon, ExternalLink, Heart, ChevronRight } from 'lucide-react-native';
import ReportButton from '../../components/ui/ReportButton';
import PostOwnerMenu from '../../components/social/PostOwnerMenu';
import { useNavigation } from '@react-navigation/native';
import { useGetPostQuery, useCreateCommentMutation, useGetPostCountsQuery, useGetLikeInfoQuery } from '../../api/apiService';
import { useCommentThread, type CommentRowItem } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import { TYPE_LABELS, CATEGORY_LABELS } from '../../components/ui/Badge';
import LikeButton from '../../components/social/LikeButton';
import CommentRow, { COMMENT_SURFACE } from '../../components/social/CommentRow';
import LikersSheet from '../../components/social/LikersSheet';
import PostEditSheet from '../../components/social/PostEditSheet';
import Spinner from '../../components/ui/Spinner';
import { imageUrl } from '../../utils/image';
import { colors, BADGE_COLORS, CATEGORY_BADGE_COLORS } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useKeyboardInset } from '../../hooks/useKeyboardHeight';
import type { FeedScreenProps, AppStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GalleryItem } from '../../types/api';
import { stripHtml, extractLinks, linkLabel } from '../../utils/text';
import MentionText from '../../components/ui/MentionText';
import PostTagBadges from '../../components/social/PostTagBadges';
import { tabNavProxy } from '../../navigation/navigateInTabs';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import GroupAttribution from '../../components/groups/GroupAttribution';
import UserSummaryModal from '../../components/members/UserSummaryModal';
import { SummaryTouchable, type SummaryOrigin } from '../../components/ui/SummaryModal';
import Odometer from '../../components/ui/Odometer';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// ── Story video ───────────────────────────────────────────────────────────────

function StoryVideoPlayer({ videoId }: { videoId: string }) {
  const player = useVideoPlayer(`https://stream.mux.com/${videoId}.m3u8`, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.videoPlayer}
      contentFit="contain"
      nativeControls
    />
  );
}

// ── Gallery swiper ────────────────────────────────────────────────────────────

function GallerySwiper({ gallery }: { gallery: GalleryItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [ratios, setRatios] = useState<Record<number, number>>({});

  if (gallery.length === 1) {
    const ratio = ratios[0] ?? 16 / 9;
    return (
      <Image
        source={{ uri: imageUrl(gallery[0].filename)! }}
        style={{ width: '100%', aspectRatio: ratio }}
        contentFit="cover"
        onLoad={(e) => setRatios({ 0: e.source.width / e.source.height })}
      />
    );
  }

  const currentRatio = ratios[activeIndex] ?? 16 / 9;
  const containerHeight = SCREEN_WIDTH / currentRatio;

  return (
    <View>
      <View style={{ height: containerHeight, overflow: 'hidden' }}>
        <FlatList
          data={gallery}
          keyExtractor={(item, i) => item.filename ?? String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setActiveIndex(idx);
          }}
          renderItem={({ item, index }) => {
            const ratio = ratios[index] ?? currentRatio;
            return (
              <View style={{ width: SCREEN_WIDTH, height: containerHeight, justifyContent: 'center' }}>
                <Image
                  source={{ uri: imageUrl(item.filename)! }}
                  style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH / ratio }}
                  contentFit="cover"
                  onLoad={(e) => {
                    const r = e.source.width / e.source.height;
                    setRatios((prev) => ({ ...prev, [index]: r }));
                  }}
                />
              </View>
            );
          }}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />
        {/* Dot indicators — float over the bottom of the image */}
        {gallery.length > 1 && (
          <View style={styles.dots} pointerEvents="none">
            {gallery.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PostDetailScreen({ route }: FeedScreenProps<'PostDetail'>) {
  const { postId } = route.params;
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  // Lifts the comment composer onto the keyboard — see the note below.
  const { animated: keyboardPad } = useKeyboardInset();
  const insets = useSafeAreaInsets();


  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  /**
   * The screen's own transition.
   *
   * Two values, because the two layers move differently: the sheet rises from
   * the bottom, and the backdrop only fades. Sliding the blur up with the sheet
   * made it read as part of the panel — a grey rectangle arriving from
   * off-screen — rather than as the page behind going out of focus, which is
   * the whole point of it.
   *
   * The route is presented with `animation: 'none'` so these are the only
   * motion, and closing has to run them in reverse before popping — otherwise
   * the screen would vanish on the frame the button was pressed.
   */
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const closing = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1, duration: 220, useNativeDriver: true,
      }),
      Animated.spring(sheetY, {
        toValue: 0, tension: 65, friction: 12, useNativeDriver: true,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Play the exit, then leave — and optionally do something once we're gone. */
  const close = useCallback((after?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: SCREEN_HEIGHT, duration: 240, useNativeDriver: true }),
    ]).start(() => {
      navigation.goBack();
      if (after) requestAnimationFrame(after);
    });
  }, [backdrop, sheetY, navigation]);

  // Android's back gesture would otherwise pop the route instantly, skipping
  // the exit entirely.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  /**
   * Dismiss this modal, then open the target. Deferred a frame so the pop has
   * been committed before the push — otherwise the new screen can end up
   * beneath the modal that's still animating out.
   */
  const dismissThenNavigate = (go: (nav: any) => void) => {
    // Route into the tab stacks so the target keeps the header and bottom nav.
    close(() => go(tabNavProxy(navigation)));
  };

  /**
   * One surface for the whole modal.
   *
   * This was five near-identical greys — #181818 bands for the post, #0B0B0B
   * for the comments, plus the card and page colours — stacked edge to edge, so
   * the screen read as an undifferentiated dark wall whose sections you
   * couldn't tell apart. Rather than pick better greys, there is now only one:
   * the comments' own, top to bottom.
   *
   * What separates a section from the next one is space, and what marks
   * something as pressable is a border (see `actionRow` / `outlineBtn`) — both
   * of which work on a flat ground, which is why the colours weren't needed.
   */
  const surfaceBg = COMMENT_SURFACE;
  const cardBg = surfaceBg;
  const groundBg = surfaceBg;
  const commentsBg = surfaceBg;

  const { data: postData, isLoading, refetch } = useGetPostQuery(postId);
  const refreshControl = useRefreshControl(refetch);
  const post = postData ? { ...postData.entry, user: postData.entry.user ?? postData.user } : undefined;
  const { rows: commentRows, comments } = useCommentThread(post?.entry_type ?? 'post', postId, { skip: !post });
  const { data: counts } = useGetPostCountsQuery(postId, { skip: !post });
  const { data: likeInfo } = useGetLikeInfoQuery(postId, { skip: !post });

  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  // Whose summary is open, and the row it grew out of.
  const [userSummary, setUserSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);
  // The row the likers panel grew out of — null until one is tapped.
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);
  const [editOpen, setEditOpen] = useState(false);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);

  // Auto-open the editor when deep-linked with edit=true (from the "..." menu).
  useEffect(() => {
    if ((route.params as any)?.edit) setEditOpen(true);
  }, [route.params]);

  // Navigate back if this post gets reported/hidden
  useEffect(() => {
    if (hiddenIds.includes(postId)) navigation.goBack();
  }, [hiddenIds, postId, navigation]);

  if (isLoading || !post) return <Spinner fullScreen />;

  const isOwner = userInfo?.user_id === post.user_id;
  const gallery = post.gallery ?? [];
  const displayName = post.user?.username || 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'post';
  const badgeType = post.type ?? post.entry_type ?? 'post';
  const typeBadge = BADGE_COLORS[badgeType] ?? BADGE_COLORS.default;
  const categoryBadge = post.category
    ? (CATEGORY_BADGE_COLORS[post.category] ?? CATEGORY_BADGE_COLORS.default)
    : null;

  const hasMedia = !!post.video_id || gallery.length > 0;

  // Rendered over the media when there is any, otherwise in the author row.
  const badges = (
    <View style={styles.badgeRow}>
      <View style={[styles.badge, { backgroundColor: typeBadge.bg }]}>
        <Text style={[styles.badgeText, { color: typeBadge.fg }]}>
          {TYPE_LABELS[badgeType] ?? badgeType}
        </Text>
      </View>
      {categoryBadge && (
        <View style={[styles.badge, { backgroundColor: categoryBadge.bg }]}>
          <Text style={[styles.badgeText, { color: categoryBadge.fg }]}>
            {CATEGORY_LABELS[post.category!] ?? post.category}
          </Text>
        </View>
      )}
    </View>
  );

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    const fd = new FormData();
    fd.append('document_id', post.internal_id);
    fd.append('document_type', entryType);
    fd.append('body', commentText.trim());
    if (replyingTo) fd.append('reply_to', replyingTo.commentId);
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      setReplyingTo(null);
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
  };

  return (
    /**
     * A sheet over a blurred feed, not an opaque screen.
     *
     * The route presents transparently (see AppNavigator) so the post can sit
     * *on* what you were reading rather than replacing it — the strip of
     * blurred, dimmed content left visible at the top is what says this is a
     * layer you can dismiss rather than somewhere you navigated to.
     */
    <View style={ss.fill}>
      {/* Fades in place — no Y movement. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdrop }]} pointerEvents="none">
        <BlurView tint="dark" intensity={30} style={StyleSheet.absoluteFill} />
        {/* The blur alone doesn't separate the sheet from a light photo behind
            it; the grey is what guarantees the contrast. */}
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      </Animated.View>
      {/* Tapping the exposed strip closes, like every other sheet in the app. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />

      <Animated.View style={[
        styles.sheet,
        {
          backgroundColor: surfaceBg,
          marginTop: insets.top + SHEET_PEEK,
          transform: [{ translateY: sheetY }],
        },
      ]}>
      {/* Title left, actions right.
          It reads at the post's own size rather than the 16pt centred label it
          was before — a title is the first thing you want to read, not a
          caption for the bar it sits in. Two lines before it truncates, so the
          header grows to fit a long one instead of cutting it off. No bottom
          rule: the bar and the post below share one surface, so there was
          nothing for it to divide. */}
      <View style={[styles.modalHeader, { backgroundColor: surfaceBg }]}>
        <Text style={[styles.modalHeaderTitle, { color: colors.fg }]} numberOfLines={2}>
          {post.title || 'Post'}
        </Text>
        {isOwner ? (
          <PostOwnerMenu
            postId={postId}
            size={22}
            color={colors.fg}
            onEdit={() => setEditOpen(true)}
            onDeleted={() => close()}
          />
        ) : (
          <ReportButton contentType="post" contentId={postId} size={22} />
        )}
        <TouchableOpacity onPress={() => close()} hitSlop={8} style={styles.modalHeaderBtn}>
          <X size={24} color={colors.fg} />
        </TouchableOpacity>
      </View>

      {/* Padded by the keyboard's measured height rather than a
          KeyboardAvoidingView. That needed a `keyboardVerticalOffset` guessed
          at 90 on iOS, and gave Android `behavior="height"`, which has no
          window resize to act on in an edge-to-edge app — so the composer sat
          under the keyboard exactly when you were typing in it. */}
      {/* The ground the cards sit on. Without this the gaps between them would
          show whatever is behind the modal rather than a deliberate colour. */}
      <Animated.View style={[styles.flex, { backgroundColor: groundBg, paddingBottom: keyboardPad }]}>
        <FlatList
          refreshControl={refreshControl}
          data={commentRows}
          keyExtractor={(item: any) => item.comment.internal_id ?? item.comment._id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Title lives in the header — see the note there. */}

              {/* Full width: prose reads better with the screen's own margins
                  than inset inside a card that has no background to show for
                  itself now that everything shares one surface. */}
              {post.body && (
                // Without a picture the words are the whole post, so they get
                // the size to match — the same step the feed card takes.
                <MentionText
                  text={stripHtml(post.body)}
                  style={[
                    hasMedia ? styles.postBody : styles.postBodyAlone,
                    { color: colors.fg },
                  ]}
                />
              )}

              {hasMedia && (
                <View>
                  {post.video_id ? (
                    <StoryVideoPlayer videoId={post.video_id} />
                  ) : (
                    <GallerySwiper gallery={gallery} />
                  )}
                  {/* Type/category badges float over the media, top right. */}
                  <View style={styles.badgeOverlay} pointerEvents="none">
                    {badges}
                  </View>
                </View>
              )}

              <View style={[styles.card, styles.postHeader, { backgroundColor: cardBg }]}>
                <TouchableOpacity
                  style={styles.postHeaderUser}
                  onPress={() => post.user?.user_id && dismissThenNavigate((n) =>
                    n.navigate('UserDetail', { userId: post.user!.user_id, username: post.user!.username })
                  )}
                  activeOpacity={0.7}
                >
                  <Avatar
                    user={post.user}
                    size={40}
                  />
                  <View style={styles.postHeaderText}>
                    {/* It opens their profile, so it takes the link blue the
                        mentions in the body use. */}
                    <Text style={[styles.author, { color: colors.blueLight }]}>@{displayName}</Text>
                  </View>
                </TouchableOpacity>
                {/* With media present the badges sit over it instead. */}
                {!hasMedia && badges}
                <LikeButton
                  documentId={post.internal_id}
                  entryType={entryType}
                  initialCount={counts?.likes ?? post.like_count ?? 0}
                  initialLiked={likeInfo?.hasLiked ?? post.isLiked ?? false}
                />
              </View>

              {/* Links found in the post body → open in the external browser */}
              {extractLinks(post.body).length > 0 && (
                <View style={[styles.card, styles.linkWrap, { backgroundColor: cardBg }]}>
                  {extractLinks(post.body).map((url) => (
                    <TouchableOpacity
                      key={url}
                      style={[styles.linkBtn, { borderColor: colors.border }]}
                      onPress={() => Linking.openURL(url).catch(() => Alert.alert('Could not open link', url))}
                      activeOpacity={0.8}
                    >
                      <LinkIcon size={16} color={colors.primaryAlt} />
                      <Text style={[styles.linkBtnText, { color: colors.primaryAlt }]} numberOfLines={1}>
                        {linkLabel(url)}
                      </Text>
                      <ExternalLink size={15} color={colors.primaryAlt} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Where this came from, when it came from somewhere. Closes the
                  modal on the way out, so the group replaces it rather than
                  opening behind it. */}
              <GroupAttribution
                groupId={post.group_ids?.[0] ?? post.group_id}
                onNavigate={dismissThenNavigate}
              />

              {/* Tagged people, cars & events. Opening one closes this modal
                  first so the target replaces it instead of stacking on top. */}
              <PostTagBadges postId={post.internal_id} onNavigate={dismissThenNavigate} />

              {post.price && (
                <View style={[styles.card, styles.priceWrap, { backgroundColor: cardBg }]}>
                  <Text style={styles.priceLabel}>Asking</Text>
                  <Text style={styles.price}>${Number(post.price).toLocaleString()}</Text>
                </View>
              )}

              {/* The number on the clock, drawn as the clock. Detail only — on
                  a feed card it would be a second thing competing with the
                  photo. */}
              {post.mileage ? (
                <View style={[styles.card, styles.mileageRow, { backgroundColor: cardBg }]}>
                  <Odometer value={post.mileage} />
                </View>
              ) : null}

              {(post.type === 'listing' || post.type === 'want') && post.user && !isOwner && (
                <TouchableOpacity
                  style={[styles.card, styles.actionRow, { backgroundColor: cardBg, borderColor: colors.primaryAlt }]}
                  onPress={() => navigation.navigate('ComposeMessage', {
                    userId: post.user!.user_id,
                    username: post.user!.username,
                    subject: `Re: ${post.title || 'your listing'}`,
                    initialBody: `Hi${post.user!.username ? ` @${post.user!.username}` : ''}, I'm interested in your listing "${post.title || 'your listing'}".`,
                  })}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={18} color={colors.primaryAlt} />
                  <Text style={[styles.actionRowText, { color: colors.primaryAlt }]}>
                    Message @{post.user.username} about this
                  </Text>
                  <ChevronRight size={16} color={colors.primaryAlt} />
                </TouchableOpacity>
              )}

              {/* SummaryTouchable, so the panel grows out of this row rather
                  than arriving from nowhere — which is what it did while this
                  was a plain TouchableOpacity passing no origin. */}
              {(counts?.likes ?? 0) > 0 && (
                <SummaryTouchable
                  style={[styles.card, styles.outlineBtn, { borderColor: colors.border }]}
                  onPress={(origin) => setLikersOrigin(origin)}
                  accessibilityLabel="See everyone who liked this"
                >
                  <Heart size={16} color={colors.fg} />
                  <Text style={[styles.outlineBtnText, { color: colors.fg }]}>
                    Liked by {counts!.likes} {counts!.likes === 1 ? 'person' : 'people'}
                  </Text>
                </SummaryTouchable>
              )}

              {/* No label — the darker background is enough to mark the section. */}
              <View style={[
                styles.commentsDivider,
                { backgroundColor: commentsBg, borderTopColor: colors.border },
              ]} />
            </View>
          }
          renderItem={({ item }: { item: CommentRowItem }) => (
            <CommentRow
              comment={item.comment}
              currentUserId={userInfo?.user_id}
              isReply={item.isReply}
              isThreadStart={item.isThreadStart}
              isThreadEnd={item.isThreadEnd}
              threadId={item.threadId}
              onOpenUser={(userId, origin) => setUserSummary({ userId, origin })}
              backgroundColor={commentsBg}
              onReply={(commentId, username) => {
                setReplyingTo({ commentId, username });
                setCommentText(`@${username} `);
              }}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.noComments, { color: colors.greyDark, backgroundColor: commentsBg }]}>
              No comments yet. Be first!
            </Text>
          }
          style={{ backgroundColor: commentsBg }}
          contentContainerStyle={styles.list}
        />

        {/* No fill and no rule of its own: it's the same surface as the
            comments it sits under, and the field's own border is what marks
            where you type. */}
        <View style={{
          backgroundColor: surfaceBg,
          // Clear the home indicator / nav bar without double-counting the
          // safe area, which the SafeAreaView no longer applies.
          paddingBottom: Platform.OS === 'android' ? 48 : Math.max(insets.bottom, 12),
        }}>
          {replyingTo && (
            <View style={[styles.replyBanner, { backgroundColor: surfaceBg, borderBottomColor: colors.border }]}>
              <Text style={[styles.replyBannerText, { color: colors.grey }]}>
                Replying to <Text style={{ fontWeight: '700', color: colors.fg }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }} hitSlop={8}>
                <X size={16} color={colors.grey} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <Avatar user={userInfo} size={32} />
            <TextInput
              style={[ss.chatInput, { borderColor: colors.border, color: colors.fg }]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
              placeholderTextColor={colors.grey}
              multiline
              autoFocus={!!replyingTo}
            />
            <TouchableOpacity
              onPress={handleSubmitComment}
              disabled={submitting || !commentText.trim()}
              style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
            >
              <Text style={styles.sendText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <LikersSheet
        entryId={postId}
        visible={likersOrigin !== undefined}
        origin={likersOrigin}
        onClose={() => setLikersOrigin(undefined)}
      />
      <PostEditSheet
        post={post}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
      />

      <UserSummaryModal
        userId={userSummary?.userId ?? null}
        origin={userSummary?.origin}
        onClose={() => setUserSummary(null)}
      />
      </Animated.View>
    </View>
  );
}

/** How much of the blurred feed stays visible above the sheet. */
const SHEET_PEEK = 14;

const styles = StyleSheet.create({
  flex:             { flex: 1 },
  scrim: { backgroundColor: 'rgba(40,40,40,0.55)' },
  // Fills what's left below the exposed strip, with the corners rounded
  // against it so the edge reads as the top of a sheet.
  sheet: {
    flex: 1,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  // Title left, actions right. `alignItems: flex-start` so the icons stay on
  // the first line when the title wraps to two, rather than drifting to the
  // vertical middle of a taller bar.
  modalHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, paddingLeft: 16, paddingRight: 12,
    // Roomier at the top: the sheet's rounded edge is right above this, and a
    // title butted against it reads as clipped.
    paddingTop: 22, paddingBottom: 14,
  },
  // `minWidth: 0` lets a long word shrink the title rather than pushing the
  // actions off the edge.
  modalHeaderTitle: {
    flex: 1, minWidth: 0,
    fontSize: 22, fontWeight: '800', letterSpacing: -0.3, lineHeight: 27,
  },
  modalHeaderBtn:   { alignItems: 'flex-end' },
  list: { paddingBottom: 100 },
  /**
   * The one card treatment every section wears.
   *
   * Inset from the screen with a gap above, so sections are separated by the
   * ground showing through rather than by another shade of grey.
   */
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  /**
   * Anything you can press. A bordered row with an icon in front and a chevron
   * behind, so it can't be mistaken for the static cards above it — which is
   * exactly what happened when every row shared one flat background.
   */
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1,
  },
  actionRowText:   { flex: 1, fontSize: 15, fontWeight: '700' },
  /**
   * An outline button: the full width of a card, no fill, label centred.
   * Reads as something to press rather than as another row of information —
   * which is what it looked like sharing the cards' background.
   */
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  outlineBtnText:  { fontSize: 15, fontWeight: '700' },

  linkWrap:        { padding: 12, gap: 8 },
  linkBtn:         {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderRadius: 10,
  },
  linkBtnText:     { flex: 1, fontSize: 14, fontWeight: '700' },
  postHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  postHeaderUser:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  postHeaderText:  { flex: 1 },
  badgeOverlay: {
    position: 'absolute', top: 10, right: 10,
    alignItems: 'flex-end',
  },
  badgeRow:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  badge:           { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5 },
  badgeText:       { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  author:          { fontSize: 15, fontWeight: '700' },
  username:        { fontSize: 12 },
  // Full-bleed to the screen's own gutters, not inset in a card.
  postBody:        { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingVertical: 10 },
  mileageRow:      { padding: 14 },
  postBodyAlone:   { fontSize: 19, lineHeight: 27, paddingHorizontal: 16, paddingVertical: 12 },
  singleImage:     { width: '100%', height: 300 },
  videoPlayer:     { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#000' },
  dots: {
    position: 'absolute', left: 0, right: 0, bottom: 12,
    flexDirection: 'row', justifyContent: 'center', gap: 7,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: {
    backgroundColor: '#FFFFFF',
    // Keeps the dots legible over a light photo.
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4, shadowRadius: 2,
  },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4, shadowRadius: 2,
  },
  priceWrap:       { padding: 14, gap: 2 },
  priceLabel:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.grey },
  price:           { fontSize: 26, fontWeight: '800', color: colors.primaryAlt },
  // Empty spacer that starts the comments section — its background and top
  // border are what set it apart now that the label is gone.
  commentsDivider: {
    height: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  noComments:      { textAlign: 'center', padding: 24, fontSize: 14, fontStyle: 'italic' },
  replyBanner:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1,
  },
  replyBannerText: { fontSize: 13 },
  inputRow:        {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 10,
  },
  sendBtn:         { backgroundColor: colors.primaryAlt, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtnDisabled: { opacity: 0.4 },
  sendText:        { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
