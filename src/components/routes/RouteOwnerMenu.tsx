import React from 'react';
import { TouchableOpacity, Alert } from 'react-native';
import { Ellipsis } from 'lucide-react-native';
import { useDeleteRouteMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';

interface Props {
  routeId: string;
  size?: number;
  color?: string;
  onEdit: () => void;
  /** Called after a successful delete — to leave the screen showing the route. */
  onDeleted?: () => void;
}

/**
 * "..." on your own route — Edit / Delete, the same shape as PostOwnerMenu.
 *
 * Only ever rendered for the route's creator; the server checks again. The
 * delete is confirmed first because a route, unlike a post, can't be made
 * again — it was a drive. The delete mutation invalidates every route list,
 * a group's Routes section included, so it's gone wherever you go back to.
 */
export default function RouteOwnerMenu({ routeId, size = 20, color, onEdit, onDeleted }: Props) {
  const colors = useColors();
  const [deleteRoute] = useDeleteRouteMutation();

  const confirmDelete = () => {
    Alert.alert('Delete route?', 'This drive will be removed for everyone, including any groups it was shared to.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoute(routeId).unwrap();
            onDeleted?.();
          } catch (err: any) {
            Alert.alert('Error', err?.data?.error || 'Could not delete the route. Please try again.');
          }
        },
      },
    ]);
  };

  const openMenu = () => {
    Alert.alert('Route options', undefined, [
      { text: 'Edit', onPress: onEdit },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={openMenu}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Route options"
    >
      <Ellipsis size={size} color={color ?? colors.grey} />
    </TouchableOpacity>
  );
}
