import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme, type Palette } from '../theme';
import type { Pet, Species } from '../types';
import { speciesInfo } from '../types';
import { useStoredImageUri } from '../hooks/useStoredImageUri';

function accent(species: Species, colors: Palette): { bg: string; ring: string } {
  switch (species) {
    case 'dog':
      return { bg: colors.dogSoft, ring: colors.dog };
    case 'cat':
      return { bg: colors.catSoft, ring: colors.cat };
    case 'bird':
    case 'fish':
      return { bg: colors.sky, ring: colors.primary };
    case 'turtle':
    case 'lizard':
    case 'snake':
      return { bg: colors.sageSoft, ring: colors.sage };
    case 'rabbit':
    case 'hamster':
    case 'hedgehog':
      return { bg: colors.primarySoft, ring: colors.primaryDeep };
    default:
      return { bg: colors.surface2, ring: colors.faint };
  }
}

export function PetAvatar({ pet, size = 56 }: { pet: Pet; size?: number }) {
  const { colors } = useTheme();
  const { bg, ring } = accent(pet.species, colors);
  const photoUri = useStoredImageUri(pet.photo_url);
  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: ring }}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: ring },
      ]}
    >
      <Text style={{ fontSize: size * 0.45 }}>{speciesInfo(pet.species).emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
