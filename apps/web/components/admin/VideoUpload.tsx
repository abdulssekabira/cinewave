'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshVideo, startVideoUpload, type VideoState } from '@/app/admin/titles/video-actions';
import { uploadToR2 } from '@/lib/r2-upload';

const LABEL: Record<VideoState['status'], string> = {
  none: 'No video yet',
  pending: 'Waiting for the file…',
  processing: 'Mux is preparing the video (usually a few minutes)…',
  ready: 'Ready to play',
  errored: 'Something went wrong',
};

/**
 * Sends the film straight from this phone/computer to Mux in small chunks
 * (so a dropped connection only retries one piece), then watches Mux until
 * the video is ready.
 */
export function VideoUpload({ titleId, episodeId, initial, connected, compact, storage = 'mux' }: { titleId: string; episodeId?: string; initial: VideoState; connected: boolean; compact?: boolean; storage?: 'mux' | 'r2' }) {
  const r2 = storage === 'r2';
  const [state, setState] = useState<VideoState>(initial);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // While uploading: keep the screen on, and warn before leaving the page.
  useEffect(() => {
    if (progress === null) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const getLock = () => { nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {}); };
    getLock();
    const onVisible = () => { if (document.visibilityState === 'visible') getLock(); };
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeunload', onLeave);
      lock?.release().catch(() => {});
    };
  }, [progress === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const poll = useCallback(async () => {
    const s = await refreshVideo(titleId, episodeId);
    setState(s);
    if (s.error && s.status !== 'errored') setError(s.error);
    return s;
  }, [titleId, episodeId]);

  useEffect(() => {
    if (progress !== null || r2) return;
    if (state.status !== 'pending' && state.status !== 'processing') return;
    const t = window.setTimeout(poll, 6000);
    return () => window.clearTimeout(t);
  }, [state, progress, poll]);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|mkv|m4v|webm|avi)$/i.test(file.name)) {
      setError('Choose a video file (MP4 or MOV works best).');
      return;
    }
    if (r2) {
      setProgress(0);
      try {
        await uploadToR2({
          titleId,
          episodeId: episodeId ?? null,
          file,
          onProgress: (p) => setProgress(Math.floor(p)),
          onOffline: setOffline,
          signal: { cancelled: false },
        });
        setProgress(null);
        const s = await refreshVideo(titleId, episodeId);
        setState(s);
      } catch (e) {
        setProgress(null);
        setError(e instanceof Error ? e.message : 'Upload failed.');
        setState(await refreshVideo(titleId, episodeId));
      } finally {
        setOffline(false);
        if (input.current) input.current.value = '';
      }
      return;
    }
    const start = await startVideoUpload(titleId, episodeId);
    if (!start.url) {
      setError(start.error ?? 'Could not start the upload.');
      return;
    }
    setProgress(0);
    try {
      const { createUpload } = await import('@mux/upchunk');
      await new Promise<void>((resolve, reject) => {
        // 8 MB pieces. A piece that fails is retried patiently (bad network,
        // power cut on the router); losing the connection pauses the upload
        // and it continues by itself when the internet is back.
        const up = createUpload({ endpoint: start.url!, file, chunkSize: 8192, attempts: 30, delayBeforeAttempt: 10 });
        up.on('progress', (e) => { setProgress(Math.floor(e.detail as number)); setOffline(false); });
        up.on('offline', () => setOffline(true));
        up.on('online', () => setOffline(false));
        up.on('error', (e) => reject(new Error((e.detail as { message?: string })?.message ?? 'Upload failed')));
        up.on('success', () => resolve());
      });
      setProgress(null);
      setState({ status: 'processing' });
      poll();
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? `${e.message}. Check your connection and try again.` : 'Upload failed.');
      poll();
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  const busy = progress !== null;
  const tone = state.status === 'ready' ? 'ok' : state.status === 'errored' ? 'warn' : 'muted';

  return (
    <div>
      <p style={{ margin: '0 0 12px' }}>
        <span className={`a-badge ${tone}`}>
          {busy
            ? `Uploading ${progress}%`
            : r2 && state.status === 'pending'
              ? 'Upload not finished'
              : r2 && state.status === 'processing'
                ? 'Uploaded · waiting for conversion'
                : LABEL[state.status]}
        </span>
        {state.status === 'ready' && state.duration ? (
          <span className="a-muted"> · {Math.round(state.duration / 60)} min</span>
        ) : null}
      </p>

      {busy && (
        <div className="a-progress" aria-label="Upload progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
      {busy && offline && <div className="form-msg error">No internet. The upload is paused and will continue by itself when you’re back online. Keep this page open.</div>}
      {busy && <p className="a-muted">Keep this page open and the phone plugged in until the upload reaches 100%. The screen stays on by itself.</p>}
      {state.status === 'errored' && state.error && <div className="form-msg error">{state.error}</div>}
      {r2 && !busy && state.status === 'pending' && (
        <p className="a-muted">Choose the same file again and the upload continues from where it stopped.</p>
      )}
      {error && <div className="form-msg error">{error}</div>}

      {!connected ? (
        <p className="a-muted">Video storage isn’t connected yet. Add the Cloudflare R2 keys in Vercel to turn on uploads.</p>
      ) : (
        <label className={`btn ${state.status === 'ready' ? 'btn-gray' : 'btn-red'} btn-small`} aria-disabled={busy}>
          {state.status === 'ready' || state.status === 'processing' ? 'Replace video' : state.status === 'pending' && r2 ? 'Continue upload' : 'Upload video'}
          <input
            ref={input}
            type="file"
            accept="video/*,.mp4,.m4v,.mov,.mkv,.avi,.webm"
            hidden
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
      )}
      {!compact && <p className="a-muted" style={{ marginTop: 12, marginBottom: 0 }}>
        {r2
          ? 'MP4 works best. MKV plays on Android straight away. Large films can take a while: use Wi‑Fi and keep the phone plugged in. If it stops, choose the same file again to continue. Videos are protected: only viewers allowed by the film’s plan and rights can play them.'
          : 'Large films can take a while on mobile data. Wi-Fi is best. Videos are protected: only viewers allowed by the film’s plan and rights can play them.'}
      </p>}
    </div>
  );
}
