'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { freshStreamUrl } from '@/app/watch/actions';
import { formatRuntime, genreLabel, posterPalette, ratingLabel, type CatalogTitle, vjLabel } from '@cinewave/shared';
import { saveWatchProgress } from '@/app/watch/[slug]/actions';
import type { AdPlan } from '@cinewave/shared';
import { AdLowerThird } from './AdLowerThird';
import { ExpandIcon, MuteIcon, PauseIcon, PlayIcon, SettingsIcon, StarIcon, VolumeIcon } from './Icons';

function clock(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export type PlayerEpisode = {
  id: string;
  label: string; // "Part 3"
  name: string | null;
  next: { label: string; name: string | null; href: string } | null;
};

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
  src: initialSrc,
  startAt = 0,
  startAtUpdated = null,
  signedIn,
  episode = null,
  ads = null,
}: {
  title: CatalogTitle;
  src?: string | null;
  startAt?: number;
  startAtUpdated?: string | null;
  signedIn: boolean;
  episode?: PlayerEpisode | null;
  /** Lower-third adverts for viewers whose plan shows ads. */
  ads?: AdPlan | null;
}) {
  const router = useRouter();
  // The viewing link can be swapped for a fresh one if it stops working.
  const [src, setSrc] = useState(initialSrc);
  useEffect(() => setSrc(initialSrc), [initialSrc]);
  const refreshes = useRef(0);
  const resumeAfterReload = useRef(false);
  const posKey = episode?.id ?? title.id; // each part has its own resume point
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
  // While dragging the line: where the finger/mouse is (the film jumps there on release).
  const [drag, setDrag] = useState<number | null>(null);
  const [buffering, setBuffering] = useState(false);
  // A jump that is still loading: keep showing its target so the line doesn't snap back.
  const pendingSeek = useRef<{ t: number; at: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [upNext, setUpNext] = useState<number | null>(null); // seconds left before the next part starts

  // Next part countdown.
  useEffect(() => {
    if (upNext === null || !episode?.next) return;
    if (upNext <= 0) { router.push(episode.next.href); return; }
    const t = window.setTimeout(() => setUpNext((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [upNext, episode, router]);

  // Pick the most recent saved spot: this account's (any device) or this phone's own copy.
  useEffect(() => {
    const local = readLocal(posKey);
    const serverAt = startAtUpdated ? Date.parse(startAtUpdated) : 0;
    let pos = startAt;
    if (local && local.at > serverAt + 5000 && !(local.dur && local.pos / local.dur > 0.92)) pos = local.pos;
    if (pos > 30) setResumeAt(pos);
  }, [posKey, startAt, startAtUpdated]);

  const save = useCallback(
    (force = false) => {
      const v = video.current;
      if (!v || !src || !(v.currentTime > 0)) return;
      const pos = v.currentTime;
      const dur = Number.isFinite(v.duration) ? v.duration : 0;
      if (force || Math.abs(pos - lastLocal.current) >= 2) {
        lastLocal.current = pos;
        writeLocal(posKey, { pos, dur, at: Date.now() });
      }
      if (!signedIn) return;
      if (!force && !pending.current && Math.abs(pos - lastSaved.current) < 5) return;
      lastSaved.current = pos;
      saveWatchProgress(title.id, pos, dur || undefined, episode?.id)
        .then(() => { pending.current = false; })
        .catch(() => { pending.current = true; });
    },
    [signedIn, src, title.id, posKey, episode?.id],
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



  const posAt = (clientX: number) => {
    const el = seekRef.current;
    if (!el || !(duration > 0) || !Number.isFinite(duration)) return null;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration;
  };
  const jumpTo = (t: number) => {
    const v = video.current;
    if (!v || !src) return;
    const max = duration > 0 && Number.isFinite(duration) ? duration - 0.5 : t;
    const to = Math.max(0, Math.min(max, t));
    pendingSeek.current = { t: to, at: Date.now() };
    v.currentTime = to;
    setTime(to);
  };
  // Skips build on a jump that is still loading, so tapping +10 three times = +30.
  const skip = (sec: number) => {
    const v = video.current;
    if (!v) return;
    const base = pendingSeek.current && Date.now() - pendingSeek.current.at < 8000 ? pendingSeek.current.t : v.currentTime;
    jumpTo(base + sec);
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
      else if (e.key === 'ArrowRight' && v && src) skip(10);
      else if (e.key === 'ArrowLeft' && v && src) skip(-10);
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
        if (d.response?.code === 403 && refreshes.current < 4) { reconnectRef.current(true); return; }
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

  // Reconnect from the same spot. `fresh` also asks the server for a new link.
  const reconnectRef = useRef<(fresh: boolean) => void>(() => {});
  reconnectRef.current = async (fresh: boolean) => {
    const v = video.current;
    if (!v) return;
    const pos = v.currentTime || target.current || 0;
    const keepPlaying = wasPlaying.current || !v.paused;
    setOffline(true);
    if (fresh && refreshes.current < 4) {
      refreshes.current += 1;
      const next = await freshStreamUrl(title.slug, episode?.id ?? null).catch(() => null);
      if (next) {
        target.current = pos;
        resumeAfterReload.current = keepPlaying;
        setSrc(next);
        return;
      }
    }
    if (hlsRef.current) { hlsRef.current.startLoad(pos || -1); return; }
    target.current = pos;
    resumeAfterReload.current = keepPlaying;
    v.load();
  };

  // Watchdog: if the film stops moving while it should be playing (a stall
  // the browser doesn't recover from), reconnect by itself — first gently,
  // then with a fresh link — instead of making the viewer reload the page.
  useEffect(() => {
    let lastT = -1;
    let stuckSince: number | null = null;
    let step = 0;
    const id = window.setInterval(() => {
      const v = video.current;
      if (!v || !src) return;
      const shouldPlay = !v.paused && !v.ended;
      if (!shouldPlay || Math.abs(v.currentTime - lastT) > 0.2) {
        lastT = v.currentTime;
        stuckSince = null;
        step = 0;
        if (shouldPlay) setOffline(false);
        return;
      }
      if (!navigator.onLine) return;
      stuckSince ??= Date.now();
      const stuck = Date.now() - stuckSince;
      if (step === 0 && stuck > 8000) { step = 1; reconnectRef.current(false); }
      else if (step === 1 && stuck > 20000) { step = 2; reconnectRef.current(true); }
      else if (step === 2 && stuck > 45000) { stuckSince = Date.now(); step = 1; }
    }, 2000);
    return () => window.clearInterval(id);
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

  // Some files (e.g. MKV) report their length as unknown. Then use what the
  // browser can seek to, or the film's runtime, so the progress line moves.
  function readDuration(v: HTMLVideoElement) {
    let d = v.duration;
    if (!Number.isFinite(d) || d <= 0) {
      try { if (v.seekable.length) d = v.seekable.end(v.seekable.length - 1); } catch { /* not ready */ }
    }
    if (!Number.isFinite(d) || d <= 0) d = (title.runtime_minutes ?? 0) * 60;
    if (Number.isFinite(d) && d > 0) setDuration((cur) => (Math.abs(cur - d) > 0.5 ? d : cur));
  }

  const shownTime = drag ?? time;
  const pct = duration > 0 && Number.isFinite(duration) && Number.isFinite(shownTime) ? Math.min(100, Math.max(0, (shownTime / duration) * 100)) : 0;
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
          onTimeUpdate={(e) => {
            const now = e.currentTarget.currentTime;
            const p = pendingSeek.current;
            if (p) {
              // Still on the old spot while the new one loads: keep showing the target.
              if (Math.abs(now - p.t) > 2 && Date.now() - p.at < 8000) return;
              pendingSeek.current = null;
            }
            setTime(now);
            if (!(duration > 0) || !Number.isFinite(duration)) readDuration(e.currentTarget);
            save();
          }}
          onDurationChange={(e) => readDuration(e.currentTarget)}
          onPlaying={() => { setOffline(false); setBuffering(false); }}
          onWaiting={() => setBuffering(true)}
          onSeeking={() => setBuffering(true)}
          onSeeked={() => setBuffering(false)}
          onLoadedMetadata={(e) => {
            readDuration(e.currentTarget);
            if (target.current !== null) {
              e.currentTarget.currentTime = target.current;
              target.current = null;
            }
          }}
          onEnded={() => { save(true); if (episode?.next) setUpNext(10); }}
          onError={(e) => {
            if (!navigator.onLine) { setOffline(true); return; }
            // Broken connection or an expired link: get a fresh link and carry on.
            if (refreshes.current < 4) { reconnectRef.current(true); return; }
            flash(`This video could not be loaded (code ${e.currentTarget.error?.code ?? '?'}). Refresh the page to carry on from where you stopped.`);
          }}
          onCanPlay={(e) => {
            setBuffering(false);
            if (resumeAfterReload.current) {
              resumeAfterReload.current = false;
              e.currentTarget.play().catch(() => {});
            }
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

      {buffering && playing && src && <div className="player-spin" aria-label="Loading" />}
      {ads && <AdLowerThird plan={ads} time={time} playing={playing} titleId={title.id} raised={!idle} />}

      <div className="player-overlay">
        <div className="player-top">
          <div style={{ visibility: showInfo ? 'visible' : 'hidden' }}>
            <h1 className="player-title">{title.title}</h1>
            {title.vj_name && <div className="player-vj">{vjLabel(title.vj_name)}</div>}
            {episode && (
              <div className="player-part">{episode.label}{episode.name ? ` · ${episode.name}` : ''}</div>
            )}
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
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              const t = posAt(e.clientX);
              if (t !== null) setDrag(t);
            }}
            onPointerMove={(e) => {
              if (drag === null) return;
              const t = posAt(e.clientX);
              if (t !== null) setDrag(t);
            }}
            onPointerUp={() => { if (drag !== null) jumpTo(drag); setDrag(null); }}
            onPointerCancel={() => { if (drag !== null) jumpTo(drag); setDrag(null); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); skip(10); }
              else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); skip(-10); }
            }}
          >
            <div className="seek-track" />
            <div className="seek-fill" style={{ width: `${pct}%` }} />
            <div className="seek-thumb" style={{ left: `${pct}%` }} />
            <div className={`seek-time${drag !== null ? ' on' : ''}`} style={{ left: `${pct}%` }}>{clock(shownTime)}</div>
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
      ) : !playing && upNext === null && (
        <button className="player-center" onClick={toggle} aria-label="Play">
          <PlayIcon size={30} style={{ marginLeft: 4 }} />
        </button>
      )}
      {upNext !== null && episode?.next && (
        <div className="player-resume" role="dialog" aria-label="Next part">
          <p>Up next: <b>{episode.next.label}</b>{episode.next.name ? ` · ${episode.next.name}` : ''}</p>
          <div className="player-resume-actions">
            <button className="btn btn-play" onClick={() => router.push(episode.next!.href)} autoFocus>
              <PlayIcon size={18} /> Play now ({upNext})
            </button>
            <button className="btn btn-gray" onClick={() => setUpNext(null)}>Cancel</button>
          </div>
        </div>
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
