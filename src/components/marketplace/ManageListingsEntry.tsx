import React, { useCallback, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Text } from '@ors/kit';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Tag, MessageSquare, CheckCircle2, RotateCcw, Pencil, Trash2, ChevronRight, Settings,
  MessageCircle, Megaphone, Check, Plus,
} from 'lucide-react-native';
import {
  useGetMyListingsQuery,
  useMarkListingSoldMutation,
  useConfirmListingMutation,
  useDeleteListingMutation,
} from '../../api/apiService';
import ListingSnapshot from './ListingSnapshot';
import { priceLabel } from './listingFormat';
import MarketplaceUnreadBadge, { useMarketplaceUnread } from './MarketplaceUnreadBadge';
import SharedModal, { PANE_GRABBER_H } from '../ui/SharedModal';
import ActionSheet from '../ui/ActionSheet';
import SubTabs from '../ui/SubTabs';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import type { AppStackParamList } from '../../navigation/types';
import type { Listing } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS, GUTTER, COLOR_GREEN, COLOR_BLACK, COLOR_GRAY_14, COLOR_GRAY_30, COLOR_WHITE, SEARCH_EDGE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/**
 * How a host wants navigation handled.
 *
 * Both hosts of this pane are inside a modal, and neither iOS nor Android will
 * present a screen over one that is still up — so the pane never navigates
 * itself. It hands the move to the host, which closes first and runs it after.
 */
type Navigate = (go: () => void) => void;

function ActionButton({
  label, Icon, onPress, tone = 'plain', badge, busy,
}: {
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  tone?: 'plain' | 'accent' | 'danger';
  badge?: number;
  busy?: boolean;
}) {
  const colors = useColors();
  const color = tone === 'danger' ? colors.red : tone === 'accent' ? colors.primaryAlt : colors.grey;

  return (
    <TouchableOpacity
      style={[
        styles.action,
        { borderColor: tone === 'plain' ? colors.borderDark : color },
      ]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : <Icon size={13} color={color} />}
      <Text style={[styles.actionText, { color }]}>{label}</Text>
      {!!badge && badge > 0 && <MarketplaceUnreadBadge count={badge} variant="inline" />}
    </TouchableOpacity>
  );
}

/**
 * One of your listings, with everything you can do to it.
 *
 * The actions are the ones a seller actually reaches for between posting and
 * selling: answer whoever is asking, say it's gone, say it's still here, fix a
 * detail, take it down. Editing is the only one that leaves the marketplace,
 * which is why it's the only one that needs the host to close first.
 */
function ManageRow({
  listing,
  stale,
  unread,
  navigate,
}: {
  listing: Listing;
  /** Nobody has confirmed this in 60 days — the nudge, surfaced in place. */
  stale: boolean;
  unread: number;
  navigate: Navigate;
}) {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const [markSold, { isLoading: marking }] = useMarkListingSoldMutation();
  const [confirmListing, { isLoading: confirming }] = useConfirmListingMutation();
  const [deleteListing, { isLoading: deleting }] = useDeleteListingMutation();

  const sold = !!listing.sold;
  /** Edit and delete — off the row's buttons, behind its cog. */
  const [menuOpen, setMenuOpen] = useState(false);

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    try { await fn(); } catch (err: any) { Alert.alert('Error', err?.data?.error || failure); }
  };

  const onDelete = () => {
    Alert.alert(
      'Delete this listing?',
      'It comes off the marketplace. Conversations about it stay in your messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => run(
            () => deleteListing({ internal_id: listing.internal_id }).unwrap(),
            "That listing couldn't be deleted.",
          ),
        },
      ],
    );
  };

  // The listing form, in edit mode — the same screen that created it. It's a
  // route, so like the messages action it waits for the host's sheet to go.
  const onEdit = () => navigate(() => navigation.navigate('ListingCreate', {
    listingId: listing.internal_id,
  }));

  return (
    <View style={styles.row}>
      <ListingSnapshot
        title={listing.title ?? ''}
        photo={listing.gallery?.[0]}
        // The browse side's formatter, because this is a whole listing: it
        // knows that a want ad names what you'll pay and that a sale can be OBO.
        priceText={priceLabel(listing)}
        priceBadge
        sold={sold}
        size={52}
        // Clear of the cog in the top-right corner.
        style={styles.snapshot}
      />

      {/* The cog in the row's top-right corner: changing or removing the
          listing, kept apart from the everyday buttons below. */}
      <TouchableOpacity
        style={styles.cog}
        onPress={() => setMenuOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Listing options"
      >
        <Settings size={14} color={COLOR_WHITE} strokeWidth={2.4} />
      </TouchableOpacity>
      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={listing.title ?? undefined}
        options={[
          { label: 'Edit listing', Icon: Pencil, onPress: onEdit },
          { label: 'Delete listing', Icon: Trash2, destructive: true, onPress: onDelete },
        ]}
      />

      {/* Said once, in place, rather than as a separate nag screen: this is
          where you'd act on it. */}
      {stale && !sold && (
        <Text style={[styles.stale, { color: colors.grey }]}>
          Nobody has confirmed this in a while — is it still available?
        </Text>
      )}

      <View style={styles.actions}>
        <ActionButton
          label={unread > 0 ? 'Messages' : 'Interested'}
          Icon={MessageSquare}
          tone={unread > 0 ? 'accent' : 'plain'}
          badge={unread}
          onPress={() => navigate(() => navigation.navigate('MarketplaceMessages', {
            listingId: listing.internal_id,
            listingTitle: listing.title,
            role: 'as_seller',
          }))}
        />
        <ActionButton
          label={sold ? 'Relist' : 'Mark sold'}
          Icon={sold ? RotateCcw : Tag}
          tone={sold ? 'accent' : 'plain'}
          busy={marking}
          onPress={() => run(
            () => markSold({ id: listing.internal_id, sold: !sold }).unwrap(),
            "That listing couldn't be updated.",
          )}
        />
        {!sold && (
          <ActionButton
            label="Still available"
            Icon={CheckCircle2}
            tone={stale ? 'accent' : 'plain'}
            busy={confirming}
            onPress={() => run(
              () => confirmListing(listing.internal_id).unwrap(),
              "That listing couldn't be confirmed.",
            )}
          />
        )}
      </View>
    </View>
  );
}

/**
 * Everything you have on the marketplace: what's up, what you're looking for,
 * and what's gone.
 *
 * Split by the server (`/api/marketplace/mine`) rather than filtered here, so
 * the three piles mean the same thing in both clients. Exported on its own so
 * it can sit inside whatever sheet the host already has — the dashboard drops
 * it into its own SheetModal, the marketplace entry below into a SharedModal.
 */
export function ManageListingsPane({ navigate }: { navigate?: Navigate }) {
  const colors = useColors();
  const { data, isLoading, refetch } = useGetMyListingsQuery();
  const { countForListing } = useMarketplaceUnread();
  const refreshControl = useRefreshControl(refetch);
  const insets = useSafeAreaInsets();

  // Default: run it now. Right for a host that isn't a modal, and harmless for
  // one that is only ever opened from a full screen.
  const go: Navigate = navigate ?? ((fn) => fn());

  const stale = new Set(data?.needs_confirmation ?? []);

  const listings = data?.listings ?? [];
  const wants = data?.wants ?? [];
  const sold = data?.sold ?? [];
  /**
   * Listings or want ads, as sub tabs with their counts. Sold ones are
   * listings, so they sit under the listings tab with a heading of their own.
   */
  const [tab, setTab] = useState<'listings' | 'wants'>('listings');
  const sections: { key: string; title?: string; entries: Listing[] }[] = tab === 'listings'
    ? [{ key: 'listings', entries: listings }, { key: 'sold', title: 'Sold', entries: sold }]
    : [{ key: 'wants', entries: wants }];

  if (isLoading) return <Spinner />;

  if (!listings.length && !wants.length && !sold.length) {
    return <EmptyState title="You haven't listed anything" />;
  }

  return (
    // Bounded to the sheet, and padded at its end past the home indicator:
    // the last row used to run into the screen's rounded corner.
    <ScrollView
      style={styles.paneScroll}
      contentContainerStyle={[styles.pane, { paddingBottom: insets.bottom + 28 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      <View style={styles.tabs}>
        <SubTabs
          options={[
            { key: 'listings', label: listings.length ? `Listings · ${listings.length}` : 'Listings' },
            { key: 'wants', label: wants.length ? `Want ads · ${wants.length}` : 'Want ads' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {sections.every((s) => s.entries.length === 0) ? (
        <Text style={[styles.empty, { color: colors.grey }]}>
          {tab === 'listings' ? 'Nothing listed' : 'No want ads'}
        </Text>
      ) : null}
      {sections.map((section) => (
        // An empty pile is left out entirely rather than headed and empty.
        section.entries.length === 0 ? null : (
          <View key={section.key} style={styles.section}>
            {section.title ? (
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.fg }]}>{section.title}</Text>
                <Text style={[styles.sectionCount, { color: colors.grey }]}>
                  {section.entries.length}
                </Text>
              </View>
            ) : null}
            {section.entries.map((listing) => (
              <ManageRow
                key={listing.internal_id}
                listing={listing}
                stale={stale.has(listing.internal_id)}
                unread={countForListing(listing.internal_id)}
                navigate={go}
              />
            ))}
          </View>
        )
      ))}
    </ScrollView>
  );
}

/**
 * "Manage your listings" — the way into the pane above.
 *
 * One component for both places it appears (the dashboard's quick actions and
 * the top of the marketplace) so the two can't drift, and so the browse screen
 * can drop it in without knowing anything about selling. It brings its own
 * sheet: the host renders one line and gets the whole feature.
 *
 * The badge is the marketplace's unread count, and only ever that — the main
 * messages badge is counted from a different collection and neither can move
 * the other.
 */
export default function ManageListingsEntry({
  variant = 'row',
  style,
  onNew,
}: {
  /** 'row' for a settings-style list; 'card' for a standalone block. */
  variant?: 'row' | 'card';
  style?: any;
  /**
   * List something new — a + at the end of the card's bubbles. The host
   * owns what happens (the form, or the allowance pitch), so the entry stays
   * ignorant of selling, as the dashboard's row needs it to be.
   */
  onNew?: () => void;
}) {
  const colors = useColors();
  const { data } = useGetMyListingsQuery();
  const { count } = useMarketplaceUnread();
  const [open, setOpen] = useState(false);

  // Navigation out of the sheet has to wait for the sheet to be gone — iOS
  // refuses to present over a modal that is still dismissing.
  const pending = useRef<(() => void) | null>(null);
  const navigate = useCallback<Navigate>((go) => {
    pending.current = go;
    setOpen(false);
  }, []);
  const onDismissed = () => {
    const go = pending.current;
    pending.current = null;
    go?.();
  };

  /**
   * The numbers under the label, as small bubbles with icons rather than a
   * line of "3 for sale · 1 sold" to read. Unread leads, in the brand colour,
   * because it's the one waiting on you.
   */
  const counts = data?.counts;
  const stats = [
    count > 0 ? { key: 'unread', Icon: MessageCircle, value: count, label: count === 1 ? 'unread message' : 'unread messages', lead: true } : null,
    counts?.listings ? { key: 'sale', Icon: Tag, value: counts.listings, label: 'for sale' } : null,
    counts?.wants ? { key: 'want', Icon: Megaphone, value: counts.wants, label: 'wanted' } : null,
    // Green: sold is the good news of the lot.
    counts?.sold ? { key: 'sold', Icon: Check, value: counts.sold, label: 'sold', ink: COLOR_GREEN } : null,
  ].filter(Boolean) as { key: string; Icon: typeof Tag; value: number; label: string; lead?: boolean; ink?: string }[];

  const statsView = (
    stats.length > 0 ? (
      <View style={[styles.stats, variant === 'card' && styles.statsRight]}>
        {stats.map(({ key, Icon, value, label, lead, ink: own }) => {
          // A dark pill set into the card, with light ink; unread keeps
          // the brand fill, being the one waiting on you.
          const fill = lead ? colors.primaryAlt : STAT_BG;
          const ink = lead ? '#000000' : own ?? STAT_INK;
          return (
            <View
              key={key}
              style={[styles.stat, { backgroundColor: fill }]}
              accessibilityLabel={`${value} ${label}`}
            >
              <Icon size={14} color={ink} strokeWidth={2.4} />
              <Text style={[styles.statText, { color: ink }]}>{value}</Text>
            </View>
          );
        })}
      </View>
    ) : counts ? (
      <Text style={[styles.entrySummary, { color: colors.grey }]}>Nothing listed yet</Text>
    ) : null
  );

  return (
    <>
      <TouchableOpacity
        style={[
          variant === 'card' ? styles.entryCard : styles.entryRow,
          // A step under the marketplace's ground, so it reads as a panel set
          // into it — edged like the search and filter below it.
          variant === 'card' && { backgroundColor: COLOR_GRAY_14, borderColor: SEARCH_EDGE },
          style,
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Your listings"
      >
        {/* The row keeps its icon, like the dashboard rows around it; the card
            is its words — the unread count is one of the bubbles below. */}
        {variant === 'row' ? (
          <View style={styles.entryIcon}>
            <Tag size={16} color={colors.primaryAlt} />
            <MarketplaceUnreadBadge count={count} />
          </View>
        ) : null}
        <View style={styles.entryText}>
          <Text style={[styles.entryLabel, variant === 'card' && styles.entryLabelCard, { color: colors.fg }]}>
            Your Listings
          </Text>
          {variant === 'row' ? statsView : null}
        </View>
        {/* On the card the stats sit on the right, level with the title; the
            row keeps them under its title. */}
        {variant === 'card' ? statsView : null}
        {/* New, as one more bubble after the counts — in the brand colour,
            since it's the one that does something. */}
        {variant === 'card' && onNew ? (
          <TouchableOpacity
            style={[styles.newBubble, { backgroundColor: colors.primaryAlt }]}
            onPress={onNew}
            hitSlop={6}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="New listing"
          >
            <Plus size={16} color="#000000" strokeWidth={3} />
          </TouchableOpacity>
        ) : null}
        {/* The row keeps its chevron, like the dashboard rows it sits among;
            the card doesn't need one — the whole card is the button. */}
        {variant === 'row' ? <ChevronRight size={16} color={colors.grey} /> : null}
      </TouchableOpacity>

      <SharedModal
        visible={open}
        onClose={() => setOpen(false)}
        onDismissed={onDismissed}
        // No heading: the sub tabs at the top say what's here.
        hideHeader
        // Its scroller pads its own foot clear of the home indicator.
        edgeToEdge
        heightRatio={0.85}
        // Black, so the rows on it read as cards.
        surface={COLOR_BLACK}
      >
        <ManageListingsPane navigate={navigate} />
      </SharedModal>
    </>
  );
}

/** A stat bubble: darker than the card it sits on, with light ink. */
const STAT_BG = 'rgba(0,0,0,0.4)';
const STAT_INK = 'rgba(255,255,255,0.85)';

const styles = StyleSheet.create({
  paneScroll: { flex: 1 },
  // Starts clear of the grabber floating over the top — see PANE_GRABBER_H.
  pane: { paddingHorizontal: 12, paddingTop: PANE_GRABBER_H },

  section:      { paddingTop: 14 },
  sectionHead:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, paddingBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontFamily: FONT_INTER.bold },
  sectionCount: { fontSize: 12, fontFamily: FONT_INTER.bold },

  // A step lighter than the pane, and no edge.
  row: {
    borderRadius: 14, backgroundColor: COLOR_GRAY_30,
    padding: 12, marginBottom: 10, gap: 10,
  },
  // The row's top-right corner, inside its padding.
  cog: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  snapshot: { paddingRight: 30 },
  // SubTabs brings its own 12 of side margin; the pane already has 12.
  tabs: { marginHorizontal: -12, paddingTop: 12 },
  empty: { fontSize: 13, paddingHorizontal: 4, paddingTop: 16 },
  stale: { fontSize: 12, lineHeight: 17 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  actionText: { fontSize: 12, fontFamily: FONT_INTER.bold },

  // Matches the dashboard's quick-action rows, so it can sit among them.
  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  entryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    // On the app's GUTTER, like the rest of the marketplace browse around it,
    // and clear of the header's tabs above.
    marginHorizontal: GUTTER, marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  // Positioned, so the badge has a corner to hang off.
  entryIcon:    { position: 'relative' },
  entryText:    { flex: 1, minWidth: 0 },
  entryLabel:   { fontSize: 14, fontFamily: FONT_INTER.bold },
  entrySummary: { fontSize: 12, marginTop: 2 },
  // The card's title — larger than the row's, in the body font.
  entryLabelCard: { fontSize: 17, fontFamily: FONT_INTER.bold },
  stats:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  // On the card, to the right of the title: no top margin, kept to one row.
  statsRight: { flexWrap: 'nowrap', marginTop: 0, flexShrink: 0 },
  // Tighter on the icon's side, so the icon sits near the bubble's round end.
  stat:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 7, paddingRight: 9, paddingVertical: 5, borderRadius: 999 },
  statText: { fontSize: 13.5, fontFamily: FONT_INTER.bold },
  // A bubble's height, round, pressable on its own inside the pressable card.
  newBubble: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
