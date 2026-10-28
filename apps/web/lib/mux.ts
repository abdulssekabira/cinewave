import { createCipheriv, createDecipheriv, createHash, createSign, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Mux helpers. Runs on the server only: the token secret never reaches
 * the browser. Videos are uploaded with a SIGNED playback policy, so a
 * stream URL works only with a short-lived token we issue after the
 * entitlement check.
 */

const API = 'https://api.mux.com';

export function muxConfigured() {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

async function mux<T>(path: string, init: RequestInit = {}): Promise<T> {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new Error('Mux is not connected yet (MUX_TOKEN_ID / MUX_TOKEN_SECRET missing in Vercel).');
  const res = await fetch(API + path, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { messages?: string[] } }).error?.messages?.join(' ') ?? res.statusText;
    throw new Error(`Mux: ${msg}`);
  }
  return (body as { data: T }).data;
}

// ---------------------------------------------------------------- uploads

export async function createDirectUpload(titleId: string, origin: string) {
  return mux<{ id: string; url: string }>('/video/v1/uploads', {
    method: 'POST',
    body: JSON.stringify({
      cors_origin: origin,
      new_asset_settings: {
        playback_policies: ['signed'],
        video_quality: 'basic',
        passthrough: titleId,
      },
    }),
  });
}

export async function getUpload(id: string) {
  return mux<{ id: string; status: string; asset_id?: string; error?: { message?: string } }>(`/video/v1/uploads/${id}`);
}

export async function getAsset(id: string) {
  return mux<{
    id: string;
    status: 'preparing' | 'ready' | 'errored';
    duration?: number;
    playback_ids?: { id: string; policy: string }[];
    errors?: { messages?: string[] };
  }>(`/video/v1/assets/${id}`);
}

// ---------------------------------------------------------- signing key

function cipherKey() {
  return createHash('sha256').update(`cinewave-signing:${process.env.MUX_TOKEN_SECRET ?? ''}`).digest();
}

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cipherKey(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}

function decrypt(stored: string) {
  const [iv, tag, ct] = stored.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = createDecipheriv('aes-256-gcm', cipherKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

type SigningKey = { id: string; pem: string };

async function readSigningKey(sb: SupabaseClient): Promise<SigningKey | null> {
  const { data } = await sb.rpc('mux_signing_key');
  if (!data) return null;
  try {
    return JSON.parse(decrypt(data as string)) as SigningKey;
  } catch {
    return null; // token secret changed — a new key will be created by an admin
  }
}

/** Makes sure a signing key exists. Needs an admin session (stores it). */
export async function ensureSigningKey(sb: SupabaseClient): Promise<void> {
  if (await readSigningKey(sb)) return;
  const k = await mux<{ id: string; private_key: string }>('/system/v1/signing-keys', { method: 'POST' });
  const pem = Buffer.from(k.private_key, 'base64').toString('utf8');
  const { error } = await sb.rpc('set_mux_signing_key', { v: encrypt(JSON.stringify({ id: k.id, pem })) });
  if (error) throw new Error('Only an administrator can finish video security setup. Ask an admin to open this page once.');
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Short-lived stream URL for a signed playback ID, or null if not possible. */
export async function signedStreamUrl(
  sb: SupabaseClient,
  playbackId: string,
  opts: { maxResolution?: string; hours?: number } = {},
): Promise<string | null> {
  if (!muxConfigured()) return null;
  const key = await readSigningKey(sb);
  if (!key) return null;
  const header = { alg: 'RS256', typ: 'JWT', kid: key.id };
  const claims: Record<string, unknown> = {
    sub: playbackId,
    aud: 'v',
    exp: Math.floor(Date.now() / 1000) + 3600 * (opts.hours ?? 6),
  };
  if (opts.maxResolution) claims.max_resolution = opts.maxResolution;
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(key.pem);
  return `https://stream.mux.com/${playbackId}.m3u8?token=${unsigned}.${b64url(sig)}`;
}
