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
import { saveEpisodeProgress, saveProgress } from '@cinewave/shared';
import { Button, Centered, Loading } from '@/components/ui';
import { GlePlayer } from '@/components/GlePlayer';
import { useAuth } from '@/lib/auth';
import { findDownload, isPlayable, loadDownloads, useDownloadOwner, type Download } from '@/lib/downloads';
import { supabase } from '@/lib/supabase';
import { colors, F } from '@/lib/theme';

type Saved = { pos: number; dur: number; at: number };
// Same key as the streaming player, so offline and online share the resume spot.
const key = (id: string) => `gle:pos:${id}`;

function clock(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}

/** Plays a protected download from the app's private storage. No internet needed. */
export default function OfflineScreen() {
  usePreventScreenCapture('gle-offline');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const owner = useDownloadOwner();
  const me = session?.user.id ?? owner;
  const [d, setD] = useState<Download | null | undefined>(undefined);

  useEffect(() => { loadDownloads().then(() => setD(findDownload(id))); }, [id]);

  if (d === undefined) return <Loading />;
  if (!d || d.userId !== me || !isPlayable(d)) {
    return (
      <Centered>
        <Text style={styles.msg}>
          {!d || d.userId !== me
            ? 'This download isn’t on this phone any more.'
            : 'This download needs renewing. Connect to the internet and open Downloads.'}
        </Text>
        <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: 14 }} />
      </Centered>
    );
  }
  return <Player d={d} userId={me!} />;
}

function Player({ d, userId }: { d: Download; userId: string }) {
  const insets = useSafeAreaInsets();
  const posKey = d.episodeId ?? d.titleId;
  const player = useVideoPlayer(d.file, (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = false;
  });
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [decided, setDecided] = useState(false);
  const [playing, setPlaying] = useState(false);
  const last = useRef({ pos: 0, dur: 0, savedLocal: 0, savedServer: 0 });

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key(posKey)).then((raw) => {
      if (!alive) return;
      let pos = 0;
      try {
        const s = raw ? (JSON.parse(raw) as Saved) : null;
        if (s && !(s.dur && s.pos / s.dur > 0.92)) pos = s.pos;
      } catch { /* ignore */ }
      if (pos > 30) setResumeAt(pos);
      else { setDecided(true); player.play(); }
    });
    return () => { alive = false; };
  }, [posKey, player]);

  const save = useCallback((force = false) => {
    const { pos, dur } = last.current;
    if (!(pos > 0)) return;
    if (force || Math.abs(pos - last.current.savedLocal) >= 2) {
      last.current.savedLocal = pos;
      AsyncStorage.setItem(key(posKey), JSON.stringify({ pos, dur, at: Date.now() } satisfies Saved)).catch(() => {});
    }
    // If there happens to be internet, keep the account in step too.
    if (force || Math.abs(pos - last.current.savedServer) >= 15) {
      last.current.savedServer = pos;
      const job = d.episodeId
        ? saveEpisodeProgress(supabase, userId, d.titleId, d.episodeId, pos, dur || undefined)
        : saveProgress(supabase, userId, d.titleId, pos, dur || undefined);
      job.catch(() => {});
    }
  }, [posKey, d, userId]);

  useEventListener(player, 'timeUpdate', (e) => {
    last.current.pos = e.currentTime;
    last.current.dur = player.duration || last.current.dur;
    save();
  });
  useEventListener(player, 'playingChange', (e) => {
    setPlaying(e.isPlaying);
    if (!e.isPlaying) save(true);
  });
  useEventListener(player, 'playToEnd', () => {
    last.current.pos = player.duration || last.current.pos;
    save(true);
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') save(true); });
    return () => { sub.remove(); save(true); };
  }, [save]);

  function start(pos: number) {
    player.currentTime = pos;
    setResumeAt(null);
    setDecided(true);
    player.play();
  }

  return (
    <GlePlayer
      player={player}
      title={d.title}
      subtitle={`${d.episodeLabel ? `${d.episodeLabel}${d.episodeName ? ` · ${d.episodeName}` : ''} · ` : ''}Downloaded`}
      onBack={() => router.back()}
      hideControls={!decided && resumeAt !== null}
    >
      {!decided && resumeAt !== null && (
        <View style={styles.sheet}>
          <Text style={styles.sheetText}>You stopped at <Text style={styles.bold}>{clock(resumeAt)}</Text></Text>
          <Button label={`Resume from ${clock(resumeAt)}`} icon="play" onPress={() => start(resumeAt)} />
          <Button label="Start over" variant="ghost" onPress={() => start(0)} style={{ marginTop: 8 }} />
        </View>
      )}
    </GlePlayer>
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
});
