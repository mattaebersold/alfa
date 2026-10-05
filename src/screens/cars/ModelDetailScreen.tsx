import React, { useLayoutEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Car, ChevronRight, Pencil, Check, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CarMosaic from '../../components/cars/CarMosaic';
import ModelBookmarkButton from '../../components/cars/ModelBookmarkButton';
import type { ModelPageParams } from './BrandDetailScreen';
import ModelPostsSection from '../../components/cars/ModelPostsSection';
import CarGroupsRow from '../../components/cars/CarGroupsRow';
import ModelDescriptionEditor from '../../components/cars/ModelDescriptionEditor';
import Avatar from '../../components/ui/Avatar';
import {
  useGetCarsQuery, useGetModelDiscussionQuery, useGetModelResourcesQuery, useGetModelProfileQuery,
  useGetModelProposalsQuery, useReviewModelProposalMutation, useGetGroupsForCarQuery, type ModelProposal,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { CarsScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_BLACK, COLOR_GRAY_26, COLOR_GREEN, COLOR_WHITE, GUTTER, PILL_RADIUS } from '../../constants/config';

type Tab = 'cars' | 'discussion' | 'resources' | 'groups';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** The banner photo's height — behind the status bar and the header's buttons too. */
const BANNER_H = Math.round(SCREEN_WIDTH * 0.72);
/** The description's lines before "more". */
const DESCRIPTION_LINES = 3;
/** An unlit tab — as the app header's tabs. */
const TAB_IDLE = 'rgba(255,255,255,0.6)';

/**
 * What a model page is called: "Porsche 911", or for a generation "Porsche
 * 993" when that reads on its own and "Volkswagen Jetta Mk2" when it doesn't.
 */
export function modelPageTitle(p: { brand: string; model: string; generation?: string; standalone?: boolean }) {
  return `${p.brand} ${modelShortTitle(p)}`;
}

/**
 * The same, without the make — for a tile or a crumb already under the make.
 * A generation that reads on its own ("993") is just itself; one that doesn't
 * ("1st Gen") carries its model ("Atlas 1st Gen"), or it's a tile saying
 * "1st Gen" of nothing in particular.
 */
export function modelShortTitle(p: { model: string; generation?: string; standalone?: boolean }) {
  if (!p.generation) return p.model;
  return p.standalone ? p.generation : `${p.model} ${p.generation}`;
}

/**
 * A car model's page — a profile of the model, not just a list of its cars.
 *
 * A banner from one of its members' cars, under a see-through title bar
 * that keeps only the back button and the bookmark. Then the way back up
 * (the make, and the model for a generation), the name and how many cars,
 * a short factual paragraph and stat tiles from Wikipedia (horacio's
 * seed-model-profiles — absent until one's written), and four sections
 * switched by tabs styled as the app header's: every car of the model, its
 * discussion, its resources, and the groups about it. Everything above the tabs
 * scrolls away with whichever section is showing.
 */
export default function ModelDetailScreen({ route, navigation }: CarsScreenProps<'ModelDetail'>) {
  const colors = useColors();
  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <ModelDetailView
        params={route.params}
        navigation={navigation}
        onOpenBrand={(brand) => navigation.navigate('BrandDetail', { brand })}
      />
    </SafeAreaView>
  );
}

/**
 * A model's page, for any host. With a `navigation` it's a pushed screen,
 * and the bookmark rides the stack's transparent header; without one — the
 * home screen's Cars tab, in place under a breadcrumb trail — the bookmark
 * sits on the banner itself, and going back to the make is the host's.
 */
export function ModelDetailView({ params, navigation, onOpenBrand, headerPad = 0, bannerOverlay, onScroll }: {
  params: ModelPageParams;
  navigation?: CarsScreenProps<'ModelDetail'>['navigation'];
  onOpenBrand: (brand: string) => void;
  /** Room at the top for a host whose header floats over the content. */
  headerPad?: number;
  /** Laid over the banner's top — the Cars tab's breadcrumb trail, which scrolls away with the photo. */
  bannerOverlay?: React.ReactNode;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { brand, model, modelHandle, generationHandle } = params;
  const title = modelPageTitle(params);
  const colors = useColors();
  const brandColor = useBrandColor();
  const [tab, setTab] = useState<Tab>('cars');
  const { data: firstCar } = useGetCarsQuery({ page: 0, limit: 1, make: brand.toLowerCase(), model: modelHandle, generation: generationHandle });
  const total = firstCar?.total;
  // For the counts on the tabs; the sections read the same cached lists.
  const { data: discussion } = useGetModelDiscussionQuery({ make: brand, model });
  const { data: resources } = useGetModelResourcesQuery({ make: brand, model });
  const { data: groupsData } = useGetGroupsForCarQuery({ make: brand, model });
  const { data: profile } = useGetModelProfileQuery({ make: brand, model: modelHandle, generation: generationHandle });

  // Members propose the description; admins review what's waiting, right here.
  const [editing, setEditing] = useState(false);
  const isAdmin = useAppSelector((s) => s.auth.userInfo?.accountType === 'admin');
  const { data: proposals } = useGetModelProposalsQuery(
    { make: brand, model: modelHandle, generation: generationHandle },
    { skip: !isAdmin },
  );

  // The banner: a member's car of this model — its main photo, else its first.
  const car = firstCar?.entries?.[0];
  const banner = car ? (imageUrl(car.profile_image) ?? firstGalleryUrl(car.gallery)) : null;

  // The description, 3 lines until "more" — measured off an invisible copy,
  // so "more" only shows when there's more to show.
  const [expanded, setExpanded] = useState(false);
  const [clamps, setClamps] = useState(false);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'cars', label: 'Cars', count: total },
    { key: 'discussion', label: 'Discussion', count: discussion?.entries?.length },
    { key: 'resources', label: 'Resources', count: resources?.entries?.length },
    { key: 'groups', label: 'Groups', count: groupsData?.entries?.length },
  ];

  useLayoutEffect(() => {
    if (!navigation) return;
    navigation.setOptions({
      // See-through, over the banner: just the back button and the bookmark.
      // The name is on the page, under the photo.
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      headerTitle: '',
      // Saved to the header's Bookmarks › Cars — see BookmarksPanel.
      headerRight: () => (
        <ModelBookmarkButton
          make={brand}
          model={model}
          modelHandle={modelHandle}
          generation={params.generation}
          generationHandle={generationHandle}
          standalone={params.standalone}
        />
      ),
    });
  }, [navigation, brand, model, modelHandle, generationHandle, params.generation, params.standalone]);

  // Straight back to the make — a model split into generations has no page of
  // its own (BMW › E36, never BMW › 3 Series › E36).
  const crumbs: { label: string; onPress: () => void }[] = [
    { label: brand, onPress: () => onOpenBrand(brand) },
  ];

  const header = (
    <>
      {/* ── The banner ── */}
      <View style={styles.banner}>
        {banner ? (
          <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.bannerBlank]}>
            <Car size={44} color={colors.grey} />
          </View>
        )}
        {/* Dark at the top, for the back button and the status bar… */}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
          style={styles.bannerTop}
          pointerEvents="none"
        />
        {/* …and into the page's own ground at the foot. */}
        <LinearGradient
          colors={['rgba(10,10,10,0)', colors.cream]}
          style={styles.bannerFoot}
          pointerEvents="none"
        />
        {bannerOverlay ? <View style={styles.bannerOverlay}>{bannerOverlay}</View> : null}
      </View>

      <View style={styles.intro}>
        {/* ── The way back up ── */}
        <View style={styles.crumbs}>
          {crumbs.map((c, i) => (
            <React.Fragment key={c.label}>
              {i > 0 && <ChevronRight size={13} color={colors.grey} />}
              <TouchableOpacity
                style={[styles.crumb, { borderColor: colors.border }]}
                onPress={c.onPress}
                activeOpacity={0.75}
                accessibilityRole="link"
                accessibilityLabel={`Back to ${c.label}`}
              >
                <Text style={[styles.crumbText, { color: colors.fg }]} numberOfLines={1}>{c.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* ── The name, and how many ── */}
        <View style={styles.titleRow}>
          {/* In place, with no header to carry it: the bookmark leads the name. */}
          {!navigation && (
            <View style={styles.titleBookmark}>
              <ModelBookmarkButton
                make={brand}
                model={model}
                modelHandle={modelHandle}
                generation={params.generation}
                generationHandle={generationHandle}
                standalone={params.standalone}
              />
            </View>
          )}
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{title}</Text>
          {total != null && (
            <View style={styles.count} accessibilityLabel={`${total} ${total === 1 ? 'car' : 'cars'}`}>
              <Car size={13} color={COLOR_WHITE} strokeWidth={2.2} />
              <Text style={styles.countText}>{total}</Text>
            </View>
          )}
        </View>

        {/* ── About it ── */}
        {profile?.description ? (
          <View>
            <Text
              style={[styles.description, { color: colors.fg }]}
              numberOfLines={expanded ? undefined : DESCRIPTION_LINES}
            >
              {profile.description}
            </Text>
            {/* The same text, unclamped and invisible, to count its lines. */}
            <Text
              style={[styles.description, styles.measure]}
              onTextLayout={(e) => setClamps(e.nativeEvent.lines.length > DESCRIPTION_LINES)}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {profile.description}
            </Text>
            {clamps && (
              <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={8} style={styles.moreBtn}>
                <Text style={[styles.more, { color: colors.fg }]}>{expanded ? 'less' : 'more'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      {/* Anyone can propose the text; an admin approves it. */}
      <TouchableOpacity
        style={[styles.suggestBtn, { borderColor: colors.border }]}
        onPress={() => setEditing(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
      >
        <Pencil size={13} color={colors.fg} strokeWidth={2.2} />
        <Text style={[styles.suggestText, { color: colors.fg }]}>
          {profile?.description ? 'Suggest an edit' : 'Add model description'}
        </Text>
      </TouchableOpacity>

      {/* An admin sees what's waiting for this page, to approve or reject. */}
      {isAdmin && proposals?.map((p) => <ProposalReview key={p.internal_id} proposal={p} />)}

      {profile?.stats?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stats}>
          {profile.stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={[styles.statLabel, { color: colors.grey }]}>{s.label}</Text>
              <Text style={[styles.statValue, { color: colors.fg }]} numberOfLines={2}>{s.value}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* ── The sections, as the app header's tabs — a row that scrolls
          across, now there are four. ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tab}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabLabel, active ? { color: brandColor } : styles.tabLabelIdle]}>{t.label}</Text>
                {t.count ? (
                  <View style={[styles.tabCount, active && { backgroundColor: brandColor }]}>
                    <Text style={[styles.tabCountText, { color: active ? COLOR_BLACK : COLOR_WHITE }]}>{t.count}</Text>
                  </View>
                ) : null}
              </View>
              {/* Under the lit tab only, in its colour, the width of its word. */}
              <View style={[styles.tabUnderline, { backgroundColor: active ? brandColor : 'transparent' }]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );

  return (
    <View style={[ss.fill, { paddingTop: headerPad }]}>
      <ModelDescriptionEditor
        visible={editing}
        onClose={() => setEditing(false)}
        page={{ title, make: brand, model, generation: params.generation, standalone: params.standalone }}
        current={profile?.description}
      />
      {tab === 'cars' ? (
        <CarMosaic make={brand} model={modelHandle} generation={generationHandle} header={header} emptyTitle={`No ${title}s yet`} onScroll={onScroll} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
          {header}
          {tab === 'groups'
            ? <CarGroupsRow make={brand} model={model} layout="list" />
            : <ModelPostsSection kind={tab === 'discussion' ? 'discussion' : 'resource'} make={brand} model={model} />}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * A proposed description waiting on an admin: who, what it would say, and
 * Approve / Reject. Approving puts it on the page at once; either way the
 * member who proposed it is notified (the server does both).
 */
function ProposalReview({ proposal }: { proposal: ModelProposal }) {
  const colors = useColors();
  const [review, { isLoading }] = useReviewModelProposalMutation();
  const decide = (approve: boolean) => {
    Alert.alert(
      approve ? 'Approve this description?' : 'Reject this description?',
      approve ? 'It replaces the page\'s description now.' : `@${proposal.proposer.username ?? 'The member'} will be told it wasn't accepted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approve ? 'Approve' : 'Reject',
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            try { await review({ id: proposal.internal_id, approve }).unwrap(); }
            catch (err: any) { Alert.alert("Couldn't save that", err?.data?.error ?? 'Please try again.'); }
          },
        },
      ],
    );
  };
  return (
    <View style={[styles.review, { borderColor: colors.border }]}>
      <View style={styles.reviewHead}>
        <Avatar user={proposal.proposer as any} size={22} />
        <Text style={[styles.reviewWho, { color: colors.fg }]} numberOfLines={1}>
          @{proposal.proposer.username ?? 'member'} {proposal.current_description ? 'suggested an edit' : 'wrote a description'}
        </Text>
      </View>
      <Text style={[styles.reviewText, { color: colors.fg }]}>{proposal.proposed_description}</Text>
      <View style={styles.reviewBtns}>
        <TouchableOpacity
          style={[styles.reviewBtn, { borderColor: colors.border }]}
          onPress={() => decide(false)}
          disabled={isLoading}
        >
          <X size={14} color={colors.fg} strokeWidth={2.4} />
          <Text style={[styles.reviewBtnText, { color: colors.fg }]}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reviewBtn, styles.approveBtn]}
          onPress={() => decide(true)}
          disabled={isLoading}
        >
          <Check size={14} color={COLOR_BLACK} strokeWidth={2.6} />
          <Text style={[styles.reviewBtnText, { color: COLOR_BLACK }]}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleBookmark: { marginRight: 2 },
  banner: { width: '100%', height: BANNER_H, backgroundColor: COLOR_GRAY_26 },
  bannerBlank: { alignItems: 'center', justifyContent: 'center' },
  bannerOverlay: { position: 'absolute', left: 0, right: 0, top: 0 },
  bannerTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 130 },
  // A point past the foot, so no hairline of photo shows under it.
  bannerFoot: { position: 'absolute', left: 0, right: 0, bottom: -1, height: '45%' },

  // Pulled up over the banner's faded foot.
  intro: { paddingHorizontal: GUTTER + 8, marginTop: -44, gap: 10 },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  // Small outlined pills, as the other outline buttons (Add car, View channel).
  crumb: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: PILL_RADIUS, borderWidth: 1,
    backgroundColor: 'rgba(10,10,10,0.55)',
  },
  crumbText: { fontSize: 12.5, fontFamily: FONT_INTER.semibold },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flexShrink: 1, fontSize: 28, fontFamily: FONT_INTER.bold, letterSpacing: -0.5 },
  count: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  countText: { fontSize: 13, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE },

  description: { fontSize: 14, lineHeight: 20 },
  // Same box as the real one, invisible and out of flow.
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  moreBtn: { alignSelf: 'flex-start', marginTop: 2 },
  more: { fontSize: 14, lineHeight: 20, fontFamily: FONT_INTER.bold, textDecorationLine: 'underline' },

  // Tiles in a row that scrolls — a stat each, the label over the value.
  stats: { gap: 8, paddingHorizontal: GUTTER + 8, paddingTop: 14 },
  stat: {
    minWidth: 112, maxWidth: 180,
    paddingHorizontal: 12, paddingVertical: 10, gap: 3,
    borderRadius: 14, backgroundColor: COLOR_GRAY_26,
  },
  statLabel: { fontSize: 11.5, fontFamily: FONT_INTER.semibold },
  statValue: { fontSize: 14, lineHeight: 18, fontFamily: FONT_INTER.bold },

  // Outlined, like the page's other small buttons.
  suggestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginHorizontal: GUTTER + 8, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  suggestText: { fontSize: 13, fontFamily: FONT_INTER.semibold },

  // An admin's review card — outlined, set apart from the page's own text.
  review: {
    marginHorizontal: GUTTER + 8, marginTop: 12, padding: 12, gap: 10,
    borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewWho: { flexShrink: 1, fontSize: 13, fontFamily: FONT_INTER.semibold },
  reviewText: { fontSize: 14, lineHeight: 20 },
  reviewBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  approveBtn: { backgroundColor: COLOR_GREEN, borderColor: COLOR_GREEN },
  reviewBtnText: { fontSize: 13, fontFamily: FONT_INTER.bold },

  // The app header's tabs: a row of words, the lit one in the brand colour
  // with a rounded bar the width of its word beneath it.
  tabsScroll: { marginTop: 18, marginBottom: 12, flexGrow: 0 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: GUTTER + 8 },
  tab: { alignItems: 'stretch' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center' },
  tabLabel: { fontSize: 17, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  tabLabelIdle: { color: TAB_IDLE, fontFamily: FONT_INTER.medium },
  // The count in a small circle, centred on the word and set off from it —
  // brand-filled on the lit tab.
  tabCount: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, marginLeft: 7,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tabCountText: { fontSize: 11, fontFamily: FONT_INTER.bold },
  tabUnderline: { height: 3, borderRadius: 1.5, marginTop: 4 },

  scroll: { paddingBottom: 120 },
});
