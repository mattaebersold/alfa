import React from 'react';
import {
  View, StyleSheet, ScrollView, Dimensions, type DimensionValue,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import UserSummaryModal from '../members/UserSummaryModal';
import CarSummaryModal from '../cars/CarSummaryModal';
import GroupSummaryModal from '../groups/GroupSummaryModal';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { Users, Car as CarIcon, User as UserIcon, Calendar, ChevronRight, MapPin } from 'lucide-react-native';
import { useGetPhotoSpotQuery } from '@ors/kit';
import { PhotoSpotSummaryModal } from '@ors/kit/src/photography';
import {
  useGetGroupQuery, useGetUserByIdQuery, useGetCarQuery, useGetSocietyEventQuery,
  useGetPostTagsQuery,
} from '../../api/apiService';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { Post } from '../../types/api';
import { PILL_RADIUS, COLOR_BLACK, COLOR_GRAY_58 } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** The card's own horizontal inset — tiles line up with everything else on it. */
const GUTTER = 8;
const GAP = 8;

/**
 * How wide each tile is, given how many there are — or undefined to share the
 * row evenly.
 *
 * One takes half the row. Two share its width, however wide the card is, so
 * the inset is the same on both sides. (Sized off the screen they ran past the card's right
 * edge once the feed gave cards a side margin.) Past two the row genuinely
 * scrolls, and the tiles go narrower than half so the next one is visibly cut
 * off by the edge — the peek is the only thing that says there is more.
 */
function tileWidth(count: number): DimensionValue | undefined {
  // One alone takes half the row — full width, a single tag read as a banner
  // across the card rather than a note about it.
  if (count === 1) return '50%';
  if (count === 2) return undefined;
  return SCREEN_WIDTH * 0.4;
}

type Kind = 'group' | 'user' | 'car' | 'event' | 'spot';

const KIND_BADGE: Record<Kind, { label: string; bg: string }> = {
  group: { label: 'Group', bg: colors.badgeGroup },
  user:  { label: 'User',  bg: colors.badgeGarage },
  car:   { label: 'Car',   bg: colors.badgeRecord },
  event: { label: 'Event', bg: colors.badgeEvent },
  spot:  { label: 'Spot',  bg: colors.badgeSpot },
};

const KIND_ICON = {
  group: Users,
  user:  UserIcon,
  car:   CarIcon,
  event: Calendar,
  spot:  MapPin,
} as const;

/**
 * One tile.
 *
 * The group row's look, at tile scale: the subject's own picture pushed back
 * under an even scrim, with a badge and a name over it. Stacked and centred
 * rather than side by side — at 40% of a phone's width a badge and a name on
 * one line leave the name about four characters, and the name is the half that
 * matters.
 */
function Tile({ kind, name, image, width, onPress }: {
  kind: Kind;
  name: string;
  image?: string | null;
  /** Undefined: take an even share of the row (see tileWidth). */
  width?: DimensionValue;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const c = useColors();
  const badge = KIND_BADGE[kind];
  const Icon = KIND_ICON[kind];

  return (
    // `SummaryTouchable`, not a plain button: it hands its own rectangle to the
    // press handler so the panel it opens can grow out of this tile rather
    // than appearing from nowhere.
    <SummaryTouchable
      style={[styles.tile, width != null ? { width } : styles.tileShare]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${badge.label}: ${name}`}
    >
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.blank, { backgroundColor: c.segment }]}>
          <Icon size={20} color={c.grey} />
        </View>
      )}

      {/* A wash from left to right — heavy behind the badge and name, which
          sit on the left, thinning out across the tile so the photo shows
          through on the right. Enough to keep the tile a label with a picture
          behind it, rather than a second photo competing with the post's. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.1)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.row}>
        <View style={styles.body}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
        </View>
        {/* Squared off and darker than the scrim it sits on, so it reads as the
            thing you press rather than as part of the wash. */}
        <View style={styles.chevron}>
          <ChevronRight size={14} color="rgba(255,255,255,0.85)" strokeWidth={2.5} />
        </View>
      </View>
    </SummaryTouchable>
  );
}

// ── One per kind: each resolves its own subject ──────────────────────────────
// Separate components rather than a lookup in the parent, so every hook runs
// unconditionally and the number of them doesn't change with the data.

type Open = (origin: SummaryOrigin | null) => void;

function GroupTile({ id, width, onOpen }: { id: string; width?: DimensionValue; onOpen: Open }) {
  const { data: group } = useGetGroupQuery(id, { skip: !id });
  if (!group) return null;
  return (
    <Tile
      kind="group"
      name={group.title ?? 'Group'}
      image={firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery)}
      width={width}
      onPress={onOpen}
    />
  );
}

function SpotTile({ id, width, onOpen }: { id: string; width?: DimensionValue; onOpen: Open }) {
  const { data: spot } = useGetPhotoSpotQuery(id, { skip: !id });
  if (!spot) return null;
  return (
    <Tile
      kind="spot"
      name={spot.title || 'Photo spot'}
      image={firstGalleryUrl(spot.gallery as any)}
      width={width}
      onPress={onOpen}
    />
  );
}

function UserTile({ id, width, onOpen }: { id: string; width?: DimensionValue; onOpen: Open }) {
  const { data: user } = useGetUserByIdQuery(id, { skip: !id });
  if (!user) return null;
  return (
    <Tile
      kind="user"
      name={`@${user.username}`}
      image={firstGalleryUrl(user.gallery) ?? (user.profilePicture ? imageUrl(user.profilePicture) : null)}
      width={width}
      onPress={onOpen}
    />
  );
}

function CarTile({ id, width, onOpen }: { id: string; width?: DimensionValue; onOpen: Open }) {
  const { data: car } = useGetCarQuery(id, { skip: !id });
  if (!car) return null;
  const name = car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car';
  return (
    <Tile
      kind="car"
      name={name}
      image={firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null)}
      width={width}
      onPress={onOpen}
    />
  );
}

function EventTile({ id, width, onOpen }: { id: string; width?: DimensionValue; onOpen: Open }) {
  /**
   * A society event, not the legacy `Event`.
   *
   * There are two event collections behind two endpoints, and an event tag
   * always points at the newer one: the tag picker's suggestions come from
   * search, and search's `events` are SocietyEvents. Resolving them through
   * `api/event/detail` found nothing, so the tile rendered null and vanished —
   * while still counting toward the tile widths, which is why a post tagged
   * with an event showed one half-width tile and a gap.
   *
   * It's also the collection the sheet these open reads from, so this is now
   * the same event end to end.
   */
  const { data: event } = useGetSocietyEventQuery(id, { skip: !id });
  if (!event) return null;
  return (
    <Tile
      kind="event"
      name={event.title ?? 'Event'}
      image={firstGalleryUrl(event.gallery)}
      width={width}
      onPress={onOpen}
    />
  );
}

/** Server entry types, normalised. */
function kindFromEntryType(t?: string): Exclude<Kind, 'group'> | null {
  if (t === 'user') return 'user';
  if (t === 'garagecar' || t === 'car') return 'car';
  if (t === 'event') return 'event';
  if (t === 'photospot') return 'spot';
  return null;
}

/**
 * Everything this post is attached to, as one scrolling row.
 *
 * A post used to say only where it was posted — a single group banner — and
 * said nothing at all about who or what was tagged in it, which was information
 * the post already carried and the card simply dropped. Groups and tags are the
 * same kind of fact ("this post is connected to that thing"), so they're one
 * row rather than a banner plus a list somewhere else.
 *
 * Groups lead, because where a post lives frames everything else about it.
 *
 * Tags come off the post when the endpoint attached them — the feed batches
 * them server-side — and are fetched only when it didn't. Each tile still
 * resolves its own subject, which is cached, so a feed full of posts tagging
 * the same car costs one request for it.
 */
/**
 * The minimum a thing needs to have a context row.
 *
 * Narrower than `Post` on purpose: the row only ever reads an id, the groups
 * and the tags, and typing it that way is what lets a photo spot — which is not
 * a post and never will be — use the same row against the same generic Tag
 * records. See `components/photography/SpotContextRow`.
 */
export type ContextSubject = Pick<Post, 'internal_id'> &
  Partial<Pick<Post, 'group_ids' | 'group_id' | 'tags'>>;

export default function PostContextRow({ post }: { post: ContextSubject }) {
  const { openEventSheet } = useEventSheet();

  /**
   * Which panel is open, and where it should grow from.
   *
   * One piece of state rather than one per kind: only one panel is ever open,
   * and tracking them separately is how you end up with two on screen.
   */
  const [open, setOpen] = React.useState<
    { kind: Kind; id: string; origin: SummaryOrigin | null } | null
  >(null);

  const groupIds = React.useMemo(() => {
    const ids = post.group_ids?.length ? post.group_ids : [post.group_id];
    return [...new Set(ids.filter(Boolean) as string[])];
  }, [post.group_ids, post.group_id]);

  // The feed sends tags with the post; other surfaces don't, and only those pay
  // for a request.
  const inlineTags = Array.isArray(post.tags) ? post.tags : null;
  const { data: fetchedTags } = useGetPostTagsQuery(post.internal_id, {
    skip: !!inlineTags || !post.internal_id,
  });
  const tags = inlineTags ?? fetchedTags ?? [];

  const items = React.useMemo(() => {
    const out: { key: string; kind: Kind; id: string }[] =
      groupIds.map((id) => ({ key: `group-${id}`, kind: 'group' as Kind, id }));

    tags.forEach((t: any) => {
      const kind = kindFromEntryType(t.tag_entry_type);
      const id = t.tag_internal_id;
      if (!kind || !id) return;
      const key = `${kind}-${id}`;
      // The same car tagged twice is one tile.
      if (out.some((o) => o.key === key)) return;
      out.push({ key, kind, id });
    });

    return out;
  }, [groupIds, tags]);

  if (items.length === 0) return null;

  /**
   * A tap summarises; it doesn't travel.
   *
   * Every one of these tiles is a detour from the post you were reading, and
   * sending you to a whole screen to answer "which car is that" costs the
   * place you were in. The panels all carry their own "view more" for when the
   * answer is worth leaving for.
   *
   * Events are the exception in mechanism only: their sheet already exists at
   * the root — it's the same one the calendar and the drawer open — so they
   * get that rather than a second, thinner version of it.
   */
  const openFor = (kind: Kind, id: string) => (origin: SummaryOrigin | null) => {
    if (kind === 'event') return openEventSheet({ eventId: id });
    setOpen({ kind, id, origin });
  };

  const width = tileWidth(items.length);
  // Nothing to scroll when the tiles already fit, and a scrollable row that
  // can't move swallows a horizontal swipe the carousel above it might want.
  const scrolls = items.length > 2;

  const tiles = items.map((item) => {
    const props = { id: item.id, width, onOpen: openFor(item.kind, item.id) };
    if (item.kind === 'group') return <GroupTile key={item.key} {...props} />;
    if (item.kind === 'user')  return <UserTile key={item.key} {...props} />;
    if (item.kind === 'car')   return <CarTile key={item.key} {...props} />;
    if (item.kind === 'spot')  return <SpotTile key={item.key} {...props} />;
    return <EventTile key={item.key} {...props} />;
  });

  const close = () => setOpen(null);

  return (
    <>
      {scrolls ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroller}
          contentContainerStyle={styles.strip}
        >
          {tiles}
        </ScrollView>
      ) : (
        <View style={styles.strip}>{tiles}</View>
      )}

      <UserSummaryModal
        userId={open?.kind === 'user' ? open.id : null}
        origin={open?.origin}
        onClose={close}
      />
      <CarSummaryModal
        carId={open?.kind === 'car' ? open.id : null}
        origin={open?.origin}
        onClose={close}
      />
      <GroupSummaryModal
        groupId={open?.kind === 'group' ? open.id : null}
        origin={open?.origin}
        onClose={close}
      />
      {/* The spot's summary without its own tag tiles — SpotContextRow is
          built on this row, and drawing it here would be a loop. */}
      <PhotoSpotSummaryModal
        spotId={open?.kind === 'spot' ? open.id : null}
        onClose={close}
      />
    </>
  );
}
const styles = StyleSheet.create({
  // `flexGrow: 0` or the row takes the height left over in the card's column
  // and stretches the tiles to fill it.
  scroller: { flexGrow: 0, flexShrink: 0 },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: GAP,
    // Room under the tiles too, now the card can end on them — the likes row
    // that followed moved onto the photo. With nothing tagged the row isn't
    // drawn at all, so the card ends on its image, flush.
    paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 12,
  },
  // A hairline of dark grey around each, so a dark photo still has an edge
  // against the card.
  tile: {
    height: 58,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: COLOR_GRAY_58,
    justifyContent: 'center',
  },
  tileShare: { flex: 1 },
  blank: { alignItems: 'center', justifyContent: 'center' },
  // The tile's contents: the stacked badge-and-name on the left, the chevron
  // pinned right.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10,
  },
  body: {
    flex: 1, minWidth: 0,
    alignItems: 'flex-start', justifyContent: 'center', gap: 3,
  },
  // `alignSelf` keeps the badge the width of its word rather than the width of
  // the name under it.
  // At 80%, like the type and category pills on the post's photo.
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: PILL_RADIUS,
    opacity: 0.8,
  },
  badgeText: {
    fontSize: 8, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK,
  },
  // Regular weight: the badge above it is already doing the emphasis, and two
  // bold things stacked read as one loud block.
  name: {
    maxWidth: '100%',
    fontSize: 13, fontFamily: FONT_INTER.medium, color: 'rgba(255,255,255,0.95)',
  },
  chevron: {
    width: 24, height: 24, borderRadius: 6,
    flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
