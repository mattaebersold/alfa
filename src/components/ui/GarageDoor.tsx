import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Garage: pitched roof over a panelled roll-up door, drawn in the lucide
// 24x24 stroke style. One slat, splitting the door in half — at the header's
// stroke weight a second line leaves less gap than the strokes are thick and
// the door fills in solid.
export default function GarageDoor({ size = 24, color = 'currentColor', strokeWidth = 2 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* walls and roof */}
      <Path d="M3 21V10l9-6 9 6v11" />
      {/* ground */}
      <Path d="M2 21h20" />
      {/* door opening */}
      <Path d="M7 21v-9h10v9" />
      {/* slat */}
      <Path d="M7 16.5h10" />
    </Svg>
  );
}
