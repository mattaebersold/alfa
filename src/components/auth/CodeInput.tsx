import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { colors } from '../../constants/colors';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_WHITE } from '../../constants/config';

export const CODE_LENGTH = 6;

/**
 * Six boxes for an email verification code.
 *
 * One real input behind the six boxes. It used to be six inputs of maxLength
 * 1, and iOS applies maxLength to autofill as well as typing — so the code Mail
 * offers above the keyboard arrived as its first digit only. One field takes a
 * paste or an autofill whole; the boxes just draw its value.
 *
 * Calls `onComplete` once all six digits are in, whether typed, pasted or
 * autofilled, so nobody has to tap Verify.
 */
export default function CodeInput({ value, onChange, onComplete, editable = true, autoFocus = true, ref }: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
  ref?: React.Ref<TextInput>;
}) {
  const [focused, setFocused] = useState(false);
  const [input, setInput] = useState<TextInput | null>(null);

  const handleChange = (raw: string) => {
    const clean = raw.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    onChange(clean);
    if (clean.length === CODE_LENGTH) onComplete?.(clean);
  };

  const setRefs = (node: TextInput | null) => {
    setInput(node);
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.RefObject<TextInput | null>).current = node;
  };

  return (
    <Pressable style={styles.row} onPress={() => input?.focus()}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => {
        const active = focused && i === Math.min(value.length, CODE_LENGTH - 1);
        return (
          <View
            key={i}
            style={[
              styles.box,
              value[i] ? styles.boxFilled : null,
              active ? styles.boxActive : null,
            ]}
          >
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={setRefs}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        caretHidden
        editable={editable}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: COLOR_WHITE,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  boxActive: { borderColor: colors.cream },
  digit: { color: COLOR_WHITE, fontSize: 22, fontFamily: FONT_INTER.bold },
  // Covers the boxes so a tap anywhere on them lands in it, but draws nothing.
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent' },
});
