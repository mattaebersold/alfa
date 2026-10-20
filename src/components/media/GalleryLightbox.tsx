import React, { useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Dimensions, Modal, StatusBar, SafeAreaView as RNSafeAreaView, Platform,
} from 'react-native';
import { Text, PortalHost } from '@ors/kit';
import { Image } from 'expo-image';
import { X, MoreHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, FlatList as GHFlatList } from 'react-native-gesture-handler';
import PinchZoom from './PinchZoom';
import { imageUrl } from '../../utils/image';
import type { GalleryItem } from '../../types/api';
import { COLOR_BLACK, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/*
 * The full-screen photo viewer — the car gallery's, and anywhere else a row of
 * photos opens into one (a listing's). Swipe between them, pinch to zoom, a
 * count and an optional title up top.
 */

/**
 * One page of the car lightbox: the photo, fitted, growing under a pinch and
 * settling back on release — the home feed's PinchZoom.
 *
 * It was ZoomableImage, whose pan and double-tap held every drag on the photo
 * whether zoomed or not, so a swipe never reached the list and the gallery
 * wouldn't page. PinchZoom takes only two fingers, and is told about the list
 * (`simultaneousWith`) so the two share the screen.
 */
function LightboxPage({
  item, height, listRef, onPinchChange,
}: {
  item: GalleryItem;
  height: number;
  listRef: React.RefObject<any>;
  onPinchChange: (pinching: boolean) => void;
}) {
  return (
    <View style={{ width: SCREEN_WIDTH, height }}>
      <PinchZoom style={StyleSheet.absoluteFill} simultaneousWith={listRef} onActiveChange={onPinchChange}>
        <Image source={{ uri: imageUrl(item.filename)! }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </PinchZoom>
    </View>
  );
}

function Lightbox({
  images, initialIndex, title, onClose, onManage,
}: { images: GalleryItem[]; initialIndex: number; title?: string; onClose: () => void; onManage?: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const [listHeight, setListHeight] = useState(SCREEN_HEIGHT - 80);
  // The list holds still while a photo is pinched, so a pinch that drifts
  // sideways doesn't page.
  const [pinching, setPinching] = useState(false);
  /** Gesture-handler's list, named to each photo's pinch — see LightboxPage. */
  const listRef = useRef<any>(null);
  // RN's SafeAreaView only pads on iOS. On Android the modal is
  // `statusBarTranslucent`, so the header — close button included — was drawn
  // under the status bar, where its taps go to the system instead. The app's
  // insets reach in here through context; `currentHeight` backs them up if
  // they come through as zero.
  const insets = useSafeAreaInsets();
  const androidTop = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : 0;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
      {/* The pinch draws its growing copy into a portal; a Modal is its own
          window, so it needs a host of its own or the copy lands under it. */}
      <PortalHost>
      <RNSafeAreaView style={styles.lightboxSafe}>
        <StatusBar barStyle="light-content" backgroundColor={COLOR_BLACK} />
        <View style={[styles.lightboxHeader, androidTop > 0 && { paddingTop: 12 + androidTop }]}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.lightboxTitle}>{title}</Text> : null}
            <Text style={styles.lightboxCount}>{index + 1} / {images.length}</Text>
          </View>
          {onManage && (
            <TouchableOpacity onPress={onManage} style={styles.lightboxClose} hitSlop={6}>
              <MoreHorizontal size={22} color={COLOR_WHITE} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={styles.lightboxClose}>
            <X size={22} color={COLOR_WHITE} />
          </TouchableOpacity>
        </View>
        <GHFlatList
          ref={listRef}
          style={{ flex: 1 }}
          onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
          data={images}
          keyExtractor={(img, i) => img.filename ?? String(i)}
          horizontal
          pagingEnabled
          scrollEnabled={!pinching}
          initialScrollIndex={initialIndex}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
          renderItem={({ item }) => (
            <LightboxPage item={item} height={listHeight} listRef={listRef} onPinchChange={setPinching} />
          )}
        />
      </RNSafeAreaView>
      </PortalHost>
      </GestureHandlerRootView>
    </Modal>
  );
}

export default Lightbox;

const styles = StyleSheet.create({
  lightboxSafe:   { flex: 1, backgroundColor: COLOR_BLACK },
  lightboxHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  lightboxTitle:  { color: COLOR_WHITE, fontSize: 15, fontFamily: FONT_INTER.bold },
  lightboxCount:  { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  lightboxClose:  { padding: 8 },
});
