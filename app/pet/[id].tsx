import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { speciesInfo } from '../../src/types';
import { useAuth } from '../../src/context/AuthContext';
import { pickImage, takePhoto, uploadPetImage } from '../../src/lib/images';
import { ErrorState, Loading } from '../../src/components/States';
import { useStoredImageUri } from '../../src/hooks/useStoredImageUri';

export default function EditPetRoute() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  // A `key` tied to `id` forces React to unmount/remount `EditPet` when the
  // route param changes (e.g. /pet/1 -> /pet/2). Expo Router reuses the route
  // instance for param-only navigations, so without this the component would
  // re-render in place and retain stale form state / uncontrolled input values
  // belonging to the previously-edited pet.
  return <EditPet key={id} id={id} />;
}

function EditPet({ id }: { id: string | undefined }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { pets, updatePet, deletePet } = useData();
  const { user } = useAuth();
  const pet = pets.find((p) => p.id === id);
  const storedPhoto = useStoredImageUri(pet?.photo_url);

  const [name, setName] = useState<string | null>(null);
  const [breed, setBreed] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [allergies, setAllergies] = useState<string | null>(null);
  const [conditions, setConditions] = useState<string | null>(null);
  const [vetName, setVetName] = useState<string | null>(null);
  const [vetPhone, setVetPhone] = useState<string | null>(null);
  const [emergency, setEmergency] = useState<string | null>(null);
  const [feeding, setFeeding] = useState<string | null>(null);
  const [care, setCare] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!pet) {
    return <Screen><Loading message="Loading pet…" /></Screen>;
  }

  const v = (draft: string | null, orig: string) => (draft == null ? orig : draft);

  const changePhoto = async (camera: boolean) => {
    try {
      const img = camera ? await takePhoto() : await pickImage();
      if (img) setPhoto(img.uri);
    } catch (e: any) {
      Alert.alert('Photo unavailable', e?.message ?? 'Could not access photos.');
    }
  };

  const save = async () => {
    setErr(null);
    if (!v(name, pet.name).trim()) return setErr('Name cannot be empty.');
    setBusy(true);
    try {
      let photoUrl = photo ?? pet.photo_url;
      if (photo && user) photoUrl = await uploadPetImage(user.id, 'pets', photo);
      const w = parseFloat(weight);
      await updatePet(pet.id, {
        name: v(name, pet.name).trim(),
        breed: v(breed, pet.breed),
        allergies: v(allergies, pet.allergies),
        conditions: v(conditions, pet.conditions),
        vet_name: v(vetName, pet.vet_name),
        vet_phone: v(vetPhone, pet.vet_phone),
        emergency_contact: v(emergency, pet.emergency_contact),
        feeding_notes: v(feeding, pet.feeding_notes),
        care_notes: v(care, pet.care_notes),
        photo_url: photoUrl,
        ...(weight.trim() && Number.isFinite(w) && w > 0 ? { weight_kg: w } : {}),
      });
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert(`Delete ${pet.name}?`, 'Journal, health and care data for this pet will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deletePet(pet.id).then(() => router.replace('/(tabs)' as any)).catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Delete failed')),
      },
    ]);
  };

  return (
    <Screen key={pet.updated_at}>
      <Text style={[styles.title, { color: colors.ink }]}>{pet.name}’s profile</Text>
      <View style={{ height: 12 }} />
      <TouchableOpacity onPress={() => changePhoto(false)} style={[styles.photo, { backgroundColor: colors.surface2 }]}>
        {(photo ?? storedPhoto) ? (
          <Image source={{ uri: (photo ?? storedPhoto)! }} style={styles.img} />
        ) : (
          <Text style={{ fontSize: 56 }}>{speciesInfo(pet.species).emoji}</Text>
        )}
      </TouchableOpacity>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => changePhoto(false)}><Text style={[styles.link, { color: colors.primary }]}>Change photo</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => changePhoto(true)}><Text style={[styles.link, { color: colors.primary }]}>Take photo</Text></TouchableOpacity>
      </View>

      <TextField label="Name" defaultValue={pet.name} onChangeText={setName} />
      <TextField label="Breed" defaultValue={pet.breed} onChangeText={setBreed} />
      <TextField label="Log new weight (kg) — optional" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder={`${pet.weight_kg ?? '—'}`} />
      <TextField label="Allergies" defaultValue={pet.allergies} onChangeText={setAllergies} />
      <TextField label="Known conditions" defaultValue={pet.conditions} onChangeText={setConditions} />
      <TextField label="Vet name" defaultValue={pet.vet_name} onChangeText={setVetName} />
      <TextField label="Vet phone" defaultValue={pet.vet_phone} onChangeText={setVetPhone} keyboardType="phone-pad" />
      <TextField label="Emergency contact" defaultValue={pet.emergency_contact} onChangeText={setEmergency} />
      <TextField label="Feeding notes" defaultValue={pet.feeding_notes} onChangeText={setFeeding} multiline />
      <TextField label="Care notes" defaultValue={pet.care_notes} onChangeText={setCare} multiline />

      {!!err && <ErrorState message={err} />}
      <Button title="Save changes" onPress={save} loading={busy} />
      <View style={{ height: 8 }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      <View style={{ height: 16 }} />
      <TouchableOpacity onPress={remove}>
        <Text style={[styles.del, { color: colors.danger }]}>Delete {pet.name}</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  photo: { borderRadius: 22, height: 190, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', gap: 18, marginVertical: 8 },
  link: { fontSize: 15, fontWeight: '800' },
  del: { fontSize: 15, fontWeight: '800', textAlign: 'center', padding: 12 },
});
