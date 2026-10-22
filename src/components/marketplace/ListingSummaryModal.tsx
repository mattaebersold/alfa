import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, Keyboard,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import OilSheen, { WARM_SHEEN_FILL } from '../ui/OilSheen';
import GalleryLightbox from '../media/GalleryLightbox';
import { useNavigation } from '@react-navigation/native';
import { MapPin, Truck, Settings, MessageCircle, Check, Pencil, Trash2, Tag, RotateCcw } from 'lucide-react-native';
import ActionSheet from '../ui/ActionSheet';
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
  useMarkListingSoldMutation, useDeleteListingMutation,
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
  /**
   * The group whose page opened this. Unused since the panel stopped showing
   * the groups a listing is posted in; still accepted so callers needn't change.
   */
  omitGroupId?: string;
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
  /** Each photo's width over height, by URL, once it has loaded. */
  const [ratios, setRatios] = useState<Record<string, number>>({});
  /** The photo the viewer opened on, or null while it's shut. */
  const [viewing, setViewing] = useState<number | null>(null);
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


  /** Everything the listing says about the thing itself, drawn as a plain list. */
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
  // Who's on the other end, by name — "Ask @matt about this".
  const contactLabel = seller?.username
    ? `Ask @${seller.username} about this`
    : listing?.kind === 'want' ? 'Ask the buyer' : 'Ask the seller';

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
          {/* Photos lead, as a row of tiles at each photo's own shape — a
              part shot upright stays upright, a car stays wide — that scrolls
              sideways. A tap opens them full screen, as a car's gallery does. */}
          {photos.length === 1 ? (
            // One photo: the width between the panel's margins, at its own
            // shape — there's no row to scroll. Capped at 3:4 tall, so a part
            // shot upright doesn't fill the panel before any of the listing.
            <TouchableOpacity
              style={styles.photoInset}
              onPress={() => setViewing(0)}
              activeOpacity={0.9}
              accessibilityRole="imagebutton"
              accessibilityLabel="Photo"
            >
              <Image
                source={{ uri: photos[0] }}
                style={[styles.photoSingle, { aspectRatio: Math.max(MIN_SOLO_RATIO, ratios[photos[0]] ?? DEFAULT_RATIO) }]}
                contentFit="cover"
                transition={150}
                onLoad={(e) => {
                  const { width, height } = e.source;
                  const uri = photos[0];
                  if (width > 0 && height > 0) setRatios((prev) => ({ ...prev, [uri]: width / height }));
                }}
              />
            </TouchableOpacity>
          ) : photos.length === 2 ? (
            // Two: half each, side by side — nothing to scroll to.
            <View style={[styles.photoInset, styles.photoPair]}>
              {photos.map((uri, i) => (
                <TouchableOpacity
                  key={uri}
                  style={styles.photoHalf}
                  onPress={() => setViewing(i)}
                  activeOpacity={0.85}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Photo ${i + 1} of 2`}
                >
                  <Image source={{ uri }} style={styles.photoHalfImage} contentFit="cover" transition={150} />
                </TouchableOpacity>
              ))}
            </View>
          ) : photos.length > 2 ? (
            // Three or more: tiles at their own shapes, a row that scrolls.
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoStrip}
              contentContainerStyle={styles.photoRow}
            >
              {photos.map((uri, i) => (
                <TouchableOpacity
                  key={uri}
                  onPress={() => setViewing(i)}
                  activeOpacity={0.85}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
                >
                  <Image
                    source={{ uri }}
                    style={[styles.photoTile, { width: TILE_H * (ratios[uri] ?? DEFAULT_RATIO) }]}
                    contentFit="cover"
                    transition={150}
                    onLoad={(e) => {
                      const { width, height } = e.source;
                      if (width > 0 && height > 0) {
                        const r = Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height));
                        setRatios((prev) => (prev[uri] === r ? prev : { ...prev, [uri]: r }));
                      }
                    }}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.body}>

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.fg }]} numberOfLines={3}>
                {listing.title || 'Untitled listing'}
              </Text>
              {listing.sold ? (
                <View style={styles.soldPill}><Text style={styles.soldText}>SOLD</Text></View>
              ) : null}
              {/* Yours: the way to change it, beside its title. */}
              {isMine ? <ListingOwnerCog listingId={listing.internal_id} sold={!!listing.sold} /> : null}
            </View>

            {/* What it is and how good, as coloured badges under the title —
                the category its own steady colour, the condition red to
                green along its scale. Off the photo, which keeps the price. */}
            {/* The car it fits, on its own line straight under the title —
                gold with the oil-slick film, as on the cards. */}
            {match ? (
              <View style={[styles.matchPill, styles.matchUnderTitle, { backgroundColor: WARM_SHEEN_FILL }]}>
                <OilSheen tone="warm" radius={999} />
                <Check size={11} color={COLOR_BLACK} strokeWidth={3} />
                <Text style={styles.matchText} numberOfLines={1}>{match}</Text>
              </View>
            ) : null}

            {/* The price leads the badges — what it costs, then what it is
                and how good. */}
            {(price || listing.category || condition) ? (
              <View style={styles.badges}>
                {price ? (
                  <View style={styles.priceBubble}>
                    <Text style={styles.priceBubbleText} numberOfLines={1}>{price}</Text>
                    {wasPrice ? <Text style={styles.priceBubbleWas} numberOfLines={1}>{wasPrice}</Text> : null}
                  </View>
                ) : null}
                {listing.category ? (
                  <View style={[styles.kindBadge, { backgroundColor: categoryColor(listing.category) }]}>
                    <Text style={styles.kindBadgeText}>{categoryLabel(listing.category)}</Text>
                  </View>
                ) : null}
                {/* How it gets to you, beside what it is — "Ships" or "Pickup". */}
                {shipping ? (
                  <View style={[styles.kindBadge, styles.shipBadge, { backgroundColor: colors.segment }]}>
                    <Truck size={11} color={colors.grey} />
                    <Text style={[styles.kindBadgeText, { color: colors.grey }]}>{shipping}</Text>
                  </View>
                ) : null}
                {condition ? (
                  <View style={[styles.kindBadge, { backgroundColor: conditionColor(listing.condition, meta?.conditions) ?? colors.segment }]}>
                    <Text style={styles.kindBadgeText}>{condition}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}



            {/* Who's selling. The whole row opens their summary over this one
                rather than leaving the listing behind. */}
            {/* The seller on the left, and the listing's like and comment
                count at the row's right end — one line, rather than a row of
                its own further down. */}
            <View style={styles.sellerLine}>
              {seller ? (
                <TouchableOpacity
                  style={styles.sellerRow}
                  onPress={() => openUser(seller.user_id, null)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${seller.username}`}
                >
                  <Avatar user={seller} size={30} />
                  <Text style={[styles.sellerName, { color: colors.fg }]} numberOfLines={1}>
                    {seller.username}
                  </Text>
                  {distance ? (
                    <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                      <MapPin size={10} color={colors.grey} />
                      <Text style={[styles.badgeText, { color: colors.grey }]}>{distance}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ) : <View style={styles.sellerRow} />}
              {/* Likes and comments, on the listing's own record — the generic
                  collections keyed by entry type 'listing'. */}
              <View style={styles.social}>
                <LikeButton
                  documentId={listing.internal_id}
                  entryType={LISTING_ENTRY_TYPE}
                  ownerId={listing.user_id}
                  initialCount={data?.like_count ?? listing.like_count ?? 0}
                  initialLiked={data?.has_liked ?? listing.has_liked ?? false}
                />
                <CommentsJump count={comments.length} />
              </View>
            </View>

            {body ? (
              <Text style={[styles.about, { color: colors.muted }]}>{body}</Text>
            ) : null}

            {/* The details as a plain list — a label and its value a line —
                rather than tiles: read down, not swiped across. */}
            {specs.length > 0 && (
              <View style={styles.specs}>
                {specs.map((spec) => (
                  <View key={spec.label} style={styles.spec}>
                    <Text style={styles.specLabel}>{spec.label}</Text>
                    <Text style={[styles.specValue, { color: colors.fg }]} numberOfLines={2}>{spec.value}</Text>
                  </View>
                ))}
              </View>
            )}


            {/* The rule the like row used to draw, kept to set the thread off
                from the listing above it. */}
            <View style={[styles.threadRule, { borderTopColor: colors.borderDark }]} />

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

      {/* The photos full screen, from the one tapped — the car gallery's viewer. */}
      {viewing !== null && listing ? (
        <GalleryLightbox
          images={(listing.gallery ?? []).filter((g) => !!imageUrl(g.filename))}
          initialIndex={viewing}
          title={listing.title || undefined}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </SummaryModal>
  );
}

/**
 * Your own listing's controls — a cog beside the title, opening a menu: edit,
 * mark sold (or relist), delete. Inside the panel so it can close the panel
 * first (useSummaryPanel) — before the form opens on this listing, and once
 * the listing is gone. The same calls the Manage listings pane makes.
 */
function ListingOwnerCog({ listingId, sold }: { listingId: string; sold: boolean }) {
  const nav = useNavigation<any>();
  const panel = useSummaryPanel();
  const [menuOpen, setMenuOpen] = useState(false);
  const [markSold, { isLoading: marking }] = useMarkListingSoldMutation();
  const [deleteListing, { isLoading: deleting }] = useDeleteListingMutation();
  const busy = marking || deleting;

  const closePanel = (then?: () => void) => (panel ? panel.closeThen(then) : then?.());
  const run = async (fn: () => Promise<unknown>, failure: string) => {
    try { await fn(); return true; } catch (err: any) { Alert.alert('Error', err?.data?.error || failure); return false; }
  };
  const onEdit = () => closePanel(() => nav.navigate('ListingCreate', { listingId }));
  const onToggleSold = () => run(
    () => markSold({ id: listingId, sold: !sold }).unwrap(),
    "That listing couldn't be updated.",
  );
  const onDelete = () => Alert.alert(
    'Delete this listing?',
    'It comes off the marketplace. Conversations about it stay in your messages.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await run(() => deleteListing({ internal_id: listingId }).unwrap(), "That listing couldn't be deleted.")) closePanel();
        },
      },
    ],
  );

  return (
    <>
      <TouchableOpacity
        style={[styles.editCog, busy && { opacity: 0.4 }]}
        onPress={() => setMenuOpen(true)}
        disabled={busy}
        hitSlop={8}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Listing options"
      >
        <Settings size={17} color={COLOR_WHITE} strokeWidth={2.2} />
      </TouchableOpacity>
      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Your listing"
        options={[
          { label: 'Edit listing', Icon: Pencil, onPress: onEdit },
          sold
            ? { label: 'Relist', Icon: RotateCcw, onPress: onToggleSold }
            : { label: 'Mark as sold', Icon: Tag, onPress: onToggleSold },
          { label: 'Delete listing', Icon: Trash2, destructive: true, onPress: onDelete },
        ]}
      />
    </>
  );
}

/**
 * The comment bubble and its count — white, the way the heart beside it reads,
 * not a sentence — and a tap takes the pane down to the thread and the box to
 * write in. Its own component so it reads the panel it's *inside*: from the
 * modal's own body, useSummaryPanel answers with the panel underneath.
 */
function CommentsJump({ count }: { count: number }) {
  const panel = useSummaryPanel();
  return (
    <TouchableOpacity
      style={styles.commentCount}
      onPress={() => panel?.scrollToEnd()}
      hitSlop={8}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${count} comment${count === 1 ? '' : 's'} — go to comments`}
    >
      <MessageCircle size={18} color={COLOR_WHITE} />
      <Text style={styles.commentCountText}>{count}</Text>
    </TouchableOpacity>
  );
}

/** The photo tiles' height; each is as wide as its photo's shape makes it. */
const TILE_H = 150;
/** A tile's shape before its photo has loaded. */
const DEFAULT_RATIO = 4 / 3;
/**
 * The narrowest and widest a tile is drawn — a tall phone shot of a part, a
 * panorama — so neither becomes a sliver or a whole screen of one photo.
 */
const MIN_RATIO = 9 / 16;
const MAX_RATIO = 2;
/** The tallest a lone, full-width photo is drawn — 3:4 portrait. */
const MIN_SOLO_RATIO = 3 / 4;

const styles = StyleSheet.create({
  loading: { height: 260, alignItems: 'center', justifyContent: 'center' },

  photoStrip: { flexGrow: 0 },
  // In line with the body's 18, above it.
  photoRow:   { gap: 8, paddingHorizontal: 18, paddingTop: 18 },
  photoTile:  { height: TILE_H, borderRadius: 10, backgroundColor: COLOR_GRAY_22 },
  // One or two photos: inside the body's 18 margins, below the top of the panel.
  photoInset: { marginHorizontal: 18, marginTop: 18 },
  photoSingle:{ width: '100%', borderRadius: 10, backgroundColor: COLOR_GRAY_22 },
  photoPair:  { flexDirection: 'row', gap: 8 },
  photoHalf:  { flex: 1 },
  photoHalfImage: { width: '100%', height: TILE_H, borderRadius: 10, backgroundColor: COLOR_GRAY_22 },
  // Beside the title, at its end — the height of the title's first line, so
  // the two sit on one centre. Bare, just the cog, but still 26 square so it's
  // as easy to hit.
  editCog: {
    width: 26, height: 26, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  // Its own line under the title, as wide as its words.
  matchUnderTitle: { overflow: 'hidden', alignSelf: 'flex-start', maxWidth: '100%' },
  // As on the cards, a size up.
  // The badges' size — a set 22 tall, the words centred — beside them.
  priceBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 22, paddingHorizontal: 9, borderRadius: 999,
    backgroundColor: COLOR_GREEN,
  },
  priceBubbleText: { color: COLOR_BLACK, fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.semibold, includeFontPadding: false },
  priceBubbleWas: {
    color: 'rgba(0,0,0,0.6)', fontSize: 10.5, lineHeight: 15, fontFamily: FONT_INTER.semibold, includeFontPadding: false,
    textDecorationLine: 'line-through',
  },

  body: { padding: 18, paddingBottom: 20, gap: 8 },

  matchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: PILL_RADIUS,
  },
  matchText: { fontSize: 11, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:    { flex: 1, fontSize: 17, fontFamily: FONT_INTER.bold, letterSpacing: -0.2 },
  soldPill: { backgroundColor: COLOR_DANGER, paddingHorizontal: 10, paddingVertical: 4, borderRadius: PILL_RADIUS, marginTop: 2 },
  soldText: { color: COLOR_WHITE, fontSize: 11, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6 },

  // Under the title, wrapping if a long condition needs the room.
  badges:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // A set height with the word centred in it both ways — padding alone sat
  // the text a hair high, Inter's line box being taller above than below.
  kindBadge: { height: 22, paddingHorizontal: 9, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  shipBadge: { flexDirection: 'row', gap: 4 },
  // Black on every fill — the palette is all mid-bright.
  kindBadgeText: { color: '#000000', fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.semibold, textAlign: 'center', includeFontPadding: false },

  sellerLine: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  sellerRow:  { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sellerName: { fontSize: 14, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
  },
  badgeText: { fontSize: 11, fontFamily: FONT_INTER.bold },

  about: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },

  specs: { paddingTop: 6, gap: 4 },
  spec:  { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  // Quiet, sentence case, in a column of its own — the value is what you're
  // reading for, and the values line up down the list.
  specLabel: { width: 76, fontSize: 13, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.45)' },
  specValue: { flex: 1, fontSize: 13.5, fontFamily: FONT_INTER.semibold },

  social:     { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 0 },
  threadRule: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  commentCountText: { fontSize: 13, fontFamily: FONT_INTER.medium, color: COLOR_WHITE },

  // A ceiling, like the panel's: a short thread gets a short list.
  commentList: { maxHeight: 260, marginTop: 4 },

  composer:   { marginHorizontal: -12, marginTop: 4 },
});
