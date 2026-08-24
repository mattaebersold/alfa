import React from 'react';
import { View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useGetSiteSettingsQuery } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { bannerDestination } from '../../constants/bannerDestinations';

/**
 * The admin-managed feature banner at the top of the home feed.
 *
 * It can't be dismissed: the banner is the one slot ORS controls, and a member
 * who closed it once was closing every future banner too, since the next upload
 * only arrived as a new id if the admin replaced the image outright.
 */
export default function HomeFeatureBanner() {
  const navigation = useNavigation<any>();
  const { data: settings } = useGetSiteSettingsQuery();

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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  {
    marginHorizontal: 8, marginTop: 8,
    borderRadius: 12, overflow: 'hidden',
  },
  image: { width: '100%', aspectRatio: 2.2, backgroundColor: '#111' },
});
