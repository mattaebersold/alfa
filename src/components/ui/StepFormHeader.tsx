import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * The chrome every multi-step form in the app wears.
 *
 * Back, the form's name, forward — in the header, because that is the one row
 * always on screen, so the step controls belong in it. Under it a bar that
 * fills, and the name of the step you're actually filling in.
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
  leading,
}: {
  /** The form's name, on the pane's midline. */
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
  /** What the button says — "Create", "Save". */
  submitLabel: string;
  submitAccessibilityLabel?: string;
  canSubmit?: boolean;
  /** Swaps the label for a spinner and blocks a second press. */
  submitting?: boolean;
  /**
   * Replaces the leading spacer on step 1 — the garage form's "start over",
   * which only exists where there is no back to go to.
   */
  leading?: React.ReactNode;
}) {
  const brand = useBrandColor();

  return (
    /* Each caret is absent rather than disabled at the ends of the run: there
       is no step before the first or after the last, and a dimmed control
       implies one exists and is merely unavailable. A spacer holds the gap so
       the name stays on the pane's midline either way. */
    <View style={styles.navRow}>
      {step > 1 ? (
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: brand }]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Previous step"
        >
          <ChevronLeft size={20} color="#000000" strokeWidth={2.6} />
        </TouchableOpacity>
      ) : leading ?? <View style={styles.navBtn} />}

      <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>

      {step < totalSteps ? (
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: brand }, !canAdvance && styles.navBtnOff]}
          onPress={onNext}
          disabled={!canAdvance}
          accessibilityRole="button"
          accessibilityLabel="Next step"
        >
          <ChevronRight size={20} color="#000000" strokeWidth={2.6} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          // Named, not a tick: this is the one press that commits everything,
          // and a glyph made it look like another step.
          style={[styles.navBtn, styles.navBtnWide, { backgroundColor: brand }, !canSubmit && styles.navBtnOff]}
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
          accessibilityRole="button"
          accessibilityLabel={submitAccessibilityLabel ?? submitLabel}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#000000" />
            : <Text style={styles.navBtnText}>{submitLabel}</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── The bar and the step's name ──────────────────────────────────────────────
export function StepFormProgress({ step, total, caption }: {
  step: number;
  total: number;
  /** What you're filling in — the header above already carries the form's name. */
  caption?: string;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  return (
    <>
      <View style={styles.track}>
        {/* One bar that fills, not five tiles with gaps between them — the gaps
            read as five separate things rather than one journey. */}
        <View style={[styles.fill, { width: `${(step / total) * 100}%`, backgroundColor: brand }]} />
      </View>
      {caption ? (
        <Text style={[styles.stepCaption, { color: colors.fg }]}>{caption}</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  navRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  // Centred by taking the space between two fixed-width buttons, so the name
  // sits on the pane's midline whatever the buttons show.
  navTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '700', color: '#FFFFFF',
  },
  // A black glyph on the account's own colour — blue, or gold for Pro. No
  // border: the fill is the shape. A disabled one fades rather than changing.
  navBtn: {
    width: 34, height: 34, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnOff: { opacity: 0.5 },
  // Wide enough for a word — the chevrons stay square.
  navBtnWide: { width: 'auto', paddingHorizontal: 12 },
  navBtnText: { fontSize: 14, fontWeight: '800', color: '#000000' },

  track: {
    height: 4, borderRadius: 2, overflow: 'hidden',
    marginHorizontal: 16, marginTop: 12, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  fill: { height: '100%', borderRadius: 2 },
  stepCaption: {
    fontSize: 20, fontWeight: '800', letterSpacing: -0.3,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
  },
});
