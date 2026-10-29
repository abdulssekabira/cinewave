'use client';

import { completeR2Upload, signR2Parts, startR2Upload } from '@/app/admin/titles/r2-actions';

/**
 * Sends a big film from the phone straight to Cloudflare in 16 MB pieces,
 * 3 at a time. A piece that fails is retried patiently; losing the internet
 * pauses the upload until it's back. If the page is closed, choosing the
 * same file again continues from the pieces already stored.
 */

type Opts = {
  titleId: string;
  episodeId: string | null;
  file: File;
  onProgress: (pct: number) => void;
  onOffline: (offline: boolean) => void;
  signal: { cancelled: boolean };
};

const memoryKey = (o: Pick<Opts, 'titleId' | 'episodeId' | 'file'>) =>
  `gle:upload:${o.titleId}:${o.episodeId ?? 'film'}:${o.file.name}:${o.file.size}:${o.file.lastModified}`;

function remember(key: string, id: string | null) {
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch { /* private mode */ }
}
function recall(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function waitOnline(onOffline: (o: boolean) => void) {
  if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve();
  onOffline(true);
  return new Promise<void>((resolve) => {
    const on = () => { window.removeEventListener('online', on); onOffline(false); resolve(); };
    window.addEventListener('online', on);
  });
}

/** Reads the film's length from the file itself (works for MP4/MOV/WebM). */
export function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const v = document.createElement('video');
      const url = URL.createObjectURL(file);
      const done = (d: number | null) => { URL.revokeObjectURL(url); resolve(d); };
      v.preload = 'metadata';
      v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null);
      v.onerror = () => done(null);
      setTimeout(() => done(null), 15000);
      v.src = url;
    } catch {
      resolve(null);
    }
  });
}

export async function uploadToR2(o: Opts): Promise<void> {
  const key = memoryKey(o);
  const duration = await videoDuration(o.file);
  const start = await startR2Upload(o.titleId, o.episodeId, { name: o.file.name, size: o.file.size, type: o.file.type }, recall(key));
  if (start.error || !start.mediaId || !start.partSize) throw new Error(start.error ?? 'Could not start the upload.');
  const mediaId = start.mediaId;
  remember(key, mediaId);

  const size = start.partSize;
  const total = Math.ceil(o.file.size / size);
  const etags = new Map<number, string>((start.done ?? []).map((p) => [p.n, p.etag]));
  const partBytes = (n: number) => Math.min(size, o.file.size - (n - 1) * size);
  let sent = [...etags.keys()].reduce((a, n) => a + partBytes(n), 0);
  const inFlight = new Map<number, number>();
  const report = () => {
    const live = [...inFlight.values()].reduce((a, b) => a + b, 0);
    o.onProgress(Math.min(99.9, ((sent + live) / o.file.size) * 100));
  };
  report();

  const queue = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !etags.has(n));
  const urls = new Map<number, string>();

  async function urlFor(n: number) {
    if (!urls.has(n)) {
      const batch = queue.filter((x) => !urls.has(x) && x >= n).slice(0, 30);
      if (!batch.includes(n)) batch.unshift(n);
      const r = await signR2Parts(mediaId, batch);
      if (r.error || !r.urls) throw new Error(r.error ?? 'Could not continue the upload.');
      for (const u of r.urls) urls.set(u.n, u.url);
    }
    return urls.get(n)!;
  }

  function putPart(url: string, blob: Blob, n: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      x.upload.onprogress = (e) => { inFlight.set(n, e.loaded); report(); };
      x.onload = () => {
        const etag = x.getResponseHeader('ETag');
        if (x.status >= 200 && x.status < 300 && etag) resolve(etag);
        else reject(new Error(x.status === 403 ? 'expired' : `HTTP ${x.status}`));
      };
      x.onerror = () => reject(new Error('network'));
      x.ontimeout = () => reject(new Error('timeout'));
      x.timeout = 10 * 60 * 1000;
      x.send(blob);
    });
  }

  async function worker() {
    while (queue.length) {
      if (o.signal.cancelled) throw new Error('cancelled');
      const n = queue.shift()!;
      const blob = o.file.slice((n - 1) * size, (n - 1) * size + partBytes(n));
      for (let attempt = 1; ; attempt++) {
        await waitOnline(o.onOffline);
        try {
          const etag = await putPart(await urlFor(n), blob, n);
          etags.set(n, etag);
          inFlight.delete(n);
          sent += blob.size;
          report();
          break;
        } catch (e) {
          inFlight.delete(n);
          if ((e as Error).message === 'expired') urls.delete(n);
          if (attempt >= 40 || o.signal.cancelled) throw new Error('The connection kept failing. Choose the same file again to continue where it stopped.');
          if (!navigator.onLine) o.onOffline(true);
          await sleep(Math.min(30000, 3000 * attempt));
        }
      }
    }
  }

  await Promise.all([worker(), worker(), worker()]);
  o.onOffline(false);
  const parts = [...etags.entries()].map(([n, etag]) => ({ n, etag }));
  const done = await completeR2Upload(o.titleId, o.episodeId, mediaId, parts, duration);
  if (done.error) throw new Error(done.error);
  remember(key, null);
  o.onProgress(100);
}
