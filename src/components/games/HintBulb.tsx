import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/**
 * The hint's bulb: lit — warm glass with a glint and a filament, on a grey
 * screw base — where lucide's is only an outline.
 */
export default function HintBulb({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.1.9 1.8V17h6v-1c0-.7.3-1.3.9-1.8A6.5 6.5 0 0 0 12 2.5Z"
        fill="#FFC94D"
      />
      <Path d="M9.2 6.8a3.8 3.8 0 0 1 2.4-1.7" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <Path d="M10.5 14.2 11.25 11.6l.75 1.2.75-1.2.75 2.6" stroke="#9A6400" strokeWidth={1} strokeLinejoin="round" fill="none" />
      <Rect x={9} y={17.6} width={6} height={1.6} rx={0.8} fill="#C8C8C8" />
      <Rect x={9.6} y={19.8} width={4.8} height={1.6} rx={0.8} fill="#A8A8A8" />
      <Rect x={10.8} y={21.9} width={2.4} height={1} rx={0.5} fill="#888888" />
    </Svg>
  );
}
