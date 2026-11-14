import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  deleteMyReview, getReviewSummary, getReviews, reportReview, saveReview, timeAgo,
  type Review, type ReviewSummary,
} from '@cinewave/shared';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';

const PAGE = 10;
const GOLD = '#f5c518';

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }} accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name="star" size={size} color={n <= Math.round(value) ? GOLD : 'rgba(255,255,255,0.2)'} />
      ))}
    </View>
  );
}

/** Viewer reviews: average + bars, a form for viewers who have watched it, and the list. */
export function Reviews({ titleId }: { titleId: string }) {
  const { session } = useAuth();
  const signedIn = Boolean(session);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [list, setList] = useState<Review[]>([]);
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([getReviewSummary(supabase, titleId), getReviews(supabase, titleId, 0, PAGE)]);
    setSummary(s);
    setList(l);
    setMore(l.length === PAGE);
    const mine = l.find((r) => r.mine);
    setStars(mine?.stars ?? 0);
    setText(mine?.body ?? '');
  }, [titleId]);
  useEffect(() => { load().catch(() => {}); }, [load, session?.user.id]);

  // Watching on the same page: once they've seen a minute, the form appears.
  const waiting = Boolean(summary && !summary.canReview && signedIn);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { getReviewSummary(supabase, titleId).then((x) => { if (x.canReview) setSummary(x); }).catch(() => {}); }, 45000);
    return () => clearInterval(t);
  }, [waiting, titleId]);

  const mine = list.find((r) => r.mine) ?? null;

  async function submit() {
    if (!stars) { setMsg({ error: 'Tap the stars to choose your rating.' }); return; }
    setBusy(true);
    const err = await saveReview(supabase, titleId, stars, text);
    setBusy(false);
    if (err) { setMsg({ error: err }); return; }
    setMsg({ ok: mine ? 'Your review was updated.' : 'Thanks! Your review is posted.' });
    setEditing(false);
    load().catch(() => {});
  }

  function remove() {
    Alert.alert('Delete your review?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteMyReview(supabase, titleId).catch(() => {});
          setStars(0); setText(''); setMsg({ ok: 'Your review was deleted.' });
          load().catch(() => {});
        },
      },
    ]);
  }

  async function report(id: string) {
    await reportReview(supabase, id).catch(() => {});
    setReported((s) => new Set(s).add(id));
  }

  async function loadMore() {
    const l = await getReviews(supabase, titleId, list.length, PAGE).catch(() => []);
    setList((x) => [...x, ...l]);
    setMore(l.length === PAGE);
  }

  if (!summary) return null;
  const max = Math.max(1, ...summary.counts);
  const showForm = summary.canReview && (!mine || editing);

  return (
    <View style={s.wrap}>
      <Text style={s.h}>Reviews{summary.total > 0 ? `  ·  ${summary.total}` : ''}</Text>

      {summary.total > 0 && (
        <View style={s.summary}>
          <View style={s.avg}>
            <Text style={s.avgNum}>{summary.average?.toFixed(1)}</Text>
            <Stars value={summary.average ?? 0} size={15} />
            <Text style={s.small}>{summary.total} review{summary.total === 1 ? '' : 's'}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            {[5, 4, 3, 2, 1].map((n) => (
              <View key={n} style={s.barRow}>
                <Text style={s.barLabel}>{n}★</Text>
                <View style={s.barTrack}><View style={[s.barFill, { width: `${(summary.counts[n - 1] / max) * 100}%` }]} /></View>
                <Text style={s.barNum}>{summary.counts[n - 1]}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {msg.error ? <Text style={[s.msg, { color: colors.danger }]}>{msg.error}</Text> : null}
      {msg.ok ? <Text style={[s.msg, { color: colors.ok }]}>{msg.ok}</Text> : null}

      {showForm ? (
        <View style={s.form}>
          <Text style={s.formLabel}>{mine ? 'Change your rating' : 'Rate it'}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => { setStars(n); setMsg({}); }} hitSlop={6} accessibilityRole="radio" accessibilityState={{ checked: stars === n }} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
                <Ionicons name="star" size={34} color={n <= stars ? GOLD : 'rgba(255,255,255,0.22)'} />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={text} onChangeText={setText} maxLength={1000} multiline
            placeholder="What did you think? (optional)" placeholderTextColor={colors.faint}
            style={s.input}
          />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <Button label={busy ? 'Posting…' : mine ? 'Save' : 'Post review'} onPress={submit} disabled={busy} style={{ flex: 1 }} />
            {editing ? <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} /> : null}
          </View>
        </View>
      ) : !signedIn ? (
        <Pressable onPress={() => router.push('/login')}><Text style={s.note}><Text style={{ color: colors.text, textDecorationLine: 'underline' }}>Sign in</Text> to rate and review after watching.</Text></Pressable>
      ) : !summary.canReview ? (
        <Text style={s.note}>Watch it first, then come back to rate it and share your view.</Text>
      ) : null}

      {list.length === 0 ? (
        <Text style={s.note}>No reviews yet.{summary.canReview ? ' Be the first!' : ''}</Text>
      ) : (
        list.map((r) => (
          <View key={r.id} style={[s.item, r.mine && { borderColor: colors.accent }]}>
            <View style={s.head}>
              <View style={s.avatar}><Text style={s.avatarText}>{r.author.slice(0, 1).toUpperCase()}</Text></View>
              <Text style={s.author}>{r.mine ? 'You' : r.author}</Text>
              <Stars value={r.stars} size={12} />
              <Text style={s.date}>{timeAgo(r.created_at)}{r.updated_at !== r.created_at ? ' · edited' : ''}</Text>
            </View>
            {r.body ? <Text style={s.body}>{r.body}</Text> : null}
            <View style={s.tools}>
              {r.mine ? (
                <>
                  <Pressable onPress={() => { setEditing(true); setMsg({}); }} hitSlop={8}><Text style={s.tool}>Edit</Text></Pressable>
                  <Pressable onPress={remove} hitSlop={8}><Text style={s.tool}>Delete</Text></Pressable>
                </>
              ) : signedIn ? (
                reported.has(r.id)
                  ? <Text style={s.tool}>Reported. Thank you.</Text>
                  : <Pressable onPress={() => report(r.id)} hitSlop={8}><Text style={s.tool}>Report</Text></Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
      {more ? <Button label="Show more reviews" variant="ghost" onPress={loadMore} style={{ marginTop: 4 }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: 22 },
  h: { color: colors.text, fontFamily: F.bold, fontSize: 17, marginBottom: 10 },
  summary: { flexDirection: 'row', gap: 18, alignItems: 'center', marginBottom: 14 },
  avg: { alignItems: 'center', gap: 2, minWidth: 86 },
  avgNum: { color: colors.text, fontFamily: F.extrabold, fontSize: 36, lineHeight: 40 },
  small: { color: colors.muted, fontFamily: F.medium, fontSize: 11.5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel: { color: colors.muted, fontFamily: F.medium, fontSize: 11, width: 22 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: GOLD, borderRadius: 3 },
  barNum: { color: colors.muted, fontFamily: F.medium, fontSize: 11, width: 22, textAlign: 'right' },
  msg: { fontFamily: F.semibold, fontSize: 13.5, marginBottom: 8 },
  form: { backgroundColor: colors.raised, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.line, marginBottom: 14 },
  formLabel: { color: colors.text, fontFamily: F.bold, fontSize: 14 },
  input: { minHeight: 80, color: colors.text, fontFamily: F.regular, fontSize: 14.5, backgroundColor: colors.surface, borderRadius: 10, padding: 10, textAlignVertical: 'top' },
  note: { color: colors.muted, fontFamily: F.regular, fontSize: 13.5, marginBottom: 12, lineHeight: 19 },
  item: { backgroundColor: colors.raised, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: F.extrabold, fontSize: 12 },
  author: { color: colors.text, fontFamily: F.bold, fontSize: 13.5 },
  date: { color: colors.faint, fontFamily: F.regular, fontSize: 11.5 },
  body: { color: colors.text, fontFamily: F.regular, fontSize: 14, lineHeight: 20, marginTop: 7 },
  tools: { flexDirection: 'row', gap: 16, marginTop: 6 },
  tool: { color: colors.muted, fontFamily: F.semibold, fontSize: 12.5 },
});
