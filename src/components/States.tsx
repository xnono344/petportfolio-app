import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';

export function Loading({ message = 'Loading…' }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.msg, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  emoji = '🐾',
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  emoji?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{message}</Text>
      {!!actionLabel && !!onAction && (
        <View style={{ marginTop: 14, width: '100%' }}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.dangerSoft, borderColor: colors.line }]}>
      <Text style={styles.emoji}>😿</Text>
      <Text style={[styles.title, { color: colors.ink }]}>Something went wrong</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{message}</Text>
      {!!onRetry && (
        <View style={{ marginTop: 14, width: '100%' }}>
          <Button title="Try again" variant="soft" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  msg: { marginTop: 10, fontSize: 15 },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginVertical: 8,
  },
  emoji: { fontSize: 40 },
  title: { fontSize: 18, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  body: { fontSize: 15, marginTop: 6, textAlign: 'center', lineHeight: 21 },
});
