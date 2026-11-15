import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Alert, RefreshControl, Dimensions, Linking, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ArrowUpRight, Timer } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import FormScrollView, { KEYBOARD_GAP } from '../../keyboard/FormScrollView';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { useGuessCarGameMutation, useRevealCarGameHintMutation } from '../../api/apiService';
import { COLOR_BLACK, COLOR_GRAY_224, COLOR_WHITE } from '../../constants/config';
import {
  MAX_ATTEMPTS, type CarCredit, type CarMode, type CarPhotoCredit, type CarPlay, type CarPuzzle,
} from '../../types/games';
import ZoomedPuzzleImage from './ZoomedPuzzleImage';
import GuessForm, { AttemptBar } from './GuessForm';
import GuessRow from './GuessRow';
import HintBulb from './HintBulb';
import Stopwatch, { useStopwatchStart } from './Stopwatch';
import {
  GAME_BG, GAME_CARD, GAME_GUTTER, GAME_INSET, HIT_SOFT, MISS_SOFT,
  answerLabel, blurForAttempts, formatElapsed, pixelatedImage, scatterFocus, scatterZoom, zoomForAttempts,
} from './game';

/** The pinned footer's height above the safe area: the button and its padding. */
const FOOTER_H = 12 + 46 + 4;

/** How a win is called by how long it took — 1–2 guesses need no words. */
function winLine(attempts: number): string {
  if (attempts <= 2) return '';
  if (attempts < MAX_ATTEMPTS) return 'Got it —';
  return 'Barely got it —';
}

/**
 * The photo, edge to edge. A finished game's banner across its top says how
 * it went — a colour on the photo rather than a pop-up, so the answer and the
 * full photo it zooms out to stay in view.
 */
function PuzzleCard({ puzzle, play, mode, timeMs, onReady }: {
  puzzle: CarPuzzle;
  play: CarPlay | null;
  mode: CarMode;
  timeMs?: number | null;
  onReady?: () => void;
}) {
  const status = play?.status ?? 'playing';
  const finished = status !== 'playing';
  const attempts = play?.attempts ?? 0;
  // Zoom pulls back each miss. The other modes come only from a game begun
  // in Car Spotter: blur sharpens, scattered jumps about, pixelated refines.
  const scattered = mode === 'scattered';
  const focus = scattered
    ? scatterFocus(puzzle.internal_id, attempts, { x: puzzle.focus_x, y: puzzle.focus_y })
    : { x: puzzle.focus_x, y: puzzle.focus_y };
  const pixelated = !finished && mode === 'pixelated';
  const scale = finished || mode === 'blur' || mode === 'pixelated' ? 1
    : scattered ? scatterZoom(puzzle.zoom, attempts)
    : zoomForAttempts(puzzle.zoom, attempts);
  const blur = !finished && mode === 'blur' ? blurForAttempts(attempts) : 0;
  const startScale = scattered ? scatterZoom(puzzle.zoom, 0) : zoomForAttempts(puzzle.zoom, 0);

  return (
    <View style={styles.frame}>
      <ZoomedPuzzleImage
        image={pixelated ? pixelatedImage(puzzle.internal_id, attempts) : puzzle.image}
        focusX={focus.x}
        focusY={focus.y}
        scale={scale}
        startScale={startScale}
        cut={mode}
        blurRadius={blur}
        duration={finished ? 900 : scattered ? 250 : 600}
        style={styles.window}
        onReady={onReady}
      />
      {finished && play?.answer ? (
        // 80% of the colour (`CC`), so the car still shows through.
        <View style={styles.bannerArea} pointerEvents="none">
          <View style={[styles.banner, { backgroundColor: `${status === 'won' ? HIT_SOFT : MISS_SOFT}CC` }]}>
            <View style={styles.bannerCopy}>
              <Text style={styles.bannerTitle}>
                {status === 'won'
                  ? [winLine(attempts), answerLabel(play.answer)].filter(Boolean).join(' ')
                  : `The answer was ${answerLabel(play.answer)}`}
              </Text>
            </View>
            {status === 'won' ? (
              <View style={styles.timePill} accessibilityLabel={`In ${attempts} of ${MAX_ATTEMPTS} guesses`}>
                <Text style={styles.timeText}>{attempts}/{MAX_ATTEMPTS}</Text>
              </View>
            ) : null}
            {timeMs ? (
              <View style={styles.timePill} accessibilityLabel={`Time ${formatElapsed(timeMs)}`}>
                <Timer size={13} color={COLOR_WHITE} />
                <Text style={styles.timeText}>{formatElapsed(timeMs)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** A Commons or Unsplash photographer's credit, which their licences ask for. */
function PhotoCredit({ credit }: { credit: CarPhotoCredit }) {
  const text = ['Photo', credit.author ? `by ${credit.author}` : null].filter(Boolean).join(' ')
    + ` · ${[credit.license, credit.source].filter(Boolean).join(' · ')}`;
  return (
    <Text
      style={styles.photoCredit}
      numberOfLines={2}
      onPress={credit.url ? () => Linking.openURL(credit.url!).catch(() => {}) : undefined}
      accessibilityRole={credit.url ? 'link' : 'text'}
    >
      {text}
    </Text>
  );
}

/**
 * After the reveal, whose car it was: "This is @jess's 1991 NSX" — a member's
 * garage car. Their face opens their profile; View Car opens the build.
 */
function MemberCredit({ credit, play }: { credit: CarCredit; play: CarPlay }) {
  const navigation = useNavigation<any>();
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  const { user } = credit;
  const car = answerLabel(play.answer);
  return (
    <View style={styles.credit}>
      <Pressable
        onPress={() => navigation.navigate('UserDetail', { userId: user.user_id, username: user.username })}
        style={({ pressed }) => [styles.creditWho, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`@${user.username}'s profile`}
      >
        <Avatar user={user} size={40} />
        <Text style={styles.creditLine} numberOfLines={2}>
          This is <Text style={styles.creditHandle}>@{user.username}</Text>{car ? `'s ${car}` : "'s car"}
        </Text>
      </Pressable>
      {credit.garage_car_id ? (
        <Pressable
          onPress={() => navigation.navigate('CarDetail', { carId: credit.garage_car_id })}
          style={({ pressed }) => [styles.viewCar, { backgroundColor: brand }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.viewCarText, { color: brandText }]}>View Car</Text>
          <ArrowUpRight size={13} color={brandText} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The used hint mid-game, over the buttons — `width` is the pair's, so a long hint wraps inside it. */
function HintLine({ hint, width }: { hint: string; width: number | null }) {
  return (
    <View style={[styles.hintLine, width ? { width } : null]}>
      <View style={styles.hintPill}>
        <Text style={styles.hintLineText}>{hint}</Text>
      </View>
    </View>
  );
}

/**
 * Asking for the hint, beside the guess button. It asks first, because using
 * it is on the record: the result says so, and it loses a tie.
 */
function HintButton({ busy, used, onUse }: { busy: boolean; used: boolean; onUse: () => void }) {
  const confirm = () => Alert.alert(
    'Use a hint?',
    'It’s one-time — once it’s shown, that’s your hint for this car. Your result will show that you used it, and anyone with the same score who didn’t will rank ahead of you.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Show hint', onPress: onUse },
    ],
  );
  return (
    <Pressable
      onPress={confirm}
      // Once used it stays, spent: the hint's over it now.
      disabled={busy || used}
      style={({ pressed }) => [styles.hintButton, pressed && styles.pressed, used && styles.hintSpent]}
      accessibilityRole="button"
      accessibilityLabel="Hint"
      accessibilityState={{ disabled: busy || used }}
    >
      {busy ? <ActivityIndicator size="small" color={COLOR_WHITE} /> : (
        <>
          <HintBulb size={18} />
          <Text style={styles.hintLabel}>Hint</Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * One day's car, played: the photo, the guesses so far and the form for the
 * next, in a scroll that keeps the field above the keyboard — and the Guess
 * button pinned to the bottom, riding up on the keyboard. Today's car and a
 * past day's are the same game; `puzzle.play_date` is what guesses are for.
 *
 * `above` goes over the photo; `children` under a finished game; `doneFooter`
 * is pinned to the bottom once it's over.
 */
export default function CarGame({
  puzzle, play, credit, onStale, above, refreshing, onRefresh, timed = false, children, doneFooter,
}: {
  puzzle: CarPuzzle;
  play: CarPlay | null;
  /** Whose car it is — sent once the game is over. */
  credit?: CarCredit | null;
  /** A refused guess: pick up the game's real state. */
  onStale: () => void;
  above?: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  /** On-the-day games are timed, from the photo first showing. */
  timed?: boolean;
  children?: React.ReactNode;
  doneFooter?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [guess, { isLoading: guessing }] = useGuessCarGameMutation();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  // Every new game is zoom; one begun in Car Spotter keeps its own way.
  const mode: CarMode = play?.mode ?? 'zoom';

  // From the photo first showing (a slow connection eats no one's time) to
  // the game's end. A game already over when it opened has no clock.
  const overOnArrival = useRef((play?.status ?? 'playing') !== 'playing').current;
  const [photoShown, setPhotoShown] = useState(false);
  const onPhotoReady = useCallback(() => setPhotoShown(true), []);
  const clockStart = useStopwatchStart(puzzle.play_date, timed && photoShown && !overOnArrival, !play);
  /** The stopwatch at the guess that ended it, for the banner until the server's time lands. */
  const [endedAt, setEndedAt] = useState<number | null>(null);

  const onGuess = useCallback(async (mk: string, md: string) => {
    try {
      const elapsed = timed && clockStart != null ? Date.now() - clockStart : undefined;
      const next = (await guess({ make: mk, model: md, play_date: puzzle.play_date, mode, elapsed_ms: elapsed }).unwrap()).play;
      if (next.status !== 'playing' && elapsed != null) setEndedAt(elapsed);
      if (next.status === 'won') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else if (next.status === 'lost') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return true;
    } catch (err: any) {
      Alert.alert('Error', err?.data?.error || "That guess didn't go through. Please try again.");
      // Already finished elsewhere (another device, or Car Spotter): pick up the real state.
      onStale();
      return false;
    }
  }, [guess, puzzle.play_date, mode, onStale, timed, clockStart]);

  const [revealHint, { isLoading: revealing }] = useRevealCarGameHintMutation();
  const askForHint = useCallback(async () => {
    try {
      await revealHint({ play_date: puzzle.play_date, mode }).unwrap();
    } catch (err: any) {
      Alert.alert('Error', err?.data?.error || "Couldn't show the hint. Please try again.");
      onStale();
    }
  }, [puzzle.play_date, mode, revealHint, onStale]);

  const guesses = play?.guesses ?? [];
  const finished = (play?.status ?? 'playing') !== 'playing';
  const attempts = play?.attempts ?? 0;
  // The answer never comes mid-game, but a correct half is in the guess that got it.
  const solvedMake = play?.make_solved ? guesses.find((g) => g.make_correct)?.make ?? null : null;
  const solvedModel = play?.model_solved ? guesses.find((g) => g.model_correct)?.model ?? null : null;
  const finalMake = solvedMake ?? make;
  const finalModel = solvedModel ?? model;
  const ready = !!finalMake.trim() && !!finalModel.trim();
  const submit = async () => {
    if (!ready) return;
    // A wrong guess clears the open half for the next try.
    if (await onGuess(finalMake, finalModel)) { setMake(''); setModel(''); }
  };

  const hasHint = puzzle.has_hint ?? !!puzzle.hint;
  const usedHint = play?.hint_used ? play.hint ?? puzzle.hint ?? null : null;
  // Measured: a used hint over the buttons makes the footer taller.
  const [footerMeasured, setFooterMeasured] = useState<number | null>(null);
  const [pairWidth, setPairWidth] = useState<number | null>(null);
  const [doneFooterH, setDoneFooterH] = useState(0);
  const footerH = finished ? (doneFooter ? doneFooterH : 0) : footerMeasured ?? FOOTER_H;

  return (
    <View style={styles.screen}>
      <FormScrollView
        contentContainerStyle={[
          styles.content,
          !finished && styles.contentPlaying,
          { paddingBottom: insets.bottom + footerH + 16 },
        ]}
        // Clear of the pinned button too, not just the keyboard.
        bottomOffset={KEYBOARD_GAP + footerH}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR_WHITE} />}
      >
        {above}
        <PuzzleCard puzzle={puzzle} play={play} mode={mode} timeMs={play?.time_ms ?? endedAt} onReady={onPhotoReady} />

        {finished && play?.answer?.photo_credit ? <PhotoCredit credit={play.answer.photo_credit} /> : null}
        {finished && play && credit ? <MemberCredit credit={credit} play={play} /> : null}

        {/* Where you are, then how you got here, then the next guess. */}
        {!finished && (
          <View style={styles.progressRow}>
            <View style={styles.progress}><AttemptBar attempt={Math.min(attempts + 1, MAX_ATTEMPTS)} /></View>
            {timed ? <Stopwatch start={clockStart} /> : null}
          </View>
        )}

        {guesses.length > 0 && (
          <View style={styles.guesses}>
            {guesses.map((g, i) => <GuessRow key={i} guess={g} />)}
          </View>
        )}

        {!finished && (
          <GuessForm
            solvedMake={solvedMake}
            solvedModel={solvedModel}
            make={make}
            model={model}
            onMakeChange={setMake}
            onModelChange={setModel}
          />
        )}

        {finished && play ? <View style={styles.finished}>{children}</View> : null}
      </FormScrollView>

      {finished && doneFooter ? (
        <View
          style={[styles.footerWrap, styles.footer, { paddingBottom: insets.bottom + 8 }]}
          onLayout={(e) => setDoneFooterH(e.nativeEvent.layout.height - insets.bottom)}
        >
          {doneFooter}
        </View>
      ) : null}

      {!finished && (
        // The safe area's under it with the keyboard down; up, that padding is
        // taken back so the button sits right on the keys.
        <KeyboardStickyView style={styles.footerWrap} offset={{ closed: 0, opened: insets.bottom }}>
          <View
            style={[styles.footer, { paddingBottom: insets.bottom + 4 }]}
            onLayout={(e) => setFooterMeasured(e.nativeEvent.layout.height - insets.bottom)}
          >
            {usedHint ? <HintLine hint={usedHint} width={pairWidth} /> : null}
            <View style={styles.footerRow} onLayout={(e) => setPairWidth(e.nativeEvent.layout.width)}>
              {hasHint ? <HintButton busy={revealing} used={!!play?.hint_used} onUse={askForHint} /> : null}
              <View style={styles.guessCol}>
                <Button
                  label={`Guess ${Math.min(attempts + 1, MAX_ATTEMPTS)} of ${MAX_ATTEMPTS}`}
                  variant="dark"
                  size="full"
                  onPress={submit}
                  disabled={!ready}
                  loading={guessing}
                />
              </View>
            </View>
          </View>
        </KeyboardStickyView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GAME_BG },
  content: { paddingHorizontal: GAME_GUTTER, gap: 16 },
  contentPlaying: { gap: 8 },
  footerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  footer: { paddingHorizontal: GAME_GUTTER, paddingTop: 12, backgroundColor: GAME_BG, gap: 10 },
  // Edge to edge, out past the gutter, lined top and bottom only.
  frame: {
    marginHorizontal: -GAME_GUTTER, overflow: 'hidden', borderColor: 'rgba(255,255,255,0.25)',
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Never less than 30% of the screen, so a wide photo is cropped rather than a strip.
  window: { minHeight: Math.round(Dimensions.get('window').height * 0.3) },
  bannerArea: { position: 'absolute', top: 10, left: 10, right: 10 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingLeft: 14, paddingRight: 5, paddingVertical: 5, borderRadius: 999,
  },
  bannerCopy: { flex: 1, minWidth: 0 },
  bannerTitle: { color: COLOR_BLACK, fontSize: 13, fontWeight: '600' },
  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.7)',
  },
  timeText: { color: COLOR_WHITE, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  // The hint and the guess side by side, centred; the hint takes the button's height.
  footerRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, alignSelf: 'center' },
  guessCol: { width: 190 },
  hintButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingHorizontal: 18, borderRadius: 999, backgroundColor: GAME_CARD, minWidth: 96,
  },
  pressed: { opacity: 0.8 },
  hintSpent: { opacity: 0.4 },
  hintLine: { alignSelf: 'center', alignItems: 'flex-start' },
  hintPill: { backgroundColor: GAME_INSET, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 5 },
  hintLineText: { color: COLOR_GRAY_224, fontSize: 12, lineHeight: 15, fontWeight: '600' },
  hintLabel: { color: COLOR_WHITE, fontSize: 15, fontWeight: '700' },
  guesses: { gap: 8 },
  // Tucked under the photo, small: a credit, not a caption.
  photoCredit: { color: '#808080', fontSize: 11, lineHeight: 15, marginTop: -8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progress: { flex: 1 },
  finished: { gap: 16 },
  credit: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 999, padding: 6, paddingRight: 8, backgroundColor: GAME_INSET,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)',
  },
  creditWho: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  creditLine: { flex: 1, color: COLOR_GRAY_224, fontSize: 14, lineHeight: 19 },
  creditHandle: { color: COLOR_WHITE, fontWeight: '700' },
  viewCar: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 30, paddingHorizontal: 11, borderRadius: 999 },
  viewCarText: { fontSize: 12, fontWeight: '600' },
});
