import React, { createContext, useContext } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type TextProps,
  type TextInputProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { FONT_INTER } from './fonts';

/**
 * Text and TextInput, set in the app's face — Inter — without every style
 * having to name it.
 *
 * Import these instead of react-native's. Each resolves its font when it
 * renders, from the style as it finally lands (every layer flattened):
 *
 *  - a style that names a font other than Inter keeps it (the What's New
 *    monospace);
 *  - otherwise it's Inter, and `fontWeight` picks the weight.
 *
 * Why at render and not in each StyleSheet: a custom font's weight is its
 * family name, so a style that names a family also fixes a weight — and the
 * common `[styles.label, { fontSize: 13 }]` override would then reset a bold
 * label to regular. Resolving the flattened style keeps the bold from the layer
 * underneath, and a weight-only override (`{ fontWeight: '600' }`) still works.
 *
 * Nested text that says nothing about its font inherits its parent's as is.
 *
 * Off until `enableAppFonts()`: an app that hasn't loaded the font files gets
 * react-native's Text as it always was, rather than names it can't resolve.
 */

let enabled = false;

/** Call once the font files are loaded (alfa: App.tsx, after useFonts). */
export function enableAppFonts() {
  enabled = true;
}

const INTER = new Set<string>(Object.values(FONT_INTER));

/** "Inter_700Bold" → 700. */
const weightOfFamily = (family: string) => Number(family.match(/_(\d{3})/)?.[1] ?? 400);

const weightOf = (w: TextStyle['fontWeight']): number => {
  if (w == null || w === 'normal') return 400;
  if (w === 'bold') return 700;
  const n = Number(w);
  return Number.isFinite(n) ? n : 400;
};

const familyFor = (weight: number): string => {
  if (weight <= 300) return FONT_INTER.light;
  if (weight <= 400) return FONT_INTER.regular;
  if (weight <= 500) return FONT_INTER.medium;
  if (weight <= 600) return FONT_INTER.semibold;
  if (weight <= 700) return FONT_INTER.bold;
  if (weight <= 800) return FONT_INTER.extrabold;
  return FONT_INTER.black;
};

/**
 * The Inter family for one piece of text, or null to leave its style alone
 * (a font of its own, or nested text with nothing to change).
 */
function resolve(style: StyleProp<TextStyle>, nested: boolean): string | null {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const named = flat.fontFamily;
  if (named && !INTER.has(named)) return null;
  // Nested text that says nothing about its font inherits the parent's as it is.
  if (nested && !named && flat.fontSize == null && flat.fontWeight == null) return null;

  const weight = flat.fontWeight != null
    ? weightOf(flat.fontWeight)
    : named ? weightOfFamily(named) : 400;
  return familyFor(weight);
}

/** Whether this Text sits inside another — see the note on nesting above. */
const NestedContext = createContext(false);

// 'normal', not left as it was: beside a custom family a real weight makes iOS
// hunt for a bold variant of a font that is already the bold.
const withFamily = (style: StyleProp<TextStyle>, family: string): StyleProp<TextStyle> =>
  [style, { fontFamily: family, fontWeight: 'normal' }];

export function Text(props: TextProps & { ref?: React.Ref<RNText> }) {
  const nested = useContext(NestedContext);
  if (!enabled) return <RNText {...props} />;
  const family = resolve(props.style, nested);
  const text = <RNText {...props} style={family ? withFamily(props.style, family) : props.style} />;
  return nested ? text : <NestedContext.Provider value>{text}</NestedContext.Provider>;
}
export type Text = RNText;

export function TextInput(props: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  if (!enabled) return <RNTextInput {...props} />;
  const family = resolve(props.style as StyleProp<TextStyle>, false);
  return <RNTextInput {...props} style={family ? withFamily(props.style as StyleProp<TextStyle>, family) : props.style} />;
}
export type TextInput = RNTextInput;
