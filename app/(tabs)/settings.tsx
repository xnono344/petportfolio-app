import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { PetSwitcher, SectionHeader } from '../../src/components/PetSwitcher';
import { useTheme, type ThemeMode } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useData } from '../../src/context/DataContext';
import { speciesInfo } from '../../src/types';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { isSupabaseConfigured } from '../../src/lib/supabase';

export default function SettingsTab() {
  const { colors, mode, setMode } = useTheme();
  const { user, signOut, cloud } = useAuth();
  const { pets, activePetId, setActivePetId } = useData();
  const sub = useSubscription();
  const router = useRouter();

  const modes: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>Settings ⚙️</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>{user?.email ?? ''}</Text>
      <View style={{ height: 12 }} />
      {pets.length > 0 && (
        <PetSwitcher pets={pets} activeId={activePetId} onSelect={setActivePetId} onAdd={() => router.push('/pet/new' as any)} />
      )}

      <SectionHeader title="Pets" action="＋ Add" onAction={() => router.push('/pet/new' as any)} />
      {pets.map((p) => {
        const canEditPet = p.owner_id === user?.id;
        return (
        <TouchableOpacity key={p.id} disabled={!canEditPet} onPress={() => router.push({ pathname: '/pet/[id]', params: { id: p.id } } as any)}>
          <Card style={styles.row}>
            <Text style={{ fontSize: 24 }}>{speciesInfo(p.species).emoji}</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.name, { color: colors.ink }]}>{p.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{p.breed || speciesInfo(p.species).label}</Text>
            </View>
            <Text style={[styles.edit, { color: canEditPet ? colors.primary : colors.faint }]}>{canEditPet ? 'Edit' : 'Shared'}</Text>
          </Card>
        </TouchableOpacity>
      )})}

      <SectionHeader title="Plan" />
      <Card>
        <Text style={[styles.plan, { color: colors.ink }]}>
          {sub.trialActive
            ? `Premium trial · ${sub.trialDaysLeft}d left`
            : sub.plan === 'free'
              ? 'Free'
              : sub.plan[0].toUpperCase() + sub.plan.slice(1)}
        </Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {sub.configured ? 'Managed by RevenueCat' : 'Subscriptions not configured — running in free mode'}
        </Text>
        <View style={{ height: 10 }} />
        <Button title="Manage subscription" onPress={() => router.push('/settings/subscription' as any)} />
      </Card>

      <SectionHeader title="Appearance" />
      <View style={styles.modes}>
        {modes.map((m) => (
          <TouchableOpacity
            key={m.id}
            onPress={() => setMode(m.id)}
            style={[styles.mode, { backgroundColor: mode === m.id ? colors.ink : colors.surface, borderColor: colors.line }]}
          >
            <Text style={{ color: mode === m.id ? colors.bg : colors.ink, fontWeight: '700' }}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionHeader title="More" />
      <TouchableOpacity onPress={() => router.push('/settings/family' as any)}>
        <Card style={styles.row}><Text style={[styles.name, { color: colors.ink }]}>👨‍👩‍👧 Family sharing</Text></Card>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/settings/account' as any)}>
        <Card style={styles.row}><Text style={[styles.name, { color: colors.ink }]}>👤 Account & data</Text></Card>
      </TouchableOpacity>

      {!cloud && !isSupabaseConfigured && (
        <Card style={[styles.note, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
          <Text style={[styles.meta, { color: colors.primaryDeep }]}>
            Offline demo mode — add your Supabase URL + anon key in .env to sync across devices.
          </Text>
        </Card>
      )}

      <View style={{ height: 14 }} />
      {cloud && (
        <Button
          title="Log out"
          variant="ghost"
          onPress={() => Alert.alert('Log out?', 'You can log back in anytime.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', onPress: () => signOut().then(() => router.replace('/(auth)/login' as any)).catch(() => {}) },
          ])}
        />
      )}
      <Text style={[styles.foot, { color: colors.faint }]}>PetPortfolio · private by default · no ads</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  edit: { fontSize: 15, fontWeight: '800' },
  plan: { fontSize: 18, fontWeight: '800' },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  note: { marginTop: 12 },
  foot: { textAlign: 'center', fontSize: 12, marginTop: 18 },
});
