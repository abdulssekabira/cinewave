import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Empty, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { SITE } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

type Ref = { code: string; joined: number; counted: number; needed: number; reward_days: number; rewards: number; max_rewards: number; standard_until: string | null };

const reward = (d: number) => (d % 30 === 0 ? `${d / 30} month${d === 30 ? '' : 's'}` : `${d} days`);

/** Your own invite link and QR code; 2 friends = Standard free (once per account). */
export default function Invite() {
  const { session } = useAuth();
  const { data, loading, reload } = useAsync(async () => {
    if (!session) return null;
    const { data: d } = await supabase.rpc('my_referrals_v2');
    return ((Array.isArray(d) ? d[0] : d) as Ref | undefined) ?? null;
  }, [session?.user.id]);

  if (!session) {
    return <Empty icon="gift-outline" title="Sign in to invite friends" text="Invite friends and get Standard free."><Button label="Sign in" onPress={() => router.push('/login')} style={{ marginTop: 16 }} /></Empty>;
  }
  if (loading && !data) return <Loading />;
  if (!data) return <Empty icon="gift-outline" title="Couldn’t load your invite" text="Check your connection and try again."><Button label="Retry" onPress={reload} style={{ marginTop: 16 }} /></Empty>;

  const link = `${SITE.replace('https://glemovies.com', 'https://www.glemovies.com')}/r/${data.code}`;
  const earned = data.rewards >= data.max_rewards;
  const message = `Watch movies and series with VJs on GLE Movies. Sign up with my link: ${link}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <View style={s.icon}><Ionicons name="gift" size={28} color={colors.accent} /></View>
      <Text style={s.h1}>Invite friends</Text>
      {earned ? (
        <Text style={s.text}>
          🎉 You earned {reward(data.reward_days)} of Standard free
          {data.standard_until ? `, active until ${new Date(data.standard_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}` : ''}. Thanks for sharing!
        </Text>
      ) : (
        <Text style={s.text}>
          When <Text style={s.b}>{data.needed} friends</Text> sign up with your link or QR code and confirm their email, you get{' '}
          <Text style={s.b}>Standard free for {reward(data.reward_days)}</Text>.
        </Text>
      )}

      <View style={s.qr}>
        <Image source={{ uri: `${SITE}/api/qr?code=${data.code}` }} style={{ width: 200, height: 200 }} contentFit="contain" />
      </View>
      <Text style={s.codeLabel}>Your code</Text>
      <Text style={s.code}>{data.code}</Text>

      {!earned && (
        <>
          <View style={s.progress}>
            {Array.from({ length: data.needed }).map((_, i) => <View key={i} style={[s.step, i < data.counted && s.stepOn]} />)}
          </View>
          <Text style={s.small}>
            {Math.min(data.counted, data.needed)} of {data.needed} friends joined
            {data.joined > data.counted ? ` · ${data.joined - data.counted} still need to confirm their email` : ''}
          </Text>
        </>
      )}

      <TextInput style={s.link} value={link} editable={false} selectTextOnFocus />
      <Button label="Share my invite" icon="share-social" onPress={() => Share.share({ message }).catch(() => {})} style={{ alignSelf: 'stretch' }} />
      <Text style={[s.small, { marginTop: 14 }]}>Friends can also type your code when they create an account.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 24, alignItems: 'center', paddingBottom: 40 },
  icon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,122,47,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  h1: { color: colors.text, fontFamily: F.bold, fontSize: 24 },
  text: { color: colors.muted, fontFamily: F.regular, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  b: { color: colors.text, fontFamily: F.bold },
  qr: { marginTop: 22, padding: 10, backgroundColor: '#fff', borderRadius: radius.md },
  codeLabel: { color: colors.faint, fontFamily: F.medium, fontSize: 12, marginTop: 16 },
  code: { color: colors.text, fontFamily: F.extrabold, fontSize: 26, letterSpacing: 4, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 6, marginTop: 18, alignSelf: 'stretch', justifyContent: 'center' },
  step: { flex: 1, maxWidth: 80, height: 8, borderRadius: 4, backgroundColor: colors.surface },
  stepOn: { backgroundColor: colors.accent },
  small: { color: colors.muted, fontFamily: F.medium, fontSize: 12.5, marginTop: 8, textAlign: 'center' },
  link: { alignSelf: 'stretch', marginTop: 20, marginBottom: 12, height: 48, borderRadius: radius.md, backgroundColor: colors.raised, color: colors.text, paddingHorizontal: 14, fontFamily: F.medium, fontSize: 13 },
});
