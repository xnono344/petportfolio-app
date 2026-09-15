import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { useAuth } from '../../src/context/AuthContext';
import { pickImage, takePhoto, uploadPetImage } from '../../src/lib/images';
import { captureEntryContext } from '../../src/lib/locationWeather';
import { clampNote } from '../../src/lib/validation';

export default function NewJournal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { activePet, pets, setActivePetId, createJournal, myRoleByPet } = useData();
  const { user } = useAuth();
  const [petId, setPetId] = useState(activePet?.id ?? pets[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ctxNote, setCtxNote] = useState('Location & weather are added automatically when available.');

  const choose = async (camera: boolean) => {
    try {
      const img = camera ? await takePhoto() : await pickImage(false);
      if (img) setPhoto(img.uri);
    } catch (e: any) {
      Alert.alert('Photo unavailable', e?.message ?? 'You can still save a note without a photo.');
    }
  };

  const save = async () => {
    setErr(null);
    if (!petId) return setErr('Pick a pet first.');
    if ((myRoleByPet[petId] ?? 'owner') === 'viewer') return setErr('Ask the owner for carer access to add journal entries.');
    if (!note.trim() && !photo) return setErr('Add a photo or a note.');
    setBusy(true);
    try {
      const ctx = await captureEntryContext();
      setCtxNote([ctx.locationLabel, ctx.weatherLabel].filter(Boolean).join(' · ') || 'Saved without location/weather.');
      let photoUrl: string | null = photo;
      if (photo && user) photoUrl = await uploadPetImage(user.id, 'journal', photo);
      await createJournal({
        pet_id: petId,
        note: clampNote(note.trim()),
        photo_url: photoUrl,
        taken_at: new Date().toISOString(),
        location_label: ctx.locationLabel,
        weather_label: ctx.weatherLabel,
        favorite: false,
      });
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save this entry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>New memory ✨</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>{ctxNote}</Text>
      <View style={{ height: 12 }} />
      <Text style={[styles.label, { color: colors.muted }]}>Pet</Text>
      <View style={styles.pets}>
        {pets.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => { setPetId(p.id); setActivePetId(p.id); }}
            style={[styles.pill, { backgroundColor: petId === p.id ? colors.ink : colors.surface, borderColor: colors.line }]}
          >
            <Text style={{ color: petId === p.id ? colors.bg : colors.ink, fontWeight: '700' }}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={() => choose(false)} style={[styles.photo, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
        {photo ? <Image source={{ uri: photo }} style={styles.img} /> : <Text style={[styles.hint, { color: colors.muted }]}>📸  Add a photo</Text>}
      </TouchableOpacity>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => choose(false)}><Text style={[styles.link, { color: colors.primary }]}>Choose</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => choose(true)}><Text style={[styles.link, { color: colors.primary }]}>Take photo</Text></TouchableOpacity>
        {!!photo && <TouchableOpacity onPress={() => setPhoto(null)}><Text style={[styles.link, { color: colors.danger }]}>Remove</Text></TouchableOpacity>}
      </View>

      <TextField label={`Note (${note.length}/280)`} value={note} onChangeText={(t) => setNote(t.slice(0, 280))} multiline numberOfLines={4} placeholder="What made today special?" style={{ minHeight: 90, textAlignVertical: 'top' }} />
      {!!err && <Text style={[styles.err, { color: colors.danger }]}>{err}</Text>}
      <Button title="Save to journal" onPress={save} loading={busy} />
      <View style={{ height: 8 }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  pets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  photo: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 22, height: 220, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  hint: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 18, marginVertical: 8 },
  link: { fontSize: 15, fontWeight: '800' },
  err: { fontSize: 14, marginVertical: 6 },
});
