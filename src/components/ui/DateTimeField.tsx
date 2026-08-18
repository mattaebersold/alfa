import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, Clock, X } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { parseDayKey, toDayKey, formatTime } from '../../constants/eventTypes';

/**
 * Native date and time fields for the event forms.
 *
 * Both keep the same wire format the API already speaks — "YYYY-MM-DD" for
 * dates, "HH:MM" 24-hour wall-clock for times — so only the input changes;
 * nothing downstream has to care that a picker produced the string.
 *
 * The two platforms want opposite things from a picker. Android's is a dialog
 * the OS presents and dismisses itself, so it's mounted only while open and
 * committed from its own event. iOS renders inline with no chrome of its own,
 * so it gets a small bottom sheet with Cancel/Done and an edit buffer — picking
 * a date shouldn't commit until you say so.
 */

const IOS = Platform.OS === 'ios';

/** Midday, so a DST shift can't roll the picker's date to the day before. */
const dateFromDayKey = (value?: string): Date => {
  const parsed = parseDayKey(value);
  if (!parsed) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  }
  parsed.setHours(12);
  return parsed;
};

/** "HH:MM" → a Date today at that time. Empty falls back to 9am. */
const dateFromTime = (value?: string): Date => {
  const now = new Date();
  const [h, m] = String(value ?? '').split(':').map(Number);
  const valid = !Number.isNaN(h) && h >= 0 && h <= 23;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), valid ? h : 9, valid ? (m || 0) : 0);
};

const toTimeString = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** Long form for the field face — "Sat, Oct 17, 2026". */
const formatDayKey = (value?: string): string | null => {
  const date = parseDayKey(value);
  if (!date) return null;
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

interface FieldProps {
  label?: string;
  /** "YYYY-MM-DD" for a date field, "HH:MM" for a time field. "" when unset. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Draws an X to empty the field. For optional values like an end time. */
  clearable?: boolean;
  /** Date fields only — the earliest selectable day. */
  minimumDate?: Date;
}

/** The tappable face both fields share: label above, value in a bordered row. */
function FieldFace({
  label, display, placeholder, icon: Icon, onPress, onClear,
}: {
  label?: string;
  display: string | null;
  placeholder: string;
  icon: typeof Calendar;
  onPress: () => void;
  onClear?: () => void;
}) {
  const colors = useColors();

  return (
    <View style={{ flex: 1 }}>
      {label ? <Text style={[styles.label, { color: colors.grey }]}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.face, { borderColor: colors.inputBorder, backgroundColor: colors.card }]}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${display ?? placeholder}` : display ?? placeholder}
      >
        <Icon size={15} color={colors.grey} />
        <Text style={[styles.faceText, { color: display ? colors.fg : colors.grey }]} numberOfLines={1}>
          {display ?? placeholder}
        </Text>
        {onClear && display ? (
          <TouchableOpacity onPress={onClear} hitSlop={10} accessibilityLabel="Clear">
            <X size={15} color={colors.grey} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

/** The iOS sheet: the picker plus the Cancel/Done bar it doesn't come with. */
function IOSPickerSheet({
  visible, title, children, onCancel, onDone,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onDone: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.sheetBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onCancel} hitSlop={8}>
              <Text style={[styles.sheetAction, { color: colors.grey }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.sheetTitle, { color: colors.fg }]}>{title}</Text>
            <TouchableOpacity onPress={onDone} hitSlop={8}>
              <Text style={[styles.sheetAction, { color: brand }]}>Done</Text>
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function DateField({
  label, value, onChange, placeholder = 'Pick a date', clearable, minimumDate,
}: FieldProps) {
  const [open, setOpen] = useState(false);
  // iOS edits a buffer so Cancel really cancels; Android commits from its dialog.
  const [draft, setDraft] = useState<Date>(() => dateFromDayKey(value));

  const openPicker = () => {
    setDraft(dateFromDayKey(value));
    setOpen(true);
  };

  return (
    <>
      <FieldFace
        label={label}
        display={formatDayKey(value)}
        placeholder={placeholder}
        icon={Calendar}
        onPress={openPicker}
        onClear={clearable ? () => onChange('') : undefined}
      />

      {IOS ? (
        <IOSPickerSheet
          visible={open}
          title={label ?? 'Date'}
          onCancel={() => setOpen(false)}
          onDone={() => { setOpen(false); onChange(toDayKey(draft)); }}
        >
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            themeVariant="dark"
            onChange={(_, picked) => picked && setDraft(picked)}
          />
        </IOSPickerSheet>
      ) : open ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="calendar"
          minimumDate={minimumDate}
          onChange={(event, picked) => {
            setOpen(false);
            if (event.type === 'set' && picked) onChange(toDayKey(picked));
          }}
        />
      ) : null}
    </>
  );
}

export function TimeField({ label, value, onChange, placeholder = 'Pick a time', clearable }: FieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => dateFromTime(value));

  const openPicker = () => {
    setDraft(dateFromTime(value));
    setOpen(true);
  };

  return (
    <>
      <FieldFace
        label={label}
        display={formatTime(value)}
        placeholder={placeholder}
        icon={Clock}
        onPress={openPicker}
        onClear={clearable ? () => onChange('') : undefined}
      />

      {IOS ? (
        <IOSPickerSheet
          visible={open}
          title={label ?? 'Time'}
          onCancel={() => setOpen(false)}
          onDone={() => { setOpen(false); onChange(toTimeString(draft)); }}
        >
          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
            themeVariant="dark"
            onChange={(_, picked) => picked && setDraft(picked)}
          />
        </IOSPickerSheet>
      ) : open ? (
        <DateTimePicker
          value={draft}
          mode="time"
          display="clock"
          onChange={(event, picked) => {
            setOpen(false);
            if (event.type === 'set' && picked) onChange(toTimeString(picked));
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 16 },
  face: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: IOS ? 12 : 11,
  },
  faceText: { flex: 1, fontSize: 15 },

  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  sheetBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle:  { fontSize: 15, fontWeight: '800' },
  sheetAction: { fontSize: 15, fontWeight: '700' },
});
