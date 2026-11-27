import { NextResponse, type NextRequest } from 'next/server';
import { bearerClient } from '@/lib/supabase/bearer';
import { getUser } from '@/lib/supabase/server';
import { serverSecret } from '@/lib/server-secret';

/**
 * After someone sends a chat message: push "New messages in GLE Chat" to the
 * phones of viewers who switched chat notifications on. The database picks
 * the phones and limits each one to one notification every 15 minutes.
 */
export async function POST(req: NextRequest) {
  // Website: signed-in cookie. App: Authorization: Bearer <token>.
  const { sb, user } = req.headers.get('authorization') ? await bearerClient(req) : await getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Only right after this person really sent a message.
  const { data: recent } = await sb.from('chat_messages').select('author, body, spoiler')
    .eq('user_id', user.id).is('deleted_at', null)
    .gt('created_at', new Date(Date.now() - 20_000).toISOString())
    .order('id', { ascending: false }).limit(1).maybeSingle();
  const secret = serverSecret();
  if (!recent || !secret) return NextResponse.json({ ok: true, sent: 0 });

  const { data: rows, error } = await sb.rpc('chat_push_targets', { s: secret, p_sender: user.id });
  if (error || !rows?.length) return NextResponse.json({ ok: true, sent: 0 });

  const body = recent.spoiler ? `${recent.author}: (spoiler)` : `${recent.author}: ${String(recent.body).slice(0, 100)}`;
  const messages = (rows as { token: string }[]).map((r) => ({
    to: r.token,
    title: 'New messages in GLE Chat',
    body,
    sound: 'default',
    channelId: 'chat',
    data: { url: '/chat' },
  }));
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true, sent: messages.length });
}
