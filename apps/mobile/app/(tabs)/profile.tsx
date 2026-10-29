import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatPrice, getActiveSubscription, getPlans, getProfile, PLAN_LABEL } from '@cinewave/shared';
import { Button, ErrorState, Loading, ScreenTitle, type IconName } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

function MenuItem({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <Text style={styles.itemText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

export default function Profile() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { data, error, loading, reload } = useAsync(async () => {
    const plans = await getPlans(supabase);
    if (!uid) return { plans, sub: null, name: null, username: null as string | null };
    const [sub, profile, uname] = await Promise.all([
      getActiveSubscription(supabase),
      getProfile(supabase, uid),
      supabase.from('profiles').select('username').eq('id', uid).maybeSingle(),
    ]);
    return { plans, sub, name: profile?.display_name ?? null, username: (uname.data?.username as string | null) ?? null };
  }, [uid]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />;

  const current = data.sub?.plan_id ?? 'free';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenTitle title="Profile" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {session ? (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(data.name ?? session.user.email ?? '?')[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{data.name ?? 'GLE Movies member'}</Text>
              <Text style={styles.email}>{data.username ? `@${data.username} · ` : ''}{session.user.email}</Text>
              {data.sub?.current_period_end && (
                <Text style={styles.email}>
                  {PLAN_LABEL[current]} active until {new Date(data.sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              )}
            </View>
            <View style={styles.planPill}><Text style={styles.planPillText}>{PLAN_LABEL[current]}</Text></View>
          </View>
        ) : (
          <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={styles.name}>Sign in to GLE Movies</Text>
            <Text style={[styles.email, { marginBottom: 14 }]}>Sync your watchlist and progress across devices.</Text>
            <Button label="Sign in" onPress={() => router.push('/login')} />
          </View>
        )}

        <Text style={styles.h2}>Plans</Text>
        {data.plans.map((p) => (
          <View key={p.id} style={[styles.plan, current === p.id && { borderColor: colors.accent }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planText}>
                {p.shows_ads ? 'With ads' : 'No ads'} · {p.max_quality}
                {p.downloads_allowed ? ' · Downloads' : ''}
              </Text>
              {p.weekly_price_cents ? (
                <Text style={styles.planText}>or {formatPrice(p.weekly_price_cents, p.currency)} / week</Text>
              ) : null}
            </View>
            <Text style={styles.price}>
              {formatPrice(p.price_cents, p.currency)}
              {p.price_cents ? <Text style={styles.per}> /mo</Text> : null}
            </Text>
          </View>
        ))}
        <Text style={styles.note}>
          To subscribe or add more time, visit glemovies.com in your browser and pay with MTN MoMo, Airtel Money or card. Your plan then works here straight away.
        </Text>

        {session && (
          <View style={styles.menu}>
            <MenuItem icon="phone-portrait-outline" label="Devices" onPress={() => router.push('/devices')} />
            <MenuItem icon="time-outline" label="Watchlist" onPress={() => router.push('/watchlist')} />
            <MenuItem icon="search-outline" label="Browse films" onPress={() => router.push('/search')} />
            <MenuItem
              icon="log-out-outline"
              label="Sign out"
              onPress={async () => {
                await supabase.auth.signOut({ scope: 'local' });
                router.replace('/');
              }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18,
    backgroundColor: colors.raised, borderRadius: radius.lg, marginBottom: 26,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontFamily: F.bold, fontSize: 20 },
  name: { color: colors.text, fontFamily: F.bold, fontSize: 16 },
  email: { color: colors.muted, fontFamily: F.regular, fontSize: 13, marginTop: 2 },
  planPill: { backgroundColor: 'rgba(255,122,47,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  planPillText: { color: colors.accent, fontFamily: F.bold, fontSize: 11 },
  h2: { color: colors.text, fontFamily: F.bold, fontSize: 17, marginBottom: 12 },
  plan: {
    flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 10,
    backgroundColor: colors.raised, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'transparent',
  },
  planName: { color: colors.text, fontFamily: F.bold, fontSize: 15 },
  planText: { color: colors.muted, fontFamily: F.regular, fontSize: 12, marginTop: 2 },
  price: { color: colors.text, fontFamily: F.extrabold, fontSize: 17 },
  per: { color: colors.muted, fontFamily: F.medium, fontSize: 12 },
  note: { color: colors.faint, fontFamily: F.regular, fontSize: 12, marginTop: 4, marginBottom: 24 },
  menu: { backgroundColor: colors.raised, borderRadius: radius.md, overflow: 'hidden' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  itemText: { flex: 1, color: colors.text, fontFamily: F.medium, fontSize: 15 },
});
