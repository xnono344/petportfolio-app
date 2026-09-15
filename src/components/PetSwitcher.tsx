import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme';
import { PetAvatar } from './PetAvatar';
import type { Pet } from '../types';

export function PetSwitcher({
  pets,
  activeId,
  onSelect,
  onAdd,
  compact = false,
}: {
  pets: Pet[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  if (!pets.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {pets.map((p) => {
        const active = p.id === activeId;
        return (
          <TouchableOpacity
            key={p.id}
            onPress={() => onSelect(p.id)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.ink : colors.surface,
                borderColor: active ? colors.ink : colors.line,
              },
            ]}
          >
            <PetAvatar pet={p} size={compact ? 28 : 34} />
            <Text style={[styles.name, { color: active ? colors.bg : colors.ink }]}>{p.name}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        onPress={onAdd}
        style={[styles.chip, { borderColor: colors.line, backgroundColor: colors.surface, borderStyle: 'dashed' }]}
      >
        <Text style={{ fontSize: 20 }}>＋</Text>
        <Text style={[styles.name, { color: colors.muted }]}>Add</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  name: { fontSize: 15, fontWeight: '700' },
});

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={hstyles.row}>
      <Text style={[hstyles.title, { color: colors.ink }]}>{title}</Text>
      {!!action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={[hstyles.action, { color: colors.primary }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const hstyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  title: { fontSize: 19, fontWeight: '800' },
  action: { fontSize: 15, fontWeight: '700' },
});
