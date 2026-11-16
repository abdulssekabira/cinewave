import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '@/components/ui';
import { colors, F } from '@/lib/theme';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'watchlist', title: 'Watchlist', icon: 'time-outline', iconActive: 'time' },
  { name: 'downloads', title: 'Download', icon: 'download-outline', iconActive: 'download' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

// Same menu words as the website, shown just above the bottom buttons.
const MENU: { label: string; go: () => void; tab?: string }[] = [
  { label: 'Home', tab: 'index', go: () => router.navigate('/') },
  { label: 'Movies', go: () => router.push({ pathname: '/search', params: { sort: 'latest' } }) },
  { label: 'New & Popular', go: () => router.push({ pathname: '/search', params: { sort: 'newest' } }) },
  { label: 'My List', tab: 'watchlist', go: () => router.navigate('/watchlist') },
];

type BarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string) => void };
};

function Bar({ state, navigation }: BarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.menu} style={s.menuRow}>
        {MENU.map((m) => {
          const on = m.tab === current;
          return (
            <Pressable key={m.label} onPress={m.go} hitSlop={8} accessibilityRole="link" accessibilityState={{ selected: on }}>
              <Text style={[s.menuText, on && s.menuOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={s.tabs}>
        {state.routes.map((r, i) => {
          const t = TABS.find((x) => x.name === r.name);
          if (!t) return null;
          const focused = state.index === i;
          const color = focused ? colors.accent : colors.faint;
          return (
            <Pressable
              key={r.key}
              style={s.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t.title}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(r.name);
              }}
            >
              <Ionicons name={focused ? t.iconActive : t.icon} size={23} color={color} />
              <Text style={[s.tabText, { color }]}>{t.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(p) => <Bar {...(p as unknown as BarProps)} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />)}
    </Tabs>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.raised },
  menuRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  menu: { paddingHorizontal: 16, paddingVertical: 10, gap: 22, flexGrow: 1, justifyContent: 'space-between' },
  menuText: { color: '#e5e5e5', fontFamily: F.medium, fontSize: 14.5 },
  menuOn: { color: '#fff', fontFamily: F.bold },
  tabs: { flexDirection: 'row', paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabText: { fontFamily: F.semibold, fontSize: 11, lineHeight: 14 },
});
