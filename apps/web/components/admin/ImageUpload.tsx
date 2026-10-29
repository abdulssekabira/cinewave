'use client';

import { useId, useRef, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_MB = 10;

/**
 * Uploads straight from the browser to the 'artwork' storage bucket (staff
 * only, enforced by storage policies) and stores the public URL in a hidden
 * input so the surrounding form saves it.
 */
export function ImageUpload({
  name,
  label,
  hint,
  initial,
  shape,
}: {
  name: string;
  label: string;
  hint: string;
  initial: string | null;
  shape: 'poster' | 'wide' | 'round';
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    const ext = TYPES[file.type];
    if (!ext) return setError('Use a JPG, PNG or WebP image.');
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Images must be under ${MAX_MB} MB.`);
    setBusy(true);
    try {
      const sb = browserClient();
      const path = `${shape === 'round' ? 'vjs' : 'titles'}/${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await sb.storage
        .from('artwork')
        .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      setUrl(sb.storage.from('artwork').getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? `Upload failed: ${e.message}` : 'Upload failed. Try again.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="a-field">
      <label htmlFor={id}>{label}</label>
      <input type="hidden" name={name} value={url} />
      <div className={`a-upload ${shape}`}>
        {url ? <img src={url} alt={`${label} preview`} /> : <span className="a-muted">No image</span>}
      </div>
      <div className="a-row">
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <button type="button" className="btn btn-gray btn-small" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
        </button>
        {url && !busy && (
          <button type="button" className="btn btn-gray btn-small" onClick={() => setUrl('')}>Remove</button>
        )}
      </div>
      <small className="a-hint">{hint}</small>
      {error && <small className="a-error" role="alert">{error}</small>}
    </div>
  );
}
