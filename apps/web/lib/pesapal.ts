import type { SupabaseClient } from '@supabase/supabase-js';
import { serverSecret } from './server-secret';

/**
 * Pesapal API 3.0 (MTN MoMo, Airtel Money, Visa/Mastercard).
 * Without PESAPAL_CONSUMER_KEY/SECRET the site runs in TEST MODE using
 * Pesapal's public sandbox keys for Ugandan merchants — no real money moves.
 */
const LIVE = 'https://pay.pesapal.com/v3';
const SANDBOX = 'https://cybqa.pesapal.com/pesapalv3';
const DEMO_UG = { key: 'TDpigBOOhs+zAl8cwH2Fl82jJGyD8xev', secret: '1KpqkfsMaihIcOlhnBo/gBZ5smw=' };

export function pesapalSandbox() {
  return !(process.env.PESAPAL_CONSUMER_KEY && process.env.PESAPAL_CONSUMER_SECRET) || process.env.PESAPAL_ENV === 'sandbox';
}

function cfg() {
  const sandbox = pesapalSandbox();
  return {
    sandbox,
    base: sandbox ? SANDBOX : LIVE,
    key: sandbox && !process.env.PESAPAL_CONSUMER_KEY ? DEMO_UG.key : process.env.PESAPAL_CONSUMER_KEY!,
    secret: sandbox && !process.env.PESAPAL_CONSUMER_SECRET ? DEMO_UG.secret : process.env.PESAPAL_CONSUMER_SECRET!,
  };
}

let cached: { token: string; until: number; base: string } | null = null;

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}, auth = true): Promise<T> {
  const c = cfg();
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${await token()}`;
  const res = await fetch(c.base + path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string } | null };
  if (!res.ok || (data.error && (data.error.message || data.error.code))) {
    throw new Error(`Pesapal: ${data.error?.message ?? data.error?.code ?? res.statusText}`);
  }
  return data;
}

async function token() {
  const c = cfg();
  if (cached && cached.base === c.base && cached.until > Date.now()) return cached.token;
  const r = await call<{ token: string }>('/api/Auth/RequestToken', {
    method: 'POST', body: { consumer_key: c.key, consumer_secret: c.secret },
  }, false);
  cached = { token: r.token, until: Date.now() + 4 * 60_000, base: c.base };
  return r.token;
}

function secretOrThrow() {
  const s = serverSecret();
  if (!s) throw new Error('Payments are not set up yet (server secret missing).');
  return s;
}

/** The registered IPN id for this site address (registers it once). */
async function ipnId(sb: SupabaseClient, origin: string) {
  const s = secretOrThrow();
  const url = `${origin}/api/pesapal/ipn`;
  const k = `pesapal_ipn:${cfg().sandbox ? 'sandbox' : 'live'}:${url}`;
  const { data: known, error } = await sb.rpc('server_kv_get', { s, k });
  if (error) throw new Error('Payments aren’t switched on yet. An admin needs to open Admin → Plans once.');
  if (known) return known as string;
  const r = await call<{ ipn_id: string }>('/api/URLSetup/RegisterIPN', {
    method: 'POST', body: { url, ipn_notification_type: 'GET' },
  });
  await sb.rpc('server_kv_set', { s, k, v: r.ipn_id });
  return r.ipn_id;
}

export async function startCheckout(
  sb: SupabaseClient,
  origin: string,
  pay: { merchant_ref: string; amount: number; currency: string; description: string },
  buyer: { email: string; phone?: string; name?: string },
) {
  const notification_id = await ipnId(sb, origin);
  const [first, ...rest] = (buyer.name ?? '').trim().split(/\s+/);
  const r = await call<{ order_tracking_id: string; redirect_url: string }>('/api/Transactions/SubmitOrderRequest', {
    method: 'POST',
    body: {
      id: pay.merchant_ref,
      currency: pay.currency,
      amount: pay.amount,
      description: pay.description.slice(0, 100),
      callback_url: `${origin}/checkout/done`,
      cancellation_url: `${origin}/plans`,
      notification_id,
      billing_address: {
        email_address: buyer.email,
        phone_number: buyer.phone || undefined,
        country_code: 'UG',
        first_name: first || undefined,
        last_name: rest.join(' ') || undefined,
      },
    },
  });
  const { error } = await sb.rpc('attach_payment_tracking', {
    s: secretOrThrow(), p_merchant_ref: pay.merchant_ref, p_tracking: r.order_tracking_id,
  });
  if (error) throw new Error(error.message);
  return r.redirect_url;
}

/** Ask Pesapal for the real status and record it. Returns our status. */
export async function settle(sb: SupabaseClient, trackingId: string): Promise<string> {
  const st = await call<{
    status_code: number; amount: number; currency: string; payment_method?: string; confirmation_code?: string;
  }>(`/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(trackingId)}`);
  const { data, error } = await sb.rpc('settle_payment', {
    s: secretOrThrow(),
    p_tracking: trackingId,
    p_status_code: st.status_code,
    p_amount: st.amount,
    p_currency: st.currency,
    p_method: st.payment_method ?? null,
    p_confirmation: st.confirmation_code ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
