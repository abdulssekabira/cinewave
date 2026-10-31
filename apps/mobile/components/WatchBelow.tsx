import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { formatRuntime, getEpisodes, getRelated, getTitleBySlug, partLabel, vjLabel } from '@cinewave/shared';
import { PosterCard } from '@/components/Poster';
import { supabase } from '@/lib/supabase';
import { colors, F, img, radius } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

/**
 * Under the video in the small (upright) player view: what's playing, the
 * other parts of a series, and more films to watch.
 */
export function WatchBelow({ slug, partId }: { slug: string; partId: string | null }) {
  const { width } = useWindowDimensions();
  const cardW = Math.floor((Math.min(width, 520) - 24 - 24) / 3);
  const { data } = useAsync(async () => {
    const title = await getTitleBySlug(supabase, slug);
    if (!title) return null;
    const [related, eps] = await Promise.all([
      getRelated(supabase, title).catch(() => []),
      title.kind === 'series' ? getEpisodes(supabase, title.id).then((e) => e.filter((x) => x.published)).catch(() => []) : Promise.resolve([]),
    ]);
    return { title, related, eps };
  }, [slug]);

  if (!data) return null;
  const { title, related, eps } = data;
  const multi = new Set(eps.map((e) => e.season)).size > 1;
  const current = eps.find((e) => e.id === partId);

  return (
    <View style={{ paddingTop: 14 }}>
      <View style={s.info}>
        <Text style={s.title}>{title.title}</Text>
        <View style={s.meta}>
          {title.vj_name ? <Text style={s.vj}>{vjLabel(title.vj_name)}</Text> : null}
          {current ? <Text style={s.metaText}>{partLabel(current, multi)}{current.name ? ` · ${current.name}` : ''}</Text> : null}
          {title.release_year ? <Text style={s.metaText}>{title.release_year}</Text> : null}
          {title.runtime_minutes && !current ? <Text style={s.metaText}>{formatRuntime(title.runtime_minutes)}</Text> : null}
        </View>
        {title.synopsis ? <Text style={s.syn} numberOfLines={3}>{title.synopsis}</Text> : null}
      </View>

      {eps.length > 1 && (
        <View style={{ marginTop: 18 }}>
          <Text style={s.h}>Parts</Text>
          {eps.map((e) => {
            const now = e.id === partId;
            const art = img(e.still_url ?? title.backdrop_url ?? title.poster_url);
            return (
              <Pressable
                key={e.id}
                onPress={() => { if (!now) router.replace({ pathname: '/watch/[slug]', params: { slug, part: e.id } }); }}
                style={[s.part, now && s.partNow]}
                accessibilityRole="button"
                accessibilityLabel={`${partLabel(e, multi)}${now ? ', playing' : ''}`}
              >
                <View style={s.thumb}>
                  {art ? <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  <View style={s.thumbPlay}><Ionicons name={now ? 'volume-high' : 'play'} size={13} color="#fff" /></View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.partLabel, now && { color: colors.accent }]}>{partLabel(e, multi)}{now ? '  · Playing' : ''}</Text>
                  {e.name ? <Text style={s.partName} numberOfLines={1}>{e.name}</Text> : null}
                  {e.runtime_minutes ? <Text style={s.partMeta}>{formatRuntime(e.runtime_minutes)}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {related.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={s.h}>More like this</Text>
          <View style={s.grid}>
            {related.map((t) => (
              <View key={t.id} style={s.cell}>
                <PosterCard title={t} width={cardW} />
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  info: { paddingHorizontal: 16 },
  title: { color: colors.text, fontFamily: F.bold, fontSize: 19 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  vj: { color: colors.accent, fontFamily: F.bold, fontSize: 13 },
  metaText: { color: colors.muted, fontFamily: F.medium, fontSize: 13 },
  syn: { color: colors.muted, fontFamily: F.regular, fontSize: 13, lineHeight: 19, marginTop: 8 },
  h: { color: colors.text, fontFamily: F.bold, fontSize: 17, marginHorizontal: 16, marginBottom: 8 },
  part: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 16 },
  partNow: { backgroundColor: colors.raised },
  thumb: { width: 112, aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  thumbPlay: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  partLabel: { color: colors.text, fontFamily: F.bold, fontSize: 14 },
  partName: { color: colors.muted, fontFamily: F.medium, fontSize: 12.5, marginTop: 1 },
  partMeta: { color: colors.faint, fontFamily: F.regular, fontSize: 11.5, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  cell: { paddingHorizontal: 4, marginBottom: 14 },
});
