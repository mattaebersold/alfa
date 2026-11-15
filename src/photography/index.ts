/**
 * The photo spot map: screens, sheets and hooks.
 *
 * The screens are navigation-agnostic — each takes callbacks (`onDropPin`,
 * `onEditSpot`, `onSaved`) so the navigator hosts them — and anything
 * app-specific comes in through a slot:
 * `header` (alfa's AppHeader), `renderSpotContext` (alfa's tagged members,
 * cars and events on a spot's summary), `extraFields` (alfa's tag picker on
 * the form), `onUpsell` (alfa's Pro screen).
 *
 * The form's photo strip is alfa's reorderable gallery editor, so the host
 * app needs react-native-draggable-flatlist.
 */
export { default as PhotographyScreen, type PhotographyScreenProps, type MapFocus } from './PhotographyScreen';
export {
  default as PhotoSpotCreateScreen, FormSection, type PhotoSpotCreateScreenProps,
} from './PhotoSpotCreateScreen';
export { default as PhotoSpotSummaryModal, type PhotoSpotSummaryModalProps } from './PhotoSpotSummaryModal';
export { default as PhotoSpotRow } from './PhotoSpotRow';
export { default as DropPinSheet, type DropPinSheetProps, type DropPoint } from './DropPinSheet';
export { default as SpotPicker, type SpotPickerProps } from './SpotPicker';
export { default as GalleryEditor, toEditorImages, type EditorImage } from './GalleryEditor';
export { useSpotMarkers, type SpotMarker } from './useSpotMarkers';
export * from './constants';
export { boundsFor, coordinateAt, boxAround, type MapBounds } from './geometry';
export { photographyApi, useUpdatePhotoSpotMutation, useRemovePhotoSpotPhotoMutation } from './api';
