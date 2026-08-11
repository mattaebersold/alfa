import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, FlatList,
  StatusBar, SafeAreaView as RNSafeAreaView, type ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, ChevronRight } from 'lucide-react-native';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { useGetPublicUserQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { ss } from '../../styles/shared';
import { HISTORY_IMAGES } from './historyImages';
import YouTubeEmbed from '../../components/ui/YouTubeEmbed';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Two-column mosaic — the gutter is applied on both sides and between columns.
const MOSAIC_GUTTER = 8;
const MOSAIC_COL_WIDTH = (SCREEN_WIDTH - MOSAIC_GUTTER * 3) / 2;

const PARAGRAPHS = [
  "The Open Road Society is an online home for car enthusiasts. We created a digital garage and community based in the northwest that lets you access local groups, meets, and drives. Creating your digital garage allows you to maintain historical records for your cars, as well as share mods, restorations, and photo shoots with your group of friends.",
  'We also curate a marketplace focused solely on cars and parts, where you can list rare and hard to find parts for sale, list cars for sale, and create want-ads for others to see.',
  "Sharing enthusiasm for car culture is at the heart of what the society is all about. We want to cut through the never-ending online noise and create a simple, focused, and dedicated space to spend time with friends who give a damn about the same thing.",
];

const ABOUT_VIDEO_ID = 'rj5X9UIuzJs';

const PULL_QUOTE = "If we don't drive together, then we're going to die alone.";

const FOUNDERS: {
  name: string; username: string; role: string; image: ImageSourcePropType; bio: string; blankCheck: string;
}[] = [
  {
    name: 'Matt',
    username: 'matt',
    role: 'Founder',
    image: require('../../../assets/about/matt.jpg'),
    bio: 'Obsessed ever since being a 6 year old in a theatre watching Back to the Future. Porsche blood in my veins. Style over speed. Pop up headlights forever.',
    blankCheck: 'Porsche GT1, DeLorean',
  },
  {
    name: 'Jessica',
    username: 'jessica',
    role: 'Founder',
    image: require('../../../assets/about/jessica.jpg'),
    bio: "I am a girl born to a car dad, and who married a car guy. I've always liked driving things that made me happy, and who wants to drive boring cars?",
    blankCheck: 'Land Rover Defender 110 in Alpine White',
  },
];

/* ─── Founder block — photo and copy stack, alternating photo/text order ─── */

function FounderBlock({ founder, flipped }: { founder: (typeof FOUNDERS)[number]; flipped: boolean }) {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation();
  // Profiles are addressed by user_id, so the username has to be resolved first.
  const { data: profile } = useGetPublicUserQuery(founder.username);

  const photo = (
    <Image
      key="photo"
      source={founder.image}
      style={styles.founderPhoto}
      contentFit="cover"
      transition={200}
    />
  );

  const copy = (
    <View key="copy" style={styles.founderCopy}>
      <Text style={[styles.founderName, { color: colors.fg }]}>{founder.name}</Text>
      <View style={[styles.roleBadge, { backgroundColor: brand }]}>
        <Text style={styles.roleBadgeText}>{founder.role}</Text>
      </View>
      {profile?.user_id && (
        <TouchableOpacity
          style={styles.profileLink}
          onPress={() => (nav as any).navigate('UserDetail', { userId: profile.user_id, username: profile.username })}
          activeOpacity={0.7}
        >
          <Text style={[styles.profileLinkText, { color: brand }]}>View Profile</Text>
          <ChevronRight size={14} color={brand} />
        </TouchableOpacity>
      )}
      <Text style={[styles.body, { color: colors.muted }]}>{founder.bio}</Text>
      <Text style={[styles.blankCheck, { color: colors.grey }]}>
        Blank Check Cars: <Text style={{ color: colors.fg, fontWeight: '800' }}>{founder.blankCheck}</Text>
      </Text>
    </View>
  );

  return (
    <View style={[styles.founderBlock, { backgroundColor: colors.card }]}>
      {flipped ? [copy, photo] : [photo, copy]}
    </View>
  );
}

/* ─── Full-screen viewer for the history photos ─── */

function Lightbox({ index, onClose }: { index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index);

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <RNSafeAreaView style={styles.lightboxSafe}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.lightboxHeader}>
          <Text style={styles.lightboxCount}>{current + 1} / {HISTORY_IMAGES.length}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.lightboxClose}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={HISTORY_IMAGES}
          keyExtractor={(_item, i) => `history-${i}`}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_d, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
          renderItem={({ item }) => (
            <Image
              source={item}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 120 }}
              contentFit="contain"
            />
          )}
        />
      </RNSafeAreaView>
    </Modal>
  );
}

/* ─── Mosaic — two columns, each photo keeping its own aspect ratio ─── */

function HistoryMosaic({ onOpen }: { onOpen: (index: number) => void }) {
  const colors = useColors();
  // Filled in as each photo reports its dimensions, so heights stagger like a
  // pinterest grid instead of locking to one ratio.
  const [ratios, setRatios] = useState<Record<number, number>>({});

  // Alternating columns keeps the two sides close in length without needing
  // every photo measured up front.
  const columns: number[][] = [[], []];
  HISTORY_IMAGES.forEach((_img, i) => columns[i % 2].push(i));

  return (
    <View style={styles.mosaic}>
      {columns.map((col, colIdx) => (
        <View key={colIdx} style={styles.mosaicCol}>
          {col.map((i) => (
            <TouchableOpacity
              key={i}
              onPress={() => onOpen(i)}
              activeOpacity={0.85}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Open photo ${i + 1} of ${HISTORY_IMAGES.length}`}
            >
              <Image
                source={HISTORY_IMAGES[i]}
                style={[
                  styles.mosaicImg,
                  { aspectRatio: ratios[i] ?? 3 / 4, backgroundColor: colors.segment },
                ]}
                contentFit="cover"
                transition={200}
                onLoad={(e) => {
                  const { width, height } = e.source ?? {};
                  if (width && height) setRatios((prev) => (prev[i] ? prev : { ...prev, [i]: width / height }));
                }}
              />
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ─── Screen ─── */

export default function AboutScreen() {
  const colors = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Marquee — runs to the top of the screen, under the floating header. */}
        <View style={styles.marquee}>
          <Image
            source={require('../../../assets/about/banner.jpg')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
            style={styles.marqueeScrim}
            pointerEvents="none"
          />
        </View>

        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.fg }]}>About the Open Road Society</Text>
          {PARAGRAPHS.map((p, i) => (
            <Text key={i} style={[styles.body, { color: colors.muted }]}>{p}</Text>
          ))}
          <Text style={[styles.quote, { color: colors.fg }]}>{PULL_QUOTE}</Text>
        </View>

        <View style={styles.video}>
          <YouTubeEmbed videoId={ABOUT_VIDEO_ID} />
        </View>

        {FOUNDERS.map((f, i) => (
          <FounderBlock key={f.name} founder={f} flipped={i % 2 === 1} />
        ))}

        <View style={styles.historyHead}>
          <Text style={[styles.sectionTitle, { color: colors.fg }]}>Our history</Text>
          <Text style={[styles.sectionSub, { color: colors.grey }]}>
            Meets, drives, and the people who showed up — a look back at where the society came from.
          </Text>
        </View>

        <HistoryMosaic onOpen={setLightboxIndex} />
      </ScrollView>

      {lightboxIndex !== null && (
        <Lightbox index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:  { paddingBottom: 48 },

  marquee:       { width: '100%', aspectRatio: 3 / 4, maxHeight: SCREEN_HEIGHT * 0.6 },
  marqueeScrim:  { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },

  intro:   { paddingHorizontal: 16, paddingTop: 20, gap: 14 },
  title:   { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  body:    { fontSize: 15, lineHeight: 22 },
  quote:   { fontSize: 16, lineHeight: 23, fontWeight: '700', fontStyle: 'italic' },

  founderBlock: {
    marginTop: 24, marginHorizontal: 12,
    borderRadius: 14, overflow: 'hidden',
  },
  founderPhoto: { width: '100%', aspectRatio: 4 / 3 },
  founderCopy:  { padding: 16, gap: 10 },
  founderName:  { fontSize: 22, fontWeight: '800' },
  roleBadge:    {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  roleBadgeText: {
    fontSize: 11, fontWeight: '800', color: '#000000',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  blankCheck: { fontSize: 13 },
  profileLink:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: -2 },
  profileLinkText: { fontSize: 14, fontWeight: '800' },

  video:       { marginBottom: 24 },
  historyHead: { paddingHorizontal: 16, paddingTop: 36, paddingBottom: 12, gap: 4 },
  sectionTitle:{ fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  sectionSub:  { fontSize: 13, lineHeight: 19 },

  mosaic:    { flexDirection: 'row', gap: MOSAIC_GUTTER, paddingHorizontal: MOSAIC_GUTTER },
  mosaicCol: { width: MOSAIC_COL_WIDTH, gap: MOSAIC_GUTTER },
  mosaicImg: { width: '100%', borderRadius: 10 },

  lightboxSafe:   { flex: 1, backgroundColor: '#000000' },
  lightboxHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  lightboxCount:  { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  lightboxClose:  { padding: 4 },
});
