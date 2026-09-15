import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { Loading } from '../../src/components/States';
import { formatDateTime } from '../../src/utils/dates';
import { useStoredImageUri } from '../../src/hooks/useStoredImageUri';

export default function JournalDetail() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { colors } = useTheme();
  const router = useRouter();
  const { journal, pets, updateJournal, deleteJournal, toggleFavorite, myRoleByPet } = useData();
  const entry = journal.find((j) => j.id === id);
  const photoUri = useStoredImageUri(entry?.photo_url);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!entry) return <Screen><Loading message="Loading entry…" /></Screen>;
  const petName = pets.find((p) => p.id === entry.pet_id)?.name ?? 'Pet';
  const canEdit = (myRoleByPet[entry.pet_id] ?? 'owner') !== 'viewer';

  const save = async () => {
    setBusy(true);
    try {
      await updateJournal(entry.id, { note: (note ?? entry.note).slice(0, 280) });
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {!!photoUri && <Image source={{ uri: photoUri }} style={styles.photo} />}
      <Text style={[styles.date, { color: colors.muted }]}>{formatDateTime(entry.taken_at)} · {petName}</Text>
      {(!!entry.location_label || !!entry.weather_label) && (
        <Text style={[styles.meta, { color: colors.faint }]}>
          {[entry.location_label, entry.weather_label].filter(Boolean).join(' · ')}
        </Text>
      )}
      {editing ? (
        <TextField label={`Note (${(note ?? entry.note).length}/280)`} defaultValue={entry.note} onChangeText={(t) => setNote(t.slice(0, 280))} multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: 'top' }} />
      ) : (
        <Text style={[styles.note, { color: colors.ink }]}>{entry.note || '—'}</Text>
      )}
      {canEdit && <View style={styles.row}>
        <TouchableOpacity onPress={() => toggleFavorite(entry.id).catch(() => {})}>
          <Text style={{ fontSize: 26 }}>{entry.favorite ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setNote(entry.note); setEditing(!editing); }}>
          <Text style={[styles.link, { color: colors.primary }]}>{editing ? 'Cancel' : 'Edit'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Delete entry?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteJournal(entry.id).then(() => router.back()).catch((e) => Alert.alert('Delete failed', e?.message)) },
        ])}>
          <Text style={[styles.link, { color: colors.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>}
      {editing && (
        <>
          <View style={{ height: 10 }} />
          <Button title="Save changes" onPress={save} loading={busy} />
        </>
      )}
      <View style={{ height: 10 }} />
      <Button title="Close" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 22 },
  date: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  meta: { fontSize: 13, marginTop: 2 },
  note: { fontSize: 18, lineHeight: 26, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 14 },
  link: { fontSize: 16, fontWeight: '800' },
});
