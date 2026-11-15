import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, FlatList, Pressable, StyleSheet, Alert, RefreshControl, Linking, Dimensions, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ArrowUpRight, CalendarDays } from 'lucide-react-native';
import { Text, TextInput } from '../../theme/Text';
import FormScrollView, { KEYBOARD_GAP } from '../../keyboard/FormScrollView';
import Button from '../ui/Button';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { usePlayAuctionGameMutation } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { COMMON_RADIUS } from '../../constants/config';
import type { AuctionPlay, AuctionPuzzle } from '../../types/games';
import Stopwatch, { useStopwatchStart } from './Stopwatch';
import PriceMeter from './PriceMeter';
import {
  GAME_BG, GAME_CARD, GAME_GUTTER as GUTTER, GAME_INSET, auctionGrade, dayLabel, formatElapsed, formatPrice, gradeWord,
} from './game';

const SOURCE_NAMES: Record<AuctionPuzzle['source'], string | null> = {
  bat: 'Bring a Trailer',
  carsandbids: 'Cars & Bids',
  other: null,
};

/** The pinned footer's height above the safe area: the field-and-button row and its padding. */
const FOOTER_H = 12 + 46 + 4;

const PHOTO_W = Dimensions.get('window').width;
const PHOTO_H = Math.round(PHOTO_W * (2 / 3));

/**
 * The listing's photos (up to three), edge to edge, a swipe apiece — with a
 * dot for each so you know there's more. The rest load behind the cover, so
 * a swipe never lands on a blank. `onReady` once the cover is on screen
 * (or has failed to load).
 */
function Photos({ images, onReady }: { images: string[]; onReady: () => void }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    const rest = images.slice(1).map((img) => imageUrl(img)).filter((u): u is string => !!u);
    if (rest.length) Image.prefetch(rest).catch(() => {});
  }, [images]);
  return (
    <View style={styles.photos}>
      <FlatList
        data={images}
        keyExtractor={(img, i) => `${i}:${img}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / PHOTO_W))}
        renderItem={({ item, index }) => (
          <Image
            source={{ uri: imageUrl(item) ?? undefined }}
            style={{ width: PHOTO_W, height: PHOTO_H, backgroundColor: GAME_INSET }}
            contentFit="cover"
            transition={150}
            onLoad={index === 0 ? onReady : undefined}
            onError={index === 0 ? onReady : undefined}
            accessibilityIgnoresInvertColors
          />
        )}
      />
      {images.length > 1 ? (
        <View style={styles.photoDots} pointerEvents="none" accessibilityLabel={`Photo ${at + 1} of ${images.length}`}>
          {images.map((img, i) => (
            <View key={`${i}:${img}`} style={[styles.photoDot, i === at && styles.photoDotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A number from 0 to 1 for `seed`, the same every time — so the blocks don't shimmer on a re-render. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Where the price goes, pixelated: blocks of grey in roughly the shape of a
 * price, and nothing more. It's drawn, not blurred — the price isn't on the
 * phone until you've guessed, so there's nothing under it to read.
 */
function HiddenPrice({ seed }: { seed: string }) {
  const cols = 15;
  return (
    <View style={styles.pixels} accessibilityLabel="Price hidden until you guess">
      {[0, 1].map((r) => (
        <View key={r} style={styles.pixelRow}>
          {Array.from({ length: cols }, (_, c) => {
            const gap = c === 0 || c === 4 || c === 8 ? 0.6 : 0;
            const shade = 40 + Math.round(seeded(`${seed}:${r}:${c}`) * 90 * (1 - gap));
            return <View key={c} style={[styles.pixel, { backgroundColor: `rgb(${shade},${shade},${shade})` }]} />;
          })}
        </View>
      ))}
    </View>
  );
}

/** Digits only, grouped as they're typed: "210000" → "210,000". */
const groupDigits = (raw: string) => {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10);
  return digits ? Number(digits).toLocaleString('en-US') : '';
};

/**
 * How close it came, after: the 1–10 grade and a word for it, the guess and
 * how far off it was, and the two prices on one meter (PriceMeter).
 */
function Result({ play, timeMs }: { play: AuctionPlay; timeMs: number | null }) {
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  const answer = play.answer;
  const off = play.off_pct ?? null;
  const grade = auctionGrade(play.score, play.bullseye);
  return (
    <View style={styles.result}>
      <View style={styles.gradeRow}>
        <View style={styles.gradeLine}>
          <Text style={styles.grade}>{grade}</Text>
          <Text style={styles.gradeOf}>/10</Text>
        </View>
        <View style={styles.gradeCopy}>
          <View style={[styles.gradeBadge, { backgroundColor: brand }]}>
            <Text style={[styles.gradeBadgeText, { color: brandText }]}>{gradeWord(grade)}</Text>
          </View>
          <Text style={styles.offLine}>
            {`You guessed ${formatPrice(play.guess)}`}
            {off != null ? (off === 0 ? ' — right on the price' : ` · ${Math.abs(off)}% ${off < 0 ? 'under' : 'over'}`) : ''}
          </Text>
        </View>
        {timeMs ? <Text style={styles.resultTime}>{formatElapsed(timeMs)}</Text> : null}
      </View>
      {answer?.price ? (
        <PriceMeter guess={play.guess} price={answer.price} grade={grade} sold={answer.sold !== false} />
      ) : null}
      {answer?.sold === false ? <Text style={styles.offLine}>It didn’t sell — the reserve wasn’t met.</Text> : null}
    </View>
  );
}

/**
 * The day's auction, played: the listing's photos, its title and facts and
 * the day it ended, the price pixelated out, and a field pinned to the bottom
 * for your guess. One guess — then the price, how close you came, and a link
 * to the listing.
 *
 * Today's and a past day's from the log are the same game.
 */
export default function AuctionGame({
  puzzle, play, onStale, above, refreshing, onRefresh, timed = false, children, doneFooter,
}: {
  puzzle: AuctionPuzzle;
  play: AuctionPlay | null;
  onStale: () => void;
  above?: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  timed?: boolean;
  children?: React.ReactNode;
  doneFooter?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const brand = useBrandColor();
  const [send, { isLoading }] = usePlayAuctionGameMutation();
  const [text, setText] = useState('');
  const guessed = !!play;
  const overOnArrival = useRef(guessed).current;
  const scrollRef = useRef<any>(null);
  // A guess made here: the keyboard goes, and the page runs down to the
  // result once the photo has made way for it.
  useEffect(() => {
    if (!guessed || overOnArrival) return;
    Keyboard.dismiss();
    const t = setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 250);
    return () => clearTimeout(t);
  }, [guessed, overOnArrival]);
  // The clock waits for the cover photo, so a slow connection costs no time.
  // A listing with no photos has nothing to wait for.
  const [photoShown, setPhotoShown] = useState(puzzle.images.length === 0);
  const onPhotoReady = useCallback(() => setPhotoShown(true), []);
  // Until the guess is in, every visit starts at 0:00 again, like the car
  // before its first guess.
  const clockStart = useStopwatchStart(`auction_${puzzle.play_date}`, timed && photoShown && !overOnArrival, true);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [doneFooterH, setDoneFooterH] = useState(0);
  const footerH = guessed ? (doneFooter ? doneFooterH : 0) : FOOTER_H;
  const value = Number(text.replace(/\D/g, ''));

  const submit = async () => {
    if (!value) return;
    const elapsed = timed && clockStart != null ? Date.now() - clockStart : undefined;
    try {
      const next = (await send({ play_date: puzzle.play_date, guess: value, elapsed_ms: elapsed }).unwrap()).play;
      if (elapsed != null) setEndedAt(elapsed);
      Haptics.notificationAsync(next.score >= 75
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } catch (err: any) {
      Alert.alert('Error', err?.data?.error || "That guess didn't go through. Please try again.");
      onStale();
    }
  };

  const source = SOURCE_NAMES[puzzle.source] ?? null;
  // Where it was and who sold it aren't part of the game.
  const facts = puzzle.facts.filter((f) => !/^(location|seller)$/i.test(f.label ?? ''));
  const labelled = facts.filter((f) => f.label);
  const lines = facts.filter((f) => !f.label);
  const url = play?.answer?.url;

  return (
    <View style={styles.screen}>
      <FormScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + footerH + 16 }]}
        bottomOffset={KEYBOARD_GAP + footerH}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      >
        {above}
        {/* The photo's the clue while guessing; after, it shrinks beside the title. */}
        {!guessed && puzzle.images.length ? <Photos images={puzzle.images} onReady={onPhotoReady} /> : null}

        <View style={styles.heading}>
          <View style={styles.titleRow}>
            {guessed && puzzle.images[0] ? (
              <Image
                source={{ uri: imageUrl(puzzle.images[0]) ?? undefined }}
                style={styles.thumb}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <View style={styles.titleCopy}>
              <Text style={styles.title}>{puzzle.title}</Text>
              {puzzle.subtitle ? <Text style={styles.subtitle}>{puzzle.subtitle}</Text> : null}
            </View>
          </View>
          <View style={styles.metaRow}>
            {puzzle.ended_on ? (
              <View style={styles.metaPill}>
                <CalendarDays size={13} color="#E0E0E0" />
                <Text style={styles.metaText}>{`Ended ${dayLabel(puzzle.ended_on, 'MMM d, yyyy')}`}</Text>
              </View>
            ) : null}
            {source ? <View style={styles.metaPill}><Text style={styles.metaText}>{source}</Text></View> : null}
            {puzzle.sold === false ? (
              <View style={styles.metaPill}><Text style={styles.metaText}>Reserve not met</Text></View>
            ) : puzzle.sold ? (
              <View style={styles.metaPill}><Text style={styles.metaText}>Sold</Text></View>
            ) : null}
            {timed && !guessed ? <View style={styles.clock}><Stopwatch start={clockStart} /></View> : null}
          </View>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>
            {(guessed ? play.answer?.sold : puzzle.sold) === false ? 'High bid · reserve not met' : 'Sold for'}
          </Text>
          {guessed ? <Text style={styles.price}>{formatPrice(play.answer?.price)}</Text> : <HiddenPrice seed={puzzle.internal_id} />}
        </View>

        {guessed ? <Result play={play} timeMs={play.time_ms ?? endedAt} /> : null}

        {guessed && url ? (
          <Pressable
            onPress={() => Linking.openURL(url).catch(() => {})}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            accessibilityRole="link"
          >
            <Text style={styles.linkText}>{`See the auction${source ? ` on ${source}` : ''}`}</Text>
            <ArrowUpRight size={14} color="#A0A0A0" />
          </Pressable>
        ) : null}

        {/* Once guessed: the record, right under the result. */}
        {guessed ? <View style={styles.finished}>{children}</View> : null}

        {/* The listing's specs are clues — gone once the guess is in. */}
        {!guessed && (labelled.length || lines.length) ? (
          <View style={styles.facts}>
            {labelled.map((f, i) => (
              <View key={`l${i}`} style={styles.factRow}>
                <Text style={styles.factLabel}>{f.label}</Text>
                <Text style={styles.factValue}>{f.value}</Text>
              </View>
            ))}
            {lines.map((f, i) => (
              <View key={`v${i}`} style={styles.lineRow}>
                <View style={styles.dot} />
                <Text style={styles.lineText}>{f.value}</Text>
              </View>
            ))}
          </View>
        ) : null}


      </FormScrollView>

      {guessed && doneFooter ? (
        <View
          style={[styles.footerWrap, styles.footer, styles.doneFooter, { paddingBottom: insets.bottom + 8 }]}
          onLayout={(e) => setDoneFooterH(e.nativeEvent.layout.height - insets.bottom)}
        >
          {doneFooter}
        </View>
      ) : null}

      {!guessed ? (
        <KeyboardStickyView style={styles.footerWrap} offset={{ closed: 0, opened: insets.bottom }}>
          <View style={[styles.footer, styles.guessFooter, { paddingBottom: insets.bottom + 4 }]}>
            <View style={[styles.field, text ? { borderColor: brand } : null]}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                value={text}
                onChangeText={(t) => setText(groupDigits(t))}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={submit}
                style={styles.input}
                maxLength={13}
                accessibilityLabel="Your price guess, in dollars"
              />
            </View>
            <View style={styles.buttonCol}>
              <Button
                label="Guess"
                variant="dark"
                size="full"
                onPress={submit}
                disabled={!value}
                loading={isLoading}
              />
            </View>
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GAME_BG },
  content: { paddingHorizontal: GUTTER, gap: 14 },
  photos: { marginHorizontal: -GUTTER },
  photoDots: {
    position: 'absolute', alignSelf: 'center', bottom: 10, flexDirection: 'row', gap: 6,
    paddingHorizontal: 8, height: 18, borderRadius: 9, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  photoDotOn: { backgroundColor: '#FFFFFF' },
  heading: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleCopy: { flex: 1, minWidth: 0, gap: 4 },
  thumb: { width: 84, height: 56, borderRadius: 8, backgroundColor: GAME_INSET },
  title: { color: '#FFFFFF', fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { color: '#A0A0A0', fontSize: 14, lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10,
    borderRadius: 13, backgroundColor: GAME_CARD,
  },
  metaText: { color: '#E0E0E0', fontSize: 12, fontWeight: '600' },
  clock: { marginLeft: 'auto' },
  priceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    backgroundColor: GAME_CARD, borderRadius: COMMON_RADIUS, paddingHorizontal: 16, paddingVertical: 14,
  },
  priceLabel: { color: '#A0A0A0', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pixels: { gap: 2 },
  pixelRow: { flexDirection: 'row', gap: 2 },
  pixel: { width: 9, height: 13, borderRadius: 1 },
  result: { backgroundColor: GAME_INSET, borderRadius: COMMON_RADIUS, padding: 16, gap: 10 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gradeCopy: { flex: 1, minWidth: 0, gap: 2 },
  gradeLine: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  grade: { color: '#FFFFFF', fontSize: 44, lineHeight: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  gradeOf: { color: '#A0A0A0', fontSize: 18, fontWeight: '700' },
  gradeBadge: { alignSelf: 'flex-start', height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center', marginBottom: 3 },
  gradeBadgeText: { fontSize: 13, fontWeight: '800' },
  resultTime: { color: '#A0A0A0', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], alignSelf: 'flex-start' },
  compare: { flexDirection: 'row', gap: 12, marginTop: 2 },
  compareCol: { flex: 1, gap: 2 },
  compareLabel: { color: '#A0A0A0', fontSize: 12, fontWeight: '600' },
  compareValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  offLine: { color: '#E0E0E0', fontSize: 13, fontWeight: '600' },
  facts: { backgroundColor: GAME_INSET, borderRadius: COMMON_RADIUS, padding: 14, gap: 8 },
  factRow: { flexDirection: 'row', gap: 12 },
  factLabel: { width: 84, color: '#A0A0A0', fontSize: 13, fontWeight: '600' },
  factValue: { flex: 1, color: '#FFFFFF', fontSize: 14 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#666666', marginTop: 8 },
  lineText: { flex: 1, color: '#E0E0E0', fontSize: 14, lineHeight: 20 },
  link: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)',
  },
  linkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  pressed: { opacity: 0.7 },
  finished: { gap: 16 },
  footerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 12, backgroundColor: GAME_BG },
  // The price and its button side by side.
  guessFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneFooter: { gap: 10 },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 23, paddingHorizontal: 16,
    backgroundColor: GAME_CARD, borderWidth: 1.5, borderColor: '#3A3A3A',
  },
  dollar: { color: '#A0A0A0', fontSize: 18, fontWeight: '700', marginRight: 4 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'], paddingVertical: 0 },
  buttonCol: { width: 110 },
});
