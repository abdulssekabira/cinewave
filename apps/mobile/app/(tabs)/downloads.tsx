import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Paths } from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchTitles } from '@cinewave/shared';
import { Button, Row, ScreenTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  expiryLabel,
  isPlayable,
  loadDownloads,
  removeDownload,
  retryDownload,
  sizeLabel,
  useDownloads,
  verifyDownloads,
  useDownloadOwner,
  type Download,
} from '@/lib/downloads';
import { supabase } from '@/lib/supabase';
import { colors, F, img, radius } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

/**
 * Downloads kept inside the app. They play without internet until their
 * licence expires; going online renews them automatically.
 */
export default function Downloads() {
  const { session } = useAuth();
  const owner = useDownloadOwner();
  const userId = session?.user.id ?? owner;
  const list = useDownloads(userId);
  const [refreshing, setRefreshing] = useState(false);
  const { data: available } = useAsync(
    async () => (await searchTitles(supabase, {})).filter((t) => t.downloadable),
    [],
  );

  useEffect(() => { loadDownloads(); }, []);
  useFocusEffect(useCallback(() => { if (userId) verifyDownloads(userId); }, [userId]));

  async function refresh() {
    if (!userId) return;
    setRefreshing(true);
    await verifyDownloads(userId);
    setRefreshing(false);
  }

  const used = list.filter((d) => d.status === 'done').reduce((n, d) => n + (d.bytes ?? 0), 0);
  let free = 0;
  try { free = Paths.availableDiskSpace; } catch { /* unknown */ }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenTitle title="Downloads" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <View style={styles.storage}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.storageTitle}>
              {list.length ? `${list.length} download${list.length === 1 ? '' : 's'}${used ? ` · ${sizeLabel(used)}` : ''}` : 'No downloads yet'}
              {free ? <Text style={styles.free}>  ·  {sizeLabel(free)} free</Text> : null}
            </Text>
            <Text style={styles.storageText}>
              Kept safely inside GLE Movies, not in your gallery. Go online now and then to keep them playing.
            </Text>
          </View>
        </View>

        {!userId ? (
          <View style={styles.empty}>
            <Text style={styles.title}>Sign in to download</Text>
            <Text style={styles.text}>Offline downloads are included with Premium.</Text>
            <Button label="Sign in" onPress={() => router.push('/login')} style={{ marginTop: 16, alignSelf: 'stretch' }} />
          </View>
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.icon}><Ionicons name="download-outline" size={30} color={colors.accent} /></View>
            <Text style={styles.title}>Watch offline, anywhere</Text>
            <Text style={styles.text}>
              Open a film or series and tap the download button. Offline downloads are included with Premium.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18 }}>
            {list.map((d) => <Item key={d.id} d={d} />)}
          </View>
        )}

        {available && available.length > 0 && (
          <Row label="Available to download" titles={available} onSeeAll={() => router.push('/search')} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Item({ d }: { d: Download }) {
  const pct = d.bytes ? Math.min(100, Math.round((d.received / d.bytes) * 100)) : 0;
  const playable = isPlayable(d);
  const art = img(d.backdrop ?? d.poster);

  function open() {
    if (d.status === 'done' && playable) return router.push({ pathname: '/offline/[id]', params: { id: d.id } });
    if (d.status === 'done') {
      Alert.alert('Renew this download', 'Connect to the internet, then pull down on this page to renew it.');
    }
  }

  function menu() {
    const del = { text: d.status === 'downloading' ? 'Cancel download' : 'Delete download', style: 'destructive' as const, onPress: () => removeDownload(d.id) };
    const opts: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (d.status === 'failed') {
      opts.push({ text: 'Retry', onPress: () => retryDownload(d).then((m) => m && Alert.alert('Download', m)) });
    }
    opts.push({ text: 'View details', onPress: () => router.push({ pathname: '/title/[slug]', params: { slug: d.slug } }) });
    opts.push(del, { text: 'Close', style: 'cancel' });
    Alert.alert(d.title, d.episodeLabel ?? undefined, opts);
  }

  return (
    <Pressable onPress={open} onLongPress={menu} style={styles.item} accessibilityRole="button" accessibilityLabel={`${d.title}${d.episodeLabel ? `, ${d.episodeLabel}` : ''}`}>
      <View style={styles.thumb}>
        {art ? <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        {d.status === 'done' && (
          <View style={[styles.play, !playable && { opacity: 0.45 }]}><Ionicons name="play" size={14} color="#fff" /></View>
        )}
        {d.status === 'downloading' && (
          <View style={styles.bar}><View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.accent }} /></View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{d.title}</Text>
        {d.episodeLabel ? <Text style={styles.sub} numberOfLines={1}>{d.episodeLabel}{d.episodeName ? ` · ${d.episodeName}` : ''}</Text> : null}
        {d.status === 'downloading' ? (
          <Text style={styles.meta}>Downloading {pct}%{d.bytes ? ` of ${sizeLabel(d.bytes)}` : ''} · keep the app open</Text>
        ) : d.status === 'failed' ? (
          <Text style={[styles.meta, { color: colors.danger }]}>{d.error ?? 'Download stopped'} · hold to retry</Text>
        ) : (
          <Text style={[styles.meta, !playable && { color: colors.gold }]}>
            {sizeLabel(d.bytes)}{d.bytes ? ' · ' : ''}{expiryLabel(d)}
          </Text>
        )}
      </View>
      <Pressable onPress={menu} hitSlop={10} accessibilityLabel="Download options" style={styles.more}>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  storage: {
    flexDirection: 'row', gap: 12, alignItems: 'center', marginHorizontal: 20, padding: 16,
    backgroundColor: colors.raised, borderRadius: radius.md,
  },
  storageTitle: { color: colors.text, fontFamily: F.semibold, fontSize: 14 },
  free: { color: colors.faint, fontFamily: F.medium, fontSize: 12 },
  storageText: { color: colors.muted, fontFamily: F.regular, fontSize: 12, marginTop: 2, lineHeight: 17 },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  icon: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,122,47,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { color: colors.text, fontFamily: F.bold, fontSize: 18, marginBottom: 6 },
  text: { color: colors.muted, fontFamily: F.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  thumb: {
    width: 124, aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  play: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  name: { color: colors.text, fontFamily: F.bold, fontSize: 15 },
  sub: { color: colors.muted, fontFamily: F.medium, fontSize: 12.5, marginTop: 1 },
  meta: { color: colors.faint, fontFamily: F.regular, fontSize: 12, marginTop: 3 },
  more: { padding: 6 },
});
