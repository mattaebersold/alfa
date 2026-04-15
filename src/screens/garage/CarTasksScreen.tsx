import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Check, Trash2, ChevronDown, Archive } from 'lucide-react-native';
import {
  useGetCarTasksQuery,
  useGetArchivedCarTasksQuery,
  useCreateCarTaskMutation,
  useUpdateCarTaskMutation,
  useToggleCarTaskMutation,
  useDeleteCarTaskMutation,
} from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppScreenProps } from '../../navigation/types';
import type { CarTask } from '../../types/api';

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
type Priority = typeof PRIORITIES[number];

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: '#FF0000',
  high:     '#FA7921',
  medium:   Colors.speed,
  low:      Colors.grey,
};

function PriorityDot({ priority }: { priority?: string }) {
  const color = PRIORITY_COLORS[(priority as Priority) ?? 'medium'] ?? Colors.grey;
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
  onSave: (data: { title: string; body: string; priority: Priority }) => void;
  initial?: Partial<CarTask>;
  loading: boolean;
}) {
  const colors = useColors();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [priority, setPriority] = useState<Priority>((initial?.priority as Priority) ?? 'medium');

  React.useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? '');
      setBody(initial?.body ?? '');
      setPriority((initial?.priority as Priority) ?? 'medium');
    }
  }, [visible, initial]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[modal.safe, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
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
                onSave({ title: title.trim(), body: body.trim(), priority });
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
                style={[modal.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
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
                style={[modal.input, modal.inputMulti, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const modal = StyleSheet.create({
  safe:    { flex: 1 },
  flex:    { flex: 1 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title:   { fontSize: 17, fontWeight: '700' },
  cancel:  { fontSize: 16 },
  save:    { fontSize: 16, fontWeight: '700', color: Colors.brg },
  saveDisabled: { opacity: 0.4 },
  body:    { padding: 16 },
  field:   { marginBottom: 20 },
  label:   { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
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
}: {
  task: CarTask;
  onToggle: () => void;
  onPress: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[taskRow.row, { backgroundColor: colors.card, borderBottomColor: colors.border }, task.completed && taskRow.rowDone]} onPress={onPress} activeOpacity={0.85}>
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
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.brg,
    alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
  },
  checkDone: { backgroundColor: Colors.brg, borderColor: Colors.brg },
  content:  { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  title:    { flex: 1, fontSize: 15, fontWeight: '700' },
  body:     { fontSize: 13, lineHeight: 18 },
  priority: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4, letterSpacing: 0.3 },
  del:      { padding: 2, marginTop: 2 },
  dot:      { width: 8, height: 8, borderRadius: 4 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CarTasksScreen({ route }: AppScreenProps<'CarTasks'>) {
  const { carId } = route.params;
  const colors = useColors();
  const [showArchived, setShowArchived] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<CarTask | undefined>(undefined);

  const { data: tasks = [], isLoading } = useGetCarTasksQuery(carId);
  const { data: archived = [] } = useGetArchivedCarTasksQuery(carId, { skip: !showArchived });

  const [createTask, { isLoading: creating }] = useCreateCarTaskMutation();
  const [updateTask, { isLoading: updating }] = useUpdateCarTaskMutation();
  const [toggleTask] = useToggleCarTaskMutation();
  const [deleteTask] = useDeleteCarTaskMutation();

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const handleSave = async (data: { title: string; body: string; priority: Priority }) => {
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
    toggleTask({ internal_id: task.internal_id, car_id: carId });
  };

  const handleDelete = (task: CarTask) => {
    deleteTask({ taskId: task.internal_id, car_id: carId });
  };

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={[...open, ...done]}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onToggle={() => handleToggle(item)}
            onPress={() => handleEdit(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
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
          showArchived && archived.length > 0 ? (
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
          ) : null
        }
        ListEmptyComponent={
          <EmptyState title="No tasks" message="Add your first task to get started." />
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
  safe: { flex: 1 },
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
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.brg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
