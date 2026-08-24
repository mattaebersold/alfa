import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import NotificationsList from '../../components/notifications/NotificationsList';
import { ss } from '../../styles/shared';

/**
 * Notifications as a full-screen modal route.
 *
 * The list itself lives in components/notifications so the header's bell can
 * show exactly the same thing inside the panel it expands into. All this adds
 * is the screen's frame and what "close" means here — going back.
 */
export default function NotificationsScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: '#000' }]} edges={['bottom']}>
      <NotificationsList
        onDismiss={(go) => {
          navigation.goBack();
          go?.();
        }}
      />
    </SafeAreaView>
  );
}
