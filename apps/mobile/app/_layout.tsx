import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { colors, fonts } from '@/lib/theme';

function HeaderRight() {
  const { session } = useAuth();
  return (
    <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
      <Link href="/search" asChild>
        <Pressable accessibilityLabel="Search"><Text style={{ color: colors.text, fontSize: 15 }}>Search</Text></Pressable>
      </Link>
      <Link href={session ? '/account' : '/login'} asChild>
        <Pressable accessibilityLabel={session ? 'Account' : 'Sign in'}>
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>{session ? 'Account' : 'Sign in'}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function Wordmark() {
  return (
    <Text style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.text }}>
      Cine<Text style={{ color: colors.accent, fontStyle: 'italic' }}>Wave</Text>
    </Text>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerTitle: () => <Wordmark />, headerRight: () => <HeaderRight /> }} />
        <Stack.Screen name="title/[slug]" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="search" options={{ title: 'Browse' }} />
        <Stack.Screen name="login" options={{ title: '', presentation: 'modal' }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="watchlist" options={{ title: 'My List' }} />
      </Stack>
    </AuthProvider>
  );
}
