import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatPrice, getActiveSubscription, getPlans, PLAN_LABEL } from '@cinewave/shared';
import { Button, ErrorState, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Account() {
  const { session } = useAuth();
  const { data, error, loading, reload } = useAsync(async () => {
    const [sub, plans] = await Promise.all([getActiveSubscription(supabase), getPlans(supabase)]);
    return { sub, plans };
  }, [session?.user.id]);

  if (!session) {
    return (
      <View style={styles.wrap}>
        <Button label="Sign in" onPress={() => router.replace('/login')} />
      </View>
    );
  }
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />;

  const current = data.sub?.plan_id ?? 'free';

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.wrap}>
      <View style={styles.panel}>
        <Text style={styles.h2}>Signed in as</Text>
        <Text style={styles.value}>{session.user.email}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.h2}>Membership</Text>
        <Text style={styles.value}>{data.sub ? PLAN_LABEL[current] : 'Free (with ads)'}</Text>
        {data.sub?.current_period_end && (
          <Text style={styles.muted}>
            {data.sub.cancel_at_period_end ? 'Ends' : 'Renews'}{' '}
            {new Date(data.sub.current_period_end).toLocaleDateString()}
          </Text>
        )}
      </View>

      <Text style={[styles.h2, { marginTop: 8, marginBottom: 10 }]}>Plans</Text>
      {data.plans.map((p) => (
        <View key={p.id} style={[styles.plan, current === p.id && { borderColor: colors.accent }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.value}>{p.name}</Text>
            <Text style={styles.muted}>
              {p.shows_ads ? 'With ads' : 'No ads'} · {p.max_quality}
              {p.downloads_allowed ? ' · Downloads' : ''}
            </Text>
          </View>
          <Text style={styles.price}>
            {formatPrice(p.price_cents, p.currency)}
            {p.price_cents ? '/mo' : ''}
          </Text>
        </View>
      ))}
      <Text style={[styles.muted, { marginTop: 6 }]}>Subscriptions via Google Play arrive in Phase 4.</Text>

      <Button label="My List" variant="ghost" onPress={() => router.push('/watchlist')} style={{ marginTop: 24 }} />
      <Button
        label="Sign out"
        variant="ghost"
        style={{ marginTop: 10 }}
        onPress={async () => {
          await supabase.auth.signOut();
          router.replace('/');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, backgroundColor: colors.bg, flexGrow: 1 },
  panel: { backgroundColor: colors.raised, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 12 },
  h2: { color: colors.faint, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  value: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 10,
  },
  price: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
