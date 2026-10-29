'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatRuntime, genreLabel, posterPalette, ratingLabel, type CatalogTitle } from '@cinewave/shared';
import { saveWatchProgress } from '@/app/watch/[slug]/actions';
import { ExpandIcon, MuteIcon, PauseIcon, PlayIcon, SettingsIcon, StarIcon, VolumeIcon } from './Icons';

function clock(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

type Saved = { pos: number; dur: number; at: number };
const KEY = (id: string) => `gle:pos:${id}`;
function readLocal(id: string): Saved | null {
  try {
    const raw = localStorage.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function writeLocal(id: string, v: Saved) {
  try { localStorage.setItem(KEY(id), JSON.stringify(v)); } catch { /* storage full or blocked */ }
}

/**
 * Player. `src` is a short-lived signed stream URL.
 *
 * Resume: the position is saved to the account every 5 seconds while
 * playing (and on pause, leaving or switching apps), and also kept on the
 * phone itself, so a lost connection or a power cut costs a few seconds at
 * most. Next time, the viewer is offered "Resume from …" or "Start over".
 * If the connection drops mid-film, the player keeps retrying and carries
 * on from the same scene when the network is back.
 */
export function VideoPlayer({
  title,
  src,
  startAt = 0,
  startAtUpdated = null,
  signedIn,
}: {
  title: CatalogTitle;
  src?: string | null;
  startAt?: number;
  startAtUpdated?: string | null;
  signedIn: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const lastSaved = useRef(0);
  const lastLocal = useRef(0);
  const pending = useRef(false);
  const target = useRef<number | null>(null);
  const wasPlaying = useRef(false);
  const ready = useRef<Promise<void> | null>(null);
  const hlsRef = useRef<{ startLoad(pos?: number): void } | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState((title.runtime_minutes ?? 0) * 60);
  const [idle, setIdle] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);

  // Pick the most recent saved spot: this account's (any device) or this phone's own copy.
  useEffect(() => {
    const local = readLocal(title.id);
    const serverAt = startAtUpdated ? Date.parse(startAtUpdated) : 0;
    let pos = startAt;
    if (local && local.at > serverAt + 5000 && !(local.dur && local.pos / local.dur > 0.92)) pos = local.pos;
    if (pos > 30) setResumeAt(pos);
  }, [title.id, startAt, startAtUpdated]);

  const save = useCallback(
    (force = false) => {
      const v = video.current;
      if (!v || !src || !(v.currentTime > 0)) return;
      const pos = v.currentTime;
      const dur = Number.isFinite(v.duration) ? v.duration : 0;
      if (force || Math.abs(pos - lastLocal.current) >= 2) {
        lastLocal.current = pos;
        writeLocal(title.id, { pos, dur, at: Date.now() });
      }
      if (!signedIn) return;
      if (!force && !pending.current && Math.abs(pos - lastSaved.current) < 5) return;
      lastSaved.current = pos;
      saveWatchProgress(title.id, pos, dur || undefined)
        .then(() => { pending.current = false; })
        .catch(() => { pending.current = true; });
    },
    [signedIn, src, title.id],
  );

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 6000);
  };

  const startFrom = (pos: number) => {
    const v = video.current;
    setResumeAt(null);
    if (!v || !src) return;
    target.current = pos;
    if (v.readyState >= 1) {
      v.currentTime = pos;
      target.current = null;
    }
    setTime(pos);
    Promise.resolve(ready.current).then(() => v.play()).catch(() => {});
  };

  const toggle = useCallback(() => {
    const v = video.current;
    if (!src || !v) {
      flash('This film’s video hasn’t been uploaded yet. Check back soon.');
      return;
    }
    if (resumeAt !== null) {
      startFrom(resumeAt);
      return;
    }
    if (v.paused) {
      Promise.resolve(ready.current)
        .then(() => v.play())
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          flash(`Playback failed${e instanceof Error && e.name ? ` (${e.name})` : ''}. Check your connection and try again.`);
        });
    } else v.pause();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, resumeAt]);



  const seekTo = (clientX: number) => {
    const el = seekRef.current;
    if (!el || !duration) return;
    const r = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration;
    if (video.current && src) video.current.currentTime = t;
    setTime(t);
  };

  const fullscreen = () => {
    const el = wrap.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen();
    else (video.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.(); // iPhone
  };

  // Hide controls after 3s of no movement while playing.
  useEffect(() => {
    if (!playing) {
      setIdle(false);
      return;
    }
    let t = window.setTimeout(() => setIdle(true), 3000);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 3000);
    };
    const el = wrap.current;
    el?.addEventListener('mousemove', wake);
    el?.addEventListener('touchstart', wake);
    return () => {
      window.clearTimeout(t);
      el?.removeEventListener('mousemove', wake);
      el?.removeEventListener('touchstart', wake);
    };
  }, [playing]);

  // Keyboard: space/k play, ←/→ seek 10s, m mute, f fullscreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      const v = video.current;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight' && v && src) v.currentTime += 10;
      else if (e.key === 'ArrowLeft' && v && src) v.currentTime -= 10;
      else if (e.key === 'm' && v) { v.muted = !v.muted; setMuted(v.muted); }
      else if (e.key === 'f') fullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, src]);

  // Attach the stream. hls.js wherever the browser supports it (Android,
  // desktop); native HLS on iPhone/Safari where hls.js isn't available.
  useEffect(() => {
    const v = video.current;
    if (!v || !src) return;
    let hls: { destroy(): void } | null = null;
    let cancelled = false;
    ready.current = import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!src.includes('.m3u8') || !Hls.isSupported()) {
        v.src = src;
        return;
      }
      const h = new Hls({
        capLevelToPlayerSize: true,
        // Patient with slow or patchy mobile data.
        fragLoadPolicy: { default: { maxTimeToFirstByteMs: 15000, maxLoadTimeMs: 60000, timeoutRetry: { maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 8000 }, errorRetry: { maxNumRetry: 8, retryDelayMs: 1000, maxRetryDelayMs: 8000 } } },
      });
      let retry: number | undefined;
      h.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && d.response?.code !== 403) {
          // Connection lost: keep the spot and keep trying until it's back.
          setOffline(true);
          window.clearTimeout(retry);
          retry = window.setTimeout(() => h.startLoad(v.currentTime || -1), 4000);
          return;
        }
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR) { h.recoverMediaError(); return; }
        const code = d.response?.code ? ` (${d.response.code})` : '';
        flash(d.response?.code === 403
          ? 'This viewing link has expired. Refresh the page to carry on from where you stopped.'
          : `This video could not be loaded: ${d.details}${code}`);
      });
      h.on(Hls.Events.FRAG_LOADED, () => setOffline(false));
      h.loadSource(src);
      h.attachMedia(v);
      hls = h;
      hlsRef.current = h;
    }).catch(() => { if (!cancelled) v.src = src; });
    return () => { cancelled = true; hls?.destroy(); hlsRef.current = null; };
  }, [src]);

  // Back online: resume loading from the same scene and send any unsaved position.
  useEffect(() => {
    const onOnline = () => {
      const v = video.current;
      if (pending.current) save(true);
      if (!v || !src) return;
      if (hlsRef.current) hlsRef.current.startLoad(v.currentTime || -1);
      else if (v.error) {
        const pos = v.currentTime;
        v.load();
        target.current = pos;
        if (wasPlaying.current) v.play().catch(() => {});
      }
      setOffline(false);
    };
    const onOffline = () => { save(true); setOffline(true); };
    const onHide = () => { if (document.visibilityState === 'hidden') save(true); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [save, src]);

  // Compact layout on small players.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onLeave = () => save(true);
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [save]);

  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;
  const rating = ratingLabel(title.rating);
  const art = title.backdrop_url ?? title.poster_url;
  const showInfo = !playing;

  return (
    <div
      ref={wrap}
      className={`player${idle ? ' idle' : ''}${compact ? ' compact' : ''}`}
      role="region"
      aria-label={`${title.title} video player`}
    >
      {src ? (
        <video
          ref={video}
          playsInline
          preload="metadata"
          onClick={toggle}
          onPlay={() => { setPlaying(true); wasPlaying.current = true; }}
          onPause={() => { setPlaying(false); wasPlaying.current = false; save(true); }}
          onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); save(); }}
          onPlaying={() => setOffline(false)}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            if (target.current !== null) {
              e.currentTarget.currentTime = target.current;
              target.current = null;
            }
          }}
          onEnded={() => save(true)}
          onError={(e) => {
            if (!navigator.onLine) { setOffline(true); return; }
            flash(`This video could not be loaded (code ${e.currentTarget.error?.code ?? '?'}).`);
          }}
        />
      ) : null}
      {(!src || !playing) && (
        <div className="player-art" aria-hidden="true" style={{ opacity: src && time > 0 ? 0 : 1 }}>
          {art ? (
            <img src={art} alt="" />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `radial-gradient(ellipse at 70% 35%, ${posterPalette(title.slug).to} 0%, ${posterPalette(title.slug).from} 55%, #000 100%)`,
              }}
            />
          )}
        </div>
      )}

      <div className="player-overlay">
        <div className="player-top">
          <div style={{ visibility: showInfo ? 'visible' : 'hidden' }}>
            <h1 className="player-title">{title.title}</h1>
            <div className="player-meta">
              {title.maturity_rating && <span>{title.maturity_rating}</span>}
              {title.runtime_minutes && <span>{formatRuntime(title.runtime_minutes)}</span>}
              {title.genres.length > 0 && <span>{title.genres.map(genreLabel).join(', ')}</span>}
            </div>
            {rating && (
              <div className="player-rating">
                <StarIcon size={22} style={{ color: 'var(--gold)' }} />
                {rating} <small>/ 10</small>
                {title.rating_source && <span className="src">{title.rating_source}</span>}
              </div>
            )}
          </div>
          <button className="ctrl" onClick={fullscreen} aria-label="Full screen" style={{ alignSelf: 'flex-start' }}>
            <ExpandIcon size={26} />
          </button>
        </div>

        {showInfo && title.synopsis && <p className="player-synopsis">{title.synopsis}</p>}

        <div className="player-bar">
          <button className="ctrl ctrl-ring" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <div
            ref={seekRef}
            className="seek"
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(time)}
            aria-valuetext={`${clock(time)} of ${clock(duration)}`}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); seekTo(e.clientX); }}
            onPointerMove={(e) => { if (e.buttons === 1) seekTo(e.clientX); }}
          >
            <div className="seek-track" />
            <div className="seek-fill" style={{ width: `${pct}%` }} />
            <div className="seek-thumb" style={{ left: `${pct}%` }} />
            <div className="seek-time" style={{ left: `${pct}%` }}>{clock(time)}</div>
          </div>
          <button
            className="ctrl"
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              const v = video.current;
              if (v) v.muted = !v.muted;
              setMuted((m) => !m);
            }}
          >
            {muted ? <MuteIcon size={24} /> : <VolumeIcon size={24} />}
          </button>
          <button className="ctrl" aria-label="Quality, subtitles and audio" onClick={() => flash('Quality, subtitle and audio options appear once video is connected.')}>
            <SettingsIcon size={24} />
          </button>
        </div>
      </div>

      {!playing && resumeAt !== null && src ? (
        <div className="player-resume" role="dialog" aria-label="Continue watching">
          <p>You stopped at <b>{clock(resumeAt)}</b>{duration ? <> of {clock(duration)}</> : null}</p>
          <div className="player-resume-actions">
            <button className="btn btn-play" onClick={() => startFrom(resumeAt)} autoFocus>
              <PlayIcon size={18} /> Resume from {clock(resumeAt)}
            </button>
            <button className="btn btn-gray" onClick={() => startFrom(0)}>Start over</button>
          </div>
        </div>
      ) : !playing && (
        <button className="player-center" onClick={toggle} aria-label="Play">
          <PlayIcon size={30} style={{ marginLeft: 4 }} />
        </button>
      )}
      {offline && src && (
        <div className="player-offline" role="status">
          Connection lost. Reconnecting… You’ll continue from {clock(time)}.
        </div>
      )}
      {toast && <div className="player-toast" role="status">{toast}</div>}
    </div>
  );
}
