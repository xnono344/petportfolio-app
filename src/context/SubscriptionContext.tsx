import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

export type Plan = 'free' | 'basic' | 'premium' | 'family';

interface Offering {
  identifier: string;
  packages: { identifier: string; priceString: string; title: string }[];
}

interface SubCtx {
  plan: Plan;
  trialActive: boolean;
  trialDaysLeft: number;
  configured: boolean;
  loading: boolean;
  offerings: Offering[];
  customerEmail: string | null;
  purchase: (packageId: string) => Promise<boolean>;
  restore: () => Promise<void>;
  refresh: () => Promise<void>;
  canAddPet: (currentCount?: number) => boolean;
  canUse: (feature: 'memory_books' | 'health_log' | 'care_cards' | 'enhanced_exports' | 'family') => boolean;
}

const Ctx = createContext<SubCtx>({
  plan: 'free',
  trialActive: false,
  trialDaysLeft: 0,
  configured: false,
  loading: false,
  offerings: [],
  customerEmail: null,
  purchase: async () => false,
  restore: async () => {},
  refresh: async () => {},
  canAddPet: () => true,
  canUse: () => true,
});

const TRIAL_DAYS = 14;
const INSTALL_KEY = 'pp.installAt.v1';

function trialFrom(startIso: string | null, hasEntitlement: boolean): { active: boolean; daysLeft: number } {
  if (hasEntitlement) return { active: false, daysLeft: 0 };
  if (!startIso) return { active: true, daysLeft: TRIAL_DAYS };
  const elapsed = (Date.now() - new Date(startIso).getTime()) / 86400000;
  const left = Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
  return { active: left > 0, daysLeft: left };
}

export function SubscriptionProvider({
  children,
  userId,
  userEmail,
  accountCreatedAt,
  petCount,
}: {
  children: React.ReactNode;
  userId: string | null;
  userEmail: string | null;
  accountCreatedAt: string | null;
  petCount: number;
}) {
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [entitlementId, setEntitlementId] = useState<string | null>(null);
  const [installAt, setInstallAt] = useState<string | null>(accountCreatedAt);
  const configuredRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const existing = await AsyncStorage.getItem(INSTALL_KEY);
        if (!alive) return;
        if (existing) {
          setInstallAt((cur) => cur ?? existing);
        } else {
          const now = new Date().toISOString();
          await AsyncStorage.setItem(INSTALL_KEY, now).catch(() => {});
          if (alive) setInstallAt((cur) => cur ?? now);
        }
      } catch {
        // trial falls back to full length
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const trial = useMemo(
    () => trialFrom(accountCreatedAt ?? installAt, !!entitlementId),
    [accountCreatedAt, installAt, entitlementId],
  );

  // Paid entitlement wins; otherwise an active trial counts as premium; else free.
  // Validate the RevenueCat entitlement id against the known Plan values before
  // casting so a deprecated/custom id can't masquerade as a valid Plan.
  const plan: Plan = entitlementId
    ? ['free', 'basic', 'premium', 'family'].includes(entitlementId)
      ? (entitlementId as Plan)
      : 'free'
    : trial.active
      ? 'premium'
      : 'free';

  const refresh = useCallback(async () => {
    const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim();
    const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim();
    const webKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY?.trim();
    const apiKey = Platform.OS === 'ios' ? iosKey : Platform.OS === 'android' ? androidKey : webKey;
    if (mountedRef.current) {
      setEntitlementId(null);
      setOfferings([]);
    }
    if (!userId) return;
    if (!apiKey) {
      if (mountedRef.current) setConfigured(false);
      return;
    }
    if (mountedRef.current) setLoading(true);
    try {
      const Purchases = (await import('react-native-purchases')).default;
      if (!configuredRef.current) {
        Purchases.configure({ apiKey });
        configuredRef.current = true;
        if (mountedRef.current) setConfigured(true);
      }
      if (userId) {
        try {
          await Purchases.logIn(userId);
        } catch {
          // login failure must not break the app
        }
      }
      const customer = await Purchases.getCustomerInfo();
      const active = Object.keys(customer.entitlements.active);
      const pick = active.includes('family')
        ? 'family'
        : active.includes('premium')
          ? 'premium'
          : active.includes('basic')
            ? 'basic'
            : null;
      if (mountedRef.current) setEntitlementId(pick);
      try {
        const off = await Purchases.getOfferings();
        const current = off.current as PurchasesOffering | null;
        const list: Offering[] = current
          ? [{
              identifier: current.identifier,
              packages: (current.availablePackages ?? []).map((p: PurchasesPackage) => ({
                identifier: p.identifier,
                priceString: p.product?.priceString ?? '',
                title: p.product?.title ?? p.identifier,
              })),
            }]
          : [];
        if (mountedRef.current) setOfferings(list);
      } catch {
        if (mountedRef.current) setOfferings([]);
      }
    } catch {
      // RevenueCat unavailable (no network, bad key, unsupported platform) — stay in free/trial mode.
      if (mountedRef.current) setConfigured(false);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // Initial customer-info sync with the RevenueCat SDK (external system).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const value = useMemo<SubCtx>(
    () => ({
      plan,
      trialActive: trial.active && !entitlementId,
      trialDaysLeft: trial.daysLeft,
      configured,
      loading,
      offerings,
      customerEmail: userEmail,
      purchase: async (packageId: string) => {
        if (!configuredRef.current) return false;
        try {
          const Purchases = (await import('react-native-purchases')).default;
          const off = await Purchases.getOfferings();
          const pkg =
            off.current?.availablePackages.find((p: PurchasesPackage) => p.identifier === packageId) ?? null;
          if (!pkg) return false;
          const result = await Purchases.purchasePackage(pkg);
          const active = Object.keys(result.customerInfo.entitlements.active);
          const pick = active.includes('family')
            ? 'family'
            : active.includes('premium')
              ? 'premium'
              : active.includes('basic')
                ? 'basic'
                : null;
          setEntitlementId(pick);
          return !!pick;
        } catch (e: any) {
          if (e?.userCancelled) return false;
          throw e;
        }
      },
      restore: async () => {
        if (!configuredRef.current) return;
        try {
          const Purchases = (await import('react-native-purchases')).default;
          const info = await Purchases.restorePurchases();
          const active = Object.keys(info.entitlements.active);
          const pick = active.includes('family')
            ? 'family'
            : active.includes('premium')
              ? 'premium'
              : active.includes('basic')
                ? 'basic'
                : null;
          setEntitlementId(pick);
        } catch (error) {
          throw error;
        }
      },
      refresh,
      canAddPet: (currentCount?: number) => {
        if (plan !== 'free') return true;
        return (currentCount ?? petCount) < 2;
      },
      canUse: (feature) => {
        if (plan === 'family') return true;
        if (plan === 'premium') return feature !== 'family';
        if (plan === 'basic')
          return feature === 'memory_books' || feature === 'health_log' || feature === 'care_cards';
        // Free (post-trial): profiles + basic journal only.
        return false;
      },
    }),
    [plan, trial, entitlementId, configured, loading, offerings, userEmail, petCount, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSubscription() {
  return useContext(Ctx);
}
