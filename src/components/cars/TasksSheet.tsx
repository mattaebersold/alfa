import React from 'react';
import {
  Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { X, Wrench, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetCarTasksQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { Colors } from '../../constants/colors';
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
  const tasks = data?.entries ?? [];
  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const goToFull = () => {
    onClose();
    navigation.navigate('CarTasks', { carId, carTitle });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.cream }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <Wrench size={18} color={Colors.brg} />
              <Text style={[styles.title, { color: colors.fg }]}>Tasks</Text>
              {open.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{open.length}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={goToFull} style={styles.manageBtn} activeOpacity={0.7}>
                <Text style={[styles.manageBtnText, { color: Colors.brg }]}>Manage</Text>
                <ChevronRight size={14} color={Colors.brg} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={22} color={colors.grey} />
              </TouchableOpacity>
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.brg} style={{ marginTop: 40 }} />
          ) : tasks.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.grey }]}>No tasks yet.</Text>
              <TouchableOpacity onPress={goToFull} style={[styles.addBtn, { backgroundColor: Colors.brg }]}>
                <Text style={styles.addBtnText}>Add Task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={[...open, ...done]}
              keyExtractor={(t) => t.internal_id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                  <View style={[styles.dot, item.completed ? styles.dotDone : { backgroundColor: Colors.brg }]} />
                  <View style={styles.rowText}>
                    <Text style={[
                      styles.taskTitle, { color: colors.fg },
                      item.completed && { color: colors.grey, textDecorationLine: 'line-through' },
                    ]}>
                      {item.title}
                    </Text>
                    {item.priority && (
                      <Text style={[styles.priority, { color: colors.grey }]}>{item.priority}</Text>
                    )}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(100,100,100,0.55)' },
  backdrop:    { ...StyleSheet.absoluteFillObject },
  sheet:       { maxHeight: '85%', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title:       { fontSize: 17, fontWeight: '700' },
  badge:       {
    backgroundColor: Colors.brg, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeText:   { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  manageBtn:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  manageBtnText: { fontSize: 14, fontWeight: '600' },
  list:        { paddingBottom: 40 },
  row:         {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  dotDone:     { backgroundColor: Colors.green },
  rowText:     { flex: 1 },
  taskTitle:   { fontSize: 15, fontWeight: '500' },
  priority:    { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 16 },
  emptyText:   { fontSize: 15 },
  addBtn:      { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  addBtnText:  { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
