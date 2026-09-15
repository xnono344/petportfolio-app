import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { Button } from '../src/components/Button';
import { useTheme } from '../src/theme';
import { useOnboarded } from './_layout';

const SLIDES = [
  { emoji: '📸', title: 'Capture your pet’s life', body: 'Photo memories and tiny daily notes — a journal that takes seconds, not minutes.' },
  { emoji: '🩺', title: 'Keep care details together', body: 'Vaccines, meds, vet visits, feeding notes and emergency contacts in one calm place.' },
  { emoji: '📖', title: 'Turn memories into yearly books', body: 'Pick a pet and a year, and generate a beautiful adventure book to keep forever.' },
];

export default function Onboarding() {
  const { colors } = useTheme();
  const router = useRouter();
  const { completeOnboarding } = useOnboarded();
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const slide = SLIDES[i];

  const finish = async () => {
    if (leaving) return;
    setLeaving(true);
    await completeOnboarding();
    router.replace('/(tabs)' as any);
  };

  const next = async () => {
    if (leaving) return;
    if (i < SLIDES.length - 1) {
      setI(i + 1);
      return;
    }
    setLeaving(true);
    await completeOnboarding();
    router.push('/pet/new' as any);
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={finish} disabled={leaving} hitSlop={12}>
          <Text style={[styles.skip, { color: colors.muted, opacity: leaving ? 0.4 : 1 }]}>Skip</Text>
        </Pressable>
      </View>
      <View style={[styles.hero, { backgroundColor: colors.primarySoft }]}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
      </View>
      <Text style={[styles.title, { color: colors.ink }]}>{slide.title}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{slide.body}</Text>
      <View style={styles.dots}>
        {SLIDES.map((_, d) => (
          <Pressable
            key={d}
            accessibilityLabel={`Go to slide ${d + 1}`}
            onPress={() => setI(d)}
            style={[
              styles.dot,
              { backgroundColor: d === i ? colors.primary : colors.line, width: d === i ? 26 : 8 },
            ]}
          />
        ))}
      </View>
      <Button
        title={i === SLIDES.length - 1 ? 'Add Your First Pet' : 'Continue'}
        onPress={next}
        loading={leaving}
      />
      <View style={{ height: 10 }} />
      <Button title="Explore first" variant="ghost" onPress={finish} disabled={leaving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-end', marginBottom: 8 },
  skip: { fontSize: 15, fontWeight: '600' },
  hero: { borderRadius: 30, alignItems: 'center', paddingVertical: 54, marginVertical: 12 },
  emoji: { fontSize: 84 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 14, lineHeight: 34 },
  body: { fontSize: 16, marginTop: 8, lineHeight: 23 },
  dots: { flexDirection: 'row', gap: 6, marginVertical: 18 },
  dot: { height: 8, borderRadius: 99 },
});
