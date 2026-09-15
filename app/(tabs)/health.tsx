import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PetSwitcher, SectionHeader } from '../../src/components/PetSwitcher';
import { EmptyState, Loading } from '../../src/components/States';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { HEALTH_LABEL, type HealthKind } from '../../src/types';
import { formatDate, todayKey } from '../../src/utils/dates';
import { generateHealthSummaryPdf } from '../../src/lib/healthPdf';
import { sharePdf } from '../../src/lib/memoryBook';

const FILTERS: (HealthKind | 'all')[] = ['all', 'vet_visit', 'vaccination', 'medication', 'emergency'];

export default function HealthTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const { ready, pets, activePetId, activePet, setActivePetId, health, weights, deleteHealth, myRoleByPet } = useData();
  const sub = useSubscription();
  const canEdit = !activePetId || (myRoleByPet[activePetId] ?? 'owner') === 'owner';
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [busy, setBusy] = useState(false);

  const entries = useMemo(() => {
    let list = health.filter((h) => !activePetId || h.pet_id === activePetId);
    if (filter !== 'all') list = list.filter((h) => h.kind === filter);
    return list;
  }, [health, activePetId, filter]);

  const upcoming = useMemo(() => {
    const today = todayKey();
    return health.filter(
      (h) => (!activePetId || h.pet_id === activePetId) && h.next_due_on && h.next_due_on >= today,
    ).slice(0, 3);
  }, [health, activePetId]);

  if (!ready) return <Loading message="Loading health log…" />;
  if (!pets.length || !activePet) {
    return (
      <Screen>
        <EmptyState title="No pets yet" message="Add a pet to start its health log." actionLabel="Add a pet" onAction={() => router.push('/pet/new' as any)} />
      </Screen>
    );
  }

  const openNewEntry = () => {
    if (!canEdit) {
      Alert.alert('Read-only access', 'Only an owner can add or delete health entries.');
      return;
    }
    if (!sub.canUse('health_log')) {
      router.push('/settings/subscription' as any);
      return;
    }
    router.push('/health/new' as any);
  };

  const exportPdf = async () => {
    if (!sub.canUse('health_log') && !sub.canUse('enhanced_exports')) {
      router.push('/settings/subscription' as any);
      return;
    }
    setBusy(true);
    try {
      const petWeights = weights.filter((w) => w.pet_id === activePet.id);
      const petHealth = health.filter((h) => h.pet_id === activePet.id);
      const uri = await generateHealthSummaryPdf(activePet, petWeights, petHealth);
      await sharePdf(uri, `${activePet.name} Health Summary`);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Could not generate the PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>Health 💚</Text>
      <Text style={[styles.disclaimer, { color: colors.muted }]}>For personal use only. Not veterinary advice.</Text>
      <View style={{ height: 10 }} />
      <PetSwitcher pets={pets} activeId={activePetId} onSelect={setActivePetId} onAdd={() => router.push('/pet/new' as any)} />

      {upcoming.length > 0 && (
        <Card style={[styles.up, { backgroundColor: colors.sageSoft, borderColor: colors.sageSoft }]}>
          <Text style={[styles.upTitle, { color: colors.ink }]}>⏰ Coming up</Text>
          {upcoming.map((u) => (
            <Text key={u.id} style={[styles.upItem, { color: colors.ink }]}>
              {u.title} · due {formatDate(u.next_due_on)}
            </Text>
          ))}
        </Card>
      )}

      <SectionHeader
        title="Log"
        action={canEdit ? '＋ Add' : undefined}
        onAction={openNewEntry}
      />
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.pill, { backgroundColor: f === filter ? colors.ink : colors.surface, borderColor: colors.line }]}
          >
            <Text style={{ color: f === filter ? colors.bg : colors.ink, fontWeight: '700', fontSize: 13 }}>
              {f === 'all' ? 'All' : HEALTH_LABEL[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {entries.length === 0 ? (
        <EmptyState
          title="A calm, organized health log"
          message="Log vet visits, vaccines, meds and emergencies — all in one place."
          actionLabel={canEdit ? 'Add first entry' : undefined}
          onAction={canEdit ? openNewEntry : undefined}
          emoji="💚"
        />
      ) : (
        entries.map((h) => (
          <Card key={h.id} style={styles.entry}>
            <View style={styles.row}>
              <Text style={[styles.kind, { color: colors.primary }]}>{HEALTH_LABEL[h.kind]}</Text>
              <Text style={[styles.date, { color: colors.muted }]}>{formatDate(h.occurred_on)}</Text>
            </View>
            <Text style={[styles.hTitle, { color: colors.ink }]}>{h.title}</Text>
            {!!h.note && <Text style={[styles.note, { color: colors.muted }]}>{h.note}</Text>}
            <View style={styles.meta}>
              {h.weight_kg ? <Text style={[styles.m, { color: colors.faint }]}>{h.weight_kg} kg · </Text> : null}
              {h.next_due_on ? <Text style={[styles.m, { color: colors.faint }]}>Next: {formatDate(h.next_due_on)} · </Text> : null}
              {h.dosage ? <Text style={[styles.m, { color: colors.faint }]}>{h.dosage} · </Text> : null}
              {h.cost != null ? <Text style={[styles.m, { color: colors.faint }]}>${h.cost}</Text> : null}
            </View>
            {canEdit && (
              <TouchableOpacity onPress={() => Alert.alert('Delete entry?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteHealth(h.id).catch((e) => Alert.alert('Delete failed', e?.message)) },
              ])}>
                <Text style={[styles.del, { color: colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </Card>
        ))
      )}

      <View style={{ height: 12 }} />
      <Button title="Share Health Summary PDF" variant="soft" onPress={exportPdf} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  disclaimer: { fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  up: { marginTop: 12 },
  upTitle: { fontSize: 15, fontWeight: '800' },
  upItem: { fontSize: 14, marginTop: 4 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  entry: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  kind: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  date: { fontSize: 13 },
  hTitle: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  note: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  m: { fontSize: 13 },
  del: { fontSize: 14, fontWeight: '700', marginTop: 8 },
});
