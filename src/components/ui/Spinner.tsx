import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';

interface SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  fullScreen?: boolean;
}

export default function Spinner({ size = 'large', color, fullScreen = false }: SpinnerProps) {
  const colors = useColors();
  const spinColor = color ?? colors.primaryAlt;

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.cream }]}>
        <ActivityIndicator size={size} color={spinColor} />
      </View>
    );
  }
  return <ActivityIndicator size={size} color={spinColor} />;
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
