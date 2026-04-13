/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4: use 'class' strategy for dark mode
  darkMode: 'class',
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Font sizes (rem → pixel approximations for RN)
      fontSize: {
        xs:    12,
        sm:    14,
        base:  16,
        md:    18,
        lg:    20,
        xl:    24,
        '2xl': 30,
        '3xl': 36,
        '4xl': 48,
      },
      // Spacing tokens from Murray
      spacing: {
        xs:     15,
        sm:     30,
        md:     45,
        lg:     60,
        xl:     80,
        xxl:    120,
        header: 64, // reduced from 100px for mobile
      },
      colors: {
        // ── Static brand colors ─────────────────────────────────────
        brg: {
          DEFAULT: '#1C3738',
          dark:    '#142627',
          light:   '#254A4B',
        },
        pro: {
          DEFAULT: '#CDA96F',
          dark:    '#82683F',
          light:   '#F7CE8C',
        },
        guards:    '#D00000',
        tangerine: '#FA7921',
        speed:     '#FEB829',
        green:     '#85C27D',

        // ── Static badge colors ─────────────────────────────────────
        badgeListing: { DEFAULT: '#00FF3F', foreground: '#000000' },
        badgeWant:    { DEFAULT: '#F1184C', foreground: '#000000' },
        badgeGarage:  { DEFAULT: '#FF479C', foreground: '#000000' },
        badgeEvent:   { DEFAULT: '#FFFB38', foreground: '#000000' },
        badgeGroup:   { DEFAULT: '#F89CFA', foreground: '#000000' },
        badgeRecord:  { DEFAULT: '#35B5FF', foreground: '#000000' },
        badgeDefault: { DEFAULT: '#F0D689', foreground: '#000000' },
        badgeSpot:    { DEFAULT: '#F36943', foreground: '#000000' },
        badgeUpdate:  { DEFAULT: '#2E9599', foreground: '#FFFFFF' },

        // ── Other static colors ─────────────────────────────────────
        offwhite:   '#F2EDEB',
        cream:      '#F5EFED',
        grey: {
          DEFAULT: '#8D8D8D',
          dark:    '#666666',
          light:   '#D3D3D3',
        },
        gold:       '#C1911B',
        pink:       '#D8948B',
        teal:       '#01777A',
        red:        '#EC4632',
        blue:       '#2F3A4C',
        lightGreen: '#8DCD6E',
        dark:       '#282828',
        cyan:       '#08DEE3',

        // ── Light mode semantic tokens ──────────────────────────────
        bg:         '#F5EFED',
        fg:         '#141414',
        border:     '#AAAAAA',
        muted:      '#404040',
        segment:    '#F0F0F0',
        primary:    '#08DEE3',
        secondary:  '#DDD8D6',
        input:      '#CCCCCC',
        inputBg:    '#FFFFFF',
        inputBorder:'#606060',
      },
      borderRadius: {
        card:    8,
        default: 8,
        small:   5,
      },
    },
  },
  plugins: [],
};
