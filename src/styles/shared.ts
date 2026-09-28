import { StyleSheet } from 'react-native';
import { COMMON_RADIUS, COLOR_BLACK } from '../constants/config';
import { FONT_INTER } from '../constants/fonts'

export const ss = StyleSheet.create({
  // Layout
  fill:      { flex: 1 },
  row:       { flexDirection: 'row', alignItems: 'center' },
  rowSpread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center:    { alignItems: 'center', justifyContent: 'center' },

  // Cards
  card:   { borderRadius: COMMON_RADIUS, borderWidth: 1 },
  shadow: {
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  // Underline tab bars (Profile, UserDetail, EventDetail, Marketplace)
  tabBar:     { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem:    { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:    { fontSize: 14, fontFamily: FONT_INTER.semibold },

  // Section headers (search results, feed sections, etc.)
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1 },
  sectionTitle:  { fontSize: 12, fontFamily: FONT_INTER.extrabold, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Inputs
  input: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15,
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  chatInput: {
    flex: 1, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, maxHeight: 100,
  },

  // List rows (standard item row with separator)
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },

  // Typography
  h1:      { fontSize: 22, fontFamily: FONT_INTER.bold },
  h2:      { fontSize: 18, fontFamily: FONT_INTER.bold },
  label:   { fontSize: 15, fontFamily: FONT_INTER.semibold },
  body:    { fontSize: 15 },
  small:   { fontSize: 13 },
  caption: { fontSize: 12 },

  // Misc
  divider:     { height: 1 },
  listPadding: { paddingBottom: 40 },
});
