import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useData } from '../../src/context/DataContext';
import { useOnboarded } from '../_layout';

export default function AccountScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, signOut, deleteAccount, cloud } = useAuth();
  const { pets, journal, health } = useData();
  const { resetOnboarding } = useOnboarded();

  const logout = () => {
    Alert.alert('Log out?', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', onPress: () => signOut().then(() => router.replace('/(auth)/login' as any)).catch(() => {}) },
    ]);
  };

  const wipe = () => {
    Alert.alert(
      cloud ? 'Delete account & data?' : 'Delete local data?',
      cloud
        ? 'This permanently deletes your account, pets, journal, health log, care data and uploaded files. This cannot be undone.'
        : 'This permanently removes your offline pets, journal, health log and care data from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything', style: 'destructive',
          onPress: () =>
            deleteAccount()
              .then(() => router.replace('/(auth)/login' as any))
              .catch((e) => Alert.alert('Delete failed', e?.message ?? 'Try again.')),
        },
      ],
    );
  };

  const replayOnboarding = async () => {
    await resetOnboarding();
    router.replace('/onboarding');
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>Account & data 👤</Text>
      <View style={{ height: 12 }} />
      <Card>
        <Text style={[styles.label, { color: colors.muted }]}>Signed in as</Text>
          <Text style={[styles.value, { color: colors.ink }]}>{user?.email || 'Offline demo'}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {pets.length} pets · {journal.length} journal entries · {health.length} health entries · {cloud ? 'cloud sync on' : 'offline mode'}
        </Text>
      </Card>
      <View style={{ height: 12 }} />
      <Card>
        <Text style={[styles.value, { color: colors.ink }]}>Privacy promise</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          No ads. No selling data. No public feed, followers, comments or messaging. Your pet data is private by default — Care Card links only expose what you select.
        </Text>
      </Card>
      <View style={{ height: 12 }} />
      <Button title="Replay onboarding" variant="soft" onPress={replayOnboarding} />
      <View style={{ height: 8 }} />
      {cloud && (
        <>
          <Button title="Log out" variant="ghost" onPress={logout} />
          <View style={{ height: 8 }} />
        </>
      )}
      <Button title={cloud ? 'Delete account & data' : 'Delete local data'} variant="danger" onPress={wipe} />
      <View style={{ height: 8 }} />
      <Button title="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600' },
  value: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  meta: { fontSize: 14, marginTop: 6, lineHeight: 20 },
});
