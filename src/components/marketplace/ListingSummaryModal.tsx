import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Car, MapPin, Truck, Users, Sparkles } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Spinner from '../ui/Spinner';
import Avatar from '../ui/Avatar';
import LikeButton from '../social/LikeButton';
import CommentRow from '../social/CommentRow';
import { useStackedUserSummary } from '../members/useStackedUserSummary';
import { useGroupSummary } from '../../providers/GroupSummaryProvider';
import { useStartListingThread } from '../../screens/marketplace/useStartListingThread';
import {
  useGetListingQuery, useGetListingMetaQuery, useCreateCommentMutation,
} from '../../api/apiService';
import { useCommentThread, type CommentRowItem } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';
import { ss } from '../../styles/shared';
import {
  categoryLabel, conditionLabel, distanceLabel, matchLabel,
  previousPriceLabel, priceLabel, shippingLabel,
} from './listingFormat';

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
  const nav = useNavigation<any>();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { openGroup } = useGroupSummary();
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
    { label: 'Category', value: categoryLabel(listing.category) },
    { label: 'Condition', value: condition },
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
    if (!listingId || !commentText.trim()) return;
    const fd = new FormData();
    fd.append('document_id', listingId);
    fd.append('document_type', LISTING_ENTRY_TYPE);
    fd.append('body', commentText.trim());
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      Keyboard.dismiss();
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
  };

  /**
   * The button's words follow the listing, not the viewer: on a want ad the
   * person who posted it is the buyer, and "Message seller" there would name
   * the wrong side of the deal. Your own listing has nobody to write to.
   */
  const contactLabel = listing?.kind === 'want' ? 'Message buyer' : 'Message seller';

  return (
    <SummaryModal
      visible={!!listingId}
      onClose={onClose}
      origin={origin}
      actionLabel={isStarting ? 'Opening…' : contactLabel}
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
          {/* Photos lead — on a listing they're most of the decision. One
              sideways strip rather than a carousel with dots: there are rarely
              more than four, and a swipe is the gesture either way. */}
          {photos.length > 0 ? (
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

          <View style={styles.body}>
            {match ? (
              <View style={[styles.matchPill, { backgroundColor: brand }]}>
                <Sparkles size={11} color="#000000" strokeWidth={2.6} />
                <Text style={styles.matchText}>{match}</Text>
              </View>
            ) : null}

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.fg }]} numberOfLines={3}>
                {listing.title || 'Untitled listing'}
              </Text>
              {listing.sold ? (
                <View style={styles.soldPill}><Text style={styles.soldText}>SOLD</Text></View>
              ) : null}
            </View>

            {price ? (
              <View style={styles.priceRow}>
                <Text style={[styles.price, { color: colors.fg }]}>{price}</Text>
                {wasPrice ? (
                  <Text style={[styles.wasPrice, { color: colors.grey }]}>{wasPrice}</Text>
                ) : null}
              </View>
            ) : null}

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
                    <Text style={[styles.specLabel, { color: colors.grey }]}>{spec.label}</Text>
                    <Text style={[styles.specValue, { color: colors.fg }]} numberOfLines={1}>{spec.value}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* The car it's for. A part listed off a garage car can be checked
                against the real thing, which is the fit question answered. */}
            {car ? (
              <TouchableOpacity
                style={[styles.carRow, { backgroundColor: colors.segment }]}
                onPress={() => nav.navigate('CarDetail', { carId: car.internal_id })}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="View the tagged car"
              >
                {firstGalleryUrl(car.gallery) ? (
                  <Image source={{ uri: firstGalleryUrl(car.gallery)! }} style={styles.carThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.carThumb, styles.carThumbBlank]}>
                    <Car size={16} color={colors.grey} />
                  </View>
                )}
                <View style={styles.carText}>
                  <Text style={[styles.carLabel, { color: colors.grey }]}>Listed off</Text>
                  <Text style={[styles.carTitle, { color: colors.fg }]} numberOfLines={1}>
                    {car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Where it was posted. Through the group summary provider, so a
                member lands on the group and everyone else gets its summary
                with Join in it. */}
            {groups.length > 0 && (
              <View style={styles.groups}>
                {groups.map((g) => (
                  <TouchableOpacity
                    key={g.internal_id}
                    style={[styles.groupChip, { backgroundColor: colors.segment }]}
                    onPress={() => openGroup(g.internal_id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${g.title ?? 'group'}`}
                  >
                    <Users size={11} color={colors.grey} />
                    <Text style={[styles.groupText, { color: colors.fg }]} numberOfLines={1}>
                      {g.title ?? 'Group'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

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

            <View style={styles.composer}>
              <TextInput
                style={[ss.chatInput, { borderColor: colors.border, color: colors.fg }]}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Ask a question…"
                placeholderTextColor={colors.grey}
                multiline
              />
              <TouchableOpacity
                style={[styles.postBtn, { backgroundColor: brand }, (!commentText.trim() || posting) && styles.postBtnOff]}
                onPress={submitComment}
                disabled={!commentText.trim() || posting}
                accessibilityRole="button"
                accessibilityLabel="Post comment"
              >
                <Text style={styles.postText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  loading: { height: 260, alignItems: 'center', justifyContent: 'center' },

  photoStrip: { flexGrow: 0 },
  // Square-ish: a listing photo is as likely to be a portrait shot of a part
  // as a landscape one of a car, and a letterbox crops the part out of it.
  photo:      { width: 320, height: 240, backgroundColor: '#161616' },
  noPhoto:    { width: '100%', alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { fontSize: 12, fontWeight: '600' },

  body: { padding: 18, paddingBottom: 20, gap: 8 },

  matchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: PILL_RADIUS,
  },
  matchText: { fontSize: 11, fontWeight: '800', color: '#000000' },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:    { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  soldPill: { backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: PILL_RADIUS, marginTop: 2 },
  soldText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price:    { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  wasPrice: { fontSize: 14, fontWeight: '600', textDecorationLine: 'line-through' },

  sellerRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  sellerName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },

  about: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },

  specsScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -18 },
  specs: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 6 },
  spec:  { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, minWidth: 84 },
  specLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  specValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },

  carRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 8, borderRadius: COMMON_RADIUS, marginTop: 6,
  },
  carThumb:      { width: 44, height: 34, borderRadius: 6, backgroundColor: '#161616' },
  carThumbBlank: { alignItems: 'center', justifyContent: 'center' },
  carText:  { flex: 1, minWidth: 0 },
  carLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  carTitle: { fontSize: 14, fontWeight: '700', marginTop: 1 },

  groups:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  groupChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: PILL_RADIUS,
  },
  groupText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },

  social: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginTop: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentCount: { fontSize: 12, fontWeight: '600' },

  // A ceiling, like the panel's: a short thread gets a short list.
  commentList: { maxHeight: 260, marginTop: 4 },

  composer:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  postBtn:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: COMMON_RADIUS },
  postBtnOff: { opacity: 0.4 },
  postText:   { fontSize: 13, fontWeight: '800', color: '#000000' },
});
