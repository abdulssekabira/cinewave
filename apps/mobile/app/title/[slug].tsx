import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  entitlementMessage,
  genreLabel,
  getEntitlement,
  getProfile,
  getRelated,
  getTitleBySlug,
  getWatchlistIds,
  metaLine,
  PLAN_LABEL,
  posterPalette,
  setWatchlisted,
} from '@cinewave/shared';
import { Badges, PosterArt } from '@/components/Poster';
import { Button, Empty, ErrorState, Loading, Row } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function TitleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data, error, loading, reload } = useAsync(async () => {
    const title = await getTitleBySlug(supabase, slug);
    if (!title) return null;
    const profile = userId ? await getProfile(supabase, userId) : null;
    const [ent, related, wl] = await Promise.all([
      getEntitlement(supabase, title.id, profile?.country_code),
      getRelated(supabase, title),
      userId ? getWatchlistIds(supabase) : Promise.resolve(new Set<string>()),
    ]);
    return { title, ent, related, inList: wl.has(title.id) };
  }, [slug, userId]);

  const [inList, setInList] = useState(false);
  useEffect(() => setInList(Boolean(data?.inList)), [data?.inList]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Empty title="Not available" text="This title may have left the catalogue." />;

  const { title, ent, related } = data;
  const p = posterPalette(title.slug);

  async function toggleList() {
    if (!userId) return router.push('/login');
    const next = !inList;
    setInList(next);
    try {
      await setWatchlisted(supabase, userId, title.id, next);
    } catch {
      setInList(!next);
      Alert.alert('Couldn’t update My List', 'Check your connection and try again.');
    }
  }

  function primaryAction() {
    if (ent.can_play) return Alert.alert('Player — Phase 3', 'Playback connects once the video provider is set up.');
    if (ent.reason === 'sign_in_required') return router.push('/login');
    if (ent.reason === 'upgrade_required') return router.push('/account');
  }

  const primaryLabel = ent.can_play
    ? '▶  Play'
    : ent.reason === 'sign_in_required'
      ? 'Sign in to watch'
      : ent.reason === 'upgrade_required'
        ? `Get ${PLAN_LABEL[ent.required_plan ?? 'standard']}`
        : 'Unavailable';

  return (
    <ScrollView style={{ backgroundColor: colors.bg }}>
      <LinearGradient colors={[p.to, p.from, colors.bg]} locations={[0, 0.6, 1]} style={styles.top}>
        <View style={styles.posterWrap}>
          <View style={styles.poster}>
            <PosterArt title={title} large />
            <Badges title={title} />
          </View>
        </View>
        <Text style={styles.h1}>{title.title}</Text>
        <Text style={styles.meta}>{metaLine(title)}</Text>
        <View style={styles.chips}>
          {title.genres.map((g) => (
            <Text key={g} style={styles.chip}>{genreLabel(g)}</Text>
          ))}
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16 }}>
        <Button
          label={primaryLabel}
          onPress={primaryAction}
          disabled={!ent.can_play && ent.reason !== 'sign_in_required' && ent.reason !== 'upgrade_required'}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Button label={inList ? '✓ In My List' : '+ My List'} variant="ghost" onPress={toggleList} style={{ flex: 1 }} />
          {ent.can_download && (
            <Button
              label="↓ Download"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => Alert.alert('Downloads — Phase 5', 'Offline downloads arrive with the protected player.')}
            />
          )}
        </View>
        {!ent.can_play && <Text style={styles.notice}>{entitlementMessage(ent.reason, ent.required_plan)}</Text>}

        {title.synopsis ? <Text style={styles.synopsis}>{title.synopsis}</Text> : null}

        <View style={styles.details}>
          {title.audio_languages.length > 0 && <Detail k="Audio" v={title.audio_languages.join(', ').toUpperCase()} />}
          {title.subtitle_languages.length > 0 && (
            <Detail k="Subtitles" v={title.subtitle_languages.join(', ').toUpperCase()} />
          )}
          <Detail k="Plan" v={PLAN_LABEL[title.required_plan]} />
          {title.content_warnings.length > 0 && <Detail k="Warnings" v={title.content_warnings.join(', ')} />}
        </View>
      </View>

      {related.length > 0 && <Row label="More like this" titles={related} />}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ width: '50%', marginBottom: 14 }}>
      <Text style={styles.dt}>{k.toUpperCase()}</Text>
      <Text style={styles.dd}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: 100, paddingHorizontal: 16, paddingBottom: 20 },
  posterWrap: { width: '44%', marginBottom: 18 },
  poster: { aspectRatio: 2 / 3, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  h1: { color: colors.text, fontFamily: fonts.display, fontSize: 34, fontWeight: '700', lineHeight: 37 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    color: colors.muted,
    fontSize: 12,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  notice: { color: colors.muted, fontSize: 13, marginTop: 12 },
  synopsis: { color: '#e3dfd6', fontSize: 15, lineHeight: 23, marginTop: 20 },
  details: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 22, marginBottom: 12 },
  dt: { color: colors.faint, fontSize: 11, letterSpacing: 1.2, marginBottom: 3 },
  dd: { color: colors.text, fontSize: 14 },
});
