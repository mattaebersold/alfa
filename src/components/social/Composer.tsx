import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable, Modal, Animated,
  ActivityIndicator, Keyboard, Platform, ScrollView, type StyleProp, type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImagePlus, X, Send, ChevronDown, Camera, Images } from 'lucide-react-native';
import ActionSheet from '../ui/ActionSheet';
import MentionInput from '../ui/MentionInput';
import { useColors } from '../../hooks/useColors';
import { useKeyboardOverlap, useComposerBottomPad } from '../../hooks/useKeyboardHeight';
import type { ComposerPhotos, PhotoSource } from '../../hooks/useComposerPhotos';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

/**
 * The colours a composer takes from the surface it sits on.
 *
 * Every surface that writes a comment or a message has its own ground — the
 * comment sheet's near-black, a chat sheet's #161616, a summary panel's pure
 * black — and the composer has to look like part of it rather than a widget
 * dropped on top. Anything left out falls back to the theme.
 */
export interface ComposerTone {
  /** The ground of the bar and of the focused panel. */
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
 * The result of a send. `false` keeps the composer open — the surface has
 * shown its own error and the words shouldn't be lost behind a collapse.
 * Anything else means it went, and the composer folds back into its bar.
 */
export type SendResult = boolean | void;

interface SharedProps {
  value: string;
  /**
   * Mentioned user ids ride along with the text, as MentionInput reports them.
   * Always an empty list when `mentions` is off, so a surface that doesn't
   * care can take a two-argument handler and ignore the second.
   */
  onChangeText: (text: string, mentionedUserIds: string[]) => void;
  placeholder: string;
  /** What the focused panel is headed — "Comment", "Message @someone". */
  title?: string;
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
  /** A "Replying to @x" strip, shown above the field in both modes. */
  banner?: React.ReactNode;
  tone?: ComposerTone;
}

export interface ComposerProps extends SharedProps {
  /** Something to lead the bar with — the writer's avatar, usually. */
  leading?: React.ReactNode;
  /** Draw the bar's send button as an icon rather than the label. */
  sendIcon?: boolean;
  /** Padding and such for the bar's wrapper — the home-indicator clearance. */
  barStyle?: StyleProp<ViewStyle>;
  /** Fired as the focused panel opens and closes. */
  onOpenChange?: (open: boolean) => void;
}

export interface ComposerHandle {
  /** Open the focused panel — for a Reply tap that should start you typing. */
  open: () => void;
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
    onAccent: tone?.onAccent ?? '#FFFFFF',
    grey:     c.grey,
  };
}

/**
 * The attached photos, above the toolbar, each with a way to take it back off.
 * Renders nothing until there's one. Exported for a surface that draws its
 * own collapsed field (ComposeMessageScreen) and still needs to show what's
 * attached while the panel is down.
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
            <X size={12} color="#FFFFFF" />
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

export interface FocusedComposerProps extends SharedProps {
  visible: boolean;
  /** Asked to fold back into the bar — the keyboard went, or the chevron was tapped. */
  onClose: () => void;
}

/**
 * The composer, open: the top half of the screen, sitting on the keyboard.
 *
 * ## Why it's a Modal
 *
 * The bar it grows out of lives in six different kinds of place — a comment
 * sheet, a chat sheet, a summary panel, a transparent screen, the middle of a
 * ScrollView — and an overlay drawn inside any of those is clipped by it. A
 * Modal is the one thing that draws over all of them the same way, and it's
 * rendered *inside* the host's tree rather than beside it so iOS presents it
 * over a host that is itself a Modal (see SummaryModal's note on stacking).
 *
 * It also means the keyboard is met in exactly one environment: always a
 * `statusBarTranslucent` Modal, on both platforms, rather than a plain screen
 * on one surface and a sheet on another. There is one set of keyboard sums to
 * get right, not six.
 *
 * ## Why it isn't a KeyboardAvoidingView
 *
 * The app is edge-to-edge on Android and this is a translucent Modal, and
 * neither window is resized by the keyboard — `adjustResize` and
 * KeyboardAvoidingView both have nothing to act on. And the arithmetic the
 * other sheets do (window height minus reported keyboard height) is exactly
 * what's off by a navigation bar on Android inside a Modal like this one.
 *
 * So nothing here is computed. The toolbar asks where it *is*, in the same
 * screen coordinates the keyboard reports its top edge in, and rises by the
 * difference — useKeyboardOverlap, the one mechanism SummaryModal already
 * uses for the same situation. On iOS that measurement comes with the
 * keyboard's own duration, so the toolbar travels with it; on Android the
 * event arrives after the fact and the hook takes its extra passes. It's
 * deliberately *not* paired with useKeyboardInset's padding as
 * ComposeMessageScreen does: both react to the same event, and with the
 * padding still at zero when the overlap is first measured, the two lifts
 * add up and the toolbar overshoots before the layout passes pull it back.
 *
 * The panel's ground fills the whole window, keyboard included, so the field
 * shrinking above the toolbar is the only thing that moves.
 *
 * ## Closing
 *
 * The keyboard going away *is* the signal to fold back into the bar — back
 * button, swipe, a tap on the chevron, a send. The one time the keyboard
 * leaves without meaning that is while a photo picker is up, which is what
 * `hold` is for: the picker hides the keyboard, the panel stays, and the field
 * takes focus back once the picker returns.
 */
export function FocusedComposer({
  visible, onClose, value, onChangeText, placeholder, title, photos, onSend, sending,
  mentions = false, sendLabel = 'Send', maxLength, banner, tone,
}: FocusedComposerProps) {
  const t = useTone(tone);
  const insets = useSafeAreaInsets();
  // The home indicator's clearance, while the keyboard is down (a picker up,
  // an alert showing). Zero once the keyboard is covering that strip.
  const bottomPad = useComposerBottomPad();
  const toolbarRef = useRef<View>(null);
  const { animated: toolbarLift, onLayout: onToolbarLayout } = useKeyboardOverlap(toolbarRef);

  const inputRef = useRef<TextInput>(null);
  // True while something other than the person has the keyboard — a picker,
  // a send in flight — and its going shouldn't close the panel.
  const hold = useRef(false);
  const picking = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const focus = useCallback(() => inputRef.current?.focus(), []);

  // `autoFocus` inside a Modal is unreliable on Android — the field can mount
  // before the Dialog's window is able to take the keyboard. Focus once the
  // Modal reports itself shown, and again a beat later for the cases where
  // `onShow` fires early.
  useEffect(() => {
    if (!visible) {
      // Whatever was holding the panel open is over with the panel.
      hold.current = false;
      picking.current = false;
      setPickerOpen(false);
      return;
    }
    const timer = setTimeout(focus, 120);
    return () => clearTimeout(timer);
  }, [visible, focus]);

  useEffect(() => {
    if (!visible) return;
    const event = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub = Keyboard.addListener(event, () => {
      if (!hold.current) onClose();
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const openPicker = () => {
    hold.current = true;
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    // A choice runs a frame after the sheet closes (see ActionSheet.choose),
    // so a cancel can only be told apart from a choice by waiting that frame.
    setTimeout(() => {
      if (!picking.current) {
        hold.current = false;
        focus();
      }
    }, 80);
  };

  const pick = async (from: PhotoSource) => {
    if (!photos) return;
    picking.current = true;
    try {
      await photos.add(from);
    } finally {
      picking.current = false;
      hold.current = false;
      // A beat later: straight after the picker's activity hands back, on
      // Android, this window may not yet be able to take the keyboard.
      setTimeout(focus, 150);
    }
  };

  const canSend = canSendWith(value, photos) && !sending && !photos?.preparing;

  const send = async () => {
    if (!canSend) return;
    // An error alert takes the keyboard on Android; that mustn't read as a
    // request to close.
    hold.current = true;
    let result: SendResult = false;
    try {
      result = await onSend();
    } finally {
      if (result !== false) {
        hold.current = false;
        onClose();
      } else {
        // The alert's window takes the keyboard a beat after it's asked for,
        // so the hold outlives the call by that much.
        setTimeout(() => { hold.current = false; }, 600);
      }
    }
  };

  const fieldStyle = [styles.panelField, { color: t.text }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={focus}
    >
      <View style={[styles.panel, { backgroundColor: t.surface, paddingTop: insets.top }]}>
        <View style={styles.panelHeader}>
          <Text style={[styles.panelTitle, { color: t.grey }]} numberOfLines={1}>
            {title ?? ''}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={10}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Minimize"
            accessibilityHint="Keeps what you wrote and closes the keyboard"
          >
            <ChevronDown size={24} color={t.grey} />
          </TouchableOpacity>
        </View>

        {banner}

        {mentions ? (
          <MentionInput
            ref={inputRef}
            fill
            multiline
            style={fieldStyle}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={t.grey}
            maxLength={maxLength}
          />
        ) : (
          <TextInput
            ref={inputRef}
            style={fieldStyle}
            value={value}
            onChangeText={(text) => onChangeText(text, [])}
            placeholder={placeholder}
            placeholderTextColor={t.grey}
            multiline
            maxLength={maxLength}
            textAlignVertical="top"
            // Prose — stated outright, since `spellCheck` only follows
            // `autoCorrect` when neither is given.
            autoCorrect
            spellCheck
            autoCapitalize="sentences"
          />
        )}

        {photos ? <ComposerPhotoStrip photos={photos} borderColor={t.border} /> : null}

        {/* The lift is a margin, not a transform: the field above is `flex: 1`,
            so a margin here shortens the field and the toolbar stays on the
            keyboard, where a transform would slide it over the words. */}
        <Animated.View
          ref={toolbarRef}
          onLayout={onToolbarLayout}
          style={[
            styles.toolbar,
            { borderTopColor: t.border, paddingBottom: 10 + bottomPad, marginBottom: toolbarLift },
          ]}
        >
          {photos ? <AttachButton photos={photos} tint={t.grey} onPress={openPicker} /> : <View />}
          <TouchableOpacity
            onPress={send}
            disabled={!canSend}
            style={[styles.sendPill, { backgroundColor: t.accent }, !canSend && styles.sendOff]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={sendLabel}
            accessibilityState={{ disabled: !canSend, busy: sending }}
          >
            {sending
              ? <ActivityIndicator size="small" color={t.onAccent} />
              : (
                <>
                  <Text style={[styles.sendPillText, { color: t.onAccent }]}>{sendLabel}</Text>
                  <Send size={15} color={t.onAccent} />
                </>
              )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {photos ? <PhotoSourceSheet visible={pickerOpen} onClose={closePicker} onPick={pick} /> : null}
    </Modal>
  );
}

/**
 * Where a comment or a message is written.
 *
 * Two modes. Collapsed, it's the small bar at the bottom of a thread — a field
 * that shows what's been written so far, the attach button, and Post or Send.
 * Tap the field and it opens into the FocusedComposer above: the top half of
 * the screen, on the keyboard, with the thread covered. Dismiss the keyboard
 * and it's the bar again, words intact.
 *
 * The bar's field is a Pressable rather than a TextInput on purpose. A real
 * field would take focus and raise the keyboard on its own, and the panel's
 * field would then have to take it *over* — two keyboards, one flicker, and on
 * Android a fair chance of neither. Nothing here is ever the thing you type
 * into; it's the thing you tap to start typing.
 *
 * The text and the photos are the caller's state, passed in — so nothing is
 * lost between the two modes, and the caller's own send handler keeps doing
 * exactly what it did (FormData, close-after-posting, its own error alert).
 */
const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer({
  value, onChangeText, placeholder, title, photos, onSend, sending, mentions,
  sendLabel = 'Send', maxLength, banner, tone, leading, sendIcon = false, barStyle, onOpenChange,
}, ref) {
  const t = useTone(tone);
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Through a ref, so the handle's `open`/`close` stay stable across renders
  // however the caller writes its callback.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const openPanel = useCallback(() => {
    setOpen(true);
    onOpenChangeRef.current?.(true);
  }, []);
  const closePanel = useCallback(() => {
    setOpen(false);
    onOpenChangeRef.current?.(false);
    // The panel's field unmounts with it, which takes the keyboard on its own;
    // this is belt and braces for the paths where it's already half gone.
    Keyboard.dismiss();
  }, []);

  useImperativeHandle(ref, () => ({ open: openPanel, close: closePanel }), [openPanel, closePanel]);

  const canSend = canSendWith(value, photos) && !sending && !photos?.preparing;

  return (
    <View style={[{ backgroundColor: t.surface }, barStyle]}>
      {banner}
      {photos ? <ComposerPhotoStrip photos={photos} borderColor={t.border} /> : null}
      <View style={styles.barRow}>
        {leading}
        <Pressable
          onPress={openPanel}
          style={[ss.chatInput, styles.barField, { backgroundColor: t.field, borderColor: t.border }]}
          accessibilityRole="button"
          accessibilityLabel={value ? `Edit: ${value}` : placeholder}
          accessibilityHint="Opens the composer"
        >
          <Text style={[styles.barText, { color: value ? t.text : t.grey }]} numberOfLines={2}>
            {value || placeholder}
          </Text>
        </Pressable>
        {photos ? (
          <AttachButton photos={photos} tint={t.grey} onPress={() => setPickerOpen(true)} size={21} />
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

      <FocusedComposer
        visible={open}
        onClose={closePanel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        title={title}
        photos={photos}
        onSend={onSend}
        sending={sending}
        mentions={mentions}
        sendLabel={sendLabel}
        maxLength={maxLength}
        banner={banner}
        tone={tone}
      />

      {/* The bar's own picker — a photo can be attached without opening the
          panel, as it always could. */}
      {photos ? (
        <PhotoSourceSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={(from) => { void photos.add(from); }}
        />
      ) : null}
    </View>
  );
});

export default Composer;

const styles = StyleSheet.create({
  // ── The bar ──────────────────────────────────────────────────────────────
  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  barField: { flex: 1, minHeight: 40, justifyContent: 'center' },
  barText:  { fontSize: 15, lineHeight: 20 },
  sendBtn:  { paddingHorizontal: 14, paddingVertical: 9, borderRadius: COMMON_RADIUS, flexShrink: 0 },
  sendIconBtn: {
    width: 40, height: 40, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendText: { fontWeight: '700', fontSize: 13 },
  sendOff:  { opacity: 0.4 },
  iconBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBtnOff: { opacity: 0.35 },

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

  // ── The panel ────────────────────────────────────────────────────────────
  panel:       { flex: 1 },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 16, paddingRight: 6, paddingTop: 4, paddingBottom: 2,
  },
  panelTitle:  { flex: 1, fontSize: 14, fontWeight: '700' },
  // The field takes everything between the header and the toolbar. Its own
  // padding is the panel's margin; there's no box drawn around it, because the
  // panel *is* the box.
  panelField:  {
    flex: 1, fontSize: 17, lineHeight: 24,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    textAlignVertical: 'top',
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: COMMON_RADIUS,
    minWidth: 84, justifyContent: 'center',
  },
  sendPillText: { fontWeight: '700', fontSize: 14 },
});
