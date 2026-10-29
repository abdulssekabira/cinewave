import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  entitlementMessage,
  genreLabel,
  getEntitlement,
  getEpisodeProgress,
  getEpisodes,
  getGenres,
  getProfile,
  formatRuntime,
  partLabel,
  getRelated,
  getTitleBySlug,
  getWatchlistIds,
  PLAN_LABEL,
  setWatchlisted,
} from '@cinewave/shared';
import { Art, Rating } from '@/components/Poster';
import { Button, Chip, Empty, ErrorState, IconCircle, Loading, Row } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isPlayable, startDownload, useDownloads, type Download } from '@/lib/downloads';
import { supabase } from '@/lib/supabase';
import { colors, F, img, radius } from '@/lib/theme';
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
    const isSeries = title.kind === 'series';
    const [ent, related, wl, genreList, progress, eps] = await Promise.all([
      getEntitlement(supabase, title.id, profile?.country_code),
      getRelated(supabase, title),
      userId ? getWatchlistIds(supabase) : Promise.resolve(new Set<string>()),
      getGenres(supabase, true),
      userId
        ? supabase.from('watch_progress').select('position_seconds, duration_seconds, completed, episode_id').eq('title_id', title.id).maybeSingle().then((r) => r.data)
        : Promise.resolve(null),
      isSeries ? getEpisodes(supabase, title.id).then((e) => e.filter((x) => x.published)) : Promise.resolve([]),
    ]);
    const epProgress = userId && isSeries ? await getEpisodeProgress(supabase, eps.map((e) => e.id)) : new Map();
    return { title, ent, related, inList: wl.has(title.id), genreNames: new Map(genreList.map((g) => [g.slug, g.name])), progress, eps, epProgress };
  }, [slug, userId]);

  const [inList, setInList] = useState(false);
  useEffect(() => setInList(Boolean(data?.inList)), [data?.inList]);
  const myDownloads = useDownloads(userId);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Empty icon="film-outline" title="Not available" text="This title may have left the catalogue." />;

  const { title, ent, related, eps, epProgress, progress } = data;
  const heroH = Math.round(height * 0.58);
  const isSeries = title.kind === 'series';
  const multi = new Set(eps.map((e) => e.season)).size > 1;
  const currentEp = isSeries ? eps.find((e) => e.id === progress?.episode_id) ?? eps[0] ?? null : null;
  const cur = currentEp ? epProgress.get(currentEp.id) : null;
  const resumeAt = isSeries
    ? (cur && !cur.completed && cur.position_seconds > 30 ? cur.position_seconds : 0)
    : (progress && !progress.completed && progress.position_seconds > 30 ? progress.position_seconds : 0);
  const mmss = (x: number) => {
    const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), sec = Math.floor(x % 60);
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  };
  const openPart = (id?: string) => router.push({ pathname: '/watch/[slug]', params: id ? { slug: title.slug, part: id } : { slug: title.slug } });

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

  const dlFor = (episodeId: string | null): Download | null =>
    myDownloads.find((d) => d.titleId === title.id && d.episodeId === episodeId) ?? null;

  async function download(episodeId: string | null) {
    if (!userId) return router.push('/login');
    if (!ent.can_download) {
      if (ent.reason === 'device_limit') return router.push('/devices');
      return Alert.alert('Premium feature', 'Offline downloads are included with Premium. Visit glemovies.com to upgrade.');
    }
    const have = dlFor(episodeId);
    if (have?.status === 'done' && isPlayable(have)) return router.push({ pathname: '/offline/[id]', params: { id: have.id } });
    if (have?.status === 'downloading') return router.push('/downloads');
    if (isSeries && !episodeId) return Alert.alert('Choose a part', 'Tap the download icon next to the part you want.');
    const msg = await startDownload(userId, title.slug, episodeId);
    if (msg) Alert.alert('Download', msg);
    else Alert.alert('Downloading', 'You can follow it in the Downloads tab. Keep the app open until it finishes.', [
      { text: 'OK' },
      { text: 'Open Downloads', onPress: () => router.push('/downloads') },
    ]);
  }

  const dlIcon = (d: Download | null) =>
    d?.status === 'done' ? 'checkmark-circle' : d?.status === 'downloading' ? 'cloud-download' : 'download-outline';

  function watch(partId?: string) {
    if (ent.can_play) {
      if (isSeries && !eps.length) return Alert.alert('Coming soon', 'Parts for this series are coming soon.');
      return openPart(partId ?? currentEp?.id);
    }
    if (ent.reason === 'sign_in_required') return router.push('/login');
    if (ent.reason === 'upgrade_required') return router.push('/profile');
    if (ent.reason === 'device_limit') return router.push('/devices');
  }

  const watchLabel = ent.can_play
    ? currentEp
      ? `${resumeAt ? 'Resume' : 'Play'} ${partLabel(currentEp, multi)}${resumeAt ? ` · ${mmss(resumeAt)}` : ''}`
      : resumeAt ? `Resume ${mmss(resumeAt)}` : 'Watch Now'
    : ent.reason === 'device_limit'
      ? 'Manage devices'
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
            {isSeries && (
              <Text style={styles.seriesTag}>SERIES{eps.length ? ` · ${eps.length} PARTS` : ''}</Text>
            )}
            {(title.genres.length > 0 || title.vj_name) && (
              <View style={styles.chips}>
                {title.vj_name ? (
                  <Pressable onPress={() => router.push('/search')} style={styles.vj} accessibilityLabel={`VJ ${title.vj_name}`}>
                    {title.vj_photo_url
                      ? <Image source={img(title.vj_photo_url)} style={styles.vjImg} />
                      : <View style={[styles.vjImg, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 10 }}>VJ</Text></View>}
                    <Text style={styles.vjText}>{title.vj_name}</Text>
                  </Pressable>
                ) : null}
                {title.genres.map((g) => <Chip key={g} label={data.genreNames.get(g) ?? genreLabel(g)} />)}
                {title.maturity_rating ? <Chip label={title.maturity_rating} /> : null}
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {!ent.can_play && <Text style={styles.notice}>{entitlementMessage(ent.reason, ent.required_plan)}</Text>}

          {isSeries && eps.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={styles.h2}>Parts</Text>
              {eps.map((e) => {
                const pr = epProgress.get(e.id);
                const dur = pr?.duration_seconds || (e.runtime_minutes ?? 0) * 60;
                const pct = pr ? (pr.completed ? 100 : dur ? Math.min(100, (pr.position_seconds / dur) * 100) : 0) : 0;
                const art = img(e.still_url ?? title.backdrop_url ?? title.poster_url);
                return (
                  <Pressable key={e.id} onPress={() => watch(e.id)} style={styles.part} accessibilityRole="button" accessibilityLabel={`${partLabel(e, multi)}${e.name ? `, ${e.name}` : ''}`}>
                    <View style={styles.partThumb}>
                      {art ? <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                      <View style={styles.partPlay}><Ionicons name="play" size={14} color="#fff" /></View>
                      {pct > 0 && <View style={styles.partBar}><View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.accent }} /></View>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partLabel}>
                        {partLabel(e, multi)}
                        {pr?.completed ? <Text style={styles.partDone}>  ✓ Watched</Text> : null}
                      </Text>
                      {e.name ? <Text style={styles.partName} numberOfLines={1}>{e.name}</Text> : null}
                      {e.runtime_minutes ? <Text style={styles.partMeta}>{formatRuntime(e.runtime_minutes)}</Text> : null}
                    </View>
                    {title.downloadable && (
                      <Pressable
                        onPress={() => download(e.id)}
                        hitSlop={10}
                        style={styles.partDl}
                        accessibilityRole="button"
                        accessibilityLabel={`Download ${partLabel(e, multi)}`}
                      >
                        <Ionicons
                          name={dlIcon(dlFor(e.id))}
                          size={22}
                          color={dlFor(e.id)?.status === 'done' ? colors.ok : ent.can_download ? colors.text : colors.faint}
                        />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

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
        {title.downloadable && !isSeries && (
          <IconCircle
            icon={dlIcon(dlFor(null))}
            label={ent.can_download ? 'Download' : 'Downloads need Premium'}
            size={52}
            active={dlFor(null)?.status === 'done'}
            style={dlFor(null)?.status === 'done' ? undefined : { backgroundColor: colors.surface }}
            onPress={() => download(null)}
          />
        )}
        <Button
          label={watchLabel}
          icon={ent.can_play ? 'play' : undefined}
          onPress={() => watch()}
          disabled={!ent.can_play && !['sign_in_required', 'upgrade_required', 'device_limit'].includes(ent.reason)}
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
  seriesTag: { color: colors.accent, fontFamily: F.bold, fontSize: 11.5, letterSpacing: 1, marginTop: 8 },
  vj: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12, paddingLeft: 3, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  vjImg: { width: 24, height: 24, borderRadius: 12 },
  vjText: { color: '#fff', fontFamily: F.semibold, fontSize: 12.5 },
  part: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 },
  partThumb: { width: 128, aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  partPlay: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  partBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  partLabel: { color: colors.text, fontFamily: F.bold, fontSize: 15 },
  partDl: { padding: 6 },
  partDone: { color: colors.ok, fontFamily: F.semibold, fontSize: 12 },
  partName: { color: colors.muted, fontFamily: F.medium, fontSize: 13, marginTop: 2 },
  partMeta: { color: colors.faint, fontFamily: F.regular, fontSize: 12, marginTop: 2 },
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
