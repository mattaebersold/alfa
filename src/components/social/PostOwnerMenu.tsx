import React, { useState } from 'react';
import { TouchableOpacity, Alert } from 'react-native';
import { EllipsisVertical } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useDeletePostMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import PostEditSheet from './PostEditSheet';
import type { Post } from '../../types/api';

interface Props {
  postId: string;
  /**
   * The post itself. With it, "Edit" opens the Edit Post pane right here —
   * alone, rather than opening the post's detail pane underneath it.
   */
  post?: Post;
  size?: number;
  color?: string;
  /** If provided, "Edit" calls this instead of deep-linking to the post detail. */
  onEdit?: () => void;
  /** Called after a successful delete (e.g. to pop a detail screen). */
  onDeleted?: () => void;
}

// "..." menu shown on the user's own posts — Edit / Delete via the native action sheet.
export default function PostOwnerMenu({ postId, post, size = 18, color, onEdit, onDeleted }: Props) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const [deletePost] = useDeletePostMutation();
  const [editOpen, setEditOpen] = useState(false);
  // Mounted from the first open on, so it can slide away when closed.
  const [editMounted, setEditMounted] = useState(false);
  const edit = () => {
    if (onEdit) return onEdit();
    if (post) { setEditMounted(true); setEditOpen(true); return; }
    // No post in hand: its detail opens with the editor over it.
    nav.navigate('PostDetailModal', { postId, edit: true });
  };

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
      { text: 'Edit', onPress: edit },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <>
      <TouchableOpacity onPress={openMenu} hitSlop={8}>
        <EllipsisVertical size={size} color={color ?? colors.grey} />
      </TouchableOpacity>
      {post && editMounted && (
        <PostEditSheet post={post} visible={editOpen} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}
