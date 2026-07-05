import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Checkered racing flag, drawn in the lucide 24x24 stroke style.
export default function CheckeredFlag({ size = 24, color = 'currentColor', strokeWidth = 2 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* pole */}
      <Path d="M5 3v18" />
      {/* flag outline */}
      <Rect x="5" y="4" width="14" height="7" />
      {/* checker fills */}
      <Rect x="5" y="4" width="3.5" height="3.5" fill={color} stroke="none" />
      <Rect x="12" y="4" width="3.5" height="3.5" fill={color} stroke="none" />
      <Rect x="8.5" y="7.5" width="3.5" height="3.5" fill={color} stroke="none" />
      <Rect x="15.5" y="7.5" width="3.5" height="3.5" fill={color} stroke="none" />
    </Svg>
  );
}
