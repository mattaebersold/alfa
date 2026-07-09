import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { ChevronRight, Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetCarTasksQuery, useToggleCarTaskMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import SharedModal from '../ui/SharedModal';
import type { AppStackParamList } from '../../navigation/types';

interface TasksSheetProps {
  carId: string;
  carTitle: string;
  visible: boolean;
  onClose: () => void;
}

export default function TasksSheet({ carId, carTitle, visible, onClose }: TasksSheetProps) {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { data, isLoading } = useGetCarTasksQuery(carId, { skip: !visible });
  const [toggleTask] = useToggleCarTaskMutation();
  const tasks = data?.entries ?? [];
  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const goToFull = () => {
    onClose();
    navigation.navigate('CarTasks', { carId, carTitle });
  };

  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      title={`Tasks${open.length ? ` (${open.length})` : ''}`}
      headerRight={
        <TouchableOpacity onPress={goToFull} style={styles.manageBtn} activeOpacity={0.7}>
          <Text style={styles.manageBtnText}>Manage</Text>
          <ChevronRight size={14} color="#FFFFFF" />
        </TouchableOpacity>
      }
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginTop: 40 }} />
      ) : tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.grey }]}>No tasks yet.</Text>
          <TouchableOpacity onPress={goToFull} style={[styles.addBtn, { backgroundColor: colors.primaryAlt }]}>
            <Text style={styles.addBtnText}>Add Task</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[...open, ...done]}
          keyExtractor={(t) => t.internal_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => toggleTask({ internal_id: item.internal_id, car_id: carId })}
              activeOpacity={0.7}
            >
              <View style={[
                styles.check,
                item.completed
                  ? { backgroundColor: '#3a8a5c', borderColor: '#3a8a5c' }
                  : { borderColor: colors.primaryAlt },
              ]}>
                {item.completed && <Check size={13} color="#FFFFFF" />}
              </View>
              <View style={styles.rowText}>
                <Text style={[
                  styles.taskTitle,
                  { color: '#ECECEC' },
                  item.completed && { color: colors.grey, textDecorationLine: 'line-through' },
                ]}>
                  {item.title}
                </Text>
                {item.priority && (
                  <Text style={[styles.priority, { color: colors.grey }]}>{item.priority}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  manageBtn:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  manageBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  list:        { paddingBottom: 40 },
  row:         {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A2A2A',
  },
  check:       {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:     { flex: 1 },
  taskTitle:   { fontSize: 15, fontWeight: '500' },
  priority:    { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 16 },
  emptyText:   { fontSize: 15 },
  addBtn:      { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  addBtnText:  { color: '#000000', fontWeight: '700', fontSize: 14 },
});
