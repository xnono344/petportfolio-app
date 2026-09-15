import { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PetSwitcher, SectionHeader } from '../../src/components/PetSwitcher';
import { JournalCard } from '../../src/components/JournalCard';
import { EmptyState, ErrorState, Loading } from '../../src/components/States';
import { Card } from '../../src/components/Card';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { monthDay, yearsAgoLabel } from '../../src/utils/dates';
import { speciesInfo } from '../../src/types';

export default function JournalTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const { ready, error, pets, activePetId, activePet, setActivePetId, journal, toggleFavorite, reload, myRoleByPet } = useData();
  const sub = useSubscription();
  const canEdit = !activePetId || (myRoleByPet[activePetId] ?? 'owner') !== 'viewer';
  const openNewEntry = () => {
    if (!canEdit) {
      Alert.alert('Read-only access', 'Ask the owner for carer access to add journal entries.');
      return;
    }
    router.push('/journal/new' as any);
  };

  const entries = useMemo(
    () => journal.filter((j) => !activePetId || j.pet_id === activePetId),
    [journal, activePetId],
  );

  const onThisDay = useMemo(() => {
    const now = new Date();
    const key = `${now.getMonth()}-${now.getDate()}`;
    return journal
      .filter((j) => (!activePetId || j.pet_id === activePetId) && monthDay(j.taken_at) === key && new Date(j.taken_at).getFullYear() < now.getFullYear())
      .map((entry) => ({ entry, yearsAgo: now.getFullYear() - new Date(entry.taken_at).getFullYear() }))
      .slice(0, 3);
  }, [journal, activePetId]);

  if (!ready) return <Loading message="Loading your journal…" />;
  if (error) return <Screen><ErrorState message={error} onRetry={reload} /></Screen>;

  if (!pets.length) {
    return (
      <Screen>
        <Text style={[styles.hello, { color: colors.ink }]}>Your pet’s story starts here ✨</Text>
        <EmptyState
          title="Add your first pet"
          message="Create a profile for your pet, then save your first photo memory."
          actionLabel="Add Your First Pet"
          onAction={() => router.push('/pet/new' as any)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.head}>
        <View>
          <Text style={[styles.hello, { color: colors.ink }]}>
            {greeting()}, {activePet ? activePet.name : 'friend'} {activePet ? speciesInfo(activePet.species).emoji : '🐾'}
          </Text>
          {sub.trialActive && (
            <Text style={[styles.trial, { color: colors.gold }]}>
              Premium trial · {sub.trialDaysLeft} days left
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={openNewEntry}
          style={[styles.fab, { backgroundColor: colors.primary }]}
          accessibilityLabel="New journal entry"
        >
          <Text style={styles.fabLabel}>＋</Text>
        </TouchableOpacity>
      </View>

      <PetSwitcher pets={pets} activeId={activePetId} onSelect={setActivePetId} onAdd={() => {
        if (!sub.canAddPet(pets.length)) {
          router.push('/settings/subscription' as any);
          return;
        }
        router.push('/pet/new' as any);
      }} />

      {onThisDay.length > 0 && (
        <>
          <SectionHeader title="On This Day" />
          {onThisDay.map(({ entry, yearsAgo }) => (
            <Card key={entry.id} style={[styles.otd, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
              <Text style={[styles.otdLabel, { color: colors.primaryDeep }]}>{yearsAgoLabel(yearsAgo)} — {entry.note || 'a sweet memory'}</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/journal/[id]', params: { id: entry.id } } as any)}>
                <Text style={[styles.otdLink, { color: colors.primaryDeep }]}>Relive it →</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </>
      )}

      <SectionHeader title="Timeline" action={canEdit ? '＋ New' : undefined} onAction={openNewEntry} />
      {entries.length === 0 ? (
        <EmptyState
          title="No memories yet"
          message="Take a photo, add a tiny note, and save your first moment together."
          actionLabel={canEdit ? 'Write today’s entry' : undefined}
          onAction={canEdit ? openNewEntry : undefined}
          emoji="📸"
        />
      ) : (
        entries.map((e) => (
          <JournalCard
            key={e.id}
            entry={e}
            petName={pets.find((p) => p.id === e.pet_id)?.name ?? ''}
            onPress={() => router.push({ pathname: '/journal/[id]', params: { id: e.id } } as any)}
            onToggleFavorite={canEdit ? () => toggleFavorite(e.id).catch(() => {}) : undefined}
          />
        ))
      )}
    </Screen>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  hello: { fontSize: 24, fontWeight: '800', lineHeight: 30 },
  trial: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fab: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  fabLabel: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: -2 },
  otd: { marginBottom: 10 },
  otdLabel: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  otdLink: { fontSize: 14, fontWeight: '800', marginTop: 6 },
});
