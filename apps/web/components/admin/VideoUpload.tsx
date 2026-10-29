'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshVideo, startVideoUpload, type VideoState } from '@/app/admin/titles/video-actions';

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
export function VideoUpload({ titleId, episodeId, initial, connected, compact }: { titleId: string; episodeId?: string; initial: VideoState; connected: boolean; compact?: boolean }) {
  const [state, setState] = useState<VideoState>(initial);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const poll = useCallback(async () => {
    const s = await refreshVideo(titleId, episodeId);
    setState(s);
    if (s.error && s.status !== 'errored') setError(s.error);
    return s;
  }, [titleId, episodeId]);

  useEffect(() => {
    if (progress !== null) return;
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
    const start = await startVideoUpload(titleId, episodeId);
    if (!start.url) {
      setError(start.error ?? 'Could not start the upload.');
      return;
    }
    setProgress(0);
    try {
      const { createUpload } = await import('@mux/upchunk');
      await new Promise<void>((resolve, reject) => {
        const up = createUpload({ endpoint: start.url!, file, chunkSize: 8192 }); // 8 MB pieces
        up.on('progress', (e) => setProgress(Math.round(e.detail as number)));
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
        <span className={`a-badge ${tone}`}>{busy ? `Uploading ${progress}%` : LABEL[state.status]}</span>
        {state.status === 'ready' && state.duration ? (
          <span className="a-muted"> · {Math.round(state.duration / 60)} min</span>
        ) : null}
      </p>

      {busy && (
        <div className="a-progress" aria-label="Upload progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
      {busy && <p className="a-muted">Keep this page open until the upload reaches 100%.</p>}
      {state.status === 'errored' && state.error && <div className="form-msg error">{state.error}</div>}
      {error && <div className="form-msg error">{error}</div>}

      {!connected ? (
        <p className="a-muted">Video isn’t connected yet. Add the Mux keys in Vercel to turn on uploads.</p>
      ) : (
        <label className={`btn ${state.status === 'ready' ? 'btn-gray' : 'btn-red'} btn-small`} aria-disabled={busy}>
          {state.status === 'ready' ? 'Replace video' : 'Upload video'}
          <input
            ref={input}
            type="file"
            accept="video/*"
            hidden
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
      )}
      {!compact && <p className="a-muted" style={{ marginTop: 12, marginBottom: 0 }}>
        Large films can take a while on mobile data. Wi-Fi is best. Videos are protected: only viewers allowed by
        the film’s plan and rights can play them.
      </p>}
    </div>
  );
}
