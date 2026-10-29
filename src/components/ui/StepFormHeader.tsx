import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'
import Tachometer from './Tachometer';
import CheckeredFlag from './CheckeredFlag';

/**
 * The chrome every multi-step form in the app wears.
 *
 * A rev counter for where you are, the form's name beside it, and back and
 * forward together at the right — in the header, because that is the one row
 * always on screen, so the step controls belong in it. Under it, the name of
 * the step you're actually filling in.
 *
 * It started on CarCreateScreen, was copied wholesale into NewGroupSheet, and
 * was about to be copied a third time for the marketplace's create form. Three
 * copies of a shape is how a form ends up moving differently from its
 * neighbour, so it lives here now and all three import it.
 *
 * Only the chrome: each form still owns its steps, its validation and what
 * Create means. Pass `titleContent={<StepFormNav … />}` to a SharedModal and
 * render `<StepFormProgress … />` as the first thing inside it.
 */

// ── The header row ───────────────────────────────────────────────────────────
export function StepFormNav({
  title,
  step,
  totalSteps,
  onBack,
  onNext,
  canAdvance = true,
  onSubmit,
  submitLabel,
  submitAccessibilityLabel,
  canSubmit = true,
  submitting = false,
  leading, style, center }: {
  /** The form's name, beside the tach. */
  title: string;
  /** 1-based. */
  step: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  /** Off until this step's required fields are in. */
  canAdvance?: boolean;
  /** The last step ends in the save, not another caret. */
  onSubmit: () => void;
  /** The submit button's spoken name — "Create", "Save". It shows a flag. */
  submitLabel: string;
  submitAccessibilityLabel?: string;
  canSubmit?: boolean;
  /** Swaps the label for a spinner and blocks a second press. */
  submitting?: boolean;
  /**
   * Replaces the faded back button on step 1 — the garage form's "start
   * over", which only exists where there is no back to go to.
   */
  leading?: React.ReactNode;
  /** Onto the row — side padding when it sits in a page rather than a sheet's title bar. */
  style?: StyleProp<ViewStyle>;
  /** In the title's place — an empty spacer, when the form has no heading. */
  center?: React.ReactNode;
}) {

  return (
    <View style={[styles.navRow, style]}>
      {/* The tach is the progress: the needle climbs a step at a time. */}
      <Tachometer step={step} total={totalSteps} size={60} />

      {center ?? <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>}

      <View style={styles.navBtns}>
      {/* Back is always drawn, faded on the first step where there's nothing
          behind it: a cluster that changes width made the title jump. A
          `leading` still takes its place when a form has one. */}
      {step > 1 ? (
        <TouchableOpacity
          style={styles.navBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Previous step"
        >
          <ChevronLeft size={16} color={COLOR_WHITE} strokeWidth={2.6} />
        </TouchableOpacity>
      ) : leading ?? (
        <View
          style={[styles.navBtn, styles.navBtnOff]}
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel="Previous step"
        >
          <ChevronLeft size={16} color={COLOR_WHITE} strokeWidth={2.6} />
        </View>
      )}

      {step < totalSteps ? (
        <TouchableOpacity
          style={[styles.navBtn, !canAdvance && styles.navBtnOff]}
          onPress={onNext}
          disabled={!canAdvance}
          accessibilityRole="button"
          accessibilityLabel="Next step"
        >
          <ChevronRight size={16} color={COLOR_WHITE} strokeWidth={2.6} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          // The finish line: a solid white square with a checkered flag, so the
          // one press that commits everything doesn't read as another step.
          style={[styles.navBtn, styles.navBtnFinish, !canSubmit && styles.navBtnOff]}
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
          accessibilityRole="button"
          accessibilityLabel={submitAccessibilityLabel ?? submitLabel}
        >
          {submitting
            ? <ActivityIndicator size="small" color={COLOR_BLACK} />
            : <CheckeredFlag size={16} color={COLOR_BLACK} strokeWidth={2.2} />}
        </TouchableOpacity>
      )}
      </View>
    </View>
  );
}

// ── The step's name ──────────────────────────────────────────────────────────
/**
 * What you're filling in, under the header. The bar that used to sit above it
 * is the tach in the header now.
 */
export function StepFormProgress({ caption, style }: {
  /** What you're filling in — the header above already carries the form's name. */
  caption?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  if (!caption) return null;
  // On the pane's own ground, like the header above it.
  return <Text style={[styles.stepCaption, { color: colors.fg }, style]}>{caption}</Text>;
}

const styles = StyleSheet.create({
  navRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Takes the space between the tach and the buttons, reading from the left.
  navTitle: {
    flex: 1,
    fontSize: 17, fontFamily: FONT_INTER.bold, color: COLOR_WHITE,
  },
  navBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Back and next: white outlines on the header. A disabled one fades rather
  // than changing. Submit is the same square filled white (navBtnFinish).
  navBtn: {
    width: 28, height: 28, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLOR_WHITE,
  },
  navBtnOff: { opacity: 0.5 },
  navBtnFinish: { backgroundColor: COLOR_WHITE },

  stepCaption: {
    fontSize: 20, fontFamily: FONT_INTER.bold, letterSpacing: -0.3,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14,
  },
});
