import React from 'react';
import { View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import { useGetSiteSettingsQuery } from '../../api/apiService';
import { useFeedPreferences } from '../../hooks/useFeedPreferences';
import { imageUrl } from '../../utils/image';
import { bannerDestination } from '../../constants/bannerDestinations';

/**
 * The admin-managed feature banner at the top of the home feed.
 *
 * Closing it is permanent — but only for *this* banner. The dismissal is stored
 * as the banner's id, and uploading a new image mints a new id, so fresh content
 * comes back on its own for everyone who had closed the last one. That's the
 * whole reason the id exists rather than a plain boolean.
 */
export default function HomeFeatureBanner() {
  const navigation = useNavigation<any>();
  const { data: settings } = useGetSiteSettingsQuery();
  const { dismissBanner, isBannerDismissed } = useFeedPreferences();

  const banner = settings?.home_banner;
  const src = imageUrl(banner?.image);

  // A banner can carry both an app destination and a web URL — murray follows
  // the URL, and here the in-app screen wins, because staying in the app beats
  // bouncing the member out to a browser for the same content. The URL is the
  // fallback: it covers banners saved before destinations existed, banners whose
  // destination key this build doesn't recognise, and ones pointing somewhere
  // that only exists on the web.
  const destination = bannerDestination(banner?.destination);
  const url = banner?.url ?? null;
  const tappable = !!destination || !!url;

  if (!banner || banner.active === false || !src) return null;
  if (isBannerDismissed(banner.banner_id)) return null;

  const open = () => {
    if (destination) {
      const target = destination.target(banner.destination_id ?? undefined);
      navigation.navigate(target.name, target.params);
      return;
    }
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={tappable ? 0.9 : 1}
        onPress={open}
        // Without a destination there's nothing to open, so the image isn't a button.
        disabled={!tappable}
        accessibilityRole={tappable ? 'link' : 'image'}
      >
        <Image source={{ uri: src }} style={styles.image} contentFit="cover" transition={150} />
      </TouchableOpacity>

      {/* Floated over the image rather than placed beside it — the banner is
          edge-to-edge artwork, and a header bar for one small control would
          cost more room than the control needs. The scrim keeps it visible on
          a light image. */}
      <TouchableOpacity
        style={styles.close}
        onPress={() => dismissBanner(banner.banner_id)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Hide this banner"
      >
        <X size={15} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  {
    marginHorizontal: 8, marginTop: 8,
    borderRadius: 12, overflow: 'hidden',
  },
  image: { width: '100%', aspectRatio: 2.2, backgroundColor: '#111' },
  close: {
    position: 'absolute', top: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
