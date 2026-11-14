import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  clockLabel, deleteMyTimedComment, getTimedReplies, postTimedComment, reportTimedComment, timeAgo,
  type TimedComment, type TimedReply,
} from '@cinewave/shared';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getTimed, refreshTimed, useTimed } from '@/lib/timedStore';
import { colors, F, radius } from '@/lib/theme';

const GOLD = '#f5c518';

/** Under the small player: comments up to where you've watched, newest scene first, with replies. */
export function TimedCommentList() {
  const { session } = useAuth();
  const signedIn = Boolean(session);
  const maxTime = useTimed((s) => s.maxTime);
  const reached = useTimed((s) => s.reached);
  const comments = useTimed((s) => s.comments);
  const visible = comments.filter((c) => c.at_seconds <= maxTime + 1).slice().reverse();

  return (
    <View style={st.wrap}>
      <Text style={st.h}>Scene comments{visible.length ? `  ·  ${visible.length}` : ''}</Text>
      <Text style={st.note}>
        Comments appear as you reach each moment, so nothing is spoiled.{' '}
        {signedIn ? 'Tap the screen, then 💬 to comment on the scene you’re watching.' : ''}
      </Text>
      {!signedIn && (
        <Pressable onPress={() => router.push('/login')}><Text style={st.note}><Text style={st.link}>Sign in</Text> to comment and reply.</Text></Pressable>
      )}
      {signedIn && reached + 30 < maxTime && (
        <Text style={st.note}>You can comment and reply up to {clockLabel(reached)}, the part you’ve watched without skipping.</Text>
      )}
      {visible.length === 0
        ? <Text style={st.note}>No comments up to this point yet.</Text>
        : visible.map((c) => <Item key={c.id} c={c} signedIn={signedIn} canReply={signedIn && c.at_seconds <= reached + 5} />)}
    </View>
  );
}

function Item({ c, signedIn, canReply }: { c: TimedComment; signedIn: boolean; canReply: boolean }) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<TimedReply[] | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  async function load() { setReplies(await getTimedReplies(supabase, c.id).catch(() => [])); }
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && replies === null) load();
  }
  async function reply() {
    if (!text.trim()) return;
    setBusy(true);
    const s = getTimed();
    const r = await postTimedComment(supabase, s.titleId!, s.episodeId, c.at_seconds, text, c.id);
    setBusy(false);
    if (r) { setErr(r); return; }
    setText(''); setErr(null);
    await load();
    refreshTimed();
  }
  function remove(id: string, isReply: boolean) {
    Alert.alert('Delete your comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMyTimedComment(supabase, id); if (isReply) load(); else refreshTimed(); } },
    ]);
  }
  async function report(id: string) {
    await reportTimedComment(supabase, id);
    setReported((x) => new Set(x).add(id));
  }
  const count = replies?.length ?? c.replies;

  return (
    <View style={[st.item, c.mine && { borderColor: colors.accent }]}>
      <View style={st.head}>
        <Text style={st.at}>{clockLabel(c.at_seconds)}</Text>
        <Text style={st.author}>{c.mine ? 'You' : c.author}</Text>
        <Text style={st.date}>{timeAgo(c.created_at)}</Text>
      </View>
      <Text style={st.body}>{c.body}</Text>
      <View style={st.tools}>
        {(open || count > 0 || canReply) && (
          <Pressable onPress={toggle} hitSlop={8}><Text style={st.tool}>{open ? 'Hide replies' : count ? `${count} repl${count === 1 ? 'y' : 'ies'}` : 'Reply'}</Text></Pressable>
        )}
        {c.mine
          ? <Pressable onPress={() => remove(c.id, false)} hitSlop={8}><Text style={st.tool}>Delete</Text></Pressable>
          : signedIn && (reported.has(c.id)
            ? <Text style={st.tool}>Reported</Text>
            : <Pressable onPress={() => report(c.id)} hitSlop={8}><Text style={st.tool}>Report</Text></Pressable>)}
      </View>
      {open && (
        <View style={st.thread}>
          {replies === null ? <Text style={st.note}>Loading…</Text> : replies.map((r) => (
            <View key={r.id} style={{ marginBottom: 8 }}>
              <View style={st.head}><Text style={st.author}>{r.mine ? 'You' : r.author}</Text><Text style={st.date}>{timeAgo(r.created_at)}</Text></View>
              <Text style={[st.body, { marginTop: 2 }]}>{r.body}</Text>
              <View style={st.tools}>
                {r.mine
                  ? <Pressable onPress={() => remove(r.id, true)} hitSlop={8}><Text style={st.tool}>Delete</Text></Pressable>
                  : signedIn && (reported.has(r.id)
                    ? <Text style={st.tool}>Reported</Text>
                    : <Pressable onPress={() => report(r.id)} hitSlop={8}><Text style={st.tool}>Report</Text></Pressable>)}
              </View>
            </View>
          ))}
          {canReply ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput value={text} onChangeText={setText} maxLength={300} placeholder="Write a reply…" placeholderTextColor={colors.faint} style={st.input} returnKeyType="send" onSubmitEditing={reply} />
              <Pressable onPress={reply} disabled={busy || !text.trim()} style={[st.send, (busy || !text.trim()) && { opacity: 0.5 }]}><Text style={st.sendText}>{busy ? '…' : 'Reply'}</Text></Pressable>
            </View>
          ) : signedIn ? (
            <Text style={st.note}>Watch up to {clockLabel(c.at_seconds)} without skipping to reply.</Text>
          ) : null}
          {err ? <Text style={st.err}>{err}</Text> : null}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: 22 },
  h: { color: colors.text, fontFamily: F.bold, fontSize: 17, marginBottom: 6 },
  note: { color: colors.muted, fontFamily: F.regular, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  link: { color: colors.text, textDecorationLine: 'underline' },
  item: { backgroundColor: colors.raised, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  at: { color: GOLD, backgroundColor: 'rgba(245,197,24,0.15)', fontFamily: F.extrabold, fontSize: 11.5, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, overflow: 'hidden' },
  author: { color: colors.text, fontFamily: F.bold, fontSize: 13.5 },
  date: { color: colors.faint, fontFamily: F.regular, fontSize: 11.5 },
  body: { color: colors.text, fontFamily: F.regular, fontSize: 14, lineHeight: 20, marginTop: 6 },
  tools: { flexDirection: 'row', gap: 16, marginTop: 6 },
  tool: { color: colors.muted, fontFamily: F.semibold, fontSize: 12.5 },
  thread: { marginTop: 10, marginLeft: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.line },
  input: { flex: 1, backgroundColor: colors.surface, color: '#fff', fontFamily: F.regular, fontSize: 14, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  send: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  sendText: { color: '#fff', fontFamily: F.bold, fontSize: 13 },
  err: { color: '#ffb4b4', fontFamily: F.medium, fontSize: 12.5, marginTop: 6 },
});
