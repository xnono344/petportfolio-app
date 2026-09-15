import { useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PetSwitcher, SectionHeader } from '../../src/components/PetSwitcher';
import { EmptyState, Loading } from '../../src/components/States';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { generateMemoryBookPdf, sharePdf, selectMemoryBookPhotos } from '../../src/lib/memoryBook';
import { useStoredImageUri } from '../../src/hooks/useStoredImageUri';
import type { JournalEntry } from '../../src/types';

function MemoryThumbnail({ entry, backgroundColor }: { entry: JournalEntry; backgroundColor: string }) {
  const uri = useStoredImageUri(entry.photo_url);
  return uri ? (
    <Image source={{ uri }} style={[styles.thumb, { backgroundColor }]} />
  ) : (
    <View style={[styles.thumb, { backgroundColor }]} />
  );
}

export default function MemoriesTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const { ready, pets, activePetId, activePet, setActivePetId, journal } = useData();
  const sub = useSubscription();
  const [busy, setBusy] = useState(false);
  const [lastUri, setLastUri] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set<number>();
    journal.filter((j) => !activePetId || j.pet_id === activePetId).forEach((j) => {
      if (j.photo_url) set.add(new Date(j.taken_at).getFullYear());
    });
    return [...set].sort((a, b) => b - a);
  }, [journal, activePetId]);

  const [year, setYear] = useState<number>(() => new Date().getFullYear());

  const activeYears = years.length ? years : [new Date().getFullYear()];
  const effectiveYear = years.includes(year) ? year : activeYears[0];

  const count = useMemo(
    () => selectMemoryBookPhotos(journal.filter((j) => !activePetId || j.pet_id === activePetId), effectiveYear).length,
    [journal, activePetId, effectiveYear],
  );

  const favorites = useMemo(
    () => journal.filter((j) => (!activePetId || j.pet_id === activePetId) && j.favorite && j.photo_url).slice(0, 8),
    [journal, activePetId],
  );

  if (!ready) return <Loading message="Loading memories…" />;
  if (!pets.length || !activePet) {
    return (
      <Screen>
        <EmptyState title="No pets yet" message="Add a pet to start collecting memories." actionLabel="Add a pet" onAction={() => router.push('/pet/new' as any)} />
      </Screen>
    );
  }

  const generate = async () => {
    if (!sub.canUse('memory_books')) {
      router.push('/settings/subscription' as any);
      return;
    }
    setBusy(true);
    try {
      const uri = await generateMemoryBookPdf(activePet, effectiveYear, journal.filter((j) => j.pet_id === activePet.id));
      setLastUri(uri);
      router.push({ pathname: '/memories/book', params: { petId: activePet.id, year: String(effectiveYear), uri } } as any);
    } catch (e: any) {
      Alert.alert('Could not generate book', e?.message ?? 'Try adding more photos first.');
    } finally {
      setBusy(false);
    }
  };

  const shareLast = async () => {
    if (!lastUri) return;
    try {
      await sharePdf(lastUri, `${activePet.name}'s ${effectiveYear} Adventure Book`);
    } catch (e: any) {
      Alert.alert('Sharing failed', e?.message ?? 'Could not share the PDF.');
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>Memory books 📖</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Turn a year of moments into a keepsake.</Text>
      <View style={{ height: 12 }} />
      <PetSwitcher pets={pets} activeId={activePetId} onSelect={setActivePetId} onAdd={() => router.push('/pet/new' as any)} />
      <SectionHeader title="Choose a year" />
      <View style={styles.yearRow}>
        {activeYears.map((y) => (
          <TouchableOpacity
            key={y}
            onPress={() => setYear(y)}
            style={[styles.year, { backgroundColor: y === effectiveYear ? colors.ink : colors.surface, borderColor: colors.line }]}
          >
            <Text style={{ color: y === effectiveYear ? colors.bg : colors.ink, fontWeight: '800' }}>{y}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={{ marginTop: 14 }}>
        <Text style={[styles.bookTitle, { color: colors.ink }]}>{activePet.name}’s {effectiveYear} Adventure Book</Text>
        <Text style={[styles.bookSub, { color: colors.muted }]}>
          {count > 0 ? `${count} photos ready · up to ~60 best moments` : 'Add journal photos from this year to build a book.'}
        </Text>
        <View style={{ height: 12 }} />
        <Button title={`Generate Memory Book`} onPress={generate} loading={busy} disabled={count === 0} />
        {!!lastUri && (
          <>
            <View style={{ height: 8 }} />
            <Button title="Share last PDF" variant="soft" onPress={shareLast} />
          </>
        )}
        {!sub.canUse('memory_books') && (
          <Text style={[styles.lock, { color: colors.gold }]}>Memory books need Basic or higher ✦</Text>
        )}
      </Card>

      {favorites.length > 0 && (
        <>
          <SectionHeader title="Favorites" />
          <View style={styles.grid}>
            {favorites.map((f) => (
              <MemoryThumbnail key={f.id} entry={f} backgroundColor={colors.surface2} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 15, marginTop: 4 },
  yearRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  year: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  bookTitle: { fontSize: 19, fontWeight: '800' },
  bookSub: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  lock: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: '23%', aspectRatio: 1, borderRadius: 14 },
});
