import React from 'react';
import { TouchableOpacity, Alert } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useDeletePostMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';

interface Props {
  postId: string;
  size?: number;
  color?: string;
  /** If provided, "Edit" calls this instead of deep-linking to the post detail. */
  onEdit?: () => void;
  /** Called after a successful delete (e.g. to pop a detail screen). */
  onDeleted?: () => void;
}

// "..." menu shown on the user's own posts — Edit / Delete via the native action sheet.
export default function PostOwnerMenu({ postId, size = 18, color, onEdit, onDeleted }: Props) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const [deletePost] = useDeletePostMutation();

  const confirmDelete = () => {
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost({ internal_id: postId }).unwrap();
            onDeleted?.();
          } catch {
            Alert.alert('Error', 'Could not delete the post. Please try again.');
          }
        },
      },
    ]);
  };

  const openMenu = () => {
    Alert.alert('Post options', undefined, [
      { text: 'Edit', onPress: () => (onEdit ? onEdit() : nav.navigate('PostDetailModal', { postId, edit: true })) },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <TouchableOpacity onPress={openMenu} hitSlop={8}>
      <MoreHorizontal size={size} color={color ?? colors.grey} />
    </TouchableOpacity>
  );
}
