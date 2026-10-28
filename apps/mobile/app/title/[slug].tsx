import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  entitlementMessage,
  genreLabel,
  getEntitlement,
  getProfile,
  getRelated,
  getTitleBySlug,
  getWatchlistIds,
  PLAN_LABEL,
  setWatchlisted,
} from '@cinewave/shared';
import { Art, Rating } from '@/components/Poster';
import { Button, Chip, Empty, ErrorState, IconCircle, Loading, Row } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, F } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function TitleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
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
  if (!data) return <Empty icon="film-outline" title="Not available" text="This title may have left the catalogue." />;

  const { title, ent, related } = data;
  const heroH = Math.round(height * 0.58);

  async function toggleList() {
    if (!userId) return router.push('/login');
    const next = !inList;
    setInList(next);
    try {
      await setWatchlisted(supabase, userId, title.id, next);
    } catch {
      setInList(!next);
      Alert.alert('Couldn’t update your watchlist', 'Check your connection and try again.');
    }
  }

  function watch() {
    if (ent.can_play) return Alert.alert('Player — Phase 3', 'Playback connects once the video provider is set up.');
    if (ent.reason === 'sign_in_required') return router.push('/login');
    if (ent.reason === 'upgrade_required') return router.push('/profile');
  }

  const watchLabel = ent.can_play
    ? 'Watch Now'
    : ent.reason === 'sign_in_required'
      ? 'Sign in to watch'
      : ent.reason === 'upgrade_required'
        ? `Get ${PLAN_LABEL[ent.required_plan ?? 'standard']}`
        : 'Unavailable';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        <View style={{ height: heroH }}>
          <Art title={title} />
          <LinearGradient
            colors={['rgba(22,22,30,0.55)', 'transparent', 'rgba(22,22,30,0.82)', colors.bg]}
            locations={[0, 0.22, 0.62, 0.9]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroText}>
            <Text style={styles.h1}>{title.title}</Text>
            <Rating title={title} style={{ marginTop: 8 }} />
            {title.genres.length > 0 && (
              <View style={styles.chips}>
                {title.genres.map((g) => <Chip key={g} label={genreLabel(g)} />)}
                {title.maturity_rating ? <Chip label={title.maturity_rating} /> : null}
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {!ent.can_play && <Text style={styles.notice}>{entitlementMessage(ent.reason, ent.required_plan)}</Text>}

          <Text style={styles.h2}>Synopsis</Text>
          <Text style={styles.synopsis}>{title.synopsis ?? 'No synopsis yet.'}</Text>

          {title.credits.length > 0 && (
            <>
              <Text style={[styles.h2, { marginTop: 26 }]}>Cast &amp; Crew</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                {title.credits.map((c) => (
                  <View key={`${c.name}-${c.role}`} style={styles.person}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{initials(c.name)}</Text></View>
                    <Text style={styles.personName} numberOfLines={2}>{c.name}</Text>
                    <Text style={styles.personRole}>{c.role}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>

        {related.length > 0 && <Row label="More like this" titles={related} />}
      </ScrollView>

      {/* Top buttons */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <IconCircle icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <IconCircle
          icon="share-social-outline"
          label="Share"
          onPress={() => Share.share({ message: `Watch ${title.title} on GLE Movies` }).catch(() => {})}
        />
      </View>

      {/* Bottom action bar */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {title.downloadable && (
          <IconCircle
            icon="download-outline"
            label={ent.can_download ? 'Download' : 'Downloads need Premium'}
            size={52}
            style={{ backgroundColor: colors.surface }}
            onPress={() =>
              Alert.alert(
                ent.can_download ? 'Downloads — Phase 5' : 'Premium feature',
                ent.can_download
                  ? 'Offline downloads arrive with the protected player.'
                  : 'Offline downloads are included with Premium.',
              )
            }
          />
        )}
        <Button
          label={watchLabel}
          icon={ent.can_play ? 'play' : undefined}
          onPress={watch}
          disabled={!ent.can_play && ent.reason !== 'sign_in_required' && ent.reason !== 'upgrade_required'}
          style={{ flex: 1 }}
        />
        <IconCircle
          icon={inList ? 'checkmark' : 'add'}
          label={inList ? 'Remove from watchlist' : 'Add to watchlist'}
          size={52}
          active={inList}
          style={inList ? undefined : { backgroundColor: colors.surface }}
          onPress={toggleList}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 6 },
  h1: { color: '#fff', fontFamily: F.bold, fontSize: 28, lineHeight: 34 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26 },
  notice: { color: colors.accent, fontFamily: F.medium, fontSize: 13, marginBottom: 16 },
  h2: { color: colors.text, fontFamily: F.bold, fontSize: 17, marginBottom: 8 },
  synopsis: { color: colors.muted, fontFamily: F.regular, fontSize: 14, lineHeight: 22 },
  person: { width: 72, alignItems: 'center' },
  avatar: {
    width: 62, height: 62, borderRadius: 16, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  avatarText: { color: '#fff', fontFamily: F.bold, fontSize: 18 },
  personName: { color: colors.text, fontFamily: F.semibold, fontSize: 11.5, textAlign: 'center' },
  personRole: { color: colors.faint, fontFamily: F.regular, fontSize: 10.5, marginTop: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  actionBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 14, backgroundColor: 'rgba(22,22,30,0.96)',
  },
});
