import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../theme/Text';
import { Car, ChevronRight, Gavel, Target } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import { useColors } from '../../hooks/useColors';
import { colors as palette } from '../../constants/colors';
import { openDailyGames } from '../games/openDailyGames';
import { GuessDots, HIT, MISS, MAX_ATTEMPTS, SimpleCrown, SpotHintBadge, winnerOf } from './SpotResultBody';
import {
  COMMON_RADIUS, COLOR_GRAY_38,
  COLOR_SHEEN_GOLD, SURFACE_BLACK, SURFACE_MID
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type {
  SpotDayAuction, SpotDayCar, SpotDayGames, SpotFeedToday, SpotGameKind,
} from '../../types/api';

export const SPOT_GAMES: {
  key: SpotGameKind;
  label: string;
  /** "Play today's …" */
  noun: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}[] = [
  { key: 'car', label: 'Guess the Car', noun: 'car', Icon: Car },
  { key: 'auction', label: 'Guess the Price', noun: 'auction', Icon: Gavel },
];

// ── How each game reads ──────────────────────────────────────────────────────

/** How full a game's ring is, 0–1: fewer guesses fill more, the score is the score. */
function fillOf(game: SpotGameKind, day: SpotDayGames): number | null {
  if (game === 'car') {
    const c = day.car;
    return c ? (c.won ? (MAX_ATTEMPTS + 1 - c.attempts) / MAX_ATTEMPTS : 0) : null;
  }
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

function auctionWinner(me: SpotDayAuction, them: SpotDayAuction): 'me' | 'them' | null {
  if (me.score === them.score) return null;
  return me.score > them.score ? 'me' : 'them';
}

const carGame = (c: SpotDayCar) => ({ won: c.won, attempts: c.attempts, time_ms: c.time_ms, hint_used: c.hint_used });

// ── Each game, side by side ──────────────────────────────────────────────────

/** "Play today's auction" — the PRO tab's Daily Games. */
function PlayButton({ game }: { game: (typeof SPOT_GAMES)[number] }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={openDailyGames}
      activeOpacity={0.8}
      accessibilityRole="link"
      style={[styles.playBtn, { borderColor: colors.borderDark }]}
    >
      <View style={styles.playIcon}>
        <game.Icon size={14} color={palette.pro} strokeWidth={2.4} />
      </View>
      <Text style={[styles.playText, { color: colors.fg }]} numberOfLines={1}>Play today's {game.noun}</Text>
      <ChevronRight size={15} color={colors.muted} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

/**
 * One person's line in a game: how it went, then a crown if they took it. No
 * face or name — theirs is the first line and yours the second, and the
 * card's head says who took it.
 */
function PlayerLine({ crowned, label, children }: {
  crowned: boolean; label: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.line} accessible accessibilityLabel={label}>
      <View style={styles.lineResult}>
        {children}
        {/* After the result, so both lines start level. */}
        {crowned ? <SimpleCrown size={14} color={COLOR_SHEEN_GOLD} /> : null}
      </View>
    </View>
  );
}

export function CarResult({ car }: { car: SpotDayCar }) {
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

export function AuctionResult({ auction }: { auction: SpotDayAuction }) {
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

function GameCard({ game, them, me, theirName, self = false }: {
  game: (typeof SPOT_GAMES)[number];
  them: SpotDayGames; me: SpotDayGames;
  theirName: string;
  /** Your own day: one line per game, nobody to beat. */
  self?: boolean;
}) {
  const colors = useColors();
  const k = game.key;

  let winner: 'me' | 'them' | null = null;
  // Your own day has no one to beat.
  if (!self && k === 'car' && them.car && me.car) winner = winnerOf(carGame(me.car), carGame(them.car));
  if (!self && k === 'auction' && them.auction && me.auction) winner = auctionWinner(me.auction, them.auction);

  const result = (day: SpotDayGames) => (
    k === 'car' ? (day.car ? <CarResult car={day.car} /> : null)
      : (day.auction ? <AuctionResult auction={day.auction} /> : null)
  );
  const iPlayed = fillOf(k, me) != null;

  return (
    <View style={[styles.game, { borderColor: colors.borderDark }]}>
      <View style={styles.gameHead}>
        <game.Icon size={19} color={colors.fg} strokeWidth={2.2} />
        <Text style={[styles.gameTitle, { color: colors.fg }]}>{game.label}</Text>
        {winner ? (
          <Text style={[styles.gameWinner, { color: COLOR_SHEEN_GOLD }]} numberOfLines={1}>
            {winner === 'me' ? 'You took it' : `${theirName} took it`}
          </Text>
        ) : null}
      </View>

      {/* Only cards for games they played are drawn — see the panel. */}
      <PlayerLine label={theirName} crowned={winner === 'them'}>
        {result(them)}
      </PlayerLine>

      {self ? null : iPlayed ? (
        <PlayerLine label="You" crowned={winner === 'me'}>{result(me)}</PlayerLine>
      ) : (
        <View style={styles.playRow}><PlayButton game={game} /></View>
      )}
    </View>
  );
}

// ── The panel ────────────────────────────────────────────────────────────────

/**
 * A Pro member's Daily Games day, opened from the home feed's "played
 * today" row: each game side by side, with a way into the one you haven't
 * played yet.
 *
 * Spoiler-free like a shared result: no puzzle photo, no auction listing, no
 * trivia answer — only how each of you did.
 */
export default function SpotDaySummaryModal({ player, me, onClose, origin, self = false }: {
  player: SpotFeedToday['players'][number] | null;
  me: SpotDayGames | null;
  /** The card is your own — your day on its own, not against yourself. */
  self?: boolean;
  onClose: () => void;
  origin?: SummaryOrigin | null;
}) {
  const colors = useColors();
  const mine: SpotDayGames = me ?? { car: null, auction: null };
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
                {self ? 'You played the Daily Games today' : 'played the Daily Games today'}
              </Text>
            </View>
          </View>

          {/* Only the games they played — a game they skipped has nothing of
              theirs to compare against. */}
          {SPOT_GAMES.filter((g) => fillOf(g.key, player) != null).map((g) => (
            <GameCard key={g.key} game={g} them={player} me={mine} theirName={shortName} self={self} />
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
    borderWidth: StyleSheet.hairlineWidth, borderRadius: COMMON_RADIUS, backgroundColor: SURFACE_BLACK,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  gameHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gameTitle: { fontSize: 14, fontFamily: FONT_INTER.bold },
  gameWinner: { marginLeft: 'auto', fontSize: 11, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  // From the left, under the card's title — not pushed to the far side.
  lineResult: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  figure: { fontSize: 13, fontFamily: FONT_INTER.extrabold, fontVariant: ['tabular-nums'] },
  auctionCol: { flex: 1, maxWidth: 120, gap: 3 },
  scoreTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 3 },
  offText: { fontSize: 10.5, fontFamily: FONT_INTER.semibold },

  playRow: { alignItems: 'flex-start' },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 6, paddingRight: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, backgroundColor: SURFACE_MID, maxWidth: '100%',
  },
  playIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE_BLACK },
  playText: { flexShrink: 1, fontSize: 12.5, fontFamily: FONT_INTER.bold },
});

