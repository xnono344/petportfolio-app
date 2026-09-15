import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { useAuth } from '../../src/context/AuthContext';
import type { HealthKind } from '../../src/types';
import { HEALTH_LABEL } from '../../src/types';
import { pickImage, uploadPetImage } from '../../src/lib/images';
import { scheduleMedicationReminder } from '../../src/lib/notifications';
import { isValidDateOnly, todayKey } from '../../src/utils/dates';
import { useSubscription } from '../../src/context/SubscriptionContext';

const KINDS: HealthKind[] = ['vet_visit', 'vaccination', 'medication', 'emergency'];

export default function NewHealth() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const { activePet, pets, setActivePetId, createHealth, myRoleByPet } = useData();
  const { user } = useAuth();
  const subscription = useSubscription();

  const [petId, setPetId] = useState(activePet?.id ?? pets[0]?.id ?? '');
  const initialKind: HealthKind =
    params.kind && KINDS.includes(params.kind as HealthKind) ? (params.kind as HealthKind) : 'vet_visit';
  const [kind, setKind] = useState<HealthKind>(initialKind);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [dosage, setDosage] = useState('');
  const [schedule, setSchedule] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [remind, setRemind] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pet = pets.find((p) => p.id === petId);

  const save = async () => {
    setErr(null);
    if (!petId) return setErr('Pick a pet first.');
    if ((myRoleByPet[petId] ?? 'owner') !== 'owner') return setErr('Only an owner can add health entries.');
    if (!subscription.canUse('health_log')) return setErr('A Basic or higher plan is required for health entries.');
    if (!title.trim()) return setErr('Give this entry a title (e.g. “Annual checkup”, “Rabies”, “Apoquel”).');
    if (!isValidDateOnly(date.trim())) return setErr('Enter the date as YYYY-MM-DD.');
    if (kind === 'vaccination' && nextDue.trim() && !isValidDateOnly(nextDue.trim())) {
      return setErr('Enter the next due date as YYYY-MM-DD.');
    }
    if (kind === 'medication' && endsOn.trim() && !isValidDateOnly(endsOn.trim())) {
      return setErr('Enter the medication end date as YYYY-MM-DD.');
    }
    setBusy(true);
    try {
      let photoUrl: string | null = photo;
      if (photo && user) photoUrl = await uploadPetImage(user.id, 'docs', photo);
      const w = parseFloat(weight);
      const c = parseFloat(cost);
      let notificationId: string | null = null;
      if (kind === 'medication' && remind && pet) {
        notificationId = await scheduleMedicationReminder({
          petName: pet.name,
          medName: title.trim(),
          schedule: schedule.trim(),
        });
      }
      await createHealth({
        pet_id: petId,
        kind,
        title: title.trim(),
        occurred_on: date.trim() || todayKey(),
        weight_kg: Number.isFinite(w) && w > 0 ? w : null,
        note: note.trim(),
        cost: kind === 'vet_visit' && Number.isFinite(c) ? c : null,
        next_due_on: kind === 'vaccination' && nextDue.trim() ? nextDue.trim() : null,
        dosage: kind === 'medication' ? dosage.trim() || null : null,
        schedule: kind === 'medication' ? schedule.trim() || null : null,
        ends_on: kind === 'medication' && endsOn.trim() ? endsOn.trim() : null,
        remind: kind === 'medication' ? remind : false,
        notification_id: notificationId,
        photo_url: kind === 'emergency' ? photoUrl : null,
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
      <Text style={[styles.title, { color: colors.ink }]}>New health entry</Text>
      <Text style={[styles.warn, { color: colors.muted }]}>For personal use only. Not veterinary advice.</Text>
      <View style={{ height: 12 }} />

      <Text style={[styles.label, { color: colors.muted }]}>Pet</Text>
      <View style={styles.wrap}>
        {pets.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => { setPetId(p.id); setActivePetId(p.id); }}
            style={[styles.pill, { backgroundColor: petId === p.id ? colors.ink : colors.surface, borderColor: colors.line }]}>
            <Text style={{ color: petId === p.id ? colors.bg : colors.ink, fontWeight: '700' }}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.muted }]}>Type</Text>
      <View style={styles.wrap}>
        {KINDS.map((k) => (
          <TouchableOpacity key={k} onPress={() => setKind(k)}
            style={[styles.pill, { backgroundColor: kind === k ? colors.primary : colors.surface, borderColor: colors.line }]}>
            <Text style={{ color: kind === k ? '#fff' : colors.ink, fontWeight: '700' }}>{HEALTH_LABEL[k]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextField label={kind === 'vaccination' ? 'Vaccine name *' : kind === 'medication' ? 'Medication name *' : kind === 'emergency' ? 'What happened *' : 'Reason / visit type *'}
        value={title} onChangeText={setTitle} placeholder={kind === 'medication' ? 'Apoquel' : kind === 'vaccination' ? 'Rabies' : 'Annual checkup'} />
      <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-09-07" />
      <TextField label="Note" value={note} onChangeText={setNote} multiline placeholder="Anything worth remembering…" />

      {(kind === 'vet_visit' || kind === 'emergency') && (
        <>
          <TextField label="Weight (kg) — optional" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="24.5" />
          {kind === 'vet_visit' && <TextField label="Cost — optional" value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="85" />}
          {kind === 'emergency' && (
            <>
              <TouchableOpacity onPress={async () => { try { const img = await pickImage(false); if (img) setPhoto(img.uri); } catch (e: any) { Alert.alert('Photo unavailable', e?.message); } }}
                style={[styles.doc, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                {photo ? <Image source={{ uri: photo }} style={styles.docImg} /> : <Text style={{ color: colors.muted, fontWeight: '600' }}>🧾  Attach bill / document (optional)</Text>}
              </TouchableOpacity>
              <View style={{ height: 12 }} />
            </>
          )}
        </>
      )}
      {kind === 'vaccination' && <TextField label="Next due (YYYY-MM-DD) — optional" value={nextDue} onChangeText={setNextDue} placeholder="2027-09-07" />}
      {kind === 'medication' && (
        <>
          <TextField label="Dosage" value={dosage} onChangeText={setDosage} placeholder="16mg" />
          <TextField label="Schedule" value={schedule} onChangeText={setSchedule} placeholder="Every morning with food" />
          <TextField label="End date (YYYY-MM-DD) — optional" value={endsOn} onChangeText={setEndsOn} placeholder="" />
          <View style={styles.remind}>
            <Text style={[styles.remindLabel, { color: colors.ink }]}>Daily reminder at 9:00</Text>
            <Switch value={remind} onValueChange={setRemind} />
          </View>
        </>
      )}

      {!!err && <Text style={[styles.err, { color: colors.danger }]}>{err}</Text>}
      <Button title="Save entry" onPress={save} loading={busy} />
      <View style={{ height: 8 }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  warn: { fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  doc: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, height: 120, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  docImg: { width: '100%', height: '100%' },
  remind: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  remindLabel: { fontSize: 15, fontWeight: '600' },
  err: { fontSize: 14, marginVertical: 6 },
});
