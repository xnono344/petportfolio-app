import { useMemo } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { paginateBook, selectMemoryBookPhotos, sharePdf } from '../../src/lib/memoryBook';
import { Loading } from '../../src/components/States';
import { useStoredImageUri } from '../../src/hooks/useStoredImageUri';
import type { JournalEntry } from '../../src/types';

function PreviewPhoto({ entry }: { entry: JournalEntry }) {
  const resolvedUri = useStoredImageUri(entry.photo_url);
  return resolvedUri ? <Image source={{ uri: resolvedUri }} style={styles.thumb} /> : <View style={styles.thumb} />;
}

export default function BookPreview() {
  const { petId, year, uri } = useLocalSearchParams<{ petId: string; year: string; uri: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const { pets, journal } = useData();
  const pet = pets.find((p) => p.id === petId);
  const y = parseInt(year ?? '', 10) || new Date().getFullYear();

  const pages = useMemo(() => {
    if (!pet) return [];
    return paginateBook(selectMemoryBookPhotos(journal.filter((j) => j.pet_id === pet.id), y));
  }, [journal, pet, y]);

  if (!pet) return <Screen><Loading message="Loading book…" /></Screen>;

  const share = async () => {
    if (!uri) return;
    try {
      await sharePdf(uri as string, `${pet.name}'s ${y} Adventure Book`);
    } catch (e: any) {
      Alert.alert('Sharing failed', e?.message ?? 'Could not share the PDF.');
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>{pet.name}’s {y} Adventure Book</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {pages.length} spreads · {pages.reduce((n, p) => n + p.entries.length, 0)} photos · square PDF (~32 pages)
      </Text>
      <View style={{ height: 12 }} />
      <Card>
        <Text style={[styles.ok, { color: colors.sage }]}>✓ PDF ready</Text>
        <Text style={[styles.path, { color: colors.muted }]} numberOfLines={2}>{uri}</Text>
        <View style={{ height: 10 }} />
        <Button title="Preview & share PDF" onPress={share} />
        <View style={{ height: 8 }} />
        <Button title="Back to Memories" variant="ghost" onPress={() => router.back()} />
      </Card>
      {pages.slice(0, 6).map((p, i) => (
        <View key={i} style={styles.spread}>
          {p.entries.map((e) => (
            <PreviewPhoto key={e.id} entry={e} />
          ))}
        </View>
      ))}
      {pages.length > 6 && (
        <Text style={[styles.more, { color: colors.faint }]}>+ {pages.length - 6} more spreads in the PDF</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 4 },
  ok: { fontSize: 17, fontWeight: '800' },
  path: { fontSize: 12, marginTop: 4 },
  spread: { flexDirection: 'row', gap: 8, marginTop: 12 },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: 14, backgroundColor: '#eee' },
  more: { fontSize: 13, marginTop: 10, textAlign: 'center' },
});
