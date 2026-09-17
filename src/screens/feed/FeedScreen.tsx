import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FeedList from '../../components/feed/FeedList';
import StoriesRow from '../../components/stories/StoriesRow';
import FeedQuickLinks from '../../components/feed/FeedQuickLinks';
import SuggestedMembersRow from '../../components/feed/SuggestedMembersRow';
import SuggestedCarsRow from '../../components/feed/SuggestedCarsRow';
// import HomeFeatureBanner from '../../components/feed/HomeFeatureBanner';
import UpcomingEventsRow from '../../components/feed/UpcomingEventsRow';
import HideSuggestionsDialog from '../../components/feed/HideSuggestionsDialog';
import { useFeedPreferences, type SuggestionRow } from '../../hooks/useFeedPreferences';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { useGetBlockedUsersQuery } from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { setBlockedUsers } from '../../store/moderationSlice';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function PostPrompt() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.prompt, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('Create')}
      activeOpacity={0.9}
    >
      <Text style={[styles.promptText, { color: '#ffffff' }]}>What's on your mind...</Text>
    </TouchableOpacity>
  );
}

function FeedHeader() {
  const colors = useColors();
  const isPro = useIsPro();
  const { isRowHidden, hideRow } = useFeedPreferences();
  // One dialog, told which row's ✕ opened it — closing a row closes that row
  // and leaves the other where it is.
  const [hiding, setHiding] = useState<SuggestionRow | null>(null);

  return (
    <View>
      {/* {isPro && <StoriesRow />} */}
      {/* Feature banner parked for now — <HomeFeatureBanner /> */}
      {/* Quick links lead: they're where you go, and the feed opens with them
          rather than with a row you have to scroll past to reach them. */}
      <FeedQuickLinks />
      <PostPrompt />
      <UpcomingEventsRow />
      {!isRowHidden('members') && <SuggestedMembersRow onRequestHide={() => setHiding('members')} />}
      {/* With no card behind either row, this rule is what keeps them from
          running together into one long shelf. Only between the two — with
          one closed there's nothing to separate. */}
      {!isRowHidden('members') && !isRowHidden('cars') && (
        <View style={[styles.rowRule, { backgroundColor: colors.borderDark }]} />
      )}
      {!isRowHidden('cars') && <SuggestedCarsRow onRequestHide={() => setHiding('cars')} />}
      <HideSuggestionsDialog
        visible={hiding !== null}
        rowTitle={hiding === 'cars' ? 'Suggested Cars' : 'Suggested Members'}
        onClose={() => setHiding(null)}
        onChoose={(mode) => hiding && hideRow(hiding, mode)}
      />
    </View>
  );
}

export default function FeedScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const dispatch = useAppDispatch();

  // Keep the client-side blocked-users list in sync so blocked authors'
  // content stays hidden across sessions (Apple UGC requirement).
  const { data: blockedData } = useGetBlockedUsersQuery();
  useEffect(() => {
    if (blockedData?.entries) {
      dispatch(setBlockedUsers(blockedData.entries.map((u) => u.user_id).filter(Boolean)));
    }
  }, [blockedData, dispatch]);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
        {/* No `onPostPress`: a tap on a card opens its own text in place rather
            than pushing the post's own screen. The card carries everything
            that screen showed — the full body, the comment thread behind the
            comment button, a summary panel for whoever liked it — so the push
            only ever arrived at the same content one level deeper. */}
        <FeedList
          listRef={scrollRef}
          excludeTypes={['story']}
          includeGarageAdditions
          ListHeaderComponent={FeedHeader}
          paddingTop={headerPad}
          onScroll={onScroll}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  // Inset to the rows' own 12 gutter, so it ends where their headings start.
  rowRule: { height: StyleSheet.hairlineWidth, marginHorizontal: 12, marginTop: 8 },
  prompt: {
    marginHorizontal: 8,
    // The quick links above already end in 10 of their own padding.
    marginTop: 2,
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
  },
  promptText: { fontSize: 15 },
});
