import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { Plus, Check, MoreVertical, ChevronDown, ChevronUp, Archive, ArrowLeft } from 'lucide-react-native';
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

// ── Add/Edit Task Modal ───────────────────────────────────────────────────────
function TaskModal({
  visible,
  onClose,
  onSave,
  initial,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { title: string; body: string; priority: Priority; category: string }) => void;
  initial?: Partial<CarTask>;
  loading: boolean;
}) {
  const colors = useColors();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [priority, setPriority] = useState<Priority>((initial?.priority as Priority) ?? 'medium');
  const [category, setCategory] = useState<string>(initial?.category ?? 'general');

  React.useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? '');
      setBody(initial?.body ?? '');
      setPriority((initial?.priority as Priority) ?? 'medium');
      setCategory(initial?.category ?? 'general');
    }
  }, [visible, initial]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={modal.flex}
        >
          {/* Header */}
          <View style={[modal.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[modal.cancel, { color: colors.grey }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[modal.title, { color: colors.fg }]}>{initial?.internal_id ? 'Edit Task' : 'New Task'}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
                onSave({ title: title.trim(), body: body.trim(), priority, category });
              }}
              disabled={loading}
            >
              <Text style={[modal.save, loading && modal.saveDisabled]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={modal.body} keyboardShouldPersistTaps="handled">
            <View style={modal.field}>
              <Text style={[modal.label, { color: colors.fg }]}>Title *</Text>
              <TextInput
                style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Replace brake pads"
                placeholderTextColor={colors.grey}
                autoFocus
              />
            </View>

            <View style={modal.field}>
              <Text style={[modal.label, { color: colors.fg }]}>Notes</Text>
              <TextInput
                style={[ss.input, ss.inputMulti, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
                value={body}
                onChangeText={setBody}
                placeholder="Details, part numbers, etc."
                placeholderTextColor={colors.grey}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={modal.field}>
              <Text style={[modal.label, { color: colors.fg }]}>Priority</Text>
              <View style={modal.chips}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      modal.chip,
                      { borderColor: colors.border, backgroundColor: colors.card },
                      priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] },
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[modal.chipText, { color: colors.fg }, priority === p && { color: '#FFFFFF' }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={modal.field}>
              <Text style={[modal.label, { color: colors.fg }]}>Category</Text>
              <View style={modal.chips}>
                {TASK_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      modal.chip,
                      { borderColor: colors.border, backgroundColor: colors.card },
                      category === cat.key && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
                    ]}
                    onPress={() => setCategory(cat.key)}
                  >
                    <Text style={[modal.chipText, { color: colors.fg }, category === cat.key && { color: '#FFFFFF' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const modal = StyleSheet.create({
  flex:    { flex: 1 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title:   { fontSize: 17, fontWeight: '700' },
  cancel:  { fontSize: 16 },
  save:    { fontSize: 16, fontWeight: '700', color: colors.primaryAlt },
  saveDisabled: { opacity: 0.4 },
  body:    { padding: 16 },
  field:   { marginBottom: 20 },
  label:   { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5 },
  chipText:{ fontSize: 13, fontWeight: '600' },
});

// ── New Task Dialog ───────────────────────────────────────────────────────────
/**
 * A small centred dialog for adding a task.
 *
 * Only the three fields worth deciding up front — a title, where it goes, and
 * how urgent it is. Notes stay in the full edit sheet: they get written later,
 * when you have part numbers, not while you're jotting the task down.
 */
function NewTaskDialog({
  visible,
  onClose,
  onSave,
  saving,
  initialCategory = 'general',
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { title: string; priority: Priority; category: string }) => void;
  saving: boolean;
  /** Preselected when opened from a category header; still changeable here. */
  initialCategory?: string;
}) {
  const colors = useColors();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState(initialCategory);

  // Reset on open, not on close — clearing while it animates out is visible.
  useEffect(() => {
    if (visible) {
      setTitle('');
      setPriority('medium');
      setCategory(initialCategory);
    }
  }, [visible, initialCategory]);

  const submit = () => {
    if (!title.trim() || saving) return;
    onSave({ title: title.trim(), priority, category });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={dialog.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[dialog.card, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
          <Text style={[dialog.heading, { color: colors.fg }]}>New Task</Text>

          <TextInput
            style={[dialog.input, { borderColor: TASK_DIVIDER, color: '#FFFFFF' }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Replace brake pads"
            placeholderTextColor={colors.grey}
            autoFocus
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

          <View style={dialog.actions}>
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
              <Text style={dialog.addText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const dialog = StyleSheet.create({
  backdrop:   {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 24,
  },
  card:       { width: '100%', maxWidth: 400, borderRadius: 16, borderWidth: 1, padding: 18 },
  heading:    { fontSize: 17, fontWeight: '800', marginBottom: 14 },
  input:      {
    height: 44, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 15,
  },
  label:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  chipText:   { fontSize: 12, fontWeight: '700' },
  actions:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
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
  onDelete,
  onLongPress,
  isActive,
  isLast,
}: {
  task: CarTask;
  onToggle: () => void;
  /** Reached only through the ⋮ menu — the row itself isn't tappable. */
  onEdit: () => void;
  onDelete: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
  /** Last row of its group — drops the bottom rule. */
  isLast?: boolean;
}) {
  const colors = useColors();

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
      // checkbox, editing is the ⋮ menu, and long press starts a drag — a
      // whole-row tap would only fire one of those by accident.
      onLongPress={handleLongPress}
      // 180ms was tuned for a row that also had a handle to grab; on its own it
      // fires often enough during a scroll to feel accidental.
      delayLongPress={300}
      activeOpacity={1}
    >
      {/* Checkbox — the only way to complete a task */}
      <TouchableOpacity
        style={[taskRow.check, task.completed && taskRow.checkDone]}
        onPress={onToggle}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!task.completed }}
        accessibilityLabel={task.title}
      >
        {task.completed && <Check size={11} color="#FFFFFF" />}
      </TouchableOpacity>

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
      </View>

      {/* Overflow menu */}
      <TouchableOpacity
        onPress={() => Alert.alert(task.title ?? 'Task', undefined, [
          { text: 'Edit', onPress: onEdit },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
          { text: 'Cancel', style: 'cancel' },
        ])}
        style={taskRow.del}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`Options for ${task.title ?? 'task'}`}
      >
        <MoreVertical size={18} color={colors.grey} />
      </TouchableOpacity>
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
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<CarTask | undefined>(undefined);
  // New tasks get a small dialog; the full sheet is only for editing one.
  const [newTaskVisible, setNewTaskVisible] = useState(false);
  const [newTaskCategory, setNewTaskCategory] = useState('general');
  // Empty means everything is open — categories always start expanded, and
  // collapsing is a per-visit choice rather than something that persists.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCategory = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // Opened from a category header, the dialog starts on that category — the
  // common case is adding another task where you're already looking.
  const openNewTask = (category = 'general') => {
    setNewTaskCategory(category);
    setNewTaskVisible(true);
  };

  const { data: tasksData, isLoading } = useGetCarTasksQuery(carId);
  const tasks = tasksData?.entries ?? [];
  const { data: archivedData } = useGetArchivedCarTasksQuery(carId, { skip: !showArchived });
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

  const handleSave = async (data: { title: string; body: string; priority: Priority; category: string }) => {
    if (editingTask?.internal_id) {
      await updateTask({ ...editingTask, ...data }).unwrap();
    } else {
      await createTask({ car_id: carId, position: tasks.length, ...data }).unwrap();
    }
    setModalVisible(false);
    setEditingTask(undefined);
  };

  const handleCreate = async (data: { title: string; priority: Priority; category: string }) => {
    try {
      await createTask({ car_id: carId, position: tasks.length, ...data }).unwrap();
      setNewTaskVisible(false);
    } catch {
      // Leave the dialog open with its text intact so nothing typed is lost.
      Alert.alert('Could not add task', 'Please try again.');
    }
  };

  const handleEdit = (task: CarTask) => {
    setEditingTask(task);
    setModalVisible(true);
  };

  const handleToggle = (task: CarTask) => {
    // Send the intended state explicitly rather than relying on the server's
    // flip, so rapid taps can't race into the wrong value.
    toggleTask({ internal_id: task.internal_id, car_id: carId, completed: !task.completed });
  };

  const handleDelete = (task: CarTask) => {
    deleteTask({ taskId: task.internal_id, car_id: carId });
  };

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
                onDelete={() => handleDelete(item.task)}
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
                    onDelete={() => handleDelete(item)}
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
                  onDelete={() => handleDelete(item)}
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

      <NewTaskDialog
        visible={newTaskVisible}
        onClose={() => setNewTaskVisible(false)}
        onSave={handleCreate}
        saving={creating}
        initialCategory={newTaskCategory}
      />

      <TaskModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setEditingTask(undefined); }}
        onSave={handleSave}
        initial={editingTask}
        loading={creating || updating}
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
