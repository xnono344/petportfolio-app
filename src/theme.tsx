import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export const light = {
  bg: '#FFF8F1',
  surface: '#FFFFFF',
  surface2: '#FFF1E6',
  ink: '#2B2320',
  muted: '#8A7B70',
  faint: '#B9A99D',
  line: '#F0E2D3',
  primary: '#E2683C',
  primaryDeep: '#C4522B',
  primarySoft: '#FDE6D7',
  sage: '#5F8F78',
  sageSoft: '#DDEEE2',
  dog: '#E8930C',
  dogSoft: '#FDEBC8',
  cat: '#7C6CF0',
  catSoft: '#E4DEFF',
  blush: '#FFC9B3',
  sky: '#BFDFFF',
  danger: '#D64545',
  dangerSoft: '#FBE0E0',
  gold: '#C98A1B',
  shadow: 'rgba(80,45,20,0.10)',
  cardShadow: 'rgba(90,50,20,0.08)',
};

export const dark = {
  bg: '#161110',
  surface: '#221A16',
  surface2: '#2C221C',
  ink: '#F7EDE2',
  muted: '#B09E90',
  faint: '#7E6F63',
  line: '#3A2D25',
  primary: '#F0855C',
  primaryDeep: '#F0855C',
  primarySoft: '#3D251C',
  sage: '#7FB698',
  sageSoft: '#22382E',
  dog: '#F5A623',
  dogSoft: '#443014',
  cat: '#A79BFF',
  catSoft: '#2E2A55',
  blush: '#5A3327',
  sky: '#27405C',
  danger: '#F07A7A',
  dangerSoft: '#452222',
  gold: '#E0A83E',
  shadow: 'rgba(0,0,0,0.4)',
  cardShadow: 'rgba(0,0,0,0.35)',
};

export type Palette = typeof light;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 };
export const radius = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 };

type ThemeCtx = {
  colors: Palette;
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (m: ThemeMode) => void;
};

const Ctx = createContext<ThemeCtx>({
  colors: light,
  mode: 'system',
  resolved: 'light',
  setMode: () => {},
});

const KEY = 'pp.theme-mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo(
    () => ({ colors: resolved === 'dark' ? dark : light, mode, resolved, setMode }),
    [mode, resolved, setMode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
