import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { settle } from '@/lib/pesapal';

export const metadata: Metadata = { title: 'Payment' };

type Props = { searchParams: Promise<{ OrderTrackingId?: string; OrderMerchantReference?: string }> };

const COPY: Record<string, { h: string; p: string; ok?: boolean }> = {
  completed: { h: 'Payment received 🎉', p: 'Your plan is active. Enjoy the films!', ok: true },
  pending: { h: 'Waiting for confirmation', p: 'If you approved the payment on your phone, it can take a minute. Refresh this page shortly. You won’t be charged twice.' },
  failed: { h: 'Payment didn’t go through', p: 'Nothing was charged. You can try again, or use a different payment method.' },
  invalid: { h: 'We couldn’t confirm this payment', p: 'Please contact support with your reference below.' },
  reversed: { h: 'Payment reversed', p: 'This payment was reversed, so the time it added was removed.' },
};

export default async function Done({ searchParams }: Props) {
  const { OrderTrackingId: tracking, OrderMerchantReference: ref } = await searchParams;
  let status = 'pending';
  if (tracking) {
    try {
      status = await settle(await createClient(), tracking);
    } catch {
      status = 'pending';
    }
  }
  const c = COPY[status] ?? COPY.pending;

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <h1 className="page-title">{c.h}</h1>
      <p style={{ color: 'var(--text-muted)' }}>{c.p}</p>
      {ref && <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Reference: {ref}</p>}
      <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
        {c.ok ? (
          <Link href="/" className="btn btn-accent">Start watching</Link>
        ) : status === 'pending' && tracking ? (
          <Link href={`/checkout/done?OrderTrackingId=${encodeURIComponent(tracking)}${ref ? `&OrderMerchantReference=${encodeURIComponent(ref)}` : ''}`} className="btn btn-accent">Refresh</Link>
        ) : (
          <Link href="/plans" className="btn btn-accent">Back to plans</Link>
        )}
        <Link href="/account" className="btn btn-gray">My account</Link>
      </div>
    </div>
  );
}
