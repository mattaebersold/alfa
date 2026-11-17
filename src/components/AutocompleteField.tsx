import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Keyboard, type StyleProp, type ViewStyle } from 'react-native';
import { Text, TextInput } from '../theme/Text';
import { useColors } from '../theme/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardLift, useFormScrolled } from '../keyboard/FormScrollView';
import { Portal, usePortalHost } from './Portal';
import { FONT_INTER } from '../theme/fonts';

/**
 * How many rows the list will hold. The list scrolls inside itself (LIST_MAX_H),
 * so this isn't how many show at once — it's how many can be reached. At 8 a
 * make's models were cut short: Porsche has 22, and Boxster, Cayenne, Macan and
 * the rest were only findable by typing. 100 holds any one make's models whole;
 * the makes list, untyped, stops there and narrows as you type.
 */
const MAX_SUGGESTIONS = 100;
/**
 * The most the list takes before it scrolls inside itself — about five rows.
 * Kept short on purpose: this, plus the field, has to fit between the top of
 * the screen and the keyboard on the smallest phone.
 */
const LIST_MAX_H = 210;
/** Never less than this, even squeezed under a header — two rows. */
const LIST_MIN_H = 90;
/**
 * Between the list and the field it hangs off — none: the list sits flush on
 * the field's top edge, squared off where they meet, so the two read as one
 * piece that opened upward.
 */
const LIST_GAP = 0;
/** How long the list waits, after a finger leaves it, before closing on a blurred field. */
const LIST_RELEASE_MS = 1200;
/** The list's ground: black, so it reads as its own surface over the form. */
const LIST_BG = '#000';

/**
 * A text field that offers what's already known.
 *
 * On its own it doesn't insist: whatever is typed is the value, and the known
 * ones are one tap away. A caller that must only ever hold a listed value (the
 * make and model fields) keeps the typed text apart from the value it commits,
 * and uses `message` to say when the two disagree — see MakeModelFields.
 *
 * The list floats over the form rather than opening in the flow — in the
 * flow it shoved every field below it down the page as you typed, and back up
 * when it closed. It opens *above* the field, because below the field is where
 * the keyboard is, and inside a FormScrollView the field is scrolled down to
 * sit just over the keyboard so the list has the screen above it. It's capped
 * (to what fits above the field, at most) and scrolls inside itself.
 *
 * It's drawn in the nearest PortalHost's layer — over the form, its header and
 * its sheet — and pinned to the field by measuring both. Drawn in the form, it
 * was cut off at the top of the form's scroll view. With no host it falls back
 * to hanging off the field in place.
 *
 * In place, floating means stacking: the wrapper is always raised (zIndex, and
 * elevation for Android) so the list draws over the fields above it. Always,
 * not only while open — a zIndex that changes re-orders the native views, and
 * the TextInput taken out and put back loses focus, which closed the list the
 * moment it opened.
 */
export default function AutocompleteField({
  label,
  value,
  onChangeText,
  onSelect,
  suggestions,
  placeholder,
  autoCapitalize = 'words',
  style,
  inputStyle,
  onBlur,
  editable = true,
  message,
  invalid = false,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Defaults to `onChangeText`. */
  onSelect?: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  style?: StyleProp<ViewStyle>;
  inputStyle?: any;
  /** Called on blur, as it happens — before a tapped suggestion lands. */
  onBlur?: () => void;
  editable?: boolean;
  /** A line under the field: a hint, or with `invalid`, what's wrong. */
  message?: string;
  /** Outlines the field in red and colours `message` to match. */
  invalid?: boolean;
}) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  /** How tall the list may be — what fits between the field and the top of the form. */
  const [listMax, setListMax] = useState(LIST_MAX_H);

  const lift = useKeyboardLift();
  const host = usePortalHost();
  const insets = useSafeAreaInsets();
  /** Where the list goes in the host's layer. */
  const [anchor, setAnchor] = useState<{ left: number; width: number; bottom: number; max: number } | null>(null);
  const wrapRef = useRef<View>(null);
  const boxRef = useRef<View>(null);
  /** Focus as of now — `focused` trails a blur on purpose (see onBlur). */
  const hasFocus = useRef(false);
  const waiting = useRef<{ remove: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * A finger on the list — a tap or a scroll. The field can blur under it
   * (a drag that drops the keyboard, a press held past the blur's grace), and
   * closing then took the list away mid-scroll or before the tap landed: the
   * state was never set. While touched, and for a moment after, it stays.
   */
  const touchingList = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (releaseTimer.current) clearTimeout(releaseTimer.current); }, []);
  const holdList = () => {
    touchingList.current = true;
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
  };
  /** The finger's off (and any fling has settled): close soon if the field isn't focused. */
  const releaseList = () => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null;
      touchingList.current = false;
      if (!hasFocus.current) setFocused(false);
    }, LIST_RELEASE_MS);
  };

  const stopPlacing = () => {
    waiting.current?.remove();
    waiting.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stopPlacing, []);

  /** Pin the list to the field, in the host's layer. */
  const measure = () => {
    const box = boxRef.current;
    const layer = host?.layer.current;
    if (!box || !layer) return;
    layer.measureInWindow((lx, ly, _lw, lh) => {
      box.measureInWindow((bx, by, bw) => {
        const top = by - ly;
        // Up to the status bar — over the sheet's header is fine; under the clock isn't.
        const room = top - LIST_GAP - Math.max(0, insets.top + 8 - ly);
        setAnchor({
          left: bx - lx,
          width: bw,
          bottom: lh - top + LIST_GAP,
          max: Math.max(LIST_MIN_H, Math.min(LIST_MAX_H, room)),
        });
      });
    });
  };
  // Once a frame at most while the form scrolls under it.
  const frame = useRef<number | null>(null);
  const remeasure = () => {
    if (!host || frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      measure();
    });
  };
  useEffect(() => () => { if (frame.current != null) cancelAnimationFrame(frame.current); }, []);

  /**
   * Bring the field down to the keyboard and size the list to the room above.
   *
   * After the keyboard is up, and a beat after that: the form's own scroll
   * (out from behind the keyboard) runs as it rises and on a change of field,
   * and this should land after it rather than race it.
   */
  const place = () => {
    stopPlacing();
    const run = () => {
      timer.current = null;
      const box = boxRef.current;
      const wrap = wrapRef.current;
      if (!hasFocus.current || !box || !wrap) return;
      box.measureInWindow((_x, boxTop) => {
        lift(wrap).then((r) => {
          if (!hasFocus.current) return;
          if (host) { remeasure(); return; }
          if (!r) return;
          const room = boxTop - r.shift - r.top - LIST_GAP;
          setListMax(Math.max(LIST_MIN_H, Math.min(LIST_MAX_H, room)));
        });
      });
    };
    if (Keyboard.isVisible()) {
      timer.current = setTimeout(run, 150);
    } else {
      waiting.current = Keyboard.addListener('keyboardDidShow', () => {
        waiting.current?.remove();
        waiting.current = null;
        timer.current = setTimeout(run, 50);
      });
    }
  };

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    // Nothing typed yet: offer the head of the list rather than nothing, so
    // the field advertises that there is a list at all.
    const pool = q
      ? suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      : suggestions;
    // Anything starting with what you typed comes first — "911" should not be
    // buried under every model with a 9 in it.
    const starts = pool.filter((s) => s.toLowerCase().startsWith(q));
    const rest = pool.filter((s) => !s.toLowerCase().startsWith(q));
    return [...starts, ...rest].slice(0, MAX_SUGGESTIONS);
  }, [suggestions, value]);

  const pick = (v: string) => {
    if (!editable) return;
    (onSelect ?? onChangeText)(v);
    touchingList.current = false;
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
    setFocused(false);
  };

  const open = focused && editable && matches.length > 0;
  /** Drawn right now — with a host, only once it's been placed. */
  const showing = open && (!host || !!anchor);

  // The field's own corners and edge, so the list continues it rather than
  // guessing — a caller's inputStyle sets both.
  const fieldLook = StyleSheet.flatten(inputStyle ?? styles.input) ?? {};
  // Capped: a pill field's 999 would round the list into a lozenge.
  const radius = Math.min(16, typeof fieldLook.borderRadius === 'number' ? fieldLook.borderRadius : 8);
  const edge = (fieldLook.borderColor as string | undefined) ?? colors.inputBorder;

  useFormScrolled(() => { if (open) remeasure(); });
  useEffect(() => {
    if (!open || !host) { setAnchor(null); return undefined; }
    measure();
    // The sheet rides on the keyboard, so the field moves when it does.
    const show = Keyboard.addListener('keyboardDidShow', remeasure);
    const hide = Keyboard.addListener('keyboardDidHide', remeasure);
    return () => { show.remove(); hide.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, host]);

  const list = (
    <ScrollView
      style={[
        styles.list,
        host
          ? anchor && { left: anchor.left, width: anchor.width, bottom: anchor.bottom, maxHeight: anchor.max }
          : [styles.listInPlace, { maxHeight: listMax }],
        {
          borderColor: edge,
          backgroundColor: LIST_BG,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
        },
      ]}
      keyboardShouldPersistTaps="always"
      // Its own scroll: dragging the list never drops the keyboard.
      keyboardDismissMode="none"
      nestedScrollEnabled
      onTouchStart={holdList}
      onScrollBeginDrag={holdList}
      onMomentumScrollBegin={holdList}
      onTouchEnd={releaseList}
      onTouchCancel={releaseList}
      onScrollEndDrag={releaseList}
      onMomentumScrollEnd={releaseList}
    >
      {matches.map((s, i) => (
        <TouchableOpacity
          key={s}
          style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
          onPress={() => pick(s)}
          activeOpacity={0.7}
        >
          <Text style={[styles.rowText, { color: colors.fg }]} numberOfLines={1}>{s}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <View ref={wrapRef} style={[style, styles.raised]}>
      {label ? <Text style={[styles.label, { color: colors.fg }]}>{label}</Text> : null}
      {/* The field and its list share a box, so the list can hang off either
          edge of the field — not of the label or the message. */}
      <View ref={boxRef} collapsable={false}>
      <TextInput
        style={[
          inputStyle ?? [styles.input, {
            // `card`, not `inputBg`: the plain text fields these sit among use the
            // lighter ground, and side by side the darker one read as a disabled
            // field rather than a different component.
            color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.card,
          }],
          invalid && { borderColor: colors.red },
          !editable && styles.inputOff,
          // Squared off on top while the list sits on it.
          showing && styles.inputJoined,
        ]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        onFocus={() => {
          hasFocus.current = true;
          setFocused(true);
          place();
        }}
        // Deferred: a tap on a suggestion blurs the field first, and closing on
        // blur would unmount the row out from under the finger.
        onBlur={() => {
          hasFocus.current = false;
          stopPlacing();
          onBlur?.();
          // Not while a finger is on the list — it closes when that lets go.
          setTimeout(() => { if (!touchingList.current) setFocused(false); }, 150);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />

      {open && !host && list}
      {/* Drawn only once it knows where — a frame at the layer's corner first looks like a glitch. */}
      {open && host && anchor && <Portal>{list}</Portal>}
      </View>

      {/* After the list, not between it and the field: a message that appears
          on blur would otherwise shove the rows down under a finger that is
          already on its way to one. */}
      {message ? (
        <Text style={[styles.message, { color: invalid ? colors.red : colors.grey }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Matched to the plain text fields these sit among — they were a smaller
  // uppercase label over a taller, tighter-cornered box, so Make and Model
  // read as a different kind of field from every other one on the form.
  label: { fontSize: 13, fontFamily: FONT_INTER.bold, marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15,
  },
  inputOff: { opacity: 0.5 },
  inputJoined: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  message: { fontSize: 12, fontFamily: FONT_INTER.semibold, marginTop: 6, lineHeight: 16 },
  // Over the fields above it, so the list is too. Both, because iOS stacks by
  // zIndex and Android by elevation. Constant — see the note up top.
  raised: { zIndex: 50, elevation: 50 },
  // No bottom edge or bottom corners: the field's top border is the seam.
  list: {
    position: 'absolute',
    borderWidth: 1, borderBottomWidth: 0,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    overflow: 'hidden',
    zIndex: 50, elevation: 50,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
  },
  listInPlace: { left: 0, right: 0, bottom: '100%', marginBottom: LIST_GAP },
  row:   { paddingHorizontal: 12, paddingVertical: 11 },
  rowText: { fontSize: 14, fontFamily: FONT_INTER.semibold },
});
