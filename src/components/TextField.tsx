import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../theme';

export function TextField({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.line,
            color: colors.ink,
          },
        ]}
        {...props}
      />
      {!!error && <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  err: { fontSize: 13, marginTop: 4 },
});
