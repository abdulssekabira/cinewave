import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Empty, ErrorState, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { deviceName, type Device } from '@/lib/devices';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Phones, browsers and apps signed in to this account; remove one to free a slot. */
export default function Devices() {
  const { session } = useAuth();
  const [confirm, setConfirm] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(async () => {
    if (!session) return null;
    const [{ data: devs }, { data: plan }, { data: staff }] = await Promise.all([
      supabase.rpc('my_devices'),
      supabase.rpc('current_plan'),
      supabase.rpc('is_staff'),
    ]);
    const { data: p } = await supabase.from('plans').select('name, max_devices').eq('id', plan ?? 'free').maybeSingle();
    return { devices: (devs ?? []) as Device[], limit: (p?.max_devices as number | null) ?? null, planName: p?.name ?? 'Free', staff: Boolean(staff) };
  }, [session?.user.id]);

  if (!session) {
    return <Empty icon="phone-portrait-outline" title="Sign in first" text="Sign in to see the devices on your account."><Button label="Sign in" onPress={() => router.push('/login')} /></Empty>;
  }
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load devices.'} onRetry={reload} />;

  const blocked = !data.staff && data.devices.some((d) => d.is_current && !d.allowed);

  async function remove(id: string) {
    setConfirm(null);
    await supabase.rpc('remove_device', { p_session: id });
    reload();
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.lead}>
        {data.limit
          ? `Your ${data.planName} plan works on up to ${data.limit} devices. You’re using ${data.devices.length}.`
          : 'Phones, computers and apps signed in to your account.'}
        {data.staff && data.limit ? ' As staff, you’re not limited.' : ''}
      </Text>
      {blocked && (
        <View style={styles.warn}>
          <Text style={styles.warnText}>This phone can’t play films because your account is on too many devices. Remove one you no longer use.</Text>
        </View>
      )}
      {data.devices.map((d) => {
        const ok = data.staff || d.allowed;
        return (
          <View key={d.session_id} style={[styles.row, !ok && { borderColor: 'rgba(255,182,72,0.5)' }]}>
            <Ionicons name={/app|Android|iPhone/.test(deviceName(d.user_agent)) ? 'phone-portrait-outline' : 'laptop-outline'} size={22} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{deviceName(d.user_agent)}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {d.is_current && <Text style={styles.tag}>THIS DEVICE</Text>}
                {!ok && <Text style={[styles.tag, styles.tagWarn]}>CAN’T PLAY</Text>}
              </View>
              <Text style={styles.meta}>Signed in {when(d.signed_in_at)} · last used {when(d.last_active)}</Text>
            </View>
            {!d.is_current && (
              confirm === d.session_id ? (
                <Pressable onPress={() => remove(d.session_id)} style={[styles.rm, { backgroundColor: colors.accent }]}><Text style={styles.rmText}>Remove</Text></Pressable>
              ) : (
                <Pressable onPress={() => setConfirm(d.session_id)} style={styles.rm}><Text style={styles.rmText}>Remove</Text></Pressable>
              )
            )}
          </View>
        );
      })}
      <Text style={styles.note}>Removing a device signs it out. Devices not used for 30 days are removed automatically.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, fontFamily: F.regular, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  warn: { backgroundColor: 'rgba(255,182,72,0.12)', borderRadius: radius.md, padding: 12, marginBottom: 14 },
  warnText: { color: '#ffd79a', fontFamily: F.medium, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.raised, borderWidth: 1, borderColor: 'transparent', marginBottom: 10 },
  name: { color: colors.text, fontFamily: F.bold, fontSize: 15 },
  tag: { color: colors.accent, backgroundColor: 'rgba(255,122,47,0.14)', fontFamily: F.bold, fontSize: 10, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
  tagWarn: { color: '#ffb648', backgroundColor: 'rgba(255,182,72,0.14)' },
  meta: { color: colors.faint, fontFamily: F.regular, fontSize: 11.5, marginTop: 4 },
  rm: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.surface },
  rmText: { color: '#fff', fontFamily: F.semibold, fontSize: 13 },
  note: { color: colors.faint, fontFamily: F.regular, fontSize: 12, marginTop: 8, lineHeight: 18 },
});
