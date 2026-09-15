import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { localStore, uid, clearUserCache } from '../lib/localStore';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
}

interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
  cloud: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<'ok' | 'cancelled'>;
  continueOffline: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  cloud: false,
  error: null,
  signInWithGoogle: async () => 'cancelled',
  continueOffline: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
});

const LOCAL_USER_KEY = 'auth.user';

function toAppUser(
  id: string,
  email: string,
  meta?: Record<string, unknown>,
  createdAt?: string | null,
): AppUser {
  const str = (key: string): string | null => {
    const v = meta?.[key];
    return typeof v === 'string' ? v : null;
  };
  return {
    id,
    email,
    name: str('full_name') ?? str('name') ?? null,
    avatarUrl: str('avatar_url') ?? str('picture') ?? null,
    createdAt: createdAt ?? null,
  };
}

function friendlyOAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('provider') && m.includes('not enabled'))
    return 'Google sign-in is not enabled in your Supabase project yet. See README → Supabase setup.';
  if (m.includes('redirect')) return 'Redirect URL is not allowed. Add petportfolio://** to Supabase → Auth → URL Configuration.';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cloud = isSupabaseConfigured;

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        if (cloud) {
          const sb = getSupabase()!;
          const { data, error: sessionError } = await sb.auth.getSession();
          if (sessionError) throw sessionError;
          if (!alive) return;
          const u = data.session?.user;
          setUser(
            u ? toAppUser(u.id, u.email ?? '', u.user_metadata, u.created_at) : null,
          );
          const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
            const su = session?.user;
            setUser(su ? toAppUser(su.id, su.email ?? '', su.user_metadata, su.created_at) : null);
          });
          unsubscribe = () => sub.subscription.unsubscribe();
          setLoading(false);
          return;
        }
        const stored = await localStore.read<AppUser | null>(LOCAL_USER_KEY, null);
        if (alive) {
          setUser(stored);
          setLoading(false);
        }
      } catch (e: unknown) {
        if (alive) {
          const msg =
            e instanceof Error ? e.message : 'Could not restore your session.';
          setError(msg);
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [cloud]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      cloud,
      error,
      signInWithGoogle: async () => {
        setError(null);
        const sb = getSupabase();
        if (!sb) {
          const msg = 'Google sign-in needs a connected Supabase project. Continue with the offline demo instead.';
          setError(msg);
          throw new Error(msg);
        }
        const redirectTo = makeRedirectUri({ scheme: 'petportfolio' });
        const { data, error: err } = await sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (err || !data?.url) {
          const msg = friendlyOAuthError(err?.message ?? 'Could not start Google sign-in.');
          setError(msg);
          throw new Error(msg);
        }
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type !== 'success') return 'cancelled';
        const { params, errorCode } = QueryParams.getQueryParams(res.url);
        if (errorCode) {
          const msg = friendlyOAuthError(String(errorCode));
          setError(msg);
          throw new Error(msg);
        }
        try {
          if (params.code) {
            const { error: exErr } = await sb.auth.exchangeCodeForSession(String(params.code));
            if (exErr) throw exErr;
          } else if (params.access_token) {
            const { error: sErr } = await sb.auth.setSession({
              access_token: String(params.access_token),
              refresh_token: String(params.refresh_token ?? ''),
            });
            if (sErr) throw sErr;
          } else {
            throw new Error('Google did not return a session. Try again.');
          }
        } catch (e: unknown) {
          const msg = friendlyOAuthError(
            e instanceof Error ? e.message : 'Google sign-in failed.',
          );
          setError(msg);
          throw new Error(msg);
        }
        return 'ok';
      },
      continueOffline: async () => {
        setError(null);
        const next: AppUser = {
          id: uid('user'),
          email: '',
          name: 'Pet lover',
          avatarUrl: null,
          createdAt: null,
        };
        // Stored via localStore, which now persists through SecureStore so the
        // offline identity never lands in AsyncStorage.
        await localStore.write(LOCAL_USER_KEY, next);
        setUser(next);
      },
      signOut: async () => {
        setError(null);
        if (cloud) {
          await getSupabase()!.auth.signOut();
        } else {
          await localStore.remove(LOCAL_USER_KEY);
        }
        setUser(null);
      },
      deleteAccount: async () => {
        setError(null);
        if (!user) return;
        if (cloud) {
          const sb = getSupabase()!;
          const { error: deleteError } = await sb.functions.invoke('delete-account');
          if (deleteError) throw new Error(deleteError.message);
          await sb.auth.signOut({ scope: 'local' });
          await clearUserCache(user.id);
          setUser(null);
          return;
        }
        await clearUserCache(user.id);
        setUser(null);
      },
    }),
    [user, loading, error, cloud],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
