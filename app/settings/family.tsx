import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import type { PetRole } from '../../src/types';
import { isValidEmail } from '../../src/lib/validation';

const ROLES: { id: PetRole; desc: string }[] = [
  { id: 'viewer', desc: 'Read-only journal + health' },
  { id: 'carer', desc: 'View + journal + care checklist' },
  { id: 'owner', desc: 'Full access' },
];

export default function FamilyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { pets, activePet, setActivePetId, members, invitations, inviteMember, removeMember, myRoleByPet } = useData();
  const sub = useSubscription();
  const [petId, setPetId] = useState(activePet?.id ?? pets[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PetRole>('carer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const petMembers = members.filter((m) => m.pet_id === (petId || activePet?.id));
  const petInvites = invitations.filter((i) => i.pet_id === (petId || activePet?.id));
  const canManage = (myRoleByPet[petId || activePet?.id || ''] ?? 'owner') === 'owner';

  const invite = async () => {
    setErr(null);
    if (!petId) return setErr('Pick a pet first.');
    if (!canManage) return setErr('Only an owner can manage family access.');
    if (!isValidEmail(email)) return setErr('Enter a valid email address.');
    if (!sub.canUse('family') && role !== 'viewer') {
      // Viewers are free; carer/owner seats beyond trial need Family plan.
      router.push('/settings/subscription' as any);
      return;
    }
    setBusy(true);
    try {
      await inviteMember(petId, email, role);
      setEmail('');
      Alert.alert('Invited', `${email.trim()} was invited as ${role}. They get access after signing in with that email.`);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not send the invite.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>Family sharing 👨‍👩‍👧</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        Owners get full access · Viewers read only · Carers can journal + check off care.
      </Text>
      <View style={{ height: 12 }} />
      <View style={styles.wrap}>
        {pets.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => { setPetId(p.id); setActivePetId(p.id); }}
            style={[styles.pill, { backgroundColor: (petId || activePet?.id) === p.id ? colors.ink : colors.surface, borderColor: colors.line }]}>
            <Text style={{ color: (petId || activePet?.id) === p.id ? colors.bg : colors.ink, fontWeight: '700' }}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {canManage && <Card>
        <Text style={[styles.h, { color: colors.ink }]}>Invite by email</Text>
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="grandma@example.com" />
        {ROLES.map((r) => (
          <TouchableOpacity key={r.id} onPress={() => setRole(r.id)} style={[styles.role, { borderColor: role === r.id ? colors.primary : colors.line, backgroundColor: role === r.id ? colors.primarySoft : 'transparent' }]}>
            <Text style={[styles.roleName, { color: colors.ink }]}>{r.id}</Text>
            <Text style={[styles.roleDesc, { color: colors.muted }]}>{r.desc}</Text>
          </TouchableOpacity>
        ))}
        {!!err && <Text style={[styles.err, { color: colors.danger }]}>{err}</Text>}
        <View style={{ height: 6 }} />
        <Button title="Send invite" onPress={invite} loading={busy} />
      </Card>}

      <Text style={[styles.h2, { color: colors.ink }]}>Members</Text>
      {petMembers.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted }]}>Only you for now.</Text>
      ) : (
        petMembers.map((m) => (
          <Card key={m.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleName, { color: colors.ink }]}>{m.email}</Text>
              <Text style={[styles.roleDesc, { color: colors.muted }]}>{m.role}{m.user_id ? '' : ' · pending'}</Text>
            </View>
            {canManage && (
              <TouchableOpacity onPress={() => Alert.alert('Remove?', `${m.email} will lose access.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeMember(m.id).catch((e) => Alert.alert('Failed', e?.message)) },
              ])}>
                <Text style={[styles.rm, { color: colors.danger }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </Card>
        ))
      )}
      {petInvites.length > 0 && (
        <>
          <Text style={[styles.h2, { color: colors.ink }]}>Pending invites</Text>
          {petInvites.map((i) => (
            <Text key={i.id} style={[styles.empty, { color: colors.muted }]}>{i.email} · {i.role}</Text>
          ))}
        </>
      )}
      <View style={{ height: 12 }} />
      <Button title="Back" variant="ghost" onPress={() => router.back()} />
      <Text style={[styles.foot, { color: colors.faint }]}>Permissions are enforced in Supabase RLS, not just the UI.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  h: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
  h2: { fontSize: 17, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  role: { borderWidth: 1.5, borderRadius: 14, padding: 12, marginBottom: 8 },
  roleName: { fontSize: 15, fontWeight: '800', textTransform: 'capitalize' },
  roleDesc: { fontSize: 13, marginTop: 2 },
  err: { fontSize: 14, marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rm: { fontSize: 15, fontWeight: '800' },
  empty: { fontSize: 14, marginBottom: 4 },
  foot: { fontSize: 12, textAlign: 'center', marginTop: 14 },
});
