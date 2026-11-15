import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../../../theme/Text';
import { useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { ManageListingsPane } from '../../marketplace/ManageListingsEntry';
import { ProUpsellModal } from '../../pro/ProUpsell';
import { useGetUsageQuery } from '../../../api/apiService';
import { useColors } from '../../../hooks/useColors';
import { useIsPro } from '../../../hooks/useBrandColor';
import { LISTING_LIMIT_UPSELL, PILL_RADIUS, COLOR_BLACK } from '../../../constants/config';
import { FONT_INTER } from '../../../constants/fonts';
import type { SectionScreenProps } from '../types';

/**
 * Marketplace › My Listings — the "Your Listings" sheet's pane, as a screen.
 *
 * The same ManageListingsPane the sheet holds (listings, want ads and sold,
 * each row with messages, mark sold, still available, edit and delete), so
 * the two can't drift. Out of a sheet it can navigate straight away, so it
 * takes the pane's default navigate.
 *
 * Above it, the way to list something new — with the same allowance check the
 * browse's + makes: at the limit it's the pitch, not a form the server would
 * refuse.
 */
export default function MyListingsScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const nav = useNavigation<any>();
  const colors = useColors();
  const isPro = useIsPro();
  const { data: usage } = useGetUsageQuery(undefined, { skip: isPro });
  const allowance = !isPro && usage?.listings?.limit != null ? usage.listings : null;
  const [upsell, setUpsell] = useState(false);

  const onNew = () => (allowance?.reached ? setUpsell(true) : nav.navigate('ListingCreate', {}));

  const header = (
    <View style={styles.head}>
      <View style={styles.headText}>
        <Text style={[styles.title, { color: colors.fg }]}>Your Listings</Text>
        {/* A basic member's month, said where it's spent. */}
        {allowance ? (
          <Text style={[styles.sub, { color: colors.grey }]}>
            {allowance.used} of {allowance.limit} listings used this month
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={[styles.newBtn, { backgroundColor: colors.primaryAlt }]}
        onPress={onNew}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="New listing"
      >
        <Plus size={15} color={COLOR_BLACK} strokeWidth={3} />
        <Text style={styles.newText}>New</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <ManageListingsPane
        inset={{ top: headerPad, bottom: bottomPad }}
        onScroll={onScroll}
        header={header}
        emptyAction={{ label: 'List something', onPress: onNew }}
      />
      <ProUpsellModal
        visible={upsell}
        onClose={() => setUpsell(false)}
        title={LISTING_LIMIT_UPSELL.title}
        message={LISTING_LIMIT_UPSELL.message}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // The pane pads its sides by 12 already.
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, paddingHorizontal: 4 },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontFamily: FONT_INTER.bold, letterSpacing: -0.3 },
  sub: { fontSize: 12, marginTop: 2 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingLeft: 10, paddingRight: 13, paddingVertical: 8, borderRadius: PILL_RADIUS,
  },
  newText: { fontSize: 13, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
});
