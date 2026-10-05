import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, type StyleProp, type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import Reanimated from 'react-native-reanimated';
import { useKeyboardPadding } from '@ors/kit';
import { Image } from 'expo-image';
import { ImagePlus, X, Send, Camera, Images } from 'lucide-react-native';
import ActionSheet from '../ui/ActionSheet';
import MentionInput from '../ui/MentionInput';
import { useColors } from '../../hooks/useColors';
import type { ComposerPhotos, PhotoSource } from '../../hooks/useComposerPhotos';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * The colours a composer takes from the surface it sits on.
 *
 * Every surface that writes a comment or a message has its own ground — the
 * comment sheet's near-black, a chat sheet's #161616, a summary panel's pure
 * black — and the composer has to look like part of it rather than a widget
 * dropped on top. Anything left out falls back to the theme.
 */
export interface ComposerTone {
  /** The bar's ground. */
  surface?: string;
  /** The field's fill. */
  field?: string;
  border?: string;
  text?: string;
  /** The Send button's fill. */
  accent?: string;
  /** Text and icon on the accent. */
  onAccent?: string;
}

/**
 * The result of a send. `false` means it didn't go — the surface has shown its
 * own error, and the words are still in the field. Anything else means it went.
 */
export type SendResult = boolean | void;

export interface ComposerProps {
  value: string;
  /**
   * Mentioned user ids ride along with the text, as MentionInput reports them.
   * Always an empty list when `mentions` is off, so a surface that doesn't
   * care can take a two-argument handler and ignore the second.
   */
  onChangeText: (text: string, mentionedUserIds: string[]) => void;
  placeholder: string;
  /**
   * The attachment strip. Omit for a surface that can't take a photo; the
   * attach button goes with it.
   */
  photos?: ComposerPhotos | null;
  onSend: () => Promise<SendResult> | SendResult;
  sending: boolean;
  /** Resolve `@` into members and cars — see MentionInput. */
  mentions?: boolean;
  /** "Post" for a comment, "Send" for a message. */
  sendLabel?: string;
  maxLength?: number;
  /** A "Replying to @x" strip, shown above the field. */
  banner?: React.ReactNode;
  tone?: ComposerTone;
  /** Something to lead the bar with — the writer's avatar, usually. */
  leading?: React.ReactNode;
  /** Draw the bar's send button as an icon rather than the label. */
  sendIcon?: boolean;
  /**
   * Draw the attach button as a button in the field's own clothes — a round
   * outline filled like the field — rather than a bare icon beside it.
   */
  attachField?: boolean;
  /** Padding, border and such for the bar's wrapper. */
  barStyle?: StyleProp<ViewStyle>;
  /**
   * The home indicator's clearance, for a bar at the very foot of the screen:
   * padded below while the keyboard is down, eased to nothing as it rises.
   */
  bottomInset?: number;
  /** Fired as the field gains and loses focus. */
  onOpenChange?: (open: boolean) => void;
  /** Fired as the mention suggestions open and close — see MentionInput. */
  onSuggestionsOpenChange?: (open: boolean) => void;
}

export interface ComposerHandle {
  /** Focus the field — for a Reply tap that should start you typing. */
  open: () => void;
  /** Blur it, taking the keyboard down. */
  close: () => void;
}

/** Height of the thumbnails in the attachment strip. */
const THUMB = 64;

/**
 * Words or a photo — a comment or a message doesn't need both.
 */
function canSendWith(value: string, photos?: ComposerPhotos | null) {
  return !!value.trim() || !!photos?.hasPhotos;
}

function useTone(tone?: ComposerTone) {
  const c = useColors();
  return {
    surface:  tone?.surface  ?? c.bg,
    field:    tone?.field    ?? c.card,
    border:   tone?.border   ?? c.border,
    text:     tone?.text     ?? c.fg,
    accent:   tone?.accent   ?? c.primaryAlt,
    onAccent: tone?.onAccent ?? COLOR_WHITE,
    grey:     c.grey,
  };
}

/**
 * The attached photos, above the field, each with a way to take it back off.
 * Renders nothing until there's one. Exported for a surface with a field of
 * its own (ComposeMessageScreen) that still takes photos.
 */
export function ComposerPhotoStrip({ photos, borderColor }: { photos: ComposerPhotos; borderColor: string }) {
  if (!photos.hasPhotos) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      // Removing a photo shouldn't cost the keyboard.
      keyboardShouldPersistTaps="always"
    >
      {photos.photos.map((p, i) => (
        <View key={`${p.uri}_${i}`} style={[styles.thumbBox, { borderColor }]}>
          <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <TouchableOpacity
            style={styles.thumbRemove}
            onPress={() => photos.remove(i)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
          >
            <X size={12} color={COLOR_WHITE} />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function AttachButton({ photos, tint, onPress, size = 22, style }: {
  photos: ComposerPhotos;
  tint: string;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={photos.preparing || photos.full}
      hitSlop={8}
      style={[styles.iconBtn, photos.full && styles.iconBtnOff, style]}
      accessibilityRole="button"
      accessibilityLabel={photos.full ? 'Photo limit reached' : 'Add a photo'}
    >
      {photos.preparing
        ? <ActivityIndicator size="small" color={tint} />
        : <ImagePlus size={size} color={tint} />}
    </TouchableOpacity>
  );
}

/** The "take or choose" question the attach button asks. */
function PhotoSourceSheet({ visible, onClose, onPick }: {
  visible: boolean;
  onClose: () => void;
  onPick: (from: PhotoSource) => void;
}) {
  return (
    <ActionSheet
      visible={visible}
      onClose={onClose}
      title="Add a photo"
      options={[
        { label: 'Take Photo', Icon: Camera, onPress: () => onPick('camera') },
        { label: 'Choose Photo', Icon: Images, onPress: () => onPick('library') },
      ]}
    />
  );
}

/**
 * The attach button with its own "take or choose" sheet, for a surface with a
 * field of its own that still takes photos (ComposeMessageScreen).
 */
export function ComposerAttach({ photos, tint }: { photos: ComposerPhotos; tint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AttachButton photos={photos} tint={tint} onPress={() => setOpen(true)} size={21} />
      <PhotoSourceSheet visible={open} onClose={() => setOpen(false)} onPick={(from) => { void photos.add(from); }} />
    </>
  );
}

/** The field grows with the text to about five lines, then scrolls. */
const FIELD_MAX_H = 120;

/**
 * Where a comment or a message is written: a bar whose field is the real text
 * field, the way Messages or Instagram do it. Tap it and the keyboard comes up;
 * the surface the bar sits on carries it up on top of the keyboard (a kit
 * KeyboardAvoidingView, a sheet that rides the keyboard, a FormScrollView), and
 * the field grows with what's typed until it scrolls. Attach and send stay
 * beside it the whole time.
 *
 * This replaced a full-screen panel that opened over the bar to type in. That
 * panel existed to dodge the keyboard handling each surface used to need, and
 * it tied its own lifetime to the keyboard — any hide, even a momentary one,
 * closed it. With the kit's keyboard pieces the surfaces handle the keyboard
 * themselves, so the bar can simply be the field.
 *
 * The text and the photos are the caller's state, passed in, and the caller's
 * own send handler does the sending (FormData, its own error alert). The
 * keyboard stays up after a send, so a conversation can carry on; a surface
 * that's done after one (the comments sheet) closes itself.
 */
const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer({
  value, onChangeText, placeholder, photos, onSend, sending, mentions = false,
  sendLabel = 'Send', maxLength, banner, tone, leading, sendIcon = false, attachField = false,
  barStyle, bottomInset = 0, onOpenChange, onSuggestionsOpenChange,
}, ref) {
  const t = useTone(tone);
  const inputRef = useRef<TextInput>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // The home indicator's clearance with the keyboard down, eased away as the
  // keyboard covers that strip — switched on its events instead, the bar hops.
  const bottomPad = useKeyboardPadding({ closed: bottomInset, open: 0 });

  useImperativeHandle(ref, () => ({
    open: () => inputRef.current?.focus(),
    close: () => inputRef.current?.blur(),
  }), []);

  const canSend = canSendWith(value, photos) && !sending && !photos?.preparing;

  const fieldProps = {
    ref: inputRef,
    value,
    placeholder,
    placeholderTextColor: t.grey,
    multiline: true,
    maxLength,
    onFocus: () => onOpenChange?.(true),
    onBlur: () => onOpenChange?.(false),
    style: [ss.chatInput, styles.field, { color: t.text, backgroundColor: t.field, borderColor: t.border }],
  };

  return (
    <Reanimated.View style={[{ backgroundColor: t.surface }, barStyle, bottomPad]}>
      {banner}
      {photos ? <ComposerPhotoStrip photos={photos} borderColor={t.border} /> : null}
      <View style={styles.barRow}>
        {leading}
        {mentions ? (
          // Its suggestions open above the field — the keyboard is below it.
          <MentionInput
            {...fieldProps}
            containerStyle={styles.fieldWrap}
            onChangeText={onChangeText}
            onSuggestionsOpenChange={onSuggestionsOpenChange}
          />
        ) : (
          <View style={styles.fieldWrap}>
            <TextInput
              {...fieldProps}
              onChangeText={(text) => onChangeText(text, [])}
              textAlignVertical="top"
              // Prose — stated outright, since `spellCheck` only follows
              // `autoCorrect` when neither is given.
              autoCorrect
              spellCheck
              autoCapitalize="sentences"
            />
          </View>
        )}
        {photos ? (
          <AttachButton
            photos={photos}
            tint={t.grey}
            onPress={() => setPickerOpen(true)}
            size={attachField ? 19 : 21}
            style={attachField && [styles.attachField, { backgroundColor: t.field, borderColor: t.border }]}
          />
        ) : null}
        <TouchableOpacity
          onPress={() => { if (canSend) void onSend(); }}
          disabled={!canSend}
          style={[
            sendIcon ? styles.sendIconBtn : styles.sendBtn,
            { backgroundColor: t.accent },
            !canSend && styles.sendOff,
          ]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={sendLabel}
          accessibilityState={{ disabled: !canSend, busy: sending }}
        >
          {sending
            ? <ActivityIndicator size="small" color={t.onAccent} />
            : sendIcon
              ? <Send size={18} color={t.onAccent} />
              : <Text style={[styles.sendText, { color: t.onAccent }]}>{sendLabel}</Text>}
        </TouchableOpacity>
      </View>

      {photos ? (
        <PhotoSourceSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={(from) => { void photos.add(from); }}
        />
      ) : null}
    </Reanimated.View>
  );
});

export default Composer;

const styles = StyleSheet.create({
  // ── The bar ──────────────────────────────────────────────────────────────
  barRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  // Bottom-aligned: as the field grows upward, attach and send stay on the
  // line you're typing on.
  fieldWrap: { flex: 1 },
  field:    { flex: 0, minHeight: 40, maxHeight: FIELD_MAX_H, lineHeight: 20 },
  // 40 tall, like the field at one line, so the three sit level.
  sendBtn:  { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: COMMON_RADIUS, flexShrink: 0 },
  sendIconBtn: {
    width: 40, height: 40, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendText: { fontFamily: FONT_INTER.bold, fontSize: 13 },
  sendOff:  { opacity: 0.4 },
  iconBtn:  { width: 36, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBtnOff: { opacity: 0.35 },
  // The field's radius and rule (ss.chatInput), at the field's one-line height.
  attachField: { width: 40, height: 40, borderRadius: 20, borderWidth: 1 },

  // ── The strip ────────────────────────────────────────────────────────────
  strip:    { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  thumbBox: {
    width: THUMB, height: THUMB, borderRadius: COMMON_RADIUS, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbRemove: {
    position: 'absolute', top: 3, right: 3,
    width: 20, height: 20, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
});
