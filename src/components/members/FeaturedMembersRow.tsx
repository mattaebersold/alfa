import { useMemo } from 'react';
import {
  View, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { shuffle } from '../../utils/array';
import { useGetSiteSettingsQuery } from '../../api/apiService';
import RowEndSpacer from '../ui/RowEndSpacer';
import { GUTTER } from '../../constants/config';
import { type SummaryOrigin } from '../ui/SummaryModal';
import MemberCard from './MemberCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.6;
const CARD_GAP = 10;
/** The row's inset — the app's gutter, as the heading and tools above and below it. */
const ROW_PAD = GUTTER;

interface Props {
  /** `origin` is the card's rect, so a summary can grow out of it. */
  onMemberPress: (userId: string, username: string, origin: SummaryOrigin | null) => void;
}

export default function FeaturedMembersRow({ onMemberPress }: Props) {
  const { data } = useGetSiteSettingsQuery();
  // Shuffled per mount, for the same reason as the featured cars row — see
  // FeaturedCarsRow. Memoised on the data so it holds still while you scroll.
  const featured = data?.featured_users;
  const members = useMemo(() => shuffle(featured ?? []), [featured]);

  if (!members.length) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        pagingEnabled={false}
      >
        {members.map((member) => (
          <MemberCard
            key={member.user_id}
            member={member}
            featured
            style={styles.card}
            onPress={(origin) => onMemberPress(member.user_id, member.username, origin)}
          />
        ))}
        <RowEndSpacer width={ROW_PAD} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: on the page's own ground, not a black band across it.
  container:  { paddingTop: 2, paddingBottom: 4 },
  scroll:     { gap: CARD_GAP, paddingLeft: ROW_PAD },
  card:       { width: CARD_WIDTH },
});
