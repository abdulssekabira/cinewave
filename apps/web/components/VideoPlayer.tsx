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

/**
 * Player UI. `src` is a signed playback URL from the video provider
 * (Phase 3). Until then the UI renders and explains that video is not
 * connected yet.
 */
export function VideoPlayer({
  title,
  src,
  startAt = 0,
  signedIn,
}: {
  title: CatalogTitle;
  src?: string | null;
  startAt?: number;
  signedIn: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const lastSaved = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(startAt);
  const [duration, setDuration] = useState((title.runtime_minutes ?? 0) * 60);
  const [idle, setIdle] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);

  const save = useCallback(
    (force = false) => {
      const v = video.current;
      if (!signedIn || !v || !src) return;
      if (!force && Math.abs(v.currentTime - lastSaved.current) < 10) return;
      lastSaved.current = v.currentTime;
      saveWatchProgress(title.id, v.currentTime, v.duration || undefined).catch(() => {});
    },
    [signedIn, src, title.id],
  );

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const toggle = useCallback(() => {
    const v = video.current;
    if (!src || !v) {
      flash('This film’s video hasn’t been uploaded yet. Check back soon.');
      return;
    }
    if (v.paused) v.play().catch(() => flash('Playback failed. Check your connection and try again.'));
    else v.pause();
  }, [src]);

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

  // Attach the stream: Safari/Android play HLS natively, others use hls.js.
  useEffect(() => {
    const v = video.current;
    if (!v || !src) return;
    if (!src.includes('.m3u8') || v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = src;
      return () => { v.removeAttribute('src'); v.load(); };
    }
    let hls: { destroy(): void } | null = null;
    let cancelled = false;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) { v.src = src; return; }
      const h = new Hls({ capLevelToPlayerSize: true });
      h.loadSource(src);
      h.attachMedia(v);
      h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) flash('This video could not be loaded.'); });
      hls = h;
    });
    return () => { cancelled = true; hls?.destroy(); };
  }, [src]);

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
          onPlay={() => setPlaying(true)}
          onPause={() => { setPlaying(false); save(true); }}
          onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); save(); }}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            if (startAt) e.currentTarget.currentTime = startAt;
          }}
          onError={() => flash('This video could not be loaded.')}
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

      {!playing && (
        <button className="player-center" onClick={toggle} aria-label="Play">
          <PlayIcon size={30} style={{ marginLeft: 4 }} />
        </button>
      )}
      {toast && <div className="player-toast" role="status">{toast}</div>}
    </div>
  );
}
