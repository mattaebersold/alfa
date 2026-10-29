import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Pressable, Animated, Alert, Linking,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Check, Trash2, ChevronDown, ChevronUp, Archive, Link2, Settings, Plus } from 'lucide-react-native';
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
import FormInput from '../ui/FormInput';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import ActionSheet from '../ui/ActionSheet';
import SummaryModal, { measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import SubTabs from '../ui/SubTabs';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { CarTask } from '../../types/api';
import { ss } from '../../styles/shared';
import {
  COMMON_RADIUS,
  COLOR_BLACK,
  COLOR_GRAY_26,
  COLOR_GRAY_38,
  COLOR_PURE_RED,
  COLOR_TANGERINE,
  COLOR_WHITE,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

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
// A section the server knows but this list doesn't is shown by its key.
const CAT_LABEL = (key?: string) => TASK_CATEGORIES.find((c) => c.key === (key || 'general'))?.label ?? key ?? 'General';
const CAT_ORDER = (key?: string) => {
  const i = TASK_CATEGORIES.findIndex((c) => c.key === (key ?? 'general'));
  return i === -1 ? 999 : i;
};

/**
 * A section's heading and its tasks — one dark ground, so the cards sit
 * quiet on the page; done tasks are told apart by their fade, not a second
 * grey. The cogs on it take a lighter step, to read as buttons rather than
 * more row.
 */
const SECTION_BG = COLOR_GRAY_26;
const SECTION_BTN_BG = COLOR_GRAY_38;

/**
 * How the list moves when it changes: a task sliding to its section's foot
 * as it's ticked, one opening out, archived ones fading as their section
 * closes up — and every section below easing to its new place.
 */
const LIST_MS = 240;
const LIST_LAYOUT = LinearTransition.duration(LIST_MS);
const ROW_EXIT = FadeOut.duration(LIST_MS * 0.75);

/** How far a category card is held off the screen edges, and its corner radius. */
const GROUP_INSET = 12;
const GROUP_RADIUS = 14;

/** A task's section — its category, General when it has none. */
const categoryOf = (t: CarTask) => t.category || 'general';

/** Every section the car's tasks are in — the built-in ones in their order, then any others. */
function sectionKeys(tasks: CarTask[]): string[] {
  const used = new Set(tasks.map(categoryOf));
  const builtIn = TASK_CATEGORIES.map((c) => c.key).filter((k) => used.has(k));
  const custom = [...used].filter((k) => CAT_ORDER(k) === 999).sort((a, b) => a.localeCompare(b));
  return [...builtIn, ...custom];
}

/** Rank for sorting — the order PRIORITIES is declared in, worst first. */
const PRIORITY_RANK = (p?: string | null) => {
  const i = PRIORITIES.indexOf(p as Priority);
  // No priority: after Low, at the foot of the open tasks.
  return i === -1 ? PRIORITIES.length : i;
};

/**
 * A section per category, each sorted by priority — critical always at the
 * top — then by when it was added. Done tasks sink to the section's foot and
 * stay there, in sight, until they're cleared.
 */
function buildSections(tasks: CarTask[]): { category: string; tasks: CarTask[] }[] {
  return sectionKeys(tasks).map((category) => ({
    category,
    tasks: tasks
      .filter((t) => categoryOf(t) === category)
      .sort((a, b) =>
        Number(!!a.completed) - Number(!!b.completed)
        || PRIORITY_RANK(a.priority) - PRIORITY_RANK(b.priority)
        || (a.position ?? 0) - (b.position ?? 0)),
  }));
}

/** Open and done, for a car's pie — the list and the all-cars pane alike. */
export function taskTally(tasks: CarTask[]) {
  const done = tasks.filter((t) => t.completed).length;
  return { done, open: tasks.length - done, total: tasks.length };
}

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: COLOR_PURE_RED,
  high:     COLOR_TANGERINE,
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

/** A priority pill's ground: its colour, faint — see the pill in TaskRow. */
function priorityMuted(c: string): string {
  const rgb = parseColor(c);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.16)` : 'transparent';
}

// ── Task Dialog ───────────────────────────────────────────────────────────────
/**
 * Adding *or* editing a task, in a summary panel grown from the + that opened
 * it and settled in the middle of the screen.
 *
 * Everything at once, nothing behind an accordion: the title, then how urgent
 * (optional — pills, none to start) and where it goes (sub tabs, starting on
 * the section it was added from), then a description and a link,
 * each saying in its placeholder that it's optional. No labels — the tabs and
 * placeholders say what each is. Deleting is the task's cog, not this form.
 */
function TaskDialog({
  visible,
  origin,
  onClose,
  onSave,
  saving,
  initial,
  initialCategory = 'general',
  categories = [],
}: {
  visible: boolean;
  /** The + it grew out of. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
  onSave: (data: { title: string; body: string; link: string; priority: Priority | null; category: string }) => void;
  saving: boolean;
  /** The task being edited. Absent means this is a new one. */
  initial?: Partial<CarTask>;
  /** Preselected for a new task — the section whose + opened it; still changeable. */
  initialCategory?: string;
  /** The car's sections, any outside the built-in set included, to offer beside them. */
  categories?: string[];
}) {
  const colors = useColors();
  const isEdit = !!initial?.internal_id;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [category, setCategory] = useState(initialCategory);

  // Seed on open, not on close — clearing while it animates out is visible.
  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setBody(initial?.body ?? '');
    setLink(initial?.link ?? '');
    setPriority((initial?.priority as Priority) ?? null);
    setCategory(initial?.category ?? initialCategory);
  }, [visible, initial, initialCategory]);

  const submit = () => {
    if (!title.trim() || saving) return;
    onSave({ title: title.trim(), body: body.trim(), link: link.trim(), priority, category });
  };

  const categoryTabs = [
    ...TASK_CATEGORIES,
    ...categories.filter((k) => CAT_ORDER(k) === 999).map((k) => ({ key: k, label: k })),
  ];

  return (
    <SummaryModal visible={visible} origin={origin} onClose={onClose}>
      <View style={dialog.card}>
        {/* Editing says so; a new task needs no heading over its own title. */}
        {isEdit && <Text style={[dialog.heading, { color: colors.fg }]}>Edit Task</Text>}

        <FormInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Replace brake pads"
          // Only for a new task: editing one starts with the cursor jumping
          // into a field that's already filled in.
          autoFocus={!isEdit}
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        {/* Optional, so pills rather than tabs: none lit to start, and a
            tap on the lit one puts it back to none. Drawn as the rows'
            badges are. */}
        <View style={dialog.pills}>
          {PRIORITIES.map((p) => {
            const on = priority === p;
            const tint = PRIORITY_COLORS[p];
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setPriority(on ? null : p)}
                style={[dialog.pill, { backgroundColor: on ? tint : priorityMuted(tint) }]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[dialog.pillText, { color: on ? COLOR_BLACK : tint }]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={dialog.tabs}>
          <SubTabs options={categoryTabs} value={category} onChange={setCategory} inset={0} />
        </View>

        <FormInput
          style={dialog.textarea}
          value={body}
          onChangeText={setBody}
          placeholder="Description (optional)"
          multiline
        />
        <FormInput
          value={link}
          onChangeText={setLink}
          placeholder="Link (optional)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        {/* Cancel and Save at opposite ends — backing out and committing
            shouldn't share an edge. */}
        <View style={dialog.actions}>
          <TouchableOpacity onPress={onClose} style={dialog.cancelBtn}>
            <Text style={[dialog.cancelText, { color: colors.grey }]}>Cancel</Text>
          </TouchableOpacity>
          <View style={ss.fill} />
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
    </SummaryModal>
  );
}

const dialog = StyleSheet.create({
  card:       { padding: 16, paddingTop: 18, gap: 12 },
  heading:    { fontSize: 17, fontFamily: FONT_INTER.bold },
  // Shorter than a FormInput paragraph's default — the panel is compact.
  textarea:   { minHeight: 80 },
  tabs:       { marginHorizontal: -2 },
  pills:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillText:   { fontSize: 12, fontFamily: FONT_INTER.bold },
  actions:    { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cancelBtn:  { paddingRight: 14, paddingVertical: 10 },
  cancelText: { fontSize: 15, fontFamily: FONT_INTER.semibold },
  addBtn:     { paddingHorizontal: 22, paddingVertical: 10, borderRadius: COMMON_RADIUS },
  addBtnOff:  { opacity: 0.4 },
  addText:    { fontSize: 15, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
});

// ── Task Row ──────────────────────────────────────────────────────────────────
/**
 * One task: a square to tick it off, its title, how urgent it is, and a link
 * icon when it has a link.
 *
 * A tap on the row opens it out — the description, its photo, the link's
 * button, and the cog. Opened, the title row is what closes it again; the rest
 * is content to read. The cog is also a swipe left away, without opening it.
 */
function TaskRow({
  task,
  onToggle,
  onOptions,
  isLast,
}: {
  task: CarTask;
  onToggle: () => void;
  /** The task's options — edit, archive, delete. */
  onOptions: () => void;
  /** Last row of its section — rounds off the section's card. */
  isLast?: boolean;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const swipeRef = useRef<SwipeableMethods>(null);
  const photo = firstGalleryUrl(task.gallery);
  const priority = task.priority as Priority | null | undefined;

  /**
   * Ticking a task off should feel like something.
   *
   * The box pops past its own size and springs back, and a wash of the brand
   * colour sweeps across the row — enough to register in peripheral vision
   * when you're working down a list, short enough not to hold up the next tap.
   * Both are fired from the press rather than from `task.completed` changing, so
   * the feedback is immediate; the mutation patches the cache optimistically, so
   * the box fills on the same frame.
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

  // Eased by the row's layout transition below.
  const setOpen = (open: boolean) => setExpanded(open);

  const openOptions = () => { swipeRef.current?.close(); onOptions(); };

  // Swiped left: the cog, a step lighter than the row so it reads as
  // something revealed rather than more of it.
  const renderCog = () => (
    <TouchableOpacity
      style={[taskRow.swipeCog, { backgroundColor: SECTION_BTN_BG }, isLast && taskRow.rowLast]}
      onPress={openOptions}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Options for ${task.title ?? 'task'}`}
    >
      <Settings size={18} color={colors.fg} />
    </TouchableOpacity>
  );

  const titleRow = (
    <View style={taskRow.titleRow}>
      {/* The box — the only way to complete a task. */}
      <Animated.View style={{ transform: [{ scale: checkScale }] }}>
        <TouchableOpacity
          style={[taskRow.check, task.completed && taskRow.checkDone]}
          onPress={handleToggle}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!task.completed }}
          accessibilityLabel={task.title}
        >
          {task.completed && <Check size={11} color={COLOR_WHITE} strokeWidth={3} />}
        </TouchableOpacity>
      </Animated.View>
      <Text
        style={[taskRow.title, { color: COLOR_WHITE }, task.completed && { textDecorationLine: 'line-through', color: colors.grey }]}
        numberOfLines={expanded ? undefined : 1}
      >
        {task.title}
      </Text>
      {/* Right after the title, not out at the row's end. */}
      {task.link ? <Link2 size={14} color={colors.pro} strokeWidth={2.4} /> : null}
      <View style={ss.fill} />
      {/* None set, none shown. Done, it's settled — no badge over a muted row. Critical the other
          way round — solid, so it's the one that stands out. */}
      {!task.completed && priority && (
        <View style={[taskRow.priorityPill, { backgroundColor: priority === 'critical' ? PRIORITY_COLORS.critical : priorityMuted(PRIORITY_COLORS[priority]) }]}>
          <Text style={[taskRow.priorityText, { color: priority === 'critical' ? COLOR_WHITE : PRIORITY_COLORS[priority] }]}>
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    // Its own place in the list, eased when it moves or changes height, and a
    // fade on the way out (archived, deleted).
    <Reanimated.View layout={LIST_LAYOUT} exiting={ROW_EXIT}>
    <ReanimatedSwipeable
      ref={swipeRef}
      containerStyle={taskRow.swipeWrap}
      renderRightActions={renderCog}
      friction={2}
      rightThreshold={30}
      overshootRight={false}
    >
      <Pressable
        style={[
          taskRow.row,
          // On the section header's ground, so header and tasks read as one card.
          { backgroundColor: SECTION_BG },
          isLast && taskRow.rowLast,
          task.completed && !expanded && taskRow.rowDone,
        ]}
        // Closed, the whole row opens it; open, only the title row closes it.
        onPress={expanded ? undefined : () => setOpen(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        {expanded ? (
          <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close task">
            {titleRow}
          </Pressable>
        ) : titleRow}

        {expanded && (
          <Reanimated.View entering={FadeIn.duration(LIST_MS)} style={taskRow.detail}>
            {task.body ? <Text style={[taskRow.body, { color: colors.muted }]}>{task.body}</Text> : null}
            {photo ? <Image small source={{ uri: photo }} style={taskRow.photo} contentFit="cover" transition={150} /> : null}
            <View style={taskRow.actions}>
              {task.link ? (
                <TouchableOpacity
                  style={[taskRow.linkBtn, { backgroundColor: colors.pro }]}
                  onPress={() => Linking.openURL(task.link as string).catch(() => {})}
                  activeOpacity={0.85}
                  accessibilityRole="link"
                  accessibilityLabel={`Open link for ${task.title ?? 'task'}`}
                >
                  <Link2 size={14} color={COLOR_BLACK} strokeWidth={2.4} />
                  <Text style={taskRow.linkBtnText}>View</Text>
                </TouchableOpacity>
              ) : null}
              <View style={ss.fill} />
              <TouchableOpacity
                style={[taskRow.cog, { backgroundColor: SECTION_BTN_BG }]}
                onPress={openOptions}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Options for ${task.title ?? 'task'}`}
              >
                <Settings size={16} color={colors.fg} />
              </TouchableOpacity>
            </View>
          </Reanimated.View>
        )}

        {/* Completion flash — a wash of the brand colour that sweeps out as the
            row settles into its done state. Last child so it washes the whole row
            evenly, absolutely positioned so it stays out of the layout, and
            non-interactive so it can't eat the taps underneath it. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            isLast && taskRow.rowLast,
            { backgroundColor: colors.primaryAlt, opacity: flash },
          ]}
        />
      </Pressable>
    </ReanimatedSwipeable>
    </Reanimated.View>
  );
}

const taskRow = StyleSheet.create({
  swipeWrap: { marginHorizontal: GROUP_INSET },
  // No rule between tasks — the card holds them together, and the room
  // between rows is enough to tell one from the next.
  row: { paddingLeft: 14, paddingRight: 12, paddingVertical: 9 },
  rowLast: {
    borderBottomLeftRadius: GROUP_RADIUS,
    borderBottomRightRadius: GROUP_RADIUS,
  },
  rowDone: { opacity: 0.55 },
  swipeCog: { width: 64, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    // A rounded square, dimmed white while empty — present without competing
    // with the title. Ticked, it fills black and keeps the same edge.
    width: 19, height: 19, borderRadius: 5, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkDone: { backgroundColor: COLOR_BLACK },
  // Shrinks rather than fills, so the link icon sits against the end of the
  // title; the spacer after it takes the pill out to the row's end.
  title:    { flexShrink: 1, fontSize: 14, fontFamily: FONT_INTER.regular },
  // Lined up under the title, past the box.
  detail:   { marginLeft: 29, marginTop: 6, gap: 10 },
  body:     { fontSize: 13, lineHeight: 18 },
  photo:    { width: '100%', aspectRatio: 16 / 10, borderRadius: COMMON_RADIUS },
  actions:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: COMMON_RADIUS,
  },
  linkBtnText: { fontSize: 13, fontFamily: FONT_INTER.bold, color: COLOR_BLACK },
  cog:      { width: 32, height: 32, borderRadius: COMMON_RADIUS, alignItems: 'center', justifyContent: 'center' },
  // A tint of its colour under lettering in the colour itself — present, but
  // not shouting over the titles the way a solid pill did.
  priorityPill: {
    flexShrink: 0,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 999,
  },
  priorityText: { fontSize: 9, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.2 },
});

/** A section's +, measured on the tap so the form grows out of it. */
function SectionAdd({ label, onPress }: { label: string; onPress: (origin: SummaryOrigin | null) => void }) {
  const colors = useColors();
  const ref = useRef<View>(null);
  return (
    <TouchableOpacity
      ref={ref}
      onPress={() => measureOrigin(ref.current, onPress)}
      hitSlop={10}
      style={[styles.catAdd, { borderColor: colors.pro }]}
      accessibilityRole="button"
      accessibilityLabel={`Add task to ${label}`}
    >
      <Plus size={14} color={colors.pro} strokeWidth={3} />
    </TouchableOpacity>
  );
}

// ── Task List ─────────────────────────────────────────────────────────────────
export type CarTaskListHandle = { openNewTask: (category?: string, origin?: SummaryOrigin | null) => void };

/**
 * A car's tasks: a card per section, each with its add and its cog menu, the
 * tasks inside, and the archived ones under them — with every dialog and
 * options sheet they open.
 *
 * Not a scroller of its own, so it sits in whatever holds it: the car's tasks
 * screen, or a car's accordion in the all-cars pane (AllCarTasksSheet).
 */
const CarTaskList = forwardRef<CarTaskListHandle, { carId: string }>(function CarTaskList({ carId }, ref) {
  const colors = useColors();
  const [showArchived, setShowArchived] = useState(false);
  // One dialog for both adding and editing — `editingTask` is the only thing
  // that differs between the two.
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<CarTask | undefined>(undefined);
  const [newTaskCategory, setNewTaskCategory] = useState('general');
  /** The + the form grows out of. */
  const [dialogOrigin, setDialogOrigin] = useState<SummaryOrigin | null>(null);
  /** The task whose options are open (the cog). */
  const [optionsTask, setOptionsTask] = useState<CarTask | null>(null);
  /** The section whose options are open (its cog). */
  const [sectionMenu, setSectionMenu] = useState<string | null>(null);

  // Opened from a section header, the dialog starts on that section — the
  // common case is adding another task where you're already looking.
  const openNewTask = (category = 'general', origin: SummaryOrigin | null = null) => {
    setEditingTask(undefined);
    setNewTaskCategory(category);
    setDialogOrigin(origin);
    setDialogVisible(true);
  };

  const closeDialog = () => {
    setDialogVisible(false);
    // Cleared on close so the next "new task" doesn't briefly show the last
    // edited one while the dialog fades in.
    setEditingTask(undefined);
  };

  useImperativeHandle(ref, () => ({ openNewTask }));

  const { data: tasksData, isLoading } = useGetCarTasksQuery(carId);
  const tasks = tasksData?.entries ?? [];
  const { data: archivedData, refetch: refetchArchived } = useGetArchivedCarTasksQuery(carId, { skip: !showArchived });
  const archived = archivedData?.entries ?? [];

  const [createTask, { isLoading: creating }] = useCreateCarTaskMutation();
  const [updateTask, { isLoading: updating }] = useUpdateCarTaskMutation();
  const [toggleTask] = useToggleCarTaskMutation();
  const [deleteTask] = useDeleteCarTaskMutation();
  const [updatePositions] = useUpdateCarTaskPositionsMutation();

  const done = tasks.filter((t) => t.completed);
  const sections = buildSections(tasks);

  const handleSave = async (data: { title: string; body: string; link: string; priority: Priority | null; category: string }) => {
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
    // Done tasks sink to the foot of their section; the rows' layout
    // transition eases them there rather than jumping.
    // Send the intended state explicitly rather than relying on the server's
    // flip, so rapid taps can't race into the wrong value.
    toggleTask({ internal_id: task.internal_id, car_id: carId, completed: !task.completed });
  };

  // Confirmed rather than immediate — the options sit an inch apart.
  const confirmDelete = (task: CarTask) => Alert.alert(
    'Delete task?',
    `"${task.title ?? 'This task'}" will be removed. This can't be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deleteTask({ taskId: task.internal_id, car_id: carId }).unwrap()
          .catch(() => Alert.alert('Could not delete task', 'Please try again.')),
      },
    ],
  );

  const setArchived = (task: CarTask, on: boolean) => updateTask({ ...task, status: on ? 'archived' : '' }).unwrap()
    .then(() => { if (showArchived) refetchArchived(); })
    .catch(() => Alert.alert(on ? 'Could not archive task' : 'Could not restore task', 'Please try again.'));

  // ── Section options ──
  /** Archives tasks — kept, under Archived, just out of the section. */
  const archiveAll = (list: CarTask[], failed: string) =>
    Promise.all(list.map((t) => updateTask({ ...t, status: 'archived' }).unwrap()))
      .then(() => { if (showArchived) refetchArchived(); })
      .catch(() => Alert.alert(failed, 'Please try again.'));
  const archiveCompleted = (category: string) =>
    archiveAll(done.filter((t) => categoryOf(t) === category), 'Could not archive completed tasks');
  /**
   * Removing a section hides it, not its work: every task in it is archived,
   * so nothing is lost and each can be restored from Archived.
   */
  const removeSection = (category: string) => {
    const gone = tasks.filter((t) => categoryOf(t) === category);
    Alert.alert(
      `Remove ${CAT_LABEL(category)}?`,
      `Its ${gone.length} ${gone.length === 1 ? 'task' : 'tasks'} will move to Archived.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => archiveAll(gone, 'Could not remove section') },
      ],
    );
  };

  if (isLoading) return <Spinner />;

  const optionsIsArchived = optionsTask?.status === 'archived';
  const sectionDone = sectionMenu ? done.filter((t) => categoryOf(t) === sectionMenu).length : 0;

  return (
    <View>
      {sections.length === 0 && (
        // The sections' + is the way to add one, and there are none yet.
      <EmptyState title="No tasks" message="Add your first task to get started." actionLabel="Add Task" onAction={() => openNewTask()} />
      )}

      {sections.map((section) => (
        // Eases to its new height as tasks leave it, and fades out whole
        // when the last one does.
        <Reanimated.View key={section.category} layout={LIST_LAYOUT} exiting={ROW_EXIT}>
          <View style={[styles.catHeader, { backgroundColor: SECTION_BG }]}>
            <Text style={[styles.catHeaderText, { color: colors.fg }]} numberOfLines={1}>{CAT_LABEL(section.category)}</Text>
            <View style={styles.catCount}>
              <Text style={styles.catCountText}>{section.tasks.length}</Text>
            </View>
            <View style={ss.fill} />
            {/* The form grows out of this +, on this section. */}
            <SectionAdd label={CAT_LABEL(section.category)} onPress={(o) => openNewTask(section.category, o)} />
            <TouchableOpacity
              onPress={() => setSectionMenu(section.category)}
              hitSlop={10}
              style={styles.catMore}
              accessibilityRole="button"
              accessibilityLabel={`${CAT_LABEL(section.category)} options`}
            >
              <Settings size={17} color={colors.grey} />
            </TouchableOpacity>
          </View>
          {section.tasks.map((task, i) => (
            <TaskRow
              key={task.internal_id}
              task={task}
              onToggle={() => handleToggle(task)}
              onOptions={() => setOptionsTask(task)}
              isLast={i === section.tasks.length - 1}
            />
          ))}
        </Reanimated.View>
      ))}

      {/* Archived — its query stays skipped until it's opened. */}
      <Reanimated.View layout={LIST_LAYOUT}>
        <TouchableOpacity
          style={[
            styles.divider,
            { backgroundColor: SECTION_BG },
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
            <View style={styles.catCount}>
              <Text style={styles.catCountText}>{archived.length}</Text>
            </View>
          )}
          <View style={ss.fill} />
          {showArchived
            ? <ChevronUp size={16} color={colors.grey} />
            : <ChevronDown size={16} color={colors.grey} />}
        </TouchableOpacity>
        {showArchived && archived.map((task, i) => (
          <TaskRow
            key={task.internal_id}
            task={task}
            onToggle={() => handleToggle(task)}
            onOptions={() => setOptionsTask(task)}
            isLast={i === archived.length - 1}
          />
        ))}
      </Reanimated.View>

      {/* A task's options — the cog, open or swiped to. */}
      <ActionSheet
        visible={!!optionsTask}
        onClose={() => setOptionsTask(null)}
        title={optionsTask?.title}
        // The grabber and a tap outside close it; a Cancel row was a fifth
        // option that does nothing.
        showCancel={false}
        options={optionsTask ? [
          { label: 'Edit Task', onPress: () => handleEdit(optionsTask) },
          { label: optionsTask.completed ? 'Mark as Not Done' : 'Mark as Done', onPress: () => handleToggle(optionsTask) },
          optionsIsArchived
            ? { label: 'Restore Task', Icon: Archive, onPress: () => setArchived(optionsTask, false) }
            : { label: 'Archive Task', Icon: Archive, onPress: () => setArchived(optionsTask, true) },
          { label: 'Delete Task', Icon: Trash2, destructive: true, onPress: () => confirmDelete(optionsTask) },
        ] : []}
      />

      {/* A section's options — the cog on its heading. */}
      <ActionSheet
        visible={!!sectionMenu}
        onClose={() => setSectionMenu(null)}
        // No title — it opened from the section's own heading — and no Cancel.
        showCancel={false}
        options={sectionMenu ? [
          ...(sectionDone > 0 ? [{ label: 'Archive Completed Tasks', Icon: Archive, onPress: () => archiveCompleted(sectionMenu) }] : []),
          { label: 'Remove Section', Icon: Trash2, destructive: true, onPress: () => removeSection(sectionMenu) },
        ] : []}
      />

      <TaskDialog
        visible={dialogVisible}
        origin={editingTask ? null : dialogOrigin}
        onClose={closeDialog}
        onSave={handleSave}
        saving={creating || updating}
        initial={editingTask}
        initialCategory={newTaskCategory}
        categories={sectionKeys(tasks)}
      />
    </View>
  );
});

export default CarTaskList;

const styles = StyleSheet.create({
  // Same card treatment as a section header — these divide the list the same
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
  dividerText: { fontSize: 12, fontFamily: FONT_INTER.extrabold, textTransform: 'uppercase', letterSpacing: 0.6 },
  // Each section is a card: a lighter cap, its tasks below, and the last row
  // rounding off the bottom. Inset from the edges so the group reads as one
  // object sitting on the screen rather than a full-bleed band.
  catHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 18, marginHorizontal: GROUP_INSET,
    borderTopLeftRadius: GROUP_RADIUS, borderTopRightRadius: GROUP_RADIUS,
  },
  catHeaderText: { flexShrink: 1, fontSize: 15, fontFamily: FONT_INTER.semibold, letterSpacing: 0.1 },
  // Black under white — the same badge on every section and on Archived.
  catCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR_BLACK,
  },
  catCountText: { fontSize: 11, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE },
  catAdd: {
    width: 22, height: 22, borderRadius: COMMON_RADIUS, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  catMore: { padding: 2 },
});
