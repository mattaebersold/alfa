import React from 'react';
import SharedModal from '../ui/SharedModal';
import GroupInviteSearch from './GroupInviteSearch';

/**
 * GroupInviteSearch in a sheet of its own, for the surfaces that open inviting
 * as its own errand rather than from inside another panel.
 */
export default function GroupInviteSheet({
  groupId,
  groupTitle,
  visible,
  onClose,
}: {
  groupId: string;
  groupTitle?: string;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      title={groupTitle ? `Invite to ${groupTitle}` : 'Invite Members'}
      heightRatio={0.85}
    >
      <GroupInviteSearch groupId={groupId} active={visible} autoFocus />
    </SharedModal>
  );
}
