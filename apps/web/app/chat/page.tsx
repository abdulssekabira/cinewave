import type { Metadata } from 'next';
import { getChat, getChatNotify } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';
import { ChatRoom } from '@/components/ChatRoom';

export const metadata: Metadata = { title: 'Chat' };
export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const { sb, user } = await getUser();
  const [initial, admin, notify] = await Promise.all([
    getChat(sb).catch(() => []),
    user ? sb.rpc('has_role', { r: 'admin' }).then((r) => Boolean(r.data)) : Promise.resolve(false),
    user ? getChatNotify(sb, user.id).catch(() => false) : Promise.resolve(false),
  ]);
  return <ChatRoom initial={initial} userId={user?.id ?? null} isAdmin={admin} notify={notify} />;
}
