import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { useAuth } from '../../src/context/AuthContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { pickImage, takePhoto, uploadPetImage } from '../../src/lib/images';
import type { Species } from '../../src/types';
import { SPECIES, speciesInfo } from '../../src/types';
import { isValidDateOnly } from '../../src/utils/dates';
import { validatePetName } from '../../src/lib/validation';

export default function NewPet() {
  const { colors } = useTheme();
  const router = useRouter();
  const { createPet, pets } = useData();
  const { user } = useAuth();
  const sub = useSubscription();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('dog');
  const [breed, setBreed] = useState('');
  const [birth, setBirth] = useState('');
  const [weight, setWeight] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('');
  const [emergency, setEmergency] = useState('');
  const [feeding, setFeeding] = useState('');
  const [care, setCare] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const choosePhoto = async (camera: boolean) => {
    try {
      const img = camera ? await takePhoto() : await pickImage();
      if (img) setPhoto(img.uri);
    } catch (e: any) {
      Alert.alert('Photo unavailable', e?.message ?? 'Could not access photos.');
    }
  };

  const save = async () => {
    setErr(null);
    const nameError = validatePetName(name);
    if (nameError) return setErr(nameError);
    if (birth.trim() && !isValidDateOnly(birth.trim())) return setErr('Enter the birth date as YYYY-MM-DD.');
    if (!sub.canAddPet(pets.length)) {
      router.push('/settings/subscription' as any);
      return;
    }
    setBusy(true);
    try {
      let photoUrl: string | null = photo;
      if (photo && user) photoUrl = await uploadPetImage(user.id, 'pets', photo);
      const weightNum = parseFloat(weight);
      await createPet({
        name, species, breed,
        birth_date: birth.trim() || null,
        weight_kg: Number.isFinite(weightNum) && weightNum > 0 ? weightNum : null,
        allergies, conditions, vet_name: vetName, vet_phone: vetPhone,
        emergency_contact: emergency, feeding_notes: feeding, care_notes: care,
        photo_url: photoUrl,
      });
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save your pet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>Add your pet 🐾</Text>
      <Text style={[styles.optional, { color: colors.muted }]}>Photo is optional — you can add one later, anytime.</Text>
      <View style={{ height: 12 }} />
      <TouchableOpacity onPress={() => choosePhoto(false)} style={[styles.photo, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.img} />
        ) : (
          <Text style={[styles.photoHint, { color: colors.muted }]}>{speciesInfo(species).emoji}  Add a photo · optional</Text>
        )}
      </TouchableOpacity>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => choosePhoto(false)}>
          <Text style={[styles.link, { color: colors.primary }]}>Choose photo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => choosePhoto(true)}>
          <Text style={[styles.link, { color: colors.primary }]}>Take photo</Text>
        </TouchableOpacity>
      </View>

      <TextField label="Name *" value={name} onChangeText={setName} placeholder="Scout" />
      <Text style={[styles.label, { color: colors.muted }]}>What kind of pet?</Text>
      <View style={styles.species}>
        {SPECIES.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => setSpecies(s.id)}
            style={[styles.pill, { backgroundColor: species === s.id ? colors.ink : colors.surface, borderColor: colors.line }]}
          >
            <Text style={{ color: species === s.id ? colors.bg : colors.ink, fontWeight: '700' }}>
              {s.emoji} {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextField label="Breed / variety" value={breed} onChangeText={setBreed} placeholder="Golden Retriever, budgie, betta…" />
      <TextField label="Birth date (YYYY-MM-DD)" value={birth} onChangeText={setBirth} placeholder="2021-04-12" />
      <TextField label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="24.5" />

      <Card style={{ marginVertical: 8 }}>
        <Text style={[styles.cardTitle, { color: colors.ink }]}>Health & care</Text>
        <TextField label="Allergies" value={allergies} onChangeText={setAllergies} placeholder="None known" />
        <TextField label="Known conditions" value={conditions} onChangeText={setConditions} placeholder="None" />
        <TextField label="Vet name" value={vetName} onChangeText={setVetName} placeholder="Dr. Rivera" />
        <TextField label="Vet phone" value={vetPhone} onChangeText={setVetPhone} keyboardType="phone-pad" placeholder="+1 …" />
        <TextField label="Emergency contact" value={emergency} onChangeText={setEmergency} placeholder="Name + phone" />
        <TextField label="Feeding / care notes" value={feeding} onChangeText={setFeeding} multiline placeholder="2 cups morning + evening…" />
        <TextField label="Other care notes" value={care} onChangeText={setCare} multiline placeholder="Loves belly rubs, afraid of thunder…" />
      </Card>

      {!!err && <Text style={[styles.err, { color: colors.danger }]}>{err}</Text>}
      <Button title="Save pet" onPress={save} loading={busy} />
      <View style={{ height: 8 }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  optional: { fontSize: 14, marginTop: 4 },
  photo: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 22, height: 190, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  photoHint: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 18, marginVertical: 8 },
  link: { fontSize: 15, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  species: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  err: { fontSize: 14, marginVertical: 6 },
});
