import React from 'react';
import {
  Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable, Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import { useGetLikeUsersQuery, useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';

function LikerRow({ userId }: { userId: string }) {
  const colors = useColors();
  const { data: user } = useGetUserByIdQuery(userId, { skip: !userId });
  if (!user) return null;
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={40} />
      <Text style={[styles.name, { color: colors.fg }]}>@{user.username}</Text>
    </View>
  );
}

interface LikersSheetProps {
  entryId: string;
  visible: boolean;
  onClose: () => void;
}

export default function LikersSheet({ entryId, visible, onClose }: LikersSheetProps) {
  const colors = useColors();
  const { data, isLoading } = useGetLikeUsersQuery(entryId, { skip: !visible || !entryId });
  const userIds = data?.users ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.cream }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.fg }]}>Liked by</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color={colors.grey} />
            </TouchableOpacity>
          </View>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginTop: 40 }} />
          ) : userIds.length === 0 ? (
            <Text style={[styles.empty, { color: colors.grey }]}>No likes yet. Be the first!</Text>
          ) : (
            <FlatList
              data={userIds}
              keyExtractor={(id) => id}
              renderItem={({ item }) => <LikerRow userId={item} />}
              contentContainerStyle={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(100,100,100,0.55)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet:    { maxHeight: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden', paddingBottom: Platform.OS === 'android' ? 60 : 30 },
  header:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  title:    { fontSize: 17, fontWeight: '700' },
  list:     { paddingBottom: 40 },
  row:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  name:     { fontSize: 15, fontWeight: '600' },
  username: { fontSize: 13, marginTop: 1 },
  empty:    { textAlign: 'center', padding: 40, fontSize: 15 },
});
