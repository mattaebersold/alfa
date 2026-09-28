import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, Keyboard,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import OilSheen from '../ui/OilSheen';
import PostContextRow from '../social/PostContextRow';
import { useNavigation } from '@react-navigation/native';
import { MapPin, Truck, Sparkles, Settings, MessageCircle } from 'lucide-react-native';
import SummaryModal, { useSummaryPanel, type SummaryOrigin } from '../ui/SummaryModal';
import Spinner from '../ui/Spinner';
import Avatar from '../ui/Avatar';
import LikeButton from '../social/LikeButton';
import CommentRow from '../social/CommentRow';
import Composer from '../social/Composer';
import { useComposerPhotos } from '../../hooks/useComposerPhotos';
import { useStackedUserSummary } from '../members/useStackedUserSummary';
import { useStartListingThread } from '../../screens/marketplace/useStartListingThread';
import {
  useGetListingQuery, useGetListingMetaQuery, useCreateCommentMutation,
} from '../../api/apiService';
import { useCommentThread, type CommentRowItem } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import {
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_DANGER,
  COLOR_GRAY_22,
  COLOR_WHITE,
  COLOR_PRO,
  COLOR_GREEN,
} from '../../constants/config';
import {
  categoryLabel, conditionLabel, distanceLabel, matchLabel, categoryColor, conditionColor,
  previousPriceLabel, priceLabel, shippingLabel,
} from './listingFormat';
import { FONT_INTER } from '../../constants/fonts'

/**
 * The entry type likes and comments on a listing are filed under.
 *
 * Listings live in their own collection now, but likes and comments are still
 * the generic ones keyed by `document_entry_type` — so this string is the join,
 * and it has to match what horacio writes.
 */
const LISTING_ENTRY_TYPE = 'listing';

/**
 * A listing, answered in place.
 *
 * Everything a marketplace card raises — what is it, what condition, who's
 * selling, where is it, does it fit my car — used to cost a screen push. This
 * answers it over the list you were scrolling, the same way a group's or a
 * car's summary does.
 *
 * The one thing it doesn't answer is "can I have it": that's a conversation,
 * and it's the panel's primary button. The contact flow itself belongs to the
 * messaging work — see useStartListingThread.
 */
export default function ListingSummaryModal({ listingId, origin, onClose }: {
  /** The listing to summarise. `null` closes the panel. */
  listingId: string | null;
  /** The card that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { startThread, isStarting } = useStartListingThread();

  const { data, isLoading } = useGetListingQuery(listingId ?? '', { skip: !listingId });
  const { data: meta } = useGetListingMetaQuery();
  const listing = data?.entry;

  // A seller's summary opens over this one, so you can look at who's selling
  // and still be in the listing you were deciding about.
  const { openUser, stacked } = useStackedUserSummary(!!listingId);

  const { rows: commentRows, comments } = useCommentThread(
    LISTING_ENTRY_TYPE, listingId ?? '', { skip: !listingId },
  );
  const [createComment, { isLoading: posting }] = useCreateCommentMutation();
  const [commentText, setCommentText] = useState('');
  /** A lone photo's width over height, once it has loaded — 4:3 until then. */
  const [soloRatio, setSoloRatio] = useState(4 / 3);
  // The composer's attachments — not the listing's own `photos` below.
  const attachments = useComposerPhotos();

  const seller = data?.user ?? listing?.user ?? null;
  const isMine = !!seller && seller.user_id === myId;
  const price = listing ? priceLabel(listing) : null;
  const wasPrice = listing ? previousPriceLabel(listing) : null;
  const condition = listing ? conditionLabel(listing.condition, meta?.conditions) : null;
  const distance = listing ? distanceLabel(listing.distance_miles) : null;
  const match = listing ? matchLabel(listing) : null;
  const shipping = listing ? shippingLabel(listing.shipping) : null;
  const body = listing?.body ? stripHtml(listing.body).trim() : '';

  // Photos, in the order they were uploaded. Videos don't appear on a listing,
  // so the gallery is read straight rather than through utils/postMedia.
  const photos = (listing?.gallery ?? [])
    .map((g) => imageUrl(g.filename))
    .filter((u): u is string => !!u);

  const car = data?.car ?? null;
  const groups = data?.groups ?? [];

  /**
   * Everything the listing says about the thing itself, as a strip you skim.
   *
   * One line that scrolls rather than a block that wraps — the same treatment
   * a car's summary gives its specs, and for the same reason: eight details
   * wrapped to four rows made the panel taller than the photo in it.
   */
  const specs = listing ? ([
    { label: 'Year', value: listing.year },
    { label: 'Make', value: listing.make },
    { label: 'Model', value: listing.model },
    { label: 'Trim', value: listing.trim },
    { label: 'Color', value: listing.color },
    {
      label: 'Mileage',
      // Guarded on the parse: a mileage of "unknown" is a non-empty string that
      // formats as "NaN mi".
      value: Number.isFinite(Number(listing.mileage)) && Number(listing.mileage) > 0
        ? `${Number(listing.mileage).toLocaleString()} mi` : null,
    },
    { label: 'Part no.', value: listing.part_number },
    { label: 'VIN', value: listing.vin },
    { label: 'Brand', value: listing.diecast?.brand },
    { label: 'Rarity', value: listing.diecast?.rarity },
    { label: 'Shipping', value: shipping ?? (listing.shipping === 'pickup' ? 'Pickup only' : null) },
    { label: 'Location', value: listing.cityState },
  ].filter((s) => s.value) as { label: string; value: string }[]) : [];

  const submitComment = async () => {
    if (!listingId) return false;
    const fd = new FormData();
    fd.append('document_id', listingId);
    fd.append('document_type', LISTING_ENTRY_TYPE);
    fd.append('body', commentText.trim());
    attachments.appendTo(fd);
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      attachments.clear();
      Keyboard.dismiss();
    } catch {
      Alert.alert('Error', 'Could not post comment.');
      // Keeps the composer open with the words still in it.
      return false;
    }
  };

  /**
   * The button's words follow the listing, not the viewer: on a want ad the
   * person who posted it is the buyer, and "Message seller" there would name
   * the wrong side of the deal. Your own listing has nobody to write to.
   */
  // Who's on the other end, by name — "Message @matt about this".
  const contactLabel = seller?.username
    ? `Message @${seller.username} about this`
    : listing?.kind === 'want' ? 'Message buyer' : 'Message seller';

  return (
    <SummaryModal
      visible={!!listingId}
      onClose={onClose}
      origin={origin}
      actionLabel={isStarting ? 'Opening…' : contactLabel}
      actionIcon={MessageCircle}
      actionPill
      // Runs once the panel has finished closing, which is exactly when a
      // navigation out of it is safe — see SummaryModal.
      onAction={listingId && !isMine && !isLoading
        // The title rides along so the conversation's header has something to
        // say before its own snapshot of the listing lands.
        ? () => startThread(listingId, { listingTitle: listing?.title })
        : undefined}
      stacked={stacked}
    >
      {isLoading || !listing ? (
        // Reserved height rather than a bare spinner: the panel takes its size
        // from its content, so an unsized loading state opens as a sliver.
        <View style={styles.loading}><Spinner /></View>
      ) : (
        <View>
          <View>
          {/* Photos lead — on a listing they're most of the decision. One
              sideways strip rather than a carousel with dots: there are rarely
              more than four, and a swipe is the gesture either way. */}
          {photos.length === 1 ? (
            // One photo: the whole width, at its own shape — nothing to swipe
            // to, so no strip.
            <Image
              source={{ uri: photos[0] }}
              style={[styles.photoSingle, { aspectRatio: soloRatio }]}
              contentFit="cover"
              transition={150}
              onLoad={(e) => {
                const { width, height } = e.source;
                if (width > 0 && height > 0) setSoloRatio(Math.max(MIN_SOLO_RATIO, width / height));
              }}
            />
          ) : photos.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled={photos.length > 1}
              showsHorizontalScrollIndicator={false}
              style={styles.photoStrip}
            >
              {photos.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.photo} contentFit="cover" transition={150} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.photo, styles.noPhoto, { backgroundColor: colors.segment }]}>
              <Text style={[styles.noPhotoText, { color: colors.grey }]}>No photos</Text>
            </View>
          )}

          {/* On the photo, as on the cards: the car it fits top left, gold
              with the oil-slick film, and the price bottom left — bigger
              here than on a card. */}
          {match ? (
            <View style={[styles.matchPill, styles.onPhoto, styles.matchOnPhoto, { backgroundColor: COLOR_PRO }]}>
              <OilSheen tone="warm" radius={999} />
              <Sparkles size={11} color={COLOR_BLACK} strokeWidth={2.6} />
              <Text style={styles.matchText} numberOfLines={1}>{match}</Text>
            </View>
          ) : null}
        {/* What it is and how good, as coloured badges on the photo's
            bottom right, across from the price — the category its own
            steady colour, the condition red to green along its scale. */}
          {(listing.category || condition) ? (
            <View style={[styles.badges, styles.onPhotoRow]}>
              {listing.category ? (
                <View style={[styles.kindBadge, { backgroundColor: categoryColor(listing.category) }]}>
                  <Text style={styles.kindBadgeText}>{categoryLabel(listing.category)}</Text>
                </View>
              ) : null}
              {condition ? (
                <View style={[styles.kindBadge, { backgroundColor: conditionColor(listing.condition, meta?.conditions) ?? colors.segment }]}>
                  <Text style={styles.kindBadgeText}>{condition}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {price ? (
            <View style={[styles.priceBubble, styles.onPhoto]}>
              <Text style={styles.priceBubbleText} numberOfLines={1}>{price}</Text>
              {wasPrice ? <Text style={styles.priceBubbleWas} numberOfLines={1}>{wasPrice}</Text> : null}
            </View>
          ) : null}
          </View>

          <View style={styles.body}>

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.fg }]} numberOfLines={3}>
                {listing.title || 'Untitled listing'}
              </Text>
              {listing.sold ? (
                <View style={styles.soldPill}><Text style={styles.soldText}>SOLD</Text></View>
              ) : null}
              {/* Yours: the way to change it, beside its title. */}
              {isMine ? <EditListingCog listingId={listing.internal_id} /> : null}
            </View>



            {/* Who's selling. The whole row opens their summary over this one
                rather than leaving the listing behind. */}
            {seller ? (
              <TouchableOpacity
                style={styles.sellerRow}
                onPress={() => openUser(seller.user_id, null)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`View @${seller.username}`}
              >
                <Avatar user={seller} size={30} />
                <Text style={[styles.sellerName, { color: colors.fg }]} numberOfLines={1}>
                  @{seller.username}
                </Text>
                {distance ? (
                  <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                    <MapPin size={10} color={colors.grey} />
                    <Text style={[styles.badgeText, { color: colors.grey }]}>{distance}</Text>
                  </View>
                ) : null}
                {shipping ? (
                  <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                    <Truck size={10} color={colors.grey} />
                    <Text style={[styles.badgeText, { color: colors.grey }]}>{shipping}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}

            {body ? (
              <Text style={[styles.about, { color: colors.muted }]}>{body}</Text>
            ) : null}

            {specs.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.specsScroll}
                contentContainerStyle={styles.specs}
              >
                {specs.map((spec) => (
                  <View key={spec.label} style={[styles.spec, { backgroundColor: colors.segment }]}>
                    <Text style={styles.specLabel}>{spec.label}</Text>
                    <Text style={[styles.specValue, { color: colors.fg }]} numberOfLines={1}>{spec.value}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* The car it's listed off and the groups it's posted in, as the
                same tiles a post in the home feed carries (PostContextRow):
                one at half width, two sharing the row, three or more a
                carousel. Each opens its own summary over this one. */}
            {(car || groups.length > 0) ? (
              <View style={styles.context}>
                <PostContextRow
                  post={{
                    internal_id: listing.internal_id,
                    group_ids: groups.map((g) => g.internal_id),
                    tags: car ? [{ tag_entry_type: 'garagecar', tag_internal_id: car.internal_id }] as any : [],
                  }}
                />
              </View>
            ) : null}

            {/* Likes and comments, on the listing's own record — the generic
                collections keyed by entry type 'listing'. */}
            <View style={[styles.social, { borderTopColor: colors.borderDark }]}>
              <LikeButton
                documentId={listing.internal_id}
                entryType={LISTING_ENTRY_TYPE}
                ownerId={listing.user_id}
                initialCount={data?.like_count ?? listing.like_count ?? 0}
                initialLiked={data?.has_liked ?? listing.has_liked ?? false}
              />
              <Text style={[styles.commentCount, { color: colors.grey }]}>
                {comments.length} comment{comments.length === 1 ? '' : 's'}
              </Text>
            </View>

            {/* A bounded scroller inside the panel's own: unbounded, a busy
                listing's thread pushed everything else out of a panel that
                tops out at 90% of the screen. `nestedScrollEnabled` is what
                lets it scroll at all inside another scroller on Android. */}
            {commentRows.length > 0 && (
              <ScrollView
                style={styles.commentList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {(commentRows as CommentRowItem[]).map((item) => (
                  <CommentRow
                    key={item.comment.internal_id ?? item.comment._id}
                    comment={item.comment}
                    currentUserId={myId}
                    isReply={item.isReply}
                    isThreadStart={item.isThreadStart}
                    isThreadEnd={item.isThreadEnd}
                    threadId={item.threadId}
                  />
                ))}
              </ScrollView>
            )}

            {/* The panel lifts itself clear of the keyboard, so the bar rides
                up with it. Pulled out to the panel's own gutter, since the bar
                carries a gutter of its own. */}
            <Composer
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Ask a question…"
              photos={attachments}
              onSend={submitComment}
              sending={posting}
              sendLabel="Post"
              tone={{ surface: COLOR_BLACK, field: COLOR_BLACK, border: colors.border, text: colors.fg, accent: brand, onAccent: COLOR_BLACK }}
              barStyle={styles.composer}
            />
          </View>
        </View>
      )}
    </SummaryModal>
  );
}

/**
 * Edit, on your own listing — a cog over the photo. Inside the panel so it can
 * close the panel first (useSummaryPanel), then open the form on this listing.
 */
function EditListingCog({ listingId }: { listingId: string }) {
  const nav = useNavigation<any>();
  const panel = useSummaryPanel();
  const go = () => nav.navigate('ListingCreate', { listingId });
  return (
    <TouchableOpacity
      style={styles.editCog}
      onPress={() => (panel ? panel.closeThen(go) : go())}
      hitSlop={8}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Edit listing"
    >
      <Settings size={16} color={COLOR_WHITE} strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

/**
 * The tallest a lone photo is drawn — 3:4 portrait. Past that, a phone shot
 * of a part held upright filled the panel before any of the listing showed.
 */
const MIN_SOLO_RATIO = 3 / 4;

const styles = StyleSheet.create({
  loading: { height: 260, alignItems: 'center', justifyContent: 'center' },

  photoStrip: { flexGrow: 0 },
  // Square-ish: a listing photo is as likely to be a portrait shot of a part
  // as a landscape one of a car, and a letterbox crops the part out of it.
  photo:      { width: 320, height: 240, backgroundColor: COLOR_GRAY_22 },
  photoSingle:{ width: '100%', backgroundColor: COLOR_GRAY_22 },
  // The tile row brings its own 8 of inset and 12 above and below; pulled out
  // by that much so the tiles line up with the words and sit in the body's gap.
  context: { marginHorizontal: -8, marginVertical: -8 },
  // Beside the title, at its end — the height of the title's first line, so
  // the two sit on one centre.
  editCog: {
    width: 26, height: 26, borderRadius: 13, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // Badges laid over the photo, lifted off it by a soft shadow.
  onPhoto: {
    position: 'absolute', maxWidth: '70%',
    boxShadow: '0px 4px 18px 2px rgba(0, 0, 0, 0.35)',
  },
  matchOnPhoto: { top: 10, left: 10, overflow: 'hidden' },
  // As on the cards, a size up.
  priceBubble: {
    left: 10, bottom: 10,
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: COLOR_GREEN,
  },
  priceBubbleText: { color: COLOR_BLACK, fontSize: 18, fontFamily: FONT_INTER.bold, letterSpacing: 0.3 },
  priceBubbleWas: {
    color: 'rgba(0,0,0,0.6)', fontSize: 12.5, fontFamily: FONT_INTER.semibold,
    textDecorationLine: 'line-through',
  },
  noPhoto:    { width: '100%', alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { fontSize: 12, fontFamily: FONT_INTER.semibold },

  body: { padding: 18, paddingBottom: 20, gap: 8 },

  matchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: PILL_RADIUS,
  },
  matchText: { fontSize: 11, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:    { flex: 1, fontSize: 20, fontFamily: FONT_INTER.bold, letterSpacing: -0.3 },
  soldPill: { backgroundColor: COLOR_DANGER, paddingHorizontal: 10, paddingVertical: 4, borderRadius: PILL_RADIUS, marginTop: 2 },
  soldText: { color: COLOR_WHITE, fontSize: 11, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6 },

  badges:    { flexDirection: 'row', gap: 6 },
  // On the photo's bottom right, lifted off it like the price.
  onPhotoRow: { position: 'absolute', right: 10, bottom: 10, maxWidth: '55%', justifyContent: 'flex-end' },
  kindBadge: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, flexShrink: 1,
    boxShadow: '0px 4px 18px 2px rgba(0, 0, 0, 0.35)',
  },
  // Black on every fill — the palette is all mid-bright.
  kindBadgeText: { color: '#000000', fontSize: 13, fontFamily: FONT_INTER.bold },

  sellerRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  sellerName: { fontSize: 14, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
  },
  badgeText: { fontSize: 11, fontFamily: FONT_INTER.bold },

  about: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },

  specsScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -18 },
  specs: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 6 },
  spec:  { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, minWidth: 84 },
  // Quiet, sentence case — the value is what you're reading for.
  specLabel: { fontSize: 11.5, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.4)' },
  specValue: { fontSize: 14, fontFamily: FONT_INTER.semibold, marginTop: 2 },

  social: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginTop: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentCount: { fontSize: 12, fontFamily: FONT_INTER.semibold },

  // A ceiling, like the panel's: a short thread gets a short list.
  commentList: { maxHeight: 260, marginTop: 4 },

  composer:   { marginHorizontal: -12, marginTop: 4 },
});
