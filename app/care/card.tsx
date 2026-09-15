import { useMemo, useState } from 'react';
import { Alert, Share, StyleSheet, Text, TouchableOpacity, View, Switch } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { CARE_FIELD_OPTIONS, careCardUrl, type CareFieldKey } from '../../src/lib/careCards';
import { speciesInfo } from '../../src/types';
import { formatDateTime } from '../../src/utils/dates';
import { useSubscription } from '../../src/context/SubscriptionContext';

export default function NewCareCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const { activePet, pets, setActivePetId, health, careActions, createCareCard, myRoleByPet } = useData();
  const subscription = useSubscription();

  const [petId, setPetId] = useState(activePet?.id ?? pets[0]?.id ?? '');
  const [label, setLabel] = useState('Weekend with sitter');
  const [selected, setSelected] = useState<Record<CareFieldKey, boolean>>({
    feeding: true, care_notes: true, last_walk: true, medications: true,
    allergies: true, conditions: true, vet_phone: true, emergency_contact: true,
  });
  const [expiryDays, setExpiryDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ token: string; label: string } | null>(null);

  const pet = pets.find((p) => p.id === petId);

  const toggle = (k: CareFieldKey) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  const payload = useMemo(() => {
    if (!pet) return {};
    const meds = health.filter((h) => h.pet_id === pet.id && h.kind === 'medication')
      .map((h) => `${h.title}${h.dosage ? ` (${h.dosage})` : ''}${h.schedule ? ` — ${h.schedule}` : ''}`);
    const lastWalk = careActions
      .filter((a) => a.pet_id === pet.id && a.kind === 'walked')
      .sort((a, b) => (a.done_at < b.done_at ? 1 : -1))[0];
    const all: Record<CareFieldKey, string> = {
      feeding: pet.feeding_notes || '—',
      care_notes: pet.care_notes || '—',
      last_walk: lastWalk ? `${formatDateTime(lastWalk.done_at)} by ${lastWalk.done_by_label}` : 'No walk logged yet',
      medications: meds.length ? meds.join('\n') : 'None',
      allergies: pet.allergies || 'None recorded',
      conditions: pet.conditions || 'None recorded',
      vet_phone: [pet.vet_name, pet.vet_phone].filter(Boolean).join(' · ') || '—',
      emergency_contact: pet.emergency_contact || '—',
    };
    const out: Record<string, string> = { pet_name: pet.name, species: speciesInfo(pet.species).label };
    (Object.keys(selected) as CareFieldKey[]).forEach((k) => {
      if (selected[k]) out[k] = all[k];
    });
    return out;
  }, [pet, health, careActions, selected]);

  const generate = async () => {
    setErr(null);
    if (!pet) return setErr('Pick a pet first.');
    if ((myRoleByPet[pet.id] ?? 'owner') !== 'owner') return setErr('Only an owner can create Care Cards.');
    if (!subscription.canUse('care_cards')) return setErr('A Basic or higher plan is required for Care Cards.');
    setBusy(true);
    try {
      const days = parseInt(expiryDays, 10);
      const expiresAt = Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 86400000).toISOString()
        : null;
      const card = await createCareCard(petId, label.trim() || 'Care card', payload, expiresAt);
      setCreated({ token: card.token, label: card.label });
    } catch (e: any) {
      setErr(e?.message ?? 'Could not generate the link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>Generate Care Card 💌</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        A secure read-only link. The receiver needs no account. Revoke anytime.
      </Text>
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

      <TextField label="Card label" value={label} onChangeText={setLabel} placeholder="Weekend with sitter" />
      <Text style={[styles.label, { color: colors.muted }]}>Include</Text>
      {CARE_FIELD_OPTIONS.map((f) => (
        <View key={f.key} style={[styles.opt, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.optLabel, { color: colors.ink }]}>{f.label}</Text>
          <Switch value={selected[f.key]} onValueChange={() => toggle(f.key)} />
        </View>
      ))}
      <TextField label="Expire after (days) — empty for no expiry" value={expiryDays} onChangeText={setExpiryDays} keyboardType="number-pad" placeholder="7" />

      {!!err && <Text style={[styles.err, { color: colors.danger }]}>{err}</Text>}
      {!created ? (
        <>
          <Button title="Generate secure link" onPress={generate} loading={busy} />
          <View style={{ height: 8 }} />
          <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
        </>
      ) : (
        <>
          <View style={[styles.done, { backgroundColor: colors.sageSoft, borderColor: colors.sageSoft }]}>
            <Text style={[styles.doneTitle, { color: colors.ink }]}>✓ {created.label}</Text>
            <Text style={[styles.url, { color: colors.primaryDeep }]}>{careCardUrl(created.token)}</Text>
          </View>
          <Button title="Copy link" onPress={async () => { await Clipboard.setStringAsync(careCardUrl(created.token)); Alert.alert('Copied'); }} />
          <View style={{ height: 8 }} />
          <Button title="Share link" variant="soft" onPress={() => Share.share({ message: `${created.label}: ${careCardUrl(created.token)}` })} />
          <View style={{ height: 8 }} />
          <Button title="Done" variant="ghost" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  opt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  optLabel: { fontSize: 15, fontWeight: '600' },
  err: { fontSize: 14, marginVertical: 6 },
  done: { borderWidth: 1, borderRadius: 16, padding: 14, marginVertical: 10 },
  doneTitle: { fontSize: 16, fontWeight: '800' },
  url: { fontSize: 14, marginTop: 4 },
});
