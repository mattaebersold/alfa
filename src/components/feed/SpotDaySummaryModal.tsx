import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { Car, ChevronRight, CircleQuestionMark, Gavel, Target } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar, { type AvatarUser } from '../ui/Avatar';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import { useGetLoggedInUserQuery } from '../../api/apiService';
import { openSpotGame } from '../../constants/sourceApps';
import { GuessDots, HIT, MISS, MAX_ATTEMPTS, SimpleCrown, SpotHintBadge, winnerOf } from './SpotResultBody';
import {
  COMMON_RADIUS, PILL_RADIUS, COLOR_GRAY_10, COLOR_GRAY_22, COLOR_GRAY_38,
  COLOR_SHEEN_GOLD,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type {
  SpotDayAuction, SpotDayCar, SpotDayGames, SpotDayTrivia, SpotFeedToday, SpotGameKind,
} from '../../types/api';

const SPOT_ICON = require('../../../assets/apps/spot-icon.png');

export const SPOT_GAMES: {
  key: SpotGameKind;
  label: string;
  /** "Play today's …" */
  noun: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}[] = [
  { key: 'car', label: 'Name the Car', noun: 'car', Icon: Car },
  { key: 'trivia', label: 'Trivia', noun: 'trivia question', Icon: CircleQuestionMark },
  { key: 'auction', label: 'Auction', noun: 'auction', Icon: Gavel },
];

// ── How each game reads ──────────────────────────────────────────────────────

/** How full a game's ring is, 0–1: fewer guesses fill more, a right answer fills it, the score is the score. */
function fillOf(game: SpotGameKind, day: SpotDayGames): number | null {
  if (game === 'car') {
    const c = day.car;
    return c ? (c.won ? (MAX_ATTEMPTS + 1 - c.attempts) / MAX_ATTEMPTS : 0) : null;
  }
  if (game === 'trivia') return day.trivia ? (day.trivia.correct ? 1 : 0) : null;
  return day.auction ? Math.min(1, Math.max(0, day.auction.score / 100)) : null;
}

/** "Within 3%", "12% over", "8% under". */
function offLabel(a: SpotDayAuction): string | null {
  if (a.off_pct == null) return null;
  const pct = Math.abs(a.off_pct);
  const n = pct < 10 ? pct.toFixed(1).replace(/\.0$/, '') : Math.round(pct);
  if (a.bullseye) return `Within ${n}%`;
  return `${n}% ${a.off_pct > 0 ? 'over' : 'under'}`;
}

function triviaWinner(me: SpotDayTrivia, them: SpotDayTrivia): 'me' | 'them' | null {
  if (me.correct !== them.correct) return me.correct ? 'me' : 'them';
  if (!me.correct || me.time_ms == null || them.time_ms == null || me.time_ms === them.time_ms) return null;
  return me.time_ms < them.time_ms ? 'me' : 'them';
}

function auctionWinner(me: SpotDayAuction, them: SpotDayAuction): 'me' | 'them' | null {
  if (me.score === them.score) return null;
  return me.score > them.score ? 'me' : 'them';
}

const carGame = (c: SpotDayCar) => ({ won: c.won, attempts: c.attempts, time_ms: c.time_ms, hint_used: c.hint_used });

// ── Each game, side by side ──────────────────────────────────────────────────

/** "Play today's trivia question" — into Car Spotter, on that game. */
function PlayButton({ game }: { game: (typeof SPOT_GAMES)[number] }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={() => openSpotGame(game.key)}
      activeOpacity={0.8}
      accessibilityRole="link"
      style={[styles.playBtn, { borderColor: colors.borderDark }]}
    >
      <Image source={SPOT_ICON} style={styles.playIcon} contentFit="cover" />
      <Text style={[styles.playText, { color: colors.fg }]} numberOfLines={1}>Play today's {game.noun}</Text>
      <ChevronRight size={15} color={colors.muted} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

/** One person's line in a game: their face (crowned if they took it), whose it is, and how it went. */
function PlayerLine({ user, label, crowned, children }: {
  user?: AvatarUser | null; label: string; crowned: boolean; children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.line}>
      <View>
        <Avatar user={user ?? undefined} size={26} />
        {crowned ? (
          <View style={styles.crown} pointerEvents="none">
            <SimpleCrown size={14} color={COLOR_SHEEN_GOLD} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.lineName, { color: colors.muted }]} numberOfLines={1}>{label}</Text>
      <View style={styles.lineResult}>{children}</View>
    </View>
  );
}

function CarResult({ car }: { car: SpotDayCar }) {
  const colors = useColors();
  return (
    <>
      {car.hint_used ? <SpotHintBadge /> : null}
      <GuessDots won={car.won} attempts={car.attempts} grid={car.grid} />
      <Text style={[styles.figure, { color: car.won ? colors.fg : MISS }]}>
        {car.won ? `${car.attempts}/${MAX_ATTEMPTS}` : 'Stumped'}
      </Text>
    </>
  );
}

function TriviaResult({ trivia }: { trivia: SpotDayTrivia }) {
  const color = trivia.correct ? HIT : MISS;
  return (
    <View style={[styles.verdict, { backgroundColor: `${color}26`, borderColor: `${color}80` }]}>
      <Text style={[styles.verdictText, { color }]}>{trivia.correct ? '✓ Correct' : '✗ Wrong'}</Text>
    </View>
  );
}

function AuctionResult({ auction }: { auction: SpotDayAuction }) {
  const colors = useColors();
  const off = offLabel(auction);
  return (
    <>
      <View style={styles.auctionCol}>
        <View style={[styles.scoreTrack, { backgroundColor: COLOR_GRAY_38 }]}>
          <View style={[styles.scoreFill, { width: `${Math.max(2, auction.score)}%`, backgroundColor: auction.bullseye ? HIT : COLOR_SHEEN_GOLD }]} />
        </View>
        {off ? <Text style={[styles.offText, { color: auction.bullseye ? HIT : colors.muted }]}>{off}</Text> : null}
      </View>
      {auction.bullseye ? <Target size={14} color={HIT} strokeWidth={2.6} /> : null}
      <Text style={[styles.figure, { color: colors.fg }]}>{auction.score}</Text>
    </>
  );
}

function GameCard({ game, them, me, author, myUser, theirName }: {
  game: (typeof SPOT_GAMES)[number];
  them: SpotDayGames; me: SpotDayGames;
  author: AvatarUser; myUser?: AvatarUser | null; theirName: string;
}) {
  const colors = useColors();
  const k = game.key;

  let winner: 'me' | 'them' | null = null;
  if (k === 'car' && them.car && me.car) winner = winnerOf(carGame(me.car), carGame(them.car));
  if (k === 'trivia' && them.trivia && me.trivia) winner = triviaWinner(me.trivia, them.trivia);
  if (k === 'auction' && them.auction && me.auction) winner = auctionWinner(me.auction, them.auction);

  const result = (day: SpotDayGames) => (
    k === 'car' ? (day.car ? <CarResult car={day.car} /> : null)
      : k === 'trivia' ? (day.trivia ? <TriviaResult trivia={day.trivia} /> : null)
        : (day.auction ? <AuctionResult auction={day.auction} /> : null)
  );
  const iPlayed = fillOf(k, me) != null;

  return (
    <View style={[styles.game, { borderColor: colors.borderDark }]}>
      <View style={styles.gameHead}>
        <game.Icon size={15} color={colors.fg} strokeWidth={2.4} />
        <Text style={[styles.gameTitle, { color: colors.fg }]}>{game.label}</Text>
        {winner ? (
          <Text style={[styles.gameWinner, { color: COLOR_SHEEN_GOLD }]} numberOfLines={1}>
            {winner === 'me' ? 'You took it' : `${theirName} took it`}
          </Text>
        ) : null}
      </View>

      {/* Only cards for games they played are drawn — see the panel. */}
      <PlayerLine user={author} label={theirName} crowned={winner === 'them'}>
        {result(them)}
      </PlayerLine>

      {iPlayed ? (
        <PlayerLine user={myUser} label="You" crowned={winner === 'me'}>{result(me)}</PlayerLine>
      ) : (
        <View style={styles.playRow}><PlayButton game={game} /></View>
      )}
    </View>
  );
}

// ── The panel ────────────────────────────────────────────────────────────────

/**
 * A followed member's Car Spotter day, opened from the home feed's "played
 * today" row: each game side by side, with a way into the one you haven't
 * played yet.
 *
 * Spoiler-free like a shared result: no puzzle photo, no auction listing, no
 * trivia answer — only how each of you did.
 */
export default function SpotDaySummaryModal({ player, me, onClose, origin }: {
  player: SpotFeedToday['players'][number] | null;
  me: SpotDayGames | null;
  onClose: () => void;
  origin?: SummaryOrigin | null;
}) {
  const colors = useColors();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: myUser } = useGetLoggedInUserQuery(undefined, { skip: !myId });
  const mine: SpotDayGames = me ?? { car: null, trivia: null, auction: null };
  const user = player?.user;
  const name = user?.username || 'They';
  const shortName = user?.username
    ? (user.username.length > 12 ? `${user.username.slice(0, 12)}…` : user.username)
    : 'Them';

  return (
    <SummaryModal visible={!!player} onClose={onClose} origin={origin}>
      {player && user ? (
        <View style={styles.body}>
          <View style={styles.head}>
            <Avatar user={user} size={52} />
            <View style={styles.headText}>
              <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>{name}</Text>
              <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={2}>
                played the ORS Guessing Game today
              </Text>
            </View>
          </View>

          {/* Only the games they played — a game they skipped has nothing of
              theirs to compare against. */}
          {SPOT_GAMES.filter((g) => fillOf(g.key, player) != null).map((g) => (
            <GameCard key={g.key} game={g} them={player} me={mine} author={user} myUser={myUser} theirName={shortName} />
          ))}

        </View>
      ) : null}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingTop: 20, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 36 },
  headText: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, fontFamily: FONT_INTER.extrabold },
  sub: { fontSize: 13, fontFamily: FONT_INTER.semibold, marginTop: 1 },


  game: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: COMMON_RADIUS, backgroundColor: COLOR_GRAY_10,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  gameHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gameTitle: { fontSize: 14, fontFamily: FONT_INTER.bold },
  gameWinner: { marginLeft: 'auto', fontSize: 11, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  crown: { position: 'absolute', top: -7, left: -5, transform: [{ rotate: '-30deg' }] },
  lineName: { width: 84, fontSize: 12, fontFamily: FONT_INTER.semibold },
  lineResult: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  figure: { fontSize: 13, fontFamily: FONT_INTER.extrabold, minWidth: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
  verdict: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: PILL_RADIUS, borderWidth: StyleSheet.hairlineWidth },
  verdictText: { fontSize: 12, fontFamily: FONT_INTER.bold },
  auctionCol: { flex: 1, maxWidth: 120, gap: 3 },
  scoreTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 3 },
  offText: { fontSize: 10.5, fontFamily: FONT_INTER.semibold },

  playRow: { alignItems: 'flex-start' },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 6, paddingRight: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, backgroundColor: COLOR_GRAY_22, maxWidth: '100%',
  },
  playIcon: { width: 24, height: 24, borderRadius: 6 },
  playText: { flexShrink: 1, fontSize: 12.5, fontFamily: FONT_INTER.bold },
});

