import React, { useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, useWindowDimensions } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowUpRight, MessageCircle } from 'lucide-react-native';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import Spinner from '../../components/ui/Spinner';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { useGetConciergeRowsQuery, useGetPublicUserQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { imageUrl } from '../../utils/image';
import { ss } from '../../styles/shared';
import type { AppStackParamList } from '../../navigation/types';
import type { ConciergeRow, ConciergeService, ConciergePlatform } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK, COLOR_GRAY_22, GUTTER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * Concierge & auction services — what the society will do for a car that's
 * being sold, as rows the admin writes up on the web dashboard (horacio's
 * ConciergeRow), and a way to ask: a message to @matt with the subject set.
 *
 * The same page as the website's /concierge, built from the same rows.
 */

/** Who the "contact" button writes to. */
const CONCIERGE_USERNAME = 'matt';
const CONCIERGE_SUBJECT = 'Interested in auction services';

export const SERVICE_LABELS: Record<ConciergeService, string> = {
  detailing: 'Detailing',
  mechanical: 'Mechanical',
  photography: 'Photography',
  auction: 'Auction Management',
};
export const PLATFORM_LABELS: Record<ConciergePlatform, string> = {
  bat: 'Bring a Trailer',
  marketplace: 'Marketplace',
  cab: 'Cars & Bids',
};

/** The page's own photos, before any row's — the ones the website opens with. */
const INTRO_IMAGES = [
  require('../../../assets/concierge/1.jpg'),
  require('../../../assets/concierge/2.jpg'),
  require('../../../assets/concierge/3.jpg'),
  require('../../../assets/concierge/4.jpg'),
  require('../../../assets/concierge/5.jpg'),
];

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function RowCard({ row, width }: { row: ConciergeRow; width: number }) {
  const colors = useColors();
  const brand = useBrandColor();
  const photos = (row.gallery ?? []).map((g) => imageUrl(g.filename)).filter((u): u is string => !!u);
  // Each photo most of the card, so the next one peeks.
  const photoW = Math.round((width - 28) * (photos.length > 1 ? 0.82 : 1));
  return (
    <View style={[styles.card, { backgroundColor: COLOR_GRAY_22, borderColor: colors.borderDark }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.fg }]}>{row.title}</Text>
        {row.platform ? (
          <View style={[styles.platform, { borderColor: brand }]}>
            <Text style={[styles.platformText, { color: brand }]}>{PLATFORM_LABELS[row.platform]}</Text>
          </View>
        ) : null}
      </View>
      {row.services.length > 0 && (
        <View style={styles.bubbles}>
          {row.services.map((s) => (
            <View key={s} style={[styles.bubble, { backgroundColor: colors.segment }]}>
              <Text style={[styles.bubbleText, { color: colors.fg }]}>{SERVICE_LABELS[s] ?? s}</Text>
            </View>
          ))}
        </View>
      )}
      {row.description ? (
        <Text style={[styles.cardBody, { color: colors.muted }]}>{row.description}</Text>
      ) : null}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={photoW + 8}
          snapToAlignment="start"
          decelerationRate="fast"
          style={styles.photoStrip}
          contentContainerStyle={styles.photoRow}
        >
          {photos.map((uri, i) => (
            <Image key={`${uri}_${i}`} source={{ uri }} style={[styles.photo, { width: photoW }]} contentFit="cover" transition={150} />
          ))}
        </ScrollView>
      )}
      {row.url ? (
        <TouchableOpacity
          style={[styles.linkBtn, { backgroundColor: brand }]}
          onPress={() => Linking.openURL(row.url!).catch(() => {})}
          activeOpacity={0.85}
          accessibilityRole="link"
        >
          <Text style={[styles.linkText, { color: contrastText(brand) }]}>Learn more</Text>
          <ArrowUpRight size={16} color={contrastText(brand)} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function ConciergeScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<ScrollView>(null);
  useScrollTopOnBack(scrollRef);
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const brand = useBrandColor();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const { width } = useWindowDimensions();

  const { data, isLoading } = useGetConciergeRowsQuery();
  const rows = data?.entries ?? [];
  // Who to write to — looked up by name, so the id never has to live here.
  const { data: concierge } = useGetPublicUserQuery(CONCIERGE_USERNAME);

  const contact = () => navigation.navigate('ComposeMessage', {
    userId: concierge?.user_id,
    username: concierge?.username ?? CONCIERGE_USERNAME,
    subject: CONCIERGE_SUBJECT,
  });

  const introW = Math.round(width * 0.8);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: 48 }}
      >
        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.fg }]}>Concierge & Auction Services</Text>
          <Text style={[styles.lede, { color: colors.muted }]}>
            We'll help clean, prepare, detail, photograph and document cars for sale — and run the sale.
          </Text>
        </View>

        {/* The page's photos, edge to edge, the next one peeking. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={introW + 10}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.introStrip}
        >
          {INTRO_IMAGES.map((src, i) => (
            <Image key={i} source={src} style={[styles.introPhoto, { width: introW }]} contentFit="cover" />
          ))}
        </ScrollView>

        {/* Ask — above the rows and again below them, since the rows can run long. */}
        <TouchableOpacity
          style={[styles.contactBtn, { backgroundColor: brand }]}
          onPress={contact}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Contact me about auction services"
        >
          <MessageCircle size={18} color={contrastText(brand)} strokeWidth={2.4} />
          <Text style={[styles.contactText, { color: contrastText(brand) }]}>Contact me</Text>
        </TouchableOpacity>

        {isLoading ? (
          <Spinner />
        ) : (
          rows.map((row) => <RowCard key={row.internal_id} row={row} width={width} />)
        )}

        {rows.length > 0 && (
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: brand }]}
            onPress={contact}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Contact me about auction services"
          >
            <MessageCircle size={18} color={contrastText(brand)} strokeWidth={2.4} />
            <Text style={[styles.contactText, { color: contrastText(brand) }]}>Contact me</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  intro:      { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 6 },
  title:      { fontSize: 24, fontFamily: FONT_INTER.bold, lineHeight: 30 },
  lede:       { fontSize: 14, lineHeight: 20 },
  introStrip: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER + 4, paddingBottom: 14 },
  introPhoto: { aspectRatio: 3 / 2, borderRadius: COMMON_RADIUS, backgroundColor: COLOR_BLACK },

  contactBtn: {
    marginHorizontal: 16, marginVertical: 8, height: 48, borderRadius: COMMON_RADIUS,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  contactText: { fontSize: 15, fontFamily: FONT_INTER.bold },

  card: {
    marginHorizontal: 12, marginTop: 12, padding: 14, gap: 10,
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
  },
  cardHead:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle:  { flex: 1, minWidth: 0, fontSize: 18, fontFamily: FONT_INTER.bold, lineHeight: 24 },
  platform:   { borderWidth: 1, borderRadius: PILL_RADIUS, paddingHorizontal: 9, paddingVertical: 3, flexShrink: 0, marginTop: 2 },
  platformText: { fontSize: 11, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.3 },
  bubbles:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bubble:     { borderRadius: PILL_RADIUS, paddingHorizontal: 10, paddingVertical: 5 },
  bubbleText: { fontSize: 12, fontFamily: FONT_INTER.bold },
  cardBody:   { fontSize: 14, lineHeight: 20 },
  photoStrip: { marginHorizontal: -14 },
  photoRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  photo:      { aspectRatio: 3 / 2, borderRadius: 10, backgroundColor: COLOR_BLACK },
  linkBtn:    {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, height: 38, borderRadius: PILL_RADIUS,
  },
  linkText:   { fontSize: 13, fontFamily: FONT_INTER.bold },
});
