import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useAppSelector } from '../store/store';
import { useDeleteRallyMutation } from '../api/apiService';
import type { Rally } from '../types/api';

/**
 * The delete control shared by the two rally surfaces — the full screen and the
 * sheet, which are kept in step deliberately.
 *
 * A rally is a club-wide event rather than one member's post, so removing one
 * is an admin act; the organiser who created it can still remove their own.
 * horacio enforces both — this only decides whether to offer the control.
 */
export function useRallyDelete(rally: Rally | undefined, onDeleted?: () => void) {
  const { userInfo } = useAppSelector((s) => s.auth);
  const [deleteRally, { isLoading }] = useDeleteRallyMutation();

  const canDelete =
    !!rally && !!userInfo &&
    (userInfo.accountType === 'admin' || userInfo.user_id === rally.user_id);

  const confirmDelete = useCallback(() => {
    if (!rally) return;
    Alert.alert(
      'Delete rally',
      `"${rally.title ?? 'This rally'}" will be removed for everyone. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRally(rally.internal_id).unwrap();
              onDeleted?.();
            } catch {
              Alert.alert('Error', 'Could not delete this rally.');
            }
          },
        },
      ],
    );
  }, [rally, deleteRally, onDeleted]);

  return { canDelete, confirmDelete, isDeleting: isLoading };
}
