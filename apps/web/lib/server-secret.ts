import { createHash, createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A secret only this web server knows, derived from a server-only env var.
 * The database stores just its SHA-256 hash and uses it to accept
 * server-only calls (payment settlement) without a service-role key.
 * Override with SERVER_SECRET; otherwise derived from MUX_TOKEN_SECRET.
 */
export function serverSecret(): string | null {
  const base = process.env.SERVER_SECRET || process.env.MUX_TOKEN_SECRET;
  if (!base) return null;
  return createHmac('sha256', base).update('gle-movies-server-v1').digest('hex');
}

/** Admin-only: registers the secret's hash in the DB if it isn't there yet. */
export async function ensureServerSecret(sb: SupabaseClient): Promise<boolean> {
  const s = serverSecret();
  if (!s) return false;
  const { data: ok } = await sb.rpc('server_secret_ok', { s });
  if (ok) return true;
  const { error } = await sb.rpc('set_server_secret_hash', { h: createHash('sha256').update(s).digest('hex') });
  return !error;
}
