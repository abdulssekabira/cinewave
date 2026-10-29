import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths, type DownloadTask } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { getProfile } from '@cinewave/shared';
import { authHeaders, SITE, UA } from './api';
import { supabase } from './supabase';

/**
 * Protected offline downloads.
 *
 * - Files are saved in the app's PRIVATE storage (not the gallery, not
 *   Downloads, not visible to file managers or other apps, excluded from
 *   backups). Uninstalling the app deletes them.
 * - Each file has a licence from GLE Movies tied to this account AND this
 *   phone. It works offline only until it expires (set per film, e.g. 48h);
 *   whenever the phone is online the app renews it. If the subscription
 *   ends, the film's rights end, or this phone is removed from the account,
 *   renewal fails and the file is deleted.
 * - Signing out deletes every download on the phone.
 * - Moving the phone's clock back doesn't extend a licence.
 */

export type Download = {
  id: string; // licence id from the server
  userId: string;
  titleId: string;
  slug: string;
  title: string;
  kind: 'movie' | 'series';
  poster: string | null;
  backdrop: string | null;
  episodeId: string | null;
  episodeLabel: string | null;
  episodeName: string | null;
  file: string;
  bytes: number | null;
  received: number;
  createdAt: number;
  expiresAt: number;
  status: 'downloading' | 'done' | 'failed';
  error?: string;
};

const INDEX = 'gle:dl:index';
const CLOCK = 'gle:dl:clock';
const OWNER = 'gle:dl:owner';
const dir = () => new Directory(Paths.document, 'gle-protected');

let items: Download[] = [];
let loaded = false;
let lastSeen = 0;
let owner: string | null = null;
const listeners = new Set<() => void>();
const tasks = new Map<string, DownloadTask>();

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(now = false) {
  if (saveTimer) clearTimeout(saveTimer);
  const write = () => AsyncStorage.setItem(INDEX, JSON.stringify(items)).catch(() => {});
  if (now) write();
  else saveTimer = setTimeout(write, 800);
}

function update(id: string, patch: Partial<Download>, save = true) {
  items = items.map((d) => (d.id === id ? { ...d, ...patch } : d));
  emit();
  if (save) persist();
}

/** Loads the list once. Downloads cut off by the app closing are marked failed. */
export async function loadDownloads() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(INDEX);
    const list = raw ? (JSON.parse(raw) as Download[]) : [];
    items = list
      .map((d) => (d.status === 'downloading' && !tasks.has(d.id) ? { ...d, status: 'failed' as const, error: 'Download stopped' } : d))
      .filter((d) => d.status !== 'done' || new File(d.file).exists);
    lastSeen = Number((await AsyncStorage.getItem(CLOCK)) ?? 0) || 0;
    owner = (await AsyncStorage.getItem(OWNER)) || null;
  } catch {
    items = [];
  }
  noteClock();
  emit();
}

/** Remembers the latest time seen, so winding the clock back is noticed. */
function noteClock() {
  const now = Date.now();
  if (now > lastSeen) {
    lastSeen = now;
    AsyncStorage.setItem(CLOCK, String(now)).catch(() => {});
  }
}
const clockOk = () => Date.now() >= lastSeen - 10 * 60 * 1000;

export function isPlayable(d: Download) {
  return d.status === 'done' && clockOk() && Date.now() < d.expiresAt;
}

/**
 * The account whose downloads this phone holds. Kept separately from the
 * sign-in session so downloads still open offline after the sign-in token
 * expires. Cleared only by a real sign-out.
 */
export async function setDownloadOwner(id: string | null) {
  await loadDownloads();
  if (owner === id) return;
  owner = id;
  if (id) AsyncStorage.setItem(OWNER, id).catch(() => {});
  else AsyncStorage.removeItem(OWNER).catch(() => {});
  emit();
}

export function useDownloadOwner(): string | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => owner,
  );
}

export function useDownloads(userId: string | null | undefined): Download[] {
  const all = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => items,
  );
  return userId ? all.filter((d) => d.userId === userId) : [];
}

export const findDownload = (id: string) => items.find((d) => d.id === id) ?? null;
export const downloadFor = (userId: string, titleId: string, episodeId: string | null) =>
  items.find((d) => d.userId === userId && d.titleId === titleId && d.episodeId === (episodeId ?? null)) ?? null;

const REASONS: Record<string, string> = {
  sign_in_required: 'Sign in to download.',
  upgrade_required: 'Offline downloads are included with Premium.',
  not_downloadable: 'This title can’t be downloaded. You can still stream it.',
  device_limit: 'This phone isn’t one of your allowed devices. Remove a device first.',
  download_limit: 'You’ve reached the download limit. Delete a download first.',
  no_video: 'This video isn’t ready yet. Check back soon.',
  not_available_in_region: 'This title isn’t available in your country.',
  not_found: 'This title isn’t available.',
};

type Ready = {
  status: 'ready';
  download_id: string;
  expires_at: string;
  url: string;
  bytes: number | null;
  title: { id: string; slug: string; title: string; kind: 'movie' | 'series'; poster_url: string | null; backdrop_url: string | null };
  episode: { id: string; label: string; name: string | null } | null;
};

/** Starts a download. Resolves with a message to show (null = started fine). */
export async function startDownload(userId: string, slug: string, part?: string | null): Promise<string | null> {
  await loadDownloads();
  let body: Ready | { status: 'preparing' } | { status: 'refused'; reason: string };
  try {
    const q = new URLSearchParams({ slug });
    if (part) q.set('part', part);
    const res = await fetch(`${SITE}/api/app/download?${q}`, { headers: { ...(await authHeaders()), 'User-Agent': UA } });
    body = await res.json();
  } catch {
    return 'Could not reach GLE Movies. Check your connection.';
  }
  if (body.status === 'preparing') return 'GLE Movies is preparing this download. Try again in a few minutes.';
  if (body.status !== 'ready') return REASONS[body.reason] ?? 'Could not start the download. Try again.';

  const free = Paths.availableDiskSpace;
  if (body.bytes && free && body.bytes + 200 * 1024 * 1024 > free) {
    return `Not enough space on this phone. This download needs about ${Math.ceil(body.bytes / 1048576)} MB.`;
  }

  const existing = items.find((d) => d.id === body.download_id);
  if (existing?.status === 'downloading') return 'This is already downloading.';
  if (existing?.status === 'done' && new File(existing.file).exists) {
    update(existing.id, { expiresAt: Date.parse(body.expires_at) });
    return 'Already downloaded. Find it in Downloads.';
  }

  const d = dir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  const file = new File(d, `${body.download_id}.mp4`);
  if (file.exists) file.delete();

  const item: Download = {
    id: body.download_id,
    userId,
    titleId: body.title.id,
    slug: body.title.slug,
    title: body.title.title,
    kind: body.title.kind,
    poster: body.title.poster_url,
    backdrop: body.title.backdrop_url,
    episodeId: body.episode?.id ?? null,
    episodeLabel: body.episode?.label ?? null,
    episodeName: body.episode?.name ?? null,
    file: file.uri,
    bytes: body.bytes,
    received: 0,
    createdAt: Date.now(),
    expiresAt: Date.parse(body.expires_at),
    status: 'downloading',
  };
  items = [item, ...items.filter((x) => x.id !== item.id)];
  emit();
  persist(true);

  let lastTick = 0;
  const task = File.createDownloadTask(body.url, file, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      const now = Date.now();
      if (now - lastTick < 700) return;
      lastTick = now;
      update(item.id, { received: bytesWritten, bytes: totalBytes > 0 ? totalBytes : item.bytes }, false);
    },
  });
  tasks.set(item.id, task);
  task
    .downloadAsync()
    .then((f) => {
      if (!f) return;
      update(item.id, { status: 'done', bytes: f.size ?? item.bytes, received: f.size ?? item.received });
      persist(true);
    })
    .catch(() => {
      if (!items.some((x) => x.id === item.id)) return; // deleted meanwhile
      update(item.id, { status: 'failed', error: 'Download stopped. Check your connection and tap Retry.' });
      persist(true);
    })
    .finally(() => tasks.delete(item.id));
  return null;
}

/** Deletes the file and gives the licence back. */
export async function removeDownload(id: string) {
  const t = tasks.get(id);
  if (t) { try { t.cancel(); } catch { /* already finished */ } tasks.delete(id); }
  const d = items.find((x) => x.id === id);
  if (d) { try { const f = new File(d.file); if (f.exists) f.delete(); } catch { /* gone */ } }
  items = items.filter((x) => x.id !== id);
  emit();
  persist(true);
  supabase.rpc('release_download', { d_id: id }).then(() => {}, () => {});
}

/** Retries a failed download (gets a fresh link). */
export function retryDownload(d: Download) {
  return startDownload(d.userId, d.slug, d.episodeId);
}

/**
 * When online: renews this account's licences on this phone and deletes
 * the ones that are no longer allowed. Does nothing when offline.
 */
export async function verifyDownloads(userId: string) {
  await loadDownloads();
  noteClock();
  const mine = items.filter((d) => d.userId === userId);
  // Downloads from another account that signed in on this phone before.
  for (const d of items.filter((x) => x.userId !== userId)) await removeDownload(d.id);
  if (!mine.length) return;
  try {
    const profile = await getProfile(supabase, userId);
    const { data, error } = await supabase.rpc('check_downloads', {
      ids: mine.map((d) => d.id),
      country: profile?.country_code ?? null,
    });
    if (error || !Array.isArray(data)) return; // offline or server busy: keep everything
    for (const r of data as { download_id: string; ok: boolean; expires_at: string | null }[]) {
      if (r.ok && r.expires_at) update(r.download_id, { expiresAt: Date.parse(r.expires_at) });
      else if (!r.ok) await removeDownload(r.download_id);
    }
    persist(true);
  } catch {
    /* offline */
  }
}

/** Signing out removes every download from the phone. */
export async function removeAllDownloads() {
  await loadDownloads();
  for (const [, t] of tasks) { try { t.cancel(); } catch { /* ignore */ } }
  tasks.clear();
  try { const d = dir(); if (d.exists) d.delete(); } catch { /* ignore */ }
  items = [];
  emit();
  persist(true);
}

// ------------------------------------------------------------ helpers

export function sizeLabel(bytes: number | null | undefined) {
  if (!bytes) return '';
  return bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1048576))} MB`;
}

export function expiryLabel(d: Download) {
  if (!clockOk()) return 'Check your phone’s date and time';
  const ms = d.expiresAt - Date.now();
  if (ms <= 0) return 'Expired · go online to renew';
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `Expires in ${Math.floor(h / 24)} days`;
  if (h >= 1) return `Expires in ${h} h`;
  return `Expires in ${Math.max(1, Math.round(ms / 60000))} min`;
}
