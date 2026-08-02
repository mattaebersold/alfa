import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { Plus, Check, Trash2, ChevronDown, Archive, GripVertical, ArrowLeft } from 'lucide-react-native';
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

type Row =
  | { _type: 'header'; category: string; key: string }
  | { _type: 'task'; task: CarTask; key: string };

// A header for each non-empty category (in category order), followed by that
// category's open tasks in position order. Drag a task under a different header
// to move it to that category.
function buildRows(open: CarTask[]): Row[] {
  const rows: Row[] = [];
  TASK_CATEGORIES.forEach((cat) => {
    const catTasks = open
      .filter((t) => (t.category ?? 'general') === cat.key)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    if (catTasks.length === 0) return;
    rows.push({ _type: 'header', category: cat.key, key: `h-${cat.key}` });
    catTasks.forEach((t) => rows.push({ _type: 'task', task: t, key: t.internal_id }));
  });
  return rows;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: '#FF0000',
  high:     '#FA7921',
  medium:   colors.primaryAlt,
  low:      colors.grey,
};

function PriorityDot({ priority }: { priority?: string }) {
  const color = PRIORITY_COLORS[(priority as Priority) ?? 'medium'] ?? colors.grey;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
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

// ── Task Row ──────────────────────────────────────────────────────────────────
function TaskRow({
  task,
  onToggle,
  onPress,
  onDelete,
  onLongPress,
  isActive,
}: {
  task: CarTask;
  onToggle: () => void;
  onPress: () => void;
  onDelete: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        taskRow.row,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
        task.completed && taskRow.rowDone,
        isActive && taskRow.rowActive,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={180}
      activeOpacity={0.85}
    >
      {onLongPress && (
        <View style={taskRow.grip}>
          <GripVertical size={16} color={colors.grey} />
        </View>
      )}
      {/* Checkbox */}
      <TouchableOpacity
        style={[taskRow.check, task.completed && taskRow.checkDone]}
        onPress={onToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {task.completed && <Check size={12} color="#FFFFFF" />}
      </TouchableOpacity>

      {/* Content */}
      <View style={taskRow.content}>
        <View style={taskRow.titleRow}>
          <PriorityDot priority={task.priority} />
          <Text style={[taskRow.title, { color: colors.fg }, task.completed && { textDecorationLine: 'line-through', color: colors.grey }]} numberOfLines={1}>
            {task.title}
          </Text>
        </View>
        {task.body ? (
          <Text style={[taskRow.body, { color: colors.muted }]} numberOfLines={2}>{task.body}</Text>
        ) : null}
        {task.priority && (
          <Text style={[taskRow.priority, { color: PRIORITY_COLORS[(task.priority as Priority)] }]}>
            {task.priority}
          </Text>
        )}
      </View>

      {/* Delete */}
      <TouchableOpacity
        onPress={() => Alert.alert('Delete task?', task.title ?? '', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ])}
        style={taskRow.del}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Trash2 size={16} color={colors.grey} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const taskRow = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowDone: { opacity: 0.55 },
  rowActive: { opacity: 0.95, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  grip:    { paddingRight: 2, paddingTop: 2 },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.primaryAlt,
    alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
  },
  checkDone: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  content:  { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  title:    { flex: 1, fontSize: 15, fontWeight: '700' },
  body:     { fontSize: 13, lineHeight: 18 },
  priority: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4, letterSpacing: 0.3 },
  del:      { padding: 2, marginTop: 2 },
  dot:      { width: 8, height: 8, borderRadius: 4 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CarTasksScreen({ route, navigation }: AppScreenProps<'CarTasks'>) {
  const { carId, carTitle } = route.params;
  const colors = useColors();
  const [showArchived, setShowArchived] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<CarTask | undefined>(undefined);

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
    setDragData(buildRows(tasks.filter((t) => !t.completed)));
  }, [tasks]);

  const handleDragEnd = ({ data }: { data: Row[] }) => {
    setDragData(data); // optimistic
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
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
      {/* Dedicated back control — returns to the car this list belongs to. */}
      <View style={styles.topBar}>
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
      </View>

      <DraggableFlatList
        data={dragData}
        keyExtractor={(item) => item.key}
        onDragEnd={handleDragEnd}
        activationDistance={12}
        renderItem={({ item, drag, isActive }: RenderItemParams<Row>) => {
          if (item._type === 'header') {
            return (
              <View style={[styles.catHeader, { backgroundColor: colors.segment, borderColor: colors.border }]}>
                <Text style={[styles.catHeaderText, { color: colors.grey }]}>{CAT_LABEL(item.category)}</Text>
              </View>
            );
          }
          return (
            <ScaleDecorator>
              <TaskRow
                task={item.task}
                onToggle={() => handleToggle(item.task)}
                onPress={() => handleEdit(item.task)}
                onDelete={() => handleDelete(item.task)}
                onLongPress={drag}
                isActive={isActive}
              />
            </ScaleDecorator>
          );
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={[styles.openCount, { color: colors.fg }]}>{open.length} open</Text>
              {done.length > 0 && (
                <Text style={[styles.doneCount, { color: colors.grey }]}>{done.length} completed</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.archivedBtn}
              onPress={() => setShowArchived((v) => !v)}
            >
              <Archive size={15} color={colors.grey} />
              <Text style={[styles.archivedText, { color: colors.grey }]}>Archived</Text>
              <ChevronDown size={14} color={colors.grey} style={showArchived && { transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          <View>
            {done.length > 0 && (
              <View>
                <View style={[styles.divider, { backgroundColor: colors.segment, borderColor: colors.border }]}>
                  <Text style={[styles.dividerText, { color: colors.grey }]}>Completed</Text>
                </View>
                {done.map((item) => (
                  <TaskRow
                    key={item.internal_id}
                    task={item}
                    onToggle={() => handleToggle(item)}
                    onPress={() => handleEdit(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </View>
            )}
            {showArchived && archived.length > 0 && (
              <View>
                <View style={[styles.divider, { backgroundColor: colors.segment, borderColor: colors.border }]}>
                  <Text style={[styles.dividerText, { color: colors.grey }]}>Archived</Text>
                </View>
                {archived.map((item) => (
                  <TaskRow
                    key={item.internal_id}
                    task={item}
                    onToggle={() => handleToggle(item)}
                    onPress={() => handleEdit(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          done.length === 0
            ? <EmptyState title="No tasks" message="Add your first task to get started." />
            : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setEditingTask(undefined); setModalVisible(true); }}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

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
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  topBarSub:   { fontSize: 12, marginTop: 1 },

  list: { flexGrow: 1, paddingBottom: 80 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  openCount: { fontSize: 20, fontWeight: '800' },
  doneCount: { fontSize: 13, marginTop: 2 },
  archivedBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  archivedText: { fontSize: 13, fontWeight: '600' },
  divider: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  dividerText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  catHeader: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catHeaderText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
