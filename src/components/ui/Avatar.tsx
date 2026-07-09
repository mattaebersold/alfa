import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { imageUrl } from '../../utils/image';

interface AvatarProps {
  filename?: string | null;
  name?: string;
  size?: number;
}

export default function Avatar({ filename, name = '?', size = 40 }: AvatarProps) {
  const uri = imageUrl(filename);
  const [failed, setFailed] = useState(false);

  // Reset the error state if the source changes.
  useEffect(() => { setFailed(false); }, [uri]);

  // First alphanumeric character(s) of the name — falls back to a letter, not a blank circle.
  const cleaned = name.replace(/^@/, '').trim();
  const initials = cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

  const showImage = uri && !failed;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={200}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.42 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Slightly darker than the accent blue so white initials read clearly.
    backgroundColor: 'rgb(28, 124, 163)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
