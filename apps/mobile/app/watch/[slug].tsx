import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { entitlementMessage, saveEpisodeProgress, saveProgress, type EntitlementReason, type PlanId } from '@cinewave/shared';
import { Button, Centered, Loading } from '@/components/ui';
import { getPlayInfo, type PlayInfo } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, F } from '@/lib/theme';

type Saved = { pos: number; dur: number; at: number };
const key = (id: string) => `gle:pos:${id}`;

function clock(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}

/**
 * Full-screen player. Screenshots and screen recording are blocked while
 * it's open. The position is saved to the account every 5 seconds and kept
 * on the phone every 2 seconds, so power cuts and lost connections only
 * cost a few seconds. Series parts continue to the next part.
 */
export default function WatchScreen() {
  usePreventScreenCapture('gle-player');
  const { slug, part } = useLocalSearchParams<{ slug: string; part?: string }>();
  const { session } = useAuth();
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setInfo(null);
    getPlayInfo(slug, part).then(setInfo).catch((e: Error) => setError(e.message));
  }, [slug, part]);
  useEffect(load, [load, session?.user.id]);

  if (error) {
    return (
      <Centered>
        <Text style={styles.msg}>{error}</Text>
        <Button label="Try again" onPress={load} style={{ marginTop: 16 }} />
      </Centered>
    );
  }
  if (!info) return <Loading />;
  if (!info.can_play || !info.src) {
    const msg = info.reason === 'no_parts'
      ? 'Parts for this series are coming soon.'
      : !info.can_play
        ? entitlementMessage(info.reason as EntitlementReason, info.required_plan as PlanId | null)
        : 'This video hasn’t been uploaded yet. Check back soon.';
    return (
      <Centered>
        <Text style={styles.msg}>{msg}</Text>
        {info.reason === 'device_limit' && <Button label="Manage devices" onPress={() => router.replace('/devices')} style={{ marginTop: 16 }} />}
        {info.reason === 'sign_in_required' && <Button label="Sign in" onPress={() => router.replace('/login')} style={{ marginTop: 16 }} />}
        <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </Centered>
    );
  }
  return <Player key={info.episode?.id ?? info.title.id} info={info} userId={session?.user.id ?? null} />;
}

function Player({ info, userId }: { info: PlayInfo; userId: string | null }) {
  const insets = useSafeAreaInsets();
  const posKey = info.episode?.id ?? info.title.id;
  const src = info.src!;
  const player = useVideoPlayer(src, (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = false;
  });

  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [decided, setDecided] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [offline, setOffline] = useState(false);
  const [upNext, setUpNext] = useState<number | null>(null);
  const last = useRef({ pos: 0, dur: 0, savedServer: 0, savedLocal: 0, pending: false });

  // Newest saved spot: the account's (any device) or this phone's own copy.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key(posKey)).then((raw) => {
      if (!alive) return;
      let pos = info.start_at;
      try {
        const local = raw ? (JSON.parse(raw) as Saved) : null;
        const serverAt = info.start_at_updated ? Date.parse(info.start_at_updated) : 0;
        if (local && local.at > serverAt + 5000 && !(local.dur && local.pos / local.dur > 0.92)) pos = local.pos;
      } catch { /* ignore a damaged copy */ }
      if (pos > 30) setResumeAt(pos);
      else { setDecided(true); player.play(); }
    });
    return () => { alive = false; };
  }, [posKey, info, player]);

  const save = useCallback((force = false) => {
    const { pos, dur } = last.current;
    if (!(pos > 0)) return;
    if (force || Math.abs(pos - last.current.savedLocal) >= 2) {
      last.current.savedLocal = pos;
      AsyncStorage.setItem(key(posKey), JSON.stringify({ pos, dur, at: Date.now() } satisfies Saved)).catch(() => {});
    }
    if (!userId) return;
    if (!force && !last.current.pending && Math.abs(pos - last.current.savedServer) < 5) return;
    last.current.savedServer = pos;
    const job = info.episode
      ? saveEpisodeProgress(supabase, userId, info.title.id, info.episode.id, pos, dur || undefined)
      : saveProgress(supabase, userId, info.title.id, pos, dur || undefined);
    job.then(() => { last.current.pending = false; }).catch(() => { last.current.pending = true; });
  }, [posKey, userId, info]);

  useEventListener(player, 'timeUpdate', (e) => {
    last.current.pos = e.currentTime;
    last.current.dur = player.duration || last.current.dur;
    if (e.currentTime > 0) setOffline(false);
    save();
  });
  useEventListener(player, 'playingChange', (e) => {
    setPlaying(e.isPlaying);
    if (!e.isPlaying) save(true);
  });
  useEventListener(player, 'playToEnd', () => {
    last.current.pos = player.duration || last.current.pos;
    save(true);
    if (info.episode?.next) setUpNext(10);
  });
  useEventListener(player, 'statusChange', (e) => {
    if (e.status !== 'error') return;
    // Lost connection: keep the spot and retry until the network is back.
    setOffline(true);
    const pos = last.current.pos;
    setTimeout(() => {
      player.replace(src);
      player.currentTime = pos;
      player.play();
    }, 4000);
  });

  // Save when the app goes to the background (e.g. power button, phone call).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') save(true); });
    return () => { sub.remove(); save(true); };
  }, [save]);

  // Next part countdown.
  useEffect(() => {
    if (upNext === null || !info.episode?.next) return;
    if (upNext <= 0) {
      router.replace({ pathname: '/watch/[slug]', params: { slug: info.title.slug, part: info.episode.next.id } });
      return;
    }
    const t = setTimeout(() => setUpNext((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [upNext, info]);

  function start(pos: number) {
    player.currentTime = pos;
    setResumeAt(null);
    setDecided(true);
    player.play();
  }

  return (
    <View style={styles.wrap}>
      <StatusBar hidden />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />

      {!playing && (
        <View style={[styles.top, { paddingTop: insets.top + 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.back} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{info.title.title}</Text>
            {info.episode && (
              <Text style={styles.part} numberOfLines={1}>{info.episode.label}{info.episode.name ? ` · ${info.episode.name}` : ''}</Text>
            )}
          </View>
        </View>
      )}

      {!decided && resumeAt !== null && (
        <View style={styles.sheet}>
          <Text style={styles.sheetText}>You stopped at <Text style={styles.bold}>{clock(resumeAt)}</Text></Text>
          <Button label={`Resume from ${clock(resumeAt)}`} icon="play" onPress={() => start(resumeAt)} />
          <Button label="Start over" variant="ghost" onPress={() => start(0)} style={{ marginTop: 8 }} />
        </View>
      )}

      {upNext !== null && info.episode?.next && (
        <View style={styles.sheet}>
          <Text style={styles.sheetText}>
            Up next: <Text style={styles.bold}>{info.episode.next.label}</Text>{info.episode.next.name ? ` · ${info.episode.next.name}` : ''}
          </Text>
          <Button label={`Play now (${upNext})`} icon="play" onPress={() => setUpNext(0)} />
          <Button label="Cancel" variant="ghost" onPress={() => setUpNext(null)} style={{ marginTop: 8 }} />
        </View>
      )}

      {offline && (
        <View style={[styles.offline, { top: insets.top + 10 }]}>
          <Text style={styles.offlineText}>Connection lost. Reconnecting… You’ll continue from {clock(last.current.pos)}.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  msg: { color: colors.text, fontFamily: F.semibold, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  title: { color: '#fff', fontFamily: F.bold, fontSize: 17 },
  part: { color: 'rgba(255,255,255,0.85)', fontFamily: F.semibold, fontSize: 13, marginTop: 1 },
  sheet: {
    position: 'absolute', alignSelf: 'center', top: '30%', width: '86%', maxWidth: 420, padding: 18, borderRadius: 18,
    backgroundColor: 'rgba(16,16,22,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetText: { color: '#ddd', fontFamily: F.medium, fontSize: 15, textAlign: 'center', marginBottom: 14 },
  bold: { color: '#fff', fontFamily: F.bold },
  offline: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: 'rgba(255,182,72,0.18)', borderWidth: 1, borderColor: 'rgba(255,182,72,0.5)', maxWidth: '92%' },
  offlineText: { color: '#ffd79a', fontFamily: F.semibold, fontSize: 12.5 },
});
