'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import { pesapalSandbox, startCheckout } from '@/lib/pesapal';

export type CheckoutState = { error?: string };

async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function checkout(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const { sb, user } = await getUser();
  if (!user) redirect('/login?next=/plans');

  const plan = String(form.get('plan') ?? '');
  const period = String(form.get('period') ?? '');
  const phone = String(form.get('phone') ?? '').replace(/[^\d+]/g, '');
  if (period !== 'week' && period !== 'month') return { error: 'Choose weekly or monthly.' };
  if (phone && !/^\+?\d{9,15}$/.test(phone)) return { error: 'Check the phone number (e.g. 0772 123456).' };

  const { data: pay, error } = await sb.rpc('create_payment', { p_plan: plan, p_period: period, p_sandbox: pesapalSandbox() });
  if (error || !pay) return { error: error?.message?.replace(/^.*?: /, '') ?? 'Could not start the payment.' };

  const { data: p } = await sb.from('plans').select('name').eq('id', plan).maybeSingle();
  const { data: prof } = await sb.from('profiles').select('display_name').eq('id', user.id).maybeSingle();

  let url: string;
  try {
    url = await startCheckout(sb, await origin(), {
      merchant_ref: pay.merchant_ref,
      amount: pay.amount,
      currency: pay.currency,
      description: `GLE Movies ${p?.name ?? plan} – 1 ${period}`,
    }, {
      email: user.email!,
      phone: phone ? (phone.startsWith('0') ? `+256${phone.slice(1)}` : phone) : undefined,
      name: prof?.display_name ?? undefined,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not reach the payment service. Try again.' };
  }
  redirect(url);
}
