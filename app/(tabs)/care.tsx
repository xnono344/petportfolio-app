import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PetSwitcher, SectionHeader } from '../../src/components/PetSwitcher';
import { EmptyState, Loading } from '../../src/components/States';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme';
import { useData } from '../../src/context/DataContext';
import { useAuth } from '../../src/context/AuthContext';
import { useSubscription } from '../../src/context/SubscriptionContext';
import { CARE_ACTION_LABEL, type CareActionKind } from '../../src/types';
import { formatTime, formatDate, todayKey } from '../../src/utils/dates';
import { careCardUrl } from '../../src/lib/careCards';

const CHECKS: CareActionKind[] = ['fed', 'walked', 'meds'];

export default function CareTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { ready, pets, activePetId, activePet, setActivePetId, careActions, logCareAction, careCards, revokeCareCard, myRoleByPet } = useData();
  const sub = useSubscription();
  const [busy, setBusy] = useState<CareActionKind | null>(null);

  const role = activePetId ? (myRoleByPet[activePetId] ?? 'owner') : 'owner';
  const canEdit = role === 'owner' || role === 'carer';
  const canManageCards = role === 'owner';
  const openNewCard = () => {
    if (!canManageCards) {
      Alert.alert('Owner access required', 'Only an owner can create or revoke Care Cards.');
      return;
    }
    if (!sub.canUse('care_cards')) {
      router.push('/settings/subscription' as any);
      return;
    }
    router.push('/care/card' as any);
  };

  const today = useMemo(() => {
    const key = todayKey();
    const list = careActions.filter(
      (a) => (!activePetId || a.pet_id === activePetId) && todayKey(new Date(a.done_at)) === key,
    );
    const by: Record<CareActionKind, typeof list> = { fed: [], walked: [], meds: [] };
    list.forEach((a) => by[a.kind].push(a));
    return by;
  }, [careActions, activePetId]);

  const petCards = useMemo(
    () => careCards.filter((c) => !activePetId || c.pet_id === activePetId).filter((c) => !c.revoked),
    [careCards, activePetId],
  );

  if (!ready) return <Loading message="Loading care…" />;
  if (!pets.length || !activePet) {
    return (
      <Screen>
        <EmptyState title="No pets yet" message="Add a pet to set up care tools." actionLabel="Add a pet" onAction={() => router.push('/pet/new' as any)} />
      </Screen>
    );
  }

  const log = async (kind: CareActionKind) => {
    if (!canEdit) {
      Alert.alert('Read-only access', 'Your role allows viewing only. Ask the owner for carer access to log care.');
      return;
    }
    if (!activePetId) return;
    setBusy(kind);
    try {
      await logCareAction(activePetId, kind, user?.id ?? 'you', user?.email?.split('@')[0] || 'You');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (token: string) => {
    await Clipboard.setStringAsync(careCardUrl(token));
    Alert.alert('Copied', 'Care card link copied to clipboard.');
  };

  const shareLink = async (token: string, label: string) => {
    try {
      await Share.share({ message: `${label}: ${careCardUrl(token)}` });
    } catch {
      // user cancelled
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.ink }]}>Care 🤝</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Today’s checklist {activePet ? `for ${activePet.name}` : ''}</Text>
      <View style={{ height: 10 }} />
      <PetSwitcher pets={pets} activeId={activePetId} onSelect={setActivePetId} onAdd={() => router.push('/pet/new' as any)} />

      <SectionHeader title="Today" />
      {CHECKS.map((k) => {
        const done = today[k];
        const isDone = done.length > 0;
        return (
          <Card key={k} style={[styles.check, isDone && { backgroundColor: colors.sageSoft, borderColor: colors.sageSoft }]}>
            <View style={styles.row}>
              <Text style={{ fontSize: 26 }}>{k === 'fed' ? '🍽️' : k === 'walked' ? '🦮' : '💊'}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.checkTitle, { color: colors.ink }]}>{CARE_ACTION_LABEL[k]}</Text>
                <Text style={[styles.checkSub, { color: colors.muted }]}>
                  {isDone ? `${done[0].done_by_label} · ${formatTime(done[0].done_at)}` : 'Not yet today'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => log(k)}
                disabled={busy === k}
                style={[styles.doneBtn, { backgroundColor: isDone ? colors.sage : colors.primary }]}
              >
                <Text style={styles.doneLabel}>{busy === k ? '…' : isDone ? '✓' : 'Done'}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}

      <SectionHeader
        title="Care Cards"
        action={canManageCards ? '＋ New' : undefined}
        onAction={openNewCard}
      />
      <Text style={[styles.hint, { color: colors.muted }]}>
        Secure links for sitters — no account needed, revocable, optionally expiring.
      </Text>
      {petCards.length === 0 ? (
        <EmptyState title="No care cards yet" message="Generate a link with feeding, meds and vet info for your sitter." actionLabel={canManageCards ? 'Generate Care Card' : undefined} onAction={canManageCards ? openNewCard : undefined} emoji="💌" />
      ) : (
        petCards.map((c) => (
          <Card key={c.id} style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>{c.label}</Text>
              <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>
                {careCardUrl(c.token)}
              </Text>
              {!!c.expires_at && (
                <Text style={[styles.cardSub, { color: colors.faint }]}>Expires {formatDate(c.expires_at)}</Text>
              )}
            </View>
            <View style={styles.cardBtns}>
              <TouchableOpacity onPress={() => copyLink(c.token)}>
                <Text style={[styles.link, { color: colors.primary }]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shareLink(c.token, c.label)}>
                <Text style={[styles.link, { color: colors.primary }]}>Share</Text>
              </TouchableOpacity>
              {canManageCards && (
                <TouchableOpacity onPress={() => revokeCareCard(c.id).catch(() => {})}>
                  <Text style={[styles.link, { color: colors.danger }]}>Revoke</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        ))
      )}

      <View style={{ height: 14 }} />
      {canManageCards && <Button title="Invite family / manage roles" variant="soft" onPress={() => router.push('/settings/family' as any)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 15, marginTop: 4 },
  check: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  checkTitle: { fontSize: 17, fontWeight: '800' },
  checkSub: { fontSize: 13, marginTop: 2 },
  doneBtn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  doneLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { fontSize: 13, marginBottom: 10 },
  cardRow: { marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSub: { fontSize: 13, marginTop: 2 },
  cardBtns: { flexDirection: 'row', gap: 14, marginTop: 10 },
  link: { fontSize: 15, fontWeight: '800' },
});
