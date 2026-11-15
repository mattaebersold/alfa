import React from 'react';
import {
  KeyboardAvoidingView as KCKeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
} from 'react-native-keyboard-controller';

/**
 * For a composer pinned under a list — comments, messages. The column shrinks
 * by however much of it the keyboard covers, so the composer sits on the
 * keyboard and the list above stays scrollable.
 *
 * keyboard-controller's, not React Native's: RN's has nothing to act on under
 * Android's edge-to-edge. `automaticOffset` is on, so the view finds its own
 * place on screen — no header heights passed in, under a navigation header or
 * inside a modal alike.
 */
export default function KeyboardAvoidingView({
  behavior = 'padding',
  automaticOffset = true,
  ...rest
}: KeyboardAvoidingViewProps) {
  return <KCKeyboardAvoidingView behavior={behavior as any} automaticOffset={automaticOffset} {...(rest as any)} />;
}
