import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, Animated, RefreshControl,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { Plus, Check, Pencil, Trash2, ChevronDown, ChevronUp, Archive, ArrowLeft, Link2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useGetCarTasksQuery,
  useGetArchivedCarTasksQuery,
  useCreateCarTaskMutation,
  useUpdateCarTaskMutation,
  useToggleCarTaskMutation,
  useDeleteCarTaskMutation,
  useUpdateCarTaskPositionsMutation,
} from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppScreenProps } from '../../navigation/types';
import type { CarTask } from '../../types/api';
import { ss } from '../../styles/shared';

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
type Priority = typeof PRIORITIES[number];

const TASK_CATEGORIES: { key: string; label: string }[] = [
  { key: 'general',    label: 'General' },
  { key: 'engine',     label: 'Engine' },
  { key: 'interior',   label: 'Interior' },
  { key: 'exterior',   label: 'Exterior' },
  { key: 'electrical', label: 'Electrical' },
  { key: 'suspension', label: 'Suspension' },
  { key: 'brakes',     label: 'Brakes' },
  { key: 'wheels',     label: 'Wheels & Tires' },
  { key: 'other',      label: 'Other' },
];
const CAT_LABEL = (key?: string) => TASK_CATEGORIES.find((c) => c.key === (key ?? 'general'))?.label ?? 'General';
const CAT_ORDER = (key?: string) => {
  const i = TASK_CATEGORIES.findIndex((c) => c.key === (key ?? 'general'));
  return i === -1 ? 999 : i;
};

/**
 * The rule between tasks inside a category — a step lighter than `borderDark`,
 * which sat too close to the row colour to register.
 */
const TASK_DIVIDER = '#4A4A4A';

/** How far a category card is held off the screen edges, and its corner radius. */
const GROUP_INSET = 12;
const GROUP_RADIUS = 14;

type Row =
  | { _type: 'header'; category: string; key: string; count: number; collapsed: boolean }
  | { _type: 'task'; task: CarTask; key: string; isLast: boolean };

/**
 * Flags the last task of each run, so its bottom rule can be dropped — the
 * category band below already closes the group off.
 *
 * Derived from the row list rather than tracked per-task, so it stays correct
 * after a drag reorders things without a round trip to the server.
 */
function withLastFlags(rows: Row[]): Row[] {
  return rows.map((row, i) => {
    if (row._type !== 'task') return row;
    const next = rows[i + 1];
    return { ...row, isLast: !next || next._type !== 'task' };
  });
}

/** Rank for sorting — the order PRIORITIES is declared in, worst first. */
const PRIORITY_RANK = (p?: string) => {
  const i = PRIORITIES.indexOf((p ?? 'medium') as Priority);
  return i === -1 ? PRIORITIES.indexOf('medium') : i;
};

// A header for each non-empty category (in TASK_CATEGORIES order, so General
// leads), followed by that category's open tasks — critical first, then by
// position within a priority. Drag a task under a different header to move it
// to that category.
//
// A collapsed category keeps its header — and its count, which is the whole
// point of collapsing one — but drops its rows.
function buildRows(open: CarTask[], collapsed: Record<string, boolean> = {}): Row[] {
  const rows: Row[] = [];
  TASK_CATEGORIES.forEach((cat) => {
    const catTasks = open
      .filter((t) => (t.category ?? 'general') === cat.key)
      .sort((a, b) =>
        PRIORITY_RANK(a.priority) - PRIORITY_RANK(b.priority)
        || (a.position ?? 0) - (b.position ?? 0));
    if (catTasks.length === 0) return;
    const isCollapsed = !!collapsed[cat.key];
    rows.push({
      _type: 'header',
      category: cat.key,
      key: `h-${cat.key}`,
      count: catTasks.length,
      collapsed: isCollapsed,
    });
    if (isCollapsed) return;
    catTasks.forEach((t) => rows.push({ _type: 'task', task: t, key: t.internal_id, isLast: false }));
  });
  return withLastFlags(rows);
}

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: '#FF0000',
  high:     '#FA7921',
  medium:   colors.primaryAlt,
  low:      colors.grey,
};

/** Handles both of the palette's forms: '#RRGGBB' and 'rgb(r, g, b)'. */
function parseColor(c: string): [number, number, number] | null {
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return rgb ? [+rgb[1], +rgb[2], +rgb[3]] : null;
}

/**
 * A priority pill's label: its own colour taken well down toward black.
 *
 * Keeps the badge reading as one object — the label is unmistakably the same
 * hue as its ground — while staying legible. Lightening was the other way to
 * derive it, but all four priority colours are mid-to-bright, so a pale tint
 * lands near 3:1 against them where darkening clears 4:1 on every one.
 */
function priorityTextColor(bg: string): string {
  const rgb = parseColor(bg);
  if (!rgb) return '#FFFFFF';
  const [r, g, b] = rgb.map((v) => Math.round(v * 0.26));
  return `rgb(${r}, ${g}, ${b})`;
}

// ── Task Dialog ───────────────────────────────────────────────────────────────
/**
 * A small centred dialog for adding *or* editing a task.
 *
 * The three fields worth deciding up front — a title, where it goes, and how
 * urgent it is — are always visible. A description and a reference link are the
 * exception rather than the rule, so they sit behind a collapsed "Optional
 * fields" section: available in the same pass if you already have them,
 * invisible if you don't.
 *
 * Editing used to open a full-screen page sheet instead. Two different surfaces
 * for the same five fields meant the same task looked like two different forms
 * depending on how you got there, so the pane is gone and this is the one way in.
 *
 * Deleting lives here too, for the same reason: this is where you already are
 * when you've decided a task shouldn't exist.
 */
function TaskDialog({
  visible,
  onClose,
  onSave,
  onDelete,
  saving,
  initial,
  initialCategory = 'general',
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { title: string; body: string; link: string; priority: Priority; category: string }) => void;
  /** Only called for an existing task — a new one has nothing to delete. */
  onDelete: () => void;
  saving: boolean;
  /** The task being edited. Absent means this is a new one. */
  initial?: Partial<CarTask>;
  /** Preselected for a new task opened from a category header; still changeable. */
  initialCategory?: string;
}) {
  const colors = useColors();
  const isEdit = !!initial?.internal_id;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState(initialCategory);

  // Seed on open, not on close — clearing while it animates out is visible.
  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setBody(initial?.body ?? '');
    setLink(initial?.link ?? '');
    // A task that already has notes or a link opens with them showing —
    // collapsing existing content behind a closed accordion would hide it from
    // the person who came here to change it.
    setOptionalOpen(!!(initial?.body || initial?.link));
    setPriority((initial?.priority as Priority) ?? 'medium');
    setCategory(initial?.category ?? initialCategory);
  }, [visible, initial, initialCategory]);

  const submit = () => {
    if (!title.trim() || saving) return;
    onSave({ title: title.trim(), body: body.trim(), link: link.trim(), priority, category });
  };

  // Confirmed rather than immediate: the button sits an inch from Save, and a
  // to-do list is exactly the kind of thing people edit one-handed.
  const confirmDelete = () => {
    if (saving) return;
    Alert.alert(
      'Delete task?',
      `"${initial?.title ?? 'This task'}" will be removed. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
      { cancelable: true },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={dialog.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Scrollable because the optional section can push the dialog past the
            screen once the keyboard is up. */}
        <ScrollView
          style={dialog.scroll}
          contentContainerStyle={dialog.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={[dialog.card, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
          <Text style={[dialog.heading, { color: colors.fg }]}>{isEdit ? 'Edit Task' : 'New Task'}</Text>

          <TextInput
            style={[dialog.input, { borderColor: TASK_DIVIDER, color: '#FFFFFF' }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Replace brake pads"
            placeholderTextColor={colors.grey}
            // Only for a new task: editing one starts with the cursor jumping
            // into a field that's already filled in, which fights the keyboard
            // for the rest of the form.
            autoFocus={!isEdit}
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <Text style={[dialog.label, { color: colors.grey }]}>Priority</Text>
          <View style={dialog.chips}>
            {PRIORITIES.map((p) => {
              const on = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    dialog.chip,
                    on
                      ? { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }
                      : { borderColor: TASK_DIVIDER },
                  ]}
                >
                  <Text style={[
                    dialog.chipText,
                    { color: on ? priorityTextColor(PRIORITY_COLORS[p]) : colors.grey },
                  ]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[dialog.label, { color: colors.grey }]}>Category</Text>
          <View style={dialog.chips}>
            {TASK_CATEGORIES.map((cat) => {
              const on = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setCategory(cat.key)}
                  style={[
                    dialog.chip,
                    on
                      ? { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt }
                      : { borderColor: TASK_DIVIDER },
                  ]}
                >
                  <Text style={[dialog.chipText, { color: on ? '#000000' : colors.grey }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Optional fields — collapsed unless the task already has some */}
          <TouchableOpacity
            style={[dialog.accordionHeader, { borderColor: TASK_DIVIDER }]}
            onPress={() => setOptionalOpen((v) => !v)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ expanded: optionalOpen }}
            accessibilityLabel="Optional fields"
          >
            <Text style={[dialog.accordionText, { color: colors.grey }]}>Optional fields</Text>
            {optionalOpen
              ? <ChevronUp size={15} color={colors.grey} />
              : <ChevronDown size={15} color={colors.grey} />}
          </TouchableOpacity>

          {optionalOpen && (
            <View style={dialog.accordionBody}>
              <Text style={[dialog.label, dialog.labelTight, { color: colors.grey }]}>Description</Text>
              <TextInput
                style={[dialog.input, dialog.textarea, { borderColor: TASK_DIVIDER, color: '#FFFFFF' }]}
                value={body}
                onChangeText={setBody}
                placeholder="Details, part numbers, etc."
                placeholderTextColor={colors.grey}
                multiline
                textAlignVertical="top"
              />

              <Text style={[dialog.label, { color: colors.grey }]}>Link</Text>
              <TextInput
                style={[dialog.input, { borderColor: TASK_DIVIDER, color: '#FFFFFF' }]}
                value={link}
                onChangeText={setLink}
                placeholder="https://..."
                placeholderTextColor={colors.grey}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          )}

          <View style={dialog.actions}>
            {/* Pushed to the far left, away from Save — destructive and
                constructive shouldn't share an edge. */}
            {isEdit && (
              <TouchableOpacity
                onPress={confirmDelete}
                style={dialog.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel="Delete task"
              >
                <Trash2 size={15} color={colors.red} />
                <Text style={[dialog.deleteText, { color: colors.red }]}>Delete</Text>
              </TouchableOpacity>
            )}
            <View style={ss.fill} />
            <TouchableOpacity onPress={onClose} style={dialog.cancelBtn}>
              <Text style={[dialog.cancelText, { color: colors.grey }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={!title.trim() || saving}
              style={[
                dialog.addBtn,
                { backgroundColor: colors.pro },
                (!title.trim() || saving) && dialog.addBtnOff,
              ]}
            >
              <Text style={dialog.addText}>{isEdit ? 'Save' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const dialog = StyleSheet.create({
  backdrop:   {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 24,
  },
  // The ScrollView must not stretch to the backdrop's full height, or its
  // content stops being centred and pins to the top.
  scroll:        { flexGrow: 0, width: '100%', maxWidth: 400 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  card:       { width: '100%', maxWidth: 400, borderRadius: 16, borderWidth: 1, padding: 18 },
  heading:    { fontSize: 17, fontWeight: '800', marginBottom: 14 },
  input:      {
    height: 44, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 15,
  },
  textarea:   { height: 88, paddingTop: 10, paddingBottom: 10 },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderRadius: 10,
  },
  accordionText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  accordionBody: { marginTop: 10, gap: 6 },
  // The first label inside the accordion doesn't need the gap the shared label
  // style adds — the accordion header already spaced it.
  labelTight:    { marginTop: 0 },
  label:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  chipText:   { fontSize: 12, fontWeight: '700' },
  actions:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  deleteBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingRight: 8 },
  deleteText: { fontSize: 15, fontWeight: '700' },
  cancelBtn:  { paddingHorizontal: 14, paddingVertical: 10 },
  cancelText: { fontSize: 15, fontWeight: '600' },
  addBtn:     { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 },
  addBtnOff:  { opacity: 0.4 },
  addText:    { fontSize: 15, fontWeight: '800', color: '#000000' },
});

// ── Task Row ──────────────────────────────────────────────────────────────────
function TaskRow({
  task,
  onToggle,
  onEdit,
  onLongPress,
  isActive,
  isLast,
}: {
  task: CarTask;
  onToggle: () => void;
  /** The pencil, at the end of the row — the row itself isn't tappable. */
  onEdit: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
  /** Last row of its group — drops the bottom rule. */
  isLast?: boolean;
}) {
  const colors = useColors();

  /**
   * Ticking a task off should feel like something.
   *
   * The checkbox pops past its own size and springs back, and a wash of the
   * brand colour sweeps across the row — enough to register in peripheral vision
   * when you're working down a list, short enough not to hold up the next tap.
   * Both are fired from the press rather than from `task.completed` changing, so
   * the feedback is immediate; the mutation patches the cache optimistically, so
   * the checkbox fills on the same frame.
   *
   * Un-completing gets the pop and a light tick, but no flash and no success
   * notification — undoing isn't an achievement.
   */
  const checkScale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;

  const handleToggle = () => {
    const completing = !task.completed;

    if (completing) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    checkScale.setValue(1);
    Animated.sequence([
      Animated.timing(checkScale, { toValue: 1.35, duration: 110, useNativeDriver: true }),
      Animated.spring(checkScale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();

    if (completing) {
      flash.setValue(0);
      Animated.sequence([
        Animated.timing(flash, { toValue: 0.22, duration: 90, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    }

    onToggle();
  };

  // With the grab handle gone, the long press is the only way into a drag — so
  // it has to announce itself. The tap lands at the moment the row becomes
  // draggable, which is what tells you to keep your finger down and move.
  const handleLongPress = onLongPress
    ? () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onLongPress();
      }
    : undefined;

  return (
    <TouchableOpacity
      style={[
        taskRow.row,
        {
          backgroundColor: colors.card,
          borderBottomColor: TASK_DIVIDER,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        },
        // The last row closes off its category card.
        isLast && taskRow.rowLast,
        task.completed && taskRow.rowDone,
        isActive && taskRow.rowActive,
      ]}
      // No onPress: the row does nothing when tapped. Ticking it off is the
      // checkbox, editing is the pencil, and long press starts a drag — a
      // whole-row tap would only fire one of those by accident.
      onLongPress={handleLongPress}
      // 180ms was tuned for a row that also had a handle to grab; on its own it
      // fires often enough during a scroll to feel accidental.
      delayLongPress={300}
      activeOpacity={1}
    >
      {/* Checkbox — the only way to complete a task */}
      <Animated.View style={{ transform: [{ scale: checkScale }] }}>
        <TouchableOpacity
          style={[taskRow.check, task.completed && taskRow.checkDone]}
          onPress={handleToggle}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!task.completed }}
          accessibilityLabel={task.title}
        >
          {task.completed && <Check size={11} color="#FFFFFF" />}
        </TouchableOpacity>
      </Animated.View>


      {/* Content */}
      <View style={taskRow.content}>
        <View style={taskRow.titleRow}>
          <Text style={[taskRow.title, { color: '#FFFFFF' }, task.completed && { textDecorationLine: 'line-through', color: colors.grey }]} numberOfLines={1}>
            {task.title}
          </Text>
          {task.priority && (
            <View style={[taskRow.priorityPill, { backgroundColor: PRIORITY_COLORS[(task.priority as Priority)] }]}>
              <Text style={[
                taskRow.priorityText,
                { color: priorityTextColor(PRIORITY_COLORS[(task.priority as Priority)]) },
              ]}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </Text>
            </View>
          )}
        </View>
        {task.body ? (
          <Text style={[taskRow.body, { color: colors.muted }]} numberOfLines={2}>{task.body}</Text>
        ) : null}
        {task.link ? (
          <TouchableOpacity
            style={taskRow.linkRow}
            onPress={() => Linking.openURL(task.link as string).catch(() => {})}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="link"
            accessibilityLabel={`Open link for ${task.title ?? 'task'}`}
          >
            <Link2 size={12} color={colors.primaryAlt} />
            <Text style={[taskRow.linkText, { color: colors.primaryAlt }]} numberOfLines={1}>
              {task.link.replace(/^https?:\/\/(www\.)?/, '')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Edit — straight into the dialog. The ⋮ menu it replaces held two
          items, one of which (Delete) now lives inside that same dialog, so
          the menu was a tap standing between the row and the only thing it
          could usefully do. */}
      <TouchableOpacity
        onPress={onEdit}
        style={taskRow.del}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.title ?? 'task'}`}
      >
        <Pencil size={16} color={colors.grey} />
      </TouchableOpacity>

      {/* Completion flash — a wash of the brand colour that sweeps out as the
          row settles into its done state. Last child so it washes the whole row
          evenly rather than sliding under the later siblings, absolutely
          positioned so it stays out of the layout, and non-interactive so it
          can't eat the taps underneath it. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          taskRow.flash,
          { backgroundColor: colors.primaryAlt, opacity: flash },
        ]}
      />
    </TouchableOpacity>
  );
}

const taskRow = StyleSheet.create({
  row: {
    // Centred, not top-aligned: the checkbox and menu now sit on the title's
    // centre line instead of being nudged into place with margins.
    flexDirection: 'row', alignItems: 'center', gap: 12,
    // Asymmetric: the ⋮ is mostly whitespace inside its own glyph box, so a
    // matching right pad leaves it looking stranded well short of the edge.
    paddingLeft: 14, paddingRight: 4, paddingVertical: 12,
    marginHorizontal: GROUP_INSET,
  },
  rowLast: {
    borderBottomLeftRadius: GROUP_RADIUS,
    borderBottomRightRadius: GROUP_RADIUS,
  },
  rowDone: { opacity: 0.55 },
  // Clipped to the row's own rounding so the wash can't spill past a group's
  // bottom corners.
  flash:   { borderRadius: GROUP_RADIUS },
  rowActive: { opacity: 0.95, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  check: {
    // Dimmed white while empty — present without competing with the title.
    // `checkDone` takes it to the brand once ticked, so the filled state is
    // what carries the colour.
    width: 19, height: 19, borderRadius: 9.5, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkDone: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  content:  { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Shrinks rather than fills, so the pill sits against the end of the title
  // instead of being pushed out to the far edge of the row.
  title:    { flexShrink: 1, fontSize: 14, fontWeight: '400' },
  body:     { fontSize: 13, lineHeight: 18, marginTop: 3 },
  linkRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  linkText: { flexShrink: 1, fontSize: 12, fontWeight: '600' },
  // Filled pill rather than loose text — it reads as a label at this size, and
  // matches the priority chips in the add/edit sheet. `flexShrink: 0` stops the
  // row's squeeze landing on the pill rather than on the title.
  priorityPill: {
    flexShrink: 0,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 999,
  },
  priorityText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },
  del:      { padding: 2 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CarTasksScreen({ route, navigation }: AppScreenProps<'CarTasks'>) {
  const { carId, carTitle } = route.params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Measured rather than assumed — the bar's height depends on the safe-area
  // inset and on whether the car has a title to show underneath.
  const [headerH, setHeaderH] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  // Collapsed by default — done work is reference, not the reason you opened
  // the list, and on a long-running project it dwarfs what's still open.
  const [showCompleted, setShowCompleted] = useState(false);
  // One dialog for both adding and editing — `editingTask` is the only thing
  // that differs between the two.
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<CarTask | undefined>(undefined);
  const [newTaskCategory, setNewTaskCategory] = useState('general');
  // Empty means everything is open — categories always start expanded, and
  // collapsing is a per-visit choice rather than something that persists.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCategory = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // Opened from a category header, the dialog starts on that category — the
  // common case is adding another task where you're already looking.
  const openNewTask = (category = 'general') => {
    setEditingTask(undefined);
    setNewTaskCategory(category);
    setDialogVisible(true);
  };

  const closeDialog = () => {
    setDialogVisible(false);
    // Cleared on close so the next "new task" doesn't briefly show the last
    // edited one while the dialog fades in.
    setEditingTask(undefined);
  };

  const { data: tasksData, isLoading, refetch: refetchTasks } = useGetCarTasksQuery(carId);
  const tasks = tasksData?.entries ?? [];
  const { data: archivedData, refetch: refetchArchived } = useGetArchivedCarTasksQuery(carId, { skip: !showArchived });
  const archived = archivedData?.entries ?? [];

  const [createTask, { isLoading: creating }] = useCreateCarTaskMutation();
  const [updateTask, { isLoading: updating }] = useUpdateCarTaskMutation();
  const [toggleTask] = useToggleCarTaskMutation();
  const [deleteTask] = useDeleteCarTaskMutation();

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const [updatePositions] = useUpdateCarTaskPositionsMutation();

  // Draggable rows for open tasks (rebuilt whenever the task data changes).
  const [dragData, setDragData] = useState<Row[]>([]);
  useEffect(() => {
    setDragData(buildRows(tasks.filter((t) => !t.completed), collapsed));
  }, [tasks, collapsed]);

  const handleDragEnd = ({ data }: { data: Row[] }) => {
    // Re-flag before storing: a dropped task carries the old list's `isLast`,
    // which would leave a stray rule (or a missing one) until the refetch.
    setDragData(withLastFlags(data)); // optimistic
    const persist: { internal_id: string; position: number; category: string }[] = [];
    let currentCat = 'general';
    const counters: Record<string, number> = {};
    data.forEach((row) => {
      if (row._type === 'header') { currentCat = row.category; return; }
      const pos = counters[currentCat] ?? 0;
      counters[currentCat] = pos + 1;
      const t = row.task;
      if ((t.category ?? 'general') !== currentCat || (t.position ?? -1) !== pos) {
        persist.push({ internal_id: t.internal_id, position: pos, category: currentCat });
      }
    });
    if (persist.length) updatePositions({ tasks: persist, car_id: carId });
  };

  const handleSave = async (data: { title: string; body: string; link: string; priority: Priority; category: string }) => {
    try {
      if (editingTask?.internal_id) {
        await updateTask({ ...editingTask, ...data }).unwrap();
      } else {
        await createTask({ car_id: carId, position: tasks.length, ...data }).unwrap();
      }
      closeDialog();
    } catch {
      // Leave the dialog open with its text intact so nothing typed is lost.
      Alert.alert(
        editingTask ? 'Could not save task' : 'Could not add task',
        'Please try again.',
      );
    }
  };

  const handleEdit = (task: CarTask) => {
    setEditingTask(task);
    setDialogVisible(true);
  };

  const handleToggle = (task: CarTask) => {
    // Send the intended state explicitly rather than relying on the server's
    // flip, so rapid taps can't race into the wrong value.
    toggleTask({ internal_id: task.internal_id, car_id: carId, completed: !task.completed });
  };

  /**
   * Delete is only reachable from the dialog, so it closes on success — the
   * form it belongs to is about a task that no longer exists. A failure keeps
   * the dialog open and says so, rather than closing on a task that's still
   * there.
   */
  const handleDelete = async () => {
    const task = editingTask;
    if (!task?.internal_id) return;
    try {
      await deleteTask({ taskId: task.internal_id, car_id: carId }).unwrap();
      closeDialog();
    } catch {
      Alert.alert('Could not delete task', 'Please try again.');
    }
  };

  // Pull to refresh. The list is a shared to-do — a co-owner can tick things
  // off from their own phone, and nothing pushes that here.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchTasks(),
        showArchived ? refetchArchived() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchTasks, refetchArchived, showArchived]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    // Only the bottom edge: the header handles the top inset itself, so the
    // list can run underneath it.
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <DraggableFlatList
        data={dragData}
        keyExtractor={(item) => item.key}
        onDragEnd={handleDragEnd}
        activationDistance={12}
        // Both layers need stretching. `containerStyle` is the library's own
        // wrapper; `style` passes through to the FlatList inside it. Neither
        // flexes by default, so with the header no longer taking up flow space
        // the whole thing collapsed to its content height.
        containerStyle={ss.fill}
        style={ss.fill}
        renderItem={({ item, drag, isActive }: RenderItemParams<Row>) => {
          if (item._type === 'header') {
            return (
              <View style={[
                styles.catHeader,
                { backgroundColor: colors.secondary },
                // Collapsed, no rows follow to close the card off.
                item.collapsed && styles.catHeaderClosed,
              ]}>
                <Text style={[styles.catHeaderText, { color: colors.fg }]}>{CAT_LABEL(item.category)}</Text>
                <View style={[styles.catCount, { backgroundColor: colors.borderDark }]}>
                  <Text style={[styles.catCountText, { color: colors.fg }]}>{item.count}</Text>
                </View>
                <View style={ss.fill} />
                <TouchableOpacity
                  onPress={() => openNewTask(item.category)}
                  hitSlop={10}
                  style={[styles.catAdd, { borderColor: colors.pro }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add task to ${CAT_LABEL(item.category)}`}
                >
                  <Plus size={14} color={colors.pro} strokeWidth={3} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleCategory(item.category)}
                  hitSlop={10}
                  style={styles.catCaret}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.collapsed ? 'Expand' : 'Collapse'} ${CAT_LABEL(item.category)}`}
                >
                  {/* Two icons rather than one rotated by a style transform —
                      the transformed SVG reserved its space but drew nothing. */}
                  {item.collapsed
                    ? <ChevronDown size={16} color={colors.grey} />
                    : <ChevronUp size={16} color={colors.grey} />}
                </TouchableOpacity>
              </View>
            );
          }
          return (
            <ScaleDecorator>
              <TaskRow
                task={item.task}
                onToggle={() => handleToggle(item.task)}
                onEdit={() => handleEdit(item.task)}
                onLongPress={drag}
                isActive={isActive}
                isLast={item.isLast}
              />
            </ScaleDecorator>
          );
        }}
        ListFooterComponent={
          <View>
            {done.length > 0 && (
              <View>
                <TouchableOpacity
                  style={[
                    styles.divider,
                    { backgroundColor: colors.secondary },
                    !showCompleted && styles.dividerClosed,
                  ]}
                  onPress={() => setShowCompleted((v) => !v)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${showCompleted ? 'Hide' : 'Show'} ${done.length} completed tasks`}
                >
                  <Text style={[styles.dividerText, { color: colors.fg }]}>Completed</Text>
                  <View style={[styles.dividerCount, { backgroundColor: colors.borderDark }]}>
                    <Text style={[styles.dividerCountText, { color: colors.fg }]}>{done.length}</Text>
                  </View>
                  <View style={ss.fill} />
                  {showCompleted
                    ? <ChevronUp size={16} color={colors.grey} />
                    : <ChevronDown size={16} color={colors.grey} />}
                </TouchableOpacity>
                {showCompleted && done.map((item, i) => (
                  <TaskRow
                    key={item.internal_id}
                    task={item}
                    onToggle={() => handleToggle(item)}
                    onEdit={() => handleEdit(item)}
                    isLast={i === done.length - 1}
                  />
                ))}
              </View>
            )}

            {/* Archived moved down here when it left the top bar — it still
                needs a way in, and its query stays skipped until it's opened. */}
            <View>
              <TouchableOpacity
                style={[
                  styles.divider,
                  { backgroundColor: colors.secondary },
                  (!showArchived || archived.length === 0) && styles.dividerClosed,
                ]}
                onPress={() => setShowArchived((v) => !v)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${showArchived ? 'Hide' : 'Show'} archived tasks`}
              >
                <Archive size={14} color={colors.grey} />
                <Text style={[styles.dividerText, { color: colors.fg }]}>Archived</Text>
                {showArchived && archived.length > 0 && (
                  <View style={[styles.dividerCount, { backgroundColor: colors.borderDark }]}>
                    <Text style={[styles.dividerCountText, { color: colors.fg }]}>{archived.length}</Text>
                  </View>
                )}
                <View style={ss.fill} />
                {showArchived
                  ? <ChevronUp size={16} color={colors.grey} />
                  : <ChevronDown size={16} color={colors.grey} />}
              </TouchableOpacity>
              {showArchived && archived.map((item, i) => (
                <TaskRow
                  key={item.internal_id}
                  task={item}
                  onToggle={() => handleToggle(item)}
                  onEdit={() => handleEdit(item)}
                  isLast={i === archived.length - 1}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          done.length === 0
            ? <EmptyState title="No tasks" message="Add your first task to get started." />
            : null
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.pro}
            // The spinner would otherwise appear under the blurred header bar
            // the list scrolls beneath.
            progressViewOffset={headerH || insets.top + 62}
          />
        }
        // Starts the content below the floating header. Until onLayout has
        // measured it, an estimate keeps the first paint from starting hidden.
        contentContainerStyle={[styles.list, { paddingTop: headerH || insets.top + 62 }]}
      />

      {/* Header — rendered after the list so it paints over it. Tasks scroll
          behind the blur rather than stopping at a hard edge. */}
      <View
        style={styles.headerWrap}
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      >
        <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
        {/* The blur alone doesn't darken enough for white text over a pale
            task card to stay readable. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18,18,18,0.55)' }]} />
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          {/* Dedicated back control — returns to the car this list belongs to. */}
          <TouchableOpacity
            style={[styles.backCircle, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back to car"
          >
            <ArrowLeft size={20} color={colors.fg} />
          </TouchableOpacity>
          <View style={ss.fill}>
            <Text style={[styles.topBarTitle, { color: colors.fg }]} numberOfLines={1}>To-dos</Text>
            {carTitle ? (
              <Text style={[styles.topBarSub, { color: colors.grey }]} numberOfLines={1}>{carTitle}</Text>
            ) : null}
          </View>
          {/* Tallies live up here rather than in a band above the first
              category, so the list starts with actual tasks. */}
          <View style={styles.counts}>
            <Text style={[styles.countOpen, { color: colors.fg }]}>{open.length} open</Text>
            {done.length > 0 && (
              <Text style={[styles.countDone, { color: colors.grey }]}>{done.length} completed</Text>
            )}
          </View>
        </View>
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => openNewTask()}
      >
        <Plus size={24} color="#000000" strokeWidth={3} />
      </TouchableOpacity>

      <TaskDialog
        visible={dialogVisible}
        onClose={closeDialog}
        onSave={handleSave}
        onDelete={handleDelete}
        saving={creating || updating}
        initial={editingTask}
        initialCategory={newTaskCategory}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  topBarSub:   { fontSize: 12, marginTop: 1 },
  counts:      { alignItems: 'flex-end' },
  countOpen:   { fontSize: 15, fontWeight: '800' },
  countDone:   { fontSize: 11, marginTop: 1 },

  // Clears the FAB (56 tall, 24 from the bottom) plus room to scroll the last
  // row above it — otherwise the final task sits under the button.
  list: { flexGrow: 1, paddingBottom: 140 },
  // Same card treatment as a category header — these divide the list the same
  // way, so they shouldn't look like a different kind of boundary.
  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 18, marginHorizontal: GROUP_INSET,
    borderTopLeftRadius: GROUP_RADIUS, borderTopRightRadius: GROUP_RADIUS,
  },
  // Collapsed there are no rows beneath to close the card, so it rounds itself.
  dividerClosed: {
    borderBottomLeftRadius: GROUP_RADIUS,
    borderBottomRightRadius: GROUP_RADIUS,
  },
  dividerText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  dividerCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  dividerCountText: { fontSize: 11, fontWeight: '800' },
  // Each category is a card: a lighter cap, its tasks below, and the last row
  // rounding off the bottom. Inset from the edges so the group reads as one
  // object sitting on the screen rather than a full-bleed band.
  catHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 18, marginHorizontal: GROUP_INSET,
    borderTopLeftRadius: GROUP_RADIUS, borderTopRightRadius: GROUP_RADIUS,
  },
  catHeaderClosed: {
    borderBottomLeftRadius: GROUP_RADIUS,
    borderBottomRightRadius: GROUP_RADIUS,
  },
  catHeaderText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  // Same badge as the Completed / Archived bands use.
  catCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  catCountText: { fontSize: 11, fontWeight: '800' },
  catAdd: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  // Bare glyph, matching the Completed / Archived bands.
  catCaret: { padding: 2 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    // Smaller button, same-size glyph — the + fills more of it than before.
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.pro,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
});
