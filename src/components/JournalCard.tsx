import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import type { JournalEntry } from '../types';
import { formatDate, formatTime } from '../utils/dates';
import { useStoredImageUri } from '../hooks/useStoredImageUri';

export function JournalCard({
  entry,
  petName,
  onPress,
  onToggleFavorite,
}: {
  entry: JournalEntry;
  petName: string;
  onPress?: () => void;
  onToggleFavorite?: () => void;
}) {
  const { colors } = useTheme();
  const photoUri = useStoredImageUri(entry.photo_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed && onPress ? 0.92 : 1,
        },
      ]}
    >
      {!!photoUri && (
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.date, { color: colors.muted }]}>
            {formatDate(entry.taken_at)} · {formatTime(entry.taken_at)}
          </Text>
          <Pressable onPress={onToggleFavorite} hitSlop={12} accessibilityRole="button" accessibilityLabel="Toggle favorite">
            <Text style={{ fontSize: 18 }}>{entry.favorite ? '❤️' : '🤍'}</Text>
          </Pressable>
        </View>
        {!!entry.note && (
          <Text style={[styles.note, { color: colors.ink }]}>{entry.note}</Text>
        )}
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.faint }]}>{petName}</Text>
          {!!entry.location_label && <Text style={[styles.meta, { color: colors.faint }]}> · {entry.location_label}</Text>}
          {!!entry.weather_label && <Text style={[styles.meta, { color: colors.faint }]}> · {entry.weather_label}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, overflow: 'hidden', marginBottom: 14 },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  body: { padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 13, fontWeight: '600' },
  note: { fontSize: 16, lineHeight: 22, marginTop: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  meta: { fontSize: 13 },
});
