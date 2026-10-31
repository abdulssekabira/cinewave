import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import * as Brightness from 'expo-brightness';
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, F } from '@/lib/theme';

function clock(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

type Hud = { icon: keyof typeof Ionicons.glyphMap; label: string; value?: number } | null;

/**
 * GLE Movies player, like VLC:
 *  - swipe up/down on the LEFT half = brightness, on the RIGHT half = volume
 *  - swipe sideways = move through the film; double-tap left/right = 10 s back/forward
 *  - tap = show/hide controls; lock button blocks accidental touches
 *  - opens sideways; rotate button switches between sideways and upright
 */
export function GlePlayer({
  player,
  title,
  subtitle,
  vj,
  onBack,
  hideControls,
  children,
}: {
  player: VideoPlayer;
  title: string;
  subtitle?: string | null;
  vj?: string | null;
  onBack: () => void;
  /** Hide the controls (e.g. while a "Resume?" sheet is showing). */
  hideControls?: boolean;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockHint, setLockHint] = useState(false);
  const [landscape, setLandscape] = useState(true);
  const [hud, setHud] = useState<Hud>(null);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  const bright = useRef(0.6);
  const volume = useRef(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef({ t: 0, x: 0 });
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------- setup / cleanup
  useEffect(() => {
    volume.current = player.volume ?? 1;
    Brightness.getBrightnessAsync().then((b) => { bright.current = b; }).catch(() => {});
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      if (Platform.OS === 'android') {
        Brightness.restoreSystemBrightnessAsync().catch(() => {});
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
    };
  }, [player]);

  useEventListener(player, 'timeUpdate', (e) => {
    setTime(e.currentTime);
    if (player.duration && player.duration !== duration) setDuration(player.duration);
  });
  useEventListener(player, 'playingChange', (e) => setPlaying(e.isPlaying));
  useEventListener(player, 'statusChange', (e) => setLoading(e.status === 'loading'));

  // ---------------------------------------------------------- controls visibility
  const poke = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 3500);
  }, []);
  useEffect(() => {
    if (!playing) { setVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current); }
    else poke();
  }, [playing, poke]);

  const showHud = (h: Hud) => {
    setHud(h);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHud(null), 900);
  };

  const seekBy = (sec: number) => {
    const t = clamp((player.currentTime || 0) + sec, 0, player.duration || Infinity);
    player.currentTime = t;
    setTime(t);
    showHud({ icon: sec < 0 ? 'play-back' : 'play-forward', label: `${sec < 0 ? '−' : '+'}${Math.abs(sec)} s` });
  };

  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    setLockHint(true);
    setTimeout(() => setLockHint(false), 2000);
    if (!next) poke();
  };

  const rotate = async () => {
    const next = !landscape;
    setLandscape(next);
    await ScreenOrientation.lockAsync(next ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    poke();
  };

  // ---------------------------------------------------------- gestures
  const g = useRef({ mode: '' as '' | 'bright' | 'volume' | 'seek', startVal: 0, startX: 0 });
  const dims = useRef({ width, height });
  dims.current = { width, height };
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, s) => Math.abs(s.dx) > 8 || Math.abs(s.dy) > 8,
      onPanResponderGrant: (e) => {
        g.current = { mode: '', startVal: 0, startX: e.nativeEvent.locationX };
      },
      onPanResponderMove: (_e, s) => {
        if (lockedRef.current) return;
        const { width: w, height: h } = dims.current;
        if (!g.current.mode) {
          if (Math.abs(s.dy) > 14 && Math.abs(s.dy) > Math.abs(s.dx) * 1.3) {
            g.current.mode = g.current.startX < w / 2 ? 'bright' : 'volume';
            g.current.startVal = g.current.mode === 'bright' ? bright.current : volume.current;
          } else if (Math.abs(s.dx) > 20 && Math.abs(s.dx) > Math.abs(s.dy) * 1.5) {
            g.current.mode = 'seek';
            g.current.startVal = player.currentTime || 0;
          } else return;
        }
        if (g.current.mode === 'bright' || g.current.mode === 'volume') {
          const v = clamp(g.current.startVal - s.dy / (h * 0.7));
          if (g.current.mode === 'bright') {
            bright.current = v;
            Brightness.setBrightnessAsync(Math.max(0.02, v)).catch(() => {});
            showHud({ icon: 'sunny', label: 'Brightness', value: v });
          } else {
            volume.current = v;
            player.volume = v;
            player.muted = v === 0;
            showHud({ icon: v === 0 ? 'volume-mute' : v < 0.5 ? 'volume-low' : 'volume-high', label: 'Volume', value: v });
          }
        } else if (g.current.mode === 'seek') {
          const total = player.duration || 0;
          // A full swipe across the screen moves about 3 minutes.
          const t = clamp(g.current.startVal + (s.dx / w) * 180, 0, total || Infinity);
          setSeekPreview(t);
        }
      },
      onPanResponderRelease: (e, s) => {
        const mode = g.current.mode;
        g.current.mode = '';
        if (mode === 'seek') {
          setSeekPreview((t) => { if (t !== null) player.currentTime = t; return null; });
          return;
        }
        if (mode) return;
        if (Math.abs(s.dx) > 10 || Math.abs(s.dy) > 10) return;
        // A tap: when locked, just show the lock button.
        if (lockedRef.current) {
          setLockHint(true);
          setTimeout(() => setLockHint(false), 2000);
          return;
        }
        const now = Date.now();
        const x = e.nativeEvent.locationX;
        const w = dims.current.width;
        if (now - lastTap.current.t < 300 && Math.abs(x - lastTap.current.x) < w / 3) {
          if (tapTimer.current) clearTimeout(tapTimer.current);
          lastTap.current = { t: 0, x: 0 };
          if (x < w * 0.4) seekBy(-10);
          else if (x > w * 0.6) seekBy(10);
          return;
        }
        lastTap.current = { t: now, x };
        tapTimer.current = setTimeout(() => {
          setVisible((v) => {
            const next = !v;
            if (next) setTimeout(poke, 0);
            return next;
          });
        }, 260);
      },
    }),
  ).current;

  // ---------------------------------------------------------- seek bar
  const barWidth = useRef(1);
  const scrub = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const t = clamp(e.nativeEvent.locationX / barWidth.current) * (player.duration || 0);
        setSeekPreview(t);
      },
      onPanResponderMove: (e) => {
        const t = clamp(e.nativeEvent.locationX / barWidth.current) * (player.duration || 0);
        setSeekPreview(t);
      },
      onPanResponderRelease: () => {
        setSeekPreview((t) => { if (t !== null) player.currentTime = t; return null; });
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const shown = time;
  const pos = seekPreview ?? shown;
  const pct = duration ? clamp(pos / duration) * 100 : 0;
  const controlsOn = visible && !locked && !hideControls;
  const side = { paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16) };

  return (
    <View style={s.wrap}>
      <StatusBar hidden />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />

      {/* Gesture layer (also catches taps while locked). */}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />

      {loading && !hideControls && (
        <View style={s.center} pointerEvents="none"><ActivityIndicator size="large" color="#fff" /></View>
      )}

      {hud && (
        <View style={s.hudWrap} pointerEvents="none">
          <View style={s.hud}>
            <Ionicons name={hud.icon} size={22} color="#fff" />
            <Text style={s.hudText}>{hud.label}{hud.value !== undefined ? ` ${Math.round(hud.value * 100)}%` : ''}</Text>
            {hud.value !== undefined && (
              <View style={s.hudBar}><View style={[s.hudFill, { width: `${hud.value * 100}%` }]} /></View>
            )}
          </View>
        </View>
      )}

      {seekPreview !== null && (
        <View style={s.hudWrap} pointerEvents="none">
          <View style={s.hud}><Text style={s.seekText}>{clock(seekPreview)} / {clock(duration)}</Text></View>
        </View>
      )}

      {controlsOn && (
        <>
          <View style={[s.top, side, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={10} style={s.iconBtn}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{title}</Text>
              {(vj || subtitle) ? (
                <Text style={s.sub} numberOfLines={1}>
                  {vj ? <Text style={{ color: colors.accent }}>{vj}</Text> : null}
                  {vj && subtitle ? '  ·  ' : ''}{subtitle ?? ''}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={rotate} accessibilityLabel="Rotate screen" hitSlop={10} style={s.iconBtn}>
              <Ionicons name="phone-landscape-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={toggleLock} accessibilityLabel="Lock screen" hitSlop={10} style={s.iconBtn}>
              <Ionicons name="lock-open-outline" size={22} color="#fff" />
            </Pressable>
          </View>

          <View style={s.middle} pointerEvents="box-none">
            <Pressable onPress={() => { seekBy(-10); poke(); }} accessibilityLabel="Back 10 seconds" style={s.skip}>
              <Ionicons name="play-back" size={26} color="#fff" />
              <Text style={s.skipText}>10</Text>
            </Pressable>
            <Pressable
              onPress={() => { if (player.playing) player.pause(); else player.play(); poke(); }}
              accessibilityLabel={playing ? 'Pause' : 'Play'}
              style={s.play}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={38} color="#fff" style={playing ? undefined : { marginLeft: 4 }} />
            </Pressable>
            <Pressable onPress={() => { seekBy(10); poke(); }} accessibilityLabel="Forward 10 seconds" style={s.skip}>
              <Ionicons name="play-forward" size={26} color="#fff" />
              <Text style={s.skipText}>10</Text>
            </Pressable>
          </View>

          <View style={[s.bottom, side, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Text style={s.time}>{clock(pos)}</Text>
            <View
              style={s.barHit}
              onLayout={(e) => { barWidth.current = Math.max(1, e.nativeEvent.layout.width); }}
              {...scrub.panHandlers}
            >
              <View style={s.bar}>
                <View style={[s.barFill, { width: `${pct}%` }]} />
              </View>
              <View style={[s.knob, { left: `${pct}%` }]} />
            </View>
            <Text style={s.time}>{clock(duration)}</Text>
          </View>
        </>
      )}

      {(locked && lockHint) && (
        <View style={[s.lockWrap, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
          <Pressable onPress={toggleLock} accessibilityLabel="Unlock screen" style={s.lockBtn}>
            <Ionicons name="lock-closed" size={22} color="#fff" />
            <Text style={s.lockText}>Tap to unlock</Text>
          </Pressable>
        </View>
      )}
      {(!locked && lockHint) && (
        <View style={s.hudWrap} pointerEvents="none">
          <View style={s.hud}><Ionicons name="lock-open" size={20} color="#fff" /><Text style={s.hudText}>Unlocked</Text></View>
        </View>
      )}

      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  top: {
    position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingBottom: 14, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  title: { color: '#fff', fontFamily: F.bold, fontSize: 16 },
  sub: { color: 'rgba(255,255,255,0.85)', fontFamily: F.semibold, fontSize: 12.5, marginTop: 1 },
  middle: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 46 },
  play: { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  skip: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  skipText: { color: '#fff', fontFamily: F.bold, fontSize: 10, marginTop: -2 },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  time: { color: '#fff', fontFamily: F.semibold, fontSize: 12.5, minWidth: 48, textAlign: 'center' },
  barHit: { flex: 1, height: 32, justifyContent: 'center' },
  bar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
  knob: { position: 'absolute', width: 16, height: 16, borderRadius: 8, marginLeft: -8, backgroundColor: colors.accent, top: 8 },
  hudWrap: { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center' },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.72)' },
  hudText: { color: '#fff', fontFamily: F.bold, fontSize: 14 },
  hudBar: { width: 90, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  hudFill: { height: '100%', backgroundColor: colors.accent },
  seekText: { color: '#fff', fontFamily: F.bold, fontSize: 18 },
  lockWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  lockBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  lockText: { color: '#fff', fontFamily: F.bold, fontSize: 14 },
});
