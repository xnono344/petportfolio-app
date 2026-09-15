import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '../src/theme';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { DataProvider, useData } from '../src/context/DataContext';
import { SubscriptionProvider } from '../src/context/SubscriptionContext';
import { View, ActivityIndicator } from 'react-native';

const ONBOARDED_KEY = 'pp.onboarded.v1';

const OnboardedCtx = createContext<{
  onboarded: boolean | null;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}>({
  onboarded: null,
  completeOnboarding: async () => {},
  resetOnboarding: async () => {},
});

export function useOnboarded() {
  return useContext(OnboardedCtx);
}

function Guards({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { ready } = useData();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();
  const { resolved } = useTheme();

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(ONBOARDED_KEY).then((v) => {
      if (alive) setOnboarded(v === '1');
    });
    return () => {
      alive = false;
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {});
    setOnboarded(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await AsyncStorage.removeItem(ONBOARDED_KEY).catch(() => {});
    setOnboarded(false);
  }, []);

  useEffect(() => {
    if (loading || !ready || onboarded === null) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && !onboarded && !inOnboarding) {
      router.replace('/onboarding');
    } else if (user && onboarded && inAuth) {
      router.replace('/(tabs)');
    }
  }, [user, loading, ready, onboarded, segments, router]);

  const providerValue = useMemo(
    () => ({ onboarded, completeOnboarding, resetOnboarding }),
    [onboarded, completeOnboarding, resetOnboarding],
  );

  if (loading || !ready || onboarded === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <OnboardedCtx.Provider value={providerValue}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      {children}
    </OnboardedCtx.Provider>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { pets } = useData();
  return (
    <SubscriptionProvider
      userId={user?.id ?? null}
      userEmail={user?.email ?? null}
      accountCreatedAt={user?.createdAt ?? null}
      petCount={pets.length}
    >
      {children}
    </SubscriptionProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProviderBridge>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="pet/new" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="pet/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="journal/new" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="journal/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="health/new" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="memories/book" />
            <Stack.Screen name="care/card" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="settings/subscription" />
            <Stack.Screen name="settings/family" />
            <Stack.Screen name="settings/account" />
          </Stack>
        </DataProviderBridge>
      </AuthProvider>
    </ThemeProvider>
  );
}

function DataProviderBridge({ children }: { children: React.ReactNode }) {
  return (
    <InnerBridge>{children}</InnerBridge>
  );
}

function InnerBridge({ children }: { children: React.ReactNode }) {
  // DataProvider needs user; read via a nested consumer to avoid hook order issues.
  return (
    <DataOuter>
      {(userId: string | null, email: string | null) => (
        <DataProvider userId={userId} userEmail={email}>
          <Providers>
            <Guards>{children}</Guards>
          </Providers>
        </DataProvider>
      )}
    </DataOuter>
  );
}

function DataOuter({ children }: { children: (userId: string | null, email: string | null) => React.ReactNode }) {
  const { user } = useAuth();
  return <>{children(user?.id ?? null, user?.email ?? null)}</>;
}
