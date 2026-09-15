import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/theme';

function Icon({ label }: { label: string }) {
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          paddingTop: 6,
          height: 84,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginBottom: 10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Journal', tabBarIcon: () => <Icon label="📔" /> }} />
      <Tabs.Screen name="memories" options={{ title: 'Memories', tabBarIcon: () => <Icon label="📖" /> }} />
      <Tabs.Screen name="health" options={{ title: 'Health', tabBarIcon: () => <Icon label="💚" /> }} />
      <Tabs.Screen name="care" options={{ title: 'Care', tabBarIcon: () => <Icon label="🤝" /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: () => <Icon label="⚙️" /> }} />
    </Tabs>
  );
}
