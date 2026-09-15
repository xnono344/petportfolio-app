import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme';
import { useSubscription } from '../../src/context/SubscriptionContext';

const TIERS = [
  { id: 'basic', name: 'Basic', tag: '~$5/mo · ~$48/yr', desc: 'Unlimited pets · memory books · health log · Care Cards' },
  { id: 'premium', name: 'Premium', tag: '~$8/mo · ~$79/yr', desc: 'Everything in Basic · enhanced exports · future photo-book printing' },
  { id: 'family', name: 'Family', tag: '~$12/mo · ~$119/yr', desc: 'Everything in Premium · up to 5 family members' },
] as const;

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const sub = useSubscription();

  const buy = async (pkgId: string, tierName: string) => {
    if (!sub.configured) {
      Alert.alert(
        'Subscriptions unavailable',
        'RevenueCat is not configured in this build (no store API key). The app keeps working in free mode with a 14-day premium trial.',
      );
      return;
    }
    try {
      const ok = await sub.purchase(pkgId);
      Alert.alert(
        ok ? 'Welcome!' : 'Not completed',
        ok ? `You’re on ${tierName} now. Enjoy!` : 'The purchase was cancelled or did not complete.',
      );
    } catch (error) {
      Alert.alert('Purchase failed', error instanceof Error ? error.message : 'Could not complete the purchase.');
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>PetPortfolio Premium ✦</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {sub.trialActive
          ? `Your 14-day trial has ${sub.trialDaysLeft} days left — everything is unlocked.`
          : sub.plan === 'free'
            ? 'Your trial ended. Free includes up to 2 pets, profiles and basic journal.'
            : `You’re on ${sub.plan}. Thank you for supporting us!`}
      </Text>
      <View style={{ height: 12 }} />
      {!sub.configured && (
        <Card style={[styles.note, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
          <Text style={[styles.noteText, { color: colors.primaryDeep }]}>
            Store billing isn’t connected in this build, so live prices can’t load. Real prices always come from RevenueCat / the App Store — never hardcoded.
          </Text>
        </Card>
      )}
      {sub.configured && sub.offerings.length === 0 && (
        <Card><Text style={{ color: colors.muted }}>Loading store products…</Text></Card>
      )}
      {TIERS.map((t) => (
        <Card key={t.id} style={styles.tier}>
          <Text style={[styles.tierName, { color: colors.ink }]}>
            {t.name} {sub.plan === t.id ? '· current' : ''}
          </Text>
          <Text style={[styles.tierTag, { color: colors.primary }]}>{t.tag}</Text>
          <Text style={[styles.tierDesc, { color: colors.muted }]}>{t.desc}</Text>
          <View style={{ height: 10 }} />
        </Card>
      ))}
      {sub.configured && sub.offerings[0]?.packages.length ? (
        <Card style={styles.tier}>
          <Text style={[styles.tierName, { color: colors.ink }]}>Available subscriptions</Text>
          <Text style={[styles.tierDesc, { color: colors.muted }]}>Plans and prices are loaded from the current RevenueCat offering.</Text>
          <View style={{ height: 10 }} />
          {sub.offerings[0].packages.map((p) => (
            <View key={p.identifier} style={{ marginBottom: 8 }}>
              <Button
                title={`${p.title || 'Subscribe'}${p.priceString ? ` · ${p.priceString}` : ''}`}
                onPress={() => buy(p.identifier, p.title || 'your subscription')}
              />
            </View>
          ))}
        </Card>
      ) : null}
      <View style={{ height: 8 }} />
      {sub.configured && <Button title="Restore purchases" variant="ghost" onPress={() => sub.restore().then(() => Alert.alert('Restored', 'Purchases refreshed.')).catch(() => Alert.alert('Restore failed', 'Could not refresh purchases. Try again.'))} />}
      <View style={{ height: 8 }} />
      <Button title="Back" variant="ghost" onPress={() => router.back()} />
      <Text style={[styles.foot, { color: colors.faint }]}>
        Prices are set in the App Store / Play Store and shown from RevenueCat at runtime.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 15, marginTop: 6, lineHeight: 22 },
  note: { marginBottom: 12 },
  noteText: { fontSize: 14, lineHeight: 20 },
  tier: { marginBottom: 12 },
  tierName: { fontSize: 19, fontWeight: '800' },
  tierTag: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  tierDesc: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  foot: { fontSize: 12, textAlign: 'center', marginTop: 14 },
});
