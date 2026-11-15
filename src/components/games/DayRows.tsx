import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { useBrandColor } from '../../hooks/useBrandColor';
import { imageUrl } from '../../utils/image';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_GRAY_160, COLOR_WHITE } from '../../constants/config';
import { MAX_ATTEMPTS, type AuctionDay, type CarDay, type CarGuess } from '../../types/games';
import HintBulb from './HintBulb';
import {
  GAME_CARD, GAME_INSET, HIT, HIT_SOFT, MISS, MISS_SOFT, answerLabel, auctionGrade, dayLabel, formatPrice,
} from './game';

/**
 * One day in a game's log (Past Games), ported from Car Spotter's DayRow,
 * ResultRow and GameDayRow: the date and result, then — once it's over —
 * what the car was or what the auction sold for. A day still to play keeps
 * them back behind "???" and a chevron.
 */

/** The result as squares — make then model per guess. */
function MiniGrid({ guesses, size = 9 }: { guesses: CarGuess[]; size?: number }) {
  const cell = { width: size, height: size, borderRadius: size / 4 };
  return (
    <View style={styles.grid}>
      {guesses.map((g, i) => (
        <View key={i} style={styles.gridRow}>
          <View style={[cell, { backgroundColor: g.make_correct ? HIT : MISS }]} />
          <View style={[cell, { backgroundColor: g.model_correct ? HIT : MISS }]} />
        </View>
      ))}
    </View>
  );
}

/** A small pill beside the date: "3/5" in green or red, or an auction's "7/10". */
function Pill({ label, bg, fg = COLOR_BLACK, a11y }: { label: string; bg: string; fg?: string; a11y?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} accessibilityLabel={a11y}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function Row({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
      {children}
    </Pressable>
  );
}

export function CarDayRow({ day, isToday, onPress }: { day: CarDay; isToday: boolean; onPress: () => void }) {
  const brand = useBrandColor();
  const { play } = day;
  const finished = !!play && play.status !== 'playing';
  const won = play?.status === 'won';
  const answer = finished ? answerLabel(day.answer ?? play?.answer) : null;
  const note = finished ? null
    : play ? `In progress · ${play.attempts}/${MAX_ATTEMPTS}`
    // A missed day says nothing more — the "???" and the chevron are enough.
    : isToday ? 'Play today’s car' : null;
  return (
    <Row onPress={onPress}>
      <View style={styles.copy}>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{isToday ? 'Today' : dayLabel(day.play_date, 'EEE, MMM d')}</Text>
          {finished && play ? (
            <Pill
              label={`${play.attempts}/${MAX_ATTEMPTS}`}
              bg={won ? HIT_SOFT : MISS_SOFT}
              a11y={won ? `Won in ${play.attempts} of ${MAX_ATTEMPTS}` : 'Stumped'}
            />
          ) : null}
          {finished && play?.hint_used ? <HintBulb size={14} /> : null}
          {finished && play?.late ? <Text style={styles.tag}>caught up</Text> : null}
        </View>
        {answer ? (
          <View style={styles.answerRow}>
            {day.puzzle?.image ? (
              <Image source={{ uri: imageUrl(day.puzzle.image, 'thumb') ?? undefined }} style={styles.thumb} contentFit="cover" />
            ) : null}
            <Text style={[styles.main, styles.answerText]} numberOfLines={2}>{answer}</Text>
          </View>
        ) : (
          <Text style={[styles.main, styles.unknown]}>???</Text>
        )}
        {note ? <Text style={[styles.note, { color: brand }]}>{note}</Text> : null}
      </View>
      {finished && play ? <MiniGrid guesses={play.guesses} /> : <ChevronRight size={20} color="#666666" />}
    </Row>
  );
}

export function AuctionDayRow({ day, isToday, onPress }: { day: AuctionDay; isToday: boolean; onPress: () => void }) {
  const brand = useBrandColor();
  const { play, puzzle } = day;
  return (
    <Row onPress={onPress}>
      {play && puzzle.images?.[0] ? (
        <Image source={{ uri: imageUrl(puzzle.images[0], 'thumb') ?? undefined }} style={styles.auctionThumb} contentFit="cover" />
      ) : null}
      <View style={styles.copy}>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{isToday ? 'Today' : dayLabel(day.play_date, 'EEE, MMM d')}</Text>
          {play ? <Pill label={`${auctionGrade(play.score, play.bullseye)}/10`} bg="#3C3C3C" fg={COLOR_WHITE} /> : null}
          {play?.late ? <Text style={styles.tag}>caught up</Text> : null}
        </View>
        {play ? (
          <Text style={styles.main} numberOfLines={2}>{`${puzzle.title} · ${formatPrice(play.answer?.price)}`}</Text>
        ) : (
          <>
            {/* The title's no spoiler — the price is the puzzle. */}
            <Text style={styles.main} numberOfLines={2}>{puzzle.title}</Text>
            {isToday ? <Text style={[styles.note, { color: brand }]}>Guess today’s price</Text> : null}
          </>
        )}
      </View>
      <ChevronRight size={20} color="#666666" />
    </Row>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: GAME_CARD, borderRadius: COMMON_RADIUS, padding: 12, paddingHorizontal: 14,
  },
  pressed: { opacity: 0.7 },
  copy: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { color: COLOR_GRAY_160, fontSize: 12, fontWeight: '600' },
  tag: { color: COLOR_GRAY_160, fontSize: 12, fontWeight: '500' },
  main: { color: COLOR_WHITE, fontSize: 15, fontWeight: '600', marginTop: 4 },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  answerText: { flex: 1, marginTop: 0 },
  unknown: { color: '#666666' },
  note: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  thumb: { width: 40, height: 30, borderRadius: 6, backgroundColor: GAME_INSET },
  auctionThumb: { width: 56, height: 42, borderRadius: 8, backgroundColor: GAME_INSET },
  pill: { height: 20, justifyContent: 'center', borderRadius: 10, paddingHorizontal: 8 },
  pillText: { fontSize: 11.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  grid: { gap: 3 },
  gridRow: { flexDirection: 'row', gap: 3 },
});
