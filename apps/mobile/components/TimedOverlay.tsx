import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { clockLabel, postTimedComment, type TimedComment } from '@cinewave/shared';
import { supabase } from '@/lib/supabase';
import { controls, ensureLoaded, getTimed, refreshTimed, setTimed, useTimed } from '@/lib/timedStore';
import { colors, F } from '@/lib/theme';

const SHOW_MS = 6500;
const PREF = 'gle:bubbles';
const GOLD = '#f5c518';

/** Over the film: scene comments pop up at their moment; 💬 to comment on the current scene. */
export function TimedOverlay({ time, playing, controlsOn, landscape, signedIn }: {
  time: number; playing: boolean; controlsOn: boolean; landscape: boolean; signedIn: boolean;
}) {
  const reached = useTimed((s) => s.reached);
  const open1st = useTimed((s) => s.open);
  const commented = useTimed((s) => s.commented);
  const comments = useTimed((s) => s.comments);
  const [bubbles, setBubbles] = useState<(TimedComment & { key: number })[]>([]);
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [at, setAt] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const last = useRef<number | null>(null);
  const resume = useRef(false);
  const seq = useRef(0);
  const [hint, setHint] = useState(false);
  const hintDone = useRef(false);

  useEffect(() => { AsyncStorage.getItem(PREF).then((v) => setOn(v !== 'off')).catch(() => {}); }, []);
  useEffect(() => { setTimed({ time, maxTime: Math.max(getTimed().maxTime, time) }); ensureLoaded(time + 120); }, [time]);
  useEffect(() => { setTimed({ playing }); }, [playing]);
  useEffect(() => {
    const t = setInterval(() => { if (getTimed().playing) refreshTimed(); }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const prev = last.current;
    last.current = time;
    if (!on || !playing || prev === null) return;
    const d = time - prev;
    if (d <= 0 || d > 3) return;
    const due = comments.filter((c) => c.at_seconds > prev && c.at_seconds <= time);
    if (!due.length) return;
    const add = due.slice(0, 3).map((c) => ({ ...c, key: ++seq.current }));
    setBubbles((b) => [...b, ...add].slice(-3));
    for (const a of add) setTimeout(() => setBubbles((b) => b.filter((x) => x.key !== a.key)), SHOW_MS);
  }, [time, playing, on, comments]);

  // Once per film/episode on this phone: a notice that viewers can comment.
  useEffect(() => {
    if (hintDone.current || commented || !playing || time < 120 || time > 900 || open || (signedIn && !open1st)) return;
    hintDone.current = true;
    const s = getTimed();
    const key = `gle:hint:${s.episodeId ?? s.titleId}`;
    AsyncStorage.getItem(key).then((v) => {
      if (v) return;
      AsyncStorage.setItem(key, '1').catch(() => {});
      setHint(true);
      setTimeout(() => setHint(false), 9000);
    }).catch(() => {});
  }, [time, playing, open, signedIn, open1st, commented]);

  function say(m: string) { setFlash(m); setTimeout(() => setFlash(null), 1600); }
  function toggleBubbles() {
    const next = !on;
    setOn(next);
    if (!next) setBubbles([]);
    AsyncStorage.setItem(PREF, next ? 'on' : 'off').catch(() => {});
    say(next ? 'Comment pop-ups on' : 'Comment pop-ups off');
  }
  function openBox() {
    if (!signedIn) { router.push('/login'); return; }
    setAt(Math.floor(getTimed().time));
    setErr(null);
    resume.current = Boolean(controls.isPlaying?.());
    controls.pause?.();
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setText('');
    if (resume.current) controls.play?.();
  }
  async function post() {
    if (!text.trim()) return;
    setBusy(true);
    const s = getTimed();
    const r = await postTimedComment(supabase, s.titleId!, s.episodeId, at, text);
    setBusy(false);
    if (r) { setErr(r); return; }
    setTimed({ loadedTo: Math.max(getTimed().loadedTo, at), commented: true });
    await refreshTimed();
    close();
    say('Comment posted');
  }

  const allowed = open1st && at <= reached + 5;
  const showHint = hint && !commented;
  const sideTop = landscape ? 70 : 52;

  return (
    <>
      {controlsOn && !open && (
        <View style={[st.tools, { top: sideTop }]}>
          <Pressable onPress={openBox} style={st.btn} accessibilityLabel="Comment on this scene" hitSlop={6}>
            <Text style={{ fontSize: 17 }}>💬</Text>
          </Pressable>
          <Pressable onPress={toggleBubbles} style={[st.btn, !on && { opacity: 0.6 }]} accessibilityLabel={on ? 'Hide comment pop-ups' : 'Show comment pop-ups'} hitSlop={6}>
            <Text style={st.btnSmall}>{on ? 'ON' : 'OFF'}</Text>
          </Pressable>
        </View>
      )}

      {!open && showHint && (
        <Pressable
          onPress={() => { setHint(false); openBox(); }}
          style={[st.bubble, st.hintBubble, { position: 'absolute', left: 12, bottom: (controlsOn ? (landscape ? 76 : 46) : landscape ? 20 : 10) + bubbles.length * 44, maxWidth: landscape ? 440 : '84%' }]}
          accessibilityRole="button"
        >
          <Text style={st.bubbleText}>
            <Text style={{ fontFamily: F.bold }}>💬 New! </Text>
            {signedIn ? 'Comment on any scene. Others see it when they reach this moment. ' : 'Comment on scenes as you watch. '}
            <Text style={{ color: GOLD, fontFamily: F.bold }}>{signedIn ? 'Tap to comment' : 'Sign in to join in'}</Text>
          </Text>
        </Pressable>
      )}

      {!open && bubbles.length > 0 && (
        <View style={[st.bubbles, { bottom: controlsOn ? (landscape ? 76 : 46) : landscape ? 20 : 10, maxWidth: landscape ? 420 : '78%' }]} pointerEvents="none">
          {bubbles.map((b) => (
            <View key={b.key} style={st.bubble}>
              <Text style={st.bubbleText} numberOfLines={3}>
                <Text style={{ color: GOLD, fontFamily: F.bold }}>{b.mine ? 'You' : b.author} </Text>{b.body}
              </Text>
            </View>
          ))}
        </View>
      )}

      {flash && <View style={[st.flash, { top: sideTop }]} pointerEvents="none"><Text style={st.flashText}>{flash}</Text></View>}

      {open && (
        <View style={[st.box, landscape ? { top: 16, width: 460 } : { top: 6, left: 8, right: 8 }]}>
          <View style={st.boxHead}>
            <Text style={st.boxTitle}>Comment at {clockLabel(at)}</Text>
            <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close"><Text style={{ color: '#fff', fontSize: 22 }}>×</Text></Pressable>
          </View>
          {allowed ? (
            <>
              <TextInput
                autoFocus value={text} onChangeText={setText} maxLength={300}
                placeholder="What do you think of this scene?" placeholderTextColor={colors.faint}
                style={st.input} returnKeyType="send" onSubmitEditing={post}
              />
              {err ? <Text style={st.err}>{err}</Text> : null}
              <View style={st.boxFoot}>
                <Text style={st.hint} numberOfLines={2}>Others see it at {clockLabel(at)}. No spoilers!</Text>
                <Pressable onPress={post} disabled={busy || !text.trim()} style={[st.post, (busy || !text.trim()) && { opacity: 0.5 }]}>
                  <Text style={st.postText}>{busy ? 'Posting…' : 'Post'}</Text>
                </Pressable>
              </View>
            </>
          ) : !open1st ? (
            <Text style={st.err}>You’ve already watched this, so comments are closed for you. Comments are open only during your first time watching, but you can still read everyone’s.</Text>
          ) : (
            <Text style={st.err}>
              You can comment on scenes up to {clockLabel(reached)}, the part you&rsquo;ve watched without skipping. Go back to {clockLabel(reached)} and keep watching to comment further.
            </Text>
          )}
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  tools: { position: 'absolute', right: 12, flexDirection: 'row', gap: 8 },
  btn: { height: 36, minWidth: 36, paddingHorizontal: 8, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  btnSmall: { color: '#fff', fontFamily: F.extrabold, fontSize: 10, letterSpacing: 0.5 },
  bubbles: { position: 'absolute', left: 12, gap: 6 },
  bubble: { backgroundColor: 'rgba(10,10,14,0.8)', borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  hintBubble: { borderLeftColor: colors.accent, backgroundColor: 'rgba(10,10,14,0.9)' },
  bubbleText: { color: '#fff', fontFamily: F.medium, fontSize: 13, lineHeight: 18 },
  flash: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(20,20,24,0.92)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  flashText: { color: '#fff', fontFamily: F.semibold, fontSize: 13 },
  box: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(18,18,24,0.97)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 8 },
  boxHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boxTitle: { color: '#fff', fontFamily: F.bold, fontSize: 14 },
  input: { backgroundColor: colors.surface, color: '#fff', fontFamily: F.regular, fontSize: 14.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  boxFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hint: { flex: 1, color: colors.muted, fontFamily: F.regular, fontSize: 11.5 },
  post: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  postText: { color: '#fff', fontFamily: F.bold, fontSize: 13.5 },
  err: { color: '#ffb4b4', fontFamily: F.medium, fontSize: 13, lineHeight: 18 },
});
