import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { isSupabaseConfigured } from '../../src/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <View
      style={{
        width: size + 10,
        height: size + 10,
        borderRadius: (size + 10) / 2,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size, fontWeight: '900', color: '#4285F4' }}>G</Text>
    </View>
  );
}

export default function Login() {
  const { colors } = useTheme();
  const { signInWithGoogle, continueOffline } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<'google' | 'offline' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const google = async () => {
    setErr(null);
    setBusy('google');
    try {
      const result = await signInWithGoogle();
      if (result === 'ok') router.replace('/(tabs)' as any);
      // 'cancelled' → stay quietly on this screen
    } catch (e: any) {
      setErr(e?.message ?? 'Google sign-in failed.');
    } finally {
      setBusy(null);
    }
  };

  const offline = async () => {
    setErr(null);
    setBusy('offline');
    try {
      await continueOffline();
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not start the demo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Text style={styles.paw}>🐾</Text>
      <Text style={[styles.title, { color: colors.ink }]}>PetPortfolio</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        Your pet’s private journal, health log and memory books.
      </Text>
      <View style={{ height: 26 }} />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        onPress={google}
        disabled={busy !== null}
        style={[styles.google, { backgroundColor: colors.surface, borderColor: colors.line, opacity: busy ? 0.6 : 1 }]}
      >
        <GoogleG />
        <Text style={[styles.googleLabel, { color: colors.ink }]}>
          {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
        </Text>
      </TouchableOpacity>

      {!!err && <Text style={[styles.err, { color: colors.danger }]}>{err}</Text>}

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.line }]} />
        <Text style={[styles.or, { color: colors.faint }]}>or</Text>
        <View style={[styles.line, { backgroundColor: colors.line }]} />
      </View>

      <Button title={busy === 'offline' ? 'Starting…' : 'Explore offline demo'} variant="soft" onPress={offline} />
      {!isSupabaseConfigured && (
        <Text style={[styles.hint, { color: colors.muted }]}>
          Offline demo stores everything on this device only. Connect Supabase to sync with Google sign-in.
        </Text>
      )}
      <Text style={[styles.foot, { color: colors.faint }]}>
        Private by default · No ads · No passwords to remember
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paw: { fontSize: 56, marginTop: 40 },
  title: { fontSize: 32, fontWeight: '800', marginTop: 10 },
  sub: { fontSize: 16, marginTop: 6, lineHeight: 22 },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    minHeight: 56,
    marginTop: 8,
  },
  googleLabel: { fontSize: 17, fontWeight: '700' },
  err: { fontSize: 14, marginTop: 12, lineHeight: 20 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  line: { flex: 1, height: 1 },
  or: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 10, lineHeight: 18, textAlign: 'center' },
  foot: { fontSize: 12, marginTop: 22, textAlign: 'center' },
});
