'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  banFromChat, CHAT_BADGE, chatColor, chatTime, clearChat, deleteChatMessage, getChat, reportChat,
  sendChat, setChatNotify, subscribeChat, type ChatMessage,
} from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';
import { setWebChatNotify } from './ChatNotifier';

type Props = { initial: ChatMessage[]; userId: string | null; isAdmin: boolean; notify: boolean };

export function ChatRoom({ initial, userId, isAdmin, notify: notifyInit }: Props) {
  const sb = browserClient();
  const [msgs, setMsgs] = useState<ChatMessage[]>(initial);
  const [online, setOnline] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [menu, setMenu] = useState<number | null>(null);
  const [notify, setNotify] = useState(notifyInit);
  const [older, setOlder] = useState(initial.length >= 80);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => subscribeChat(sb, {
    presenceKey: userId ?? undefined,
    onMessage: (m) => setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m].slice(-400))),
    onRemove: (id) => setMsgs((xs) => xs.filter((x) => x.id !== id)),
    onOnline: setOnline,
  }), [sb, userId]);

  // Stay at the bottom unless the viewer scrolled up to read older messages.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  const onScroll = () => {
    const el = list.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setErr(null);
    const r = await sendChat(sb, text, spoiler);
    setBusy(false);
    if (r.error) return setErr(r.error);
    stick.current = true;
    if (r.message) setMsgs((xs) => (xs.some((x) => x.id === r.message!.id) ? xs : [...xs, r.message!]));
    setText(''); setSpoiler(false);
    fetch('/api/chat/notify', { method: 'POST' }).catch(() => {});
  }

  async function loadOlder() {
    const first = msgs[0]?.id;
    if (!first) return;
    const more = await getChat(sb, 80, first);
    stick.current = false;
    setMsgs((xs) => [...more, ...xs]);
    setOlder(more.length >= 80);
  }

  async function toggleNotify() {
    const on = !notify;
    if (on && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission().catch(() => 'denied');
      if (p !== 'granted') return setErr('Your browser blocked notifications. Allow them for glemovies.com in the browser settings, then try again.');
    }
    setNotify(on);
    setWebChatNotify(on);
    const e = await setChatNotify(sb, on);
    if (e) { setNotify(!on); setWebChatNotify(!on); setErr(e); }
  }

  async function clearAll() {
    if (!confirm('Clear the whole chat for everyone? This can’t be undone.')) return;
    const e = await clearChat(sb);
    if (e) setErr(e); else setMsgs([]);
  }

  async function act(m: ChatMessage, what: 'report' | 'delete' | 'ban1' | 'ban7' | 'banall') {
    setMenu(null);
    if (what === 'report') { await reportChat(sb, m.id); return alert('Thanks — the message was reported.'); }
    if (what === 'delete') { const e = await deleteChatMessage(sb, m.id); if (e) setErr(e); else setMsgs((xs) => xs.filter((x) => x.id !== m.id)); return; }
    if (!m.user_id) return;
    const days = what === 'ban1' ? 1 : what === 'ban7' ? 7 : null;
    if (!confirm(`Stop ${m.author} from chatting ${days ? `for ${days} day${days > 1 ? 's' : ''}` : 'for good'}?`)) return;
    const e = await banFromChat(sb, m.user_id, days);
    if (e) setErr(e);
  }

  return (
    <div className="chat-page">
      <div className="chat-head">
        <div>
          <h1>GLE Chat</h1>
          <p>Talk about movies and series with everyone.{online ? <span className="chat-online">{online} online</span> : null}</p>
        </div>
        <div className="chat-tools">
          {userId && (
            <button type="button" className={`chat-pill${notify ? ' on' : ''}`} onClick={toggleNotify} aria-pressed={notify}>
              {notify ? '🔔 Notifications on' : '🔕 Notifications off'}
            </button>
          )}
          {isAdmin && <button type="button" className="chat-pill danger" onClick={clearAll}>Clear chat</button>}
        </div>
      </div>
      <div className="chat-rules">📌 Be respectful · No links or phone numbers · Use 🙈 for spoilers · Long-press or ⋯ to report</div>

      <div className="chat-list" ref={list} onScroll={onScroll} aria-live="polite">
        {older && <button type="button" className="chat-older" onClick={loadOlder}>Load earlier messages</button>}
        {!msgs.length && <p className="chat-empty">No messages yet. Say hello 👋</p>}
        {msgs.map((m) => {
          const mine = m.user_id === userId;
          const b = m.badge ? CHAT_BADGE[m.badge] : null;
          const hidden = m.spoiler && !shown.has(m.id);
          return (
            <div key={m.id} className={`chat-msg${mine ? ' me' : ''}`}>
              <div className="chat-av" style={{ background: m.badge === 'admin' ? 'var(--accent)' : chatColor(m.author) }}>{m.author[0]?.toUpperCase()}</div>
              <div className="chat-col">
                <div className="chat-name">
                  {mine ? 'You' : m.author}
                  {b && <span className="chat-badge" style={{ background: b.bg, color: b.fg }}>{b.label}</span>}
                  <small>{chatTime(m.created_at)}</small>
                </div>
                <div className="chat-bubble-row">
                  <button
                    type="button"
                    className={`chat-bubble${hidden ? ' spoiler' : ''}`}
                    onClick={() => hidden && setShown((s) => new Set(s).add(m.id))}
                    tabIndex={hidden ? 0 : -1}
                  >
                    {hidden ? '⚠ Spoiler · tap to show' : m.body}
                  </button>
                  {userId && (!mine || isAdmin) && (
                    <span className="chat-more">
                      <button type="button" aria-label="Message options" onClick={() => setMenu(menu === m.id ? null : m.id)}>⋯</button>
                      {menu === m.id && (
                        <span className="chat-menu" role="menu">
                          {!mine && <button type="button" onClick={() => act(m, 'report')}>Report</button>}
                          {isAdmin && <button type="button" onClick={() => act(m, 'delete')}>Delete message</button>}
                          {isAdmin && !mine && m.user_id && (
                            <>
                              <button type="button" onClick={() => act(m, 'ban1')}>Mute 1 day</button>
                              <button type="button" onClick={() => act(m, 'ban7')}>Mute 7 days</button>
                              <button type="button" onClick={() => act(m, 'banall')}>Ban from chat</button>
                            </>
                          )}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {err && <div className="form-msg error chat-err" role="alert" onClick={() => setErr(null)}>{err}</div>}
      {userId ? (
        <form className="chat-input" onSubmit={send}>
          <button type="button" className={`chat-icon${spoiler ? ' on' : ''}`} onClick={() => setSpoiler((s) => !s)} title="Mark as spoiler" aria-pressed={spoiler}>🙈</button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder={spoiler ? 'Spoiler message (hidden until tapped)…' : 'Message GLE Chat…'}
            aria-label="Message"
          />
          <button className="chat-icon send" disabled={busy || !text.trim()} aria-label="Send">➤</button>
        </form>
      ) : (
        <div className="chat-signin">
          <Link href="/login?mode=signup&next=/chat" className="btn btn-accent">Create free account to chat</Link>
          <Link href="/login?next=/chat">Sign in</Link>
        </div>
      )}
    </div>
  );
}
