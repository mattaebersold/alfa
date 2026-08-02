import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { headerOffset, resetHeader } from '../../hooks/useHeaderScroll';
import { Bell, Warehouse, Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from './Avatar';
import NavDrawer from './NavDrawer';
import { useAppSelector } from '../../store/store';
import { useGetUnreadNotificationCountQuery, useGetUserGarageQuery } from '../../api/apiService';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import { CONFIG } from '../../constants/config';
import { useBrandColor } from '../../hooks/useBrandColor';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const BTN = 44;          // floating button edge length
const BTN_RADIUS = 15;   // squircle-ish corner
const ROW_PAD_V = 8;     // vertical padding around the button row

const ICON = '#000000';

/**
 * Height the header occupies below the safe-area inset.
 */
export const APP_HEADER_HEIGHT = BTN + ROW_PAD_V * 2;

/**
 * Top padding a screen's scroll content needs so its first item starts clear of
 * the floating buttons. The bar is an absolute overlay and reserves no layout
 * space, so content scrolls up underneath it.
 */
export function useHeaderPad(): number {
  const insets = useSafeAreaInsets();
  return insets.top + APP_HEADER_HEIGHT;
}

/**
 * Floating header button — a rounded square fully filled with the brand color,
 * sitting below the status bar. `wide` relaxes the fixed width for buttons
 * that carry a label.
 */
function FloatingButton({
  onPress, children, badge, label, tint, wide,
}: {
  onPress: () => void;
  children: React.ReactNode;
  badge?: boolean;
  label: string;
  tint: string;
  wide?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      // The color lives on the shadowed view itself: iOS won't cast a shadow
      // from a view with no background, and it guarantees the tint fills the
      // button rather than relying on an absolutely-positioned sibling.
      style={[styles.btn, wide && styles.btnWide, { backgroundColor: tint }]}
    >
      <View style={[styles.btnIcon, wide && styles.btnIconWide]}>{children}</View>
      {badge && <View style={[styles.badge, { borderColor: tint }]} />}
    </TouchableOpacity>
  );
}

/** Up to `max` overlapping car photos from the user's garage. */
function GarageThumbs({ cars, max = 2 }: { cars: GarageCar[]; max?: number }) {
  const shown = cars.slice(0, max);
  if (shown.length === 0) return <Warehouse size={19} color={ICON} />;

  return (
    <View style={styles.thumbRow}>
      {shown.map((car, i) => {
        const uri = car.profile_image
          ? imageUrl(car.profile_image) ?? undefined
          : firstGalleryUrl(car.gallery) ?? undefined;
        return (
          <ExpoImage
            key={car.internal_id ?? i}
            source={{ uri }}
            style={[styles.thumb, i > 0 && styles.thumbOverlap]}
            contentFit="cover"
          />
        );
      })}
    </View>
  );
}

interface AppHeaderProps {
  /**
   * Reserve layout space for the header instead of floating over the content.
   * Screens whose scroll container applies `useHeaderPad()` leave this off so
   * their content passes under the buttons.
   */
  spacer?: boolean;
}

export default function AppHeader({ spacer }: AppHeaderProps = {}) {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, userInfo } = useAppSelector((s) => s.auth);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Buttons carry the brand color; icons are black on top of it.
  const tint = useBrandColor();

  // `headerOffset` is shared across screens, so a screen left mid-scroll would
  // otherwise hand the next one a header that's still slid off-screen.
  useEffect(() => { resetHeader(); }, []);

  const { data: notifData } = useGetUnreadNotificationCountQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: CONFIG.NOTIFICATION_POLL_INTERVAL,
  });

  const notifCount = notifData?.count ?? 0;

  const { data: garageData } = useGetUserGarageQuery(undefined, { skip: !isLoggedIn });
  const garageCars = garageData?.entries ?? [];

  const go = (screen: string, params?: object) =>
    (navigation as any).navigate('MainTabs', { screen, params });

  return (
    <>
      {/* The bar is transparent, so the status bar shows the screen behind it. */}
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {spacer && <View style={{ height: insets.top + APP_HEADER_HEIGHT }} />}

      {/* Sits below the status bar, not behind it. Slides up out of view when
          the screen is scrolled down, back in when scrolled up. */}
      <Animated.View
        style={[
          styles.bar,
          {
            top: insets.top + ROW_PAD_V,
            transform: [{ translateY: headerOffset }],
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Left — logo returns to the home feed */}
        <FloatingButton
          label="Home feed"
          tint={tint}
          onPress={() => go('FeedTab', { screen: 'Feed' })}
        >
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logo}
            tintColor={ICON}
          />
        </FloatingButton>

        {/* Right — notifications (only when unread), garage, profile, menu */}
        <View style={styles.rightActions}>
          {notifCount > 0 && (
            <FloatingButton
              label={`Notifications, ${notifCount} unread`}
              tint={tint}
              badge
              onPress={() => navigation.navigate('Notifications')}
            >
              <Bell size={21} color={ICON} />
            </FloatingButton>
          )}

          <FloatingButton
            label="Garage"
            tint={tint}
            wide
            onPress={() => go('CarsTab', { screen: 'Garage' })}
          >
            <GarageThumbs cars={garageCars} />
            <Text style={styles.btnLabel}>Garage</Text>
          </FloatingButton>

          <FloatingButton
            label="Your profile"
            tint={tint}
            onPress={() => go('FeedTab', { screen: 'Profile' })}
          >
            <Avatar
              filename={userInfo?.gallery?.[0]?.filename}
              name={userInfo?.username ?? '?'}
              size={BTN}
              radius={BTN_RADIUS}
            />
          </FloatingButton>

          <FloatingButton
            label="Menu"
            tint={tint}
            onPress={() => setDrawerOpen(true)}
          >
            <Menu size={21} color={ICON} />
          </FloatingButton>
        </View>
      </Animated.View>

      <NavDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  btn: {
    width: BTN, height: BTN,
    borderRadius: BTN_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  btnIcon: {
    width: BTN, height: BTN,
    alignItems: 'center',
    justifyContent: 'center',
    // Clips the avatar to the button's corners. Sits inside the shadowed view
    // so overflow:hidden can't crop the shadow.
    borderRadius: BTN_RADIUS,
    overflow: 'hidden',
  },
  // Labelled buttons size to their content instead of the fixed square.
  btnWide:     { width: undefined, paddingHorizontal: 12 },
  btnIconWide: {
    width: undefined, flexDirection: 'row', alignItems: 'center', gap: 7,
    overflow: 'visible',
  },
  btnLabel: { fontSize: 14, fontWeight: '800', color: ICON, letterSpacing: -0.2 },

  thumbRow:     { flexDirection: 'row', alignItems: 'center' },
  thumb:        { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.25)' },
  thumbOverlap: { marginLeft: -9 },

  logo: { width: 26, height: 26 },

  badge: {
    position: 'absolute', top: -2, right: -2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#EC4632',
    borderWidth: 2,
  },
});
