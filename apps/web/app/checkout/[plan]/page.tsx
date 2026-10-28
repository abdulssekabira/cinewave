import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatPrice, type Plan } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';
import { pesapalSandbox } from '@/lib/pesapal';
import { CheckoutForm } from '@/components/CheckoutForm';

export const metadata: Metadata = { title: 'Checkout' };

type Props = { params: Promise<{ plan: string }>; searchParams: Promise<{ period?: string }> };

export default async function Checkout({ params, searchParams }: Props) {
  const { plan: id } = await params;
  const { period } = await searchParams;
  const { sb, user } = await getUser();
  if (!user) redirect(`/login?next=/checkout/${id}`);
  const { data } = await sb.from('plans').select('*').eq('id', id).eq('active', true).maybeSingle();
  const plan = data as Plan | null;
  if (!plan || plan.id === 'free') notFound();

  const options = [
    plan.weekly_price_cents ? { value: 'week', label: '1 week', price: formatPrice(plan.weekly_price_cents, plan.currency) } : null,
    plan.price_cents ? { value: 'month', label: '1 month', price: formatPrice(plan.price_cents, plan.currency) } : null,
  ].filter(Boolean) as { value: string; label: string; price: string }[];
  if (!options.length) notFound();

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <Link href="/plans" className="btn btn-gray btn-small" style={{ marginBottom: 20 }}>← Plans</Link>
      <h1 className="page-title">{plan.name}</h1>
      {pesapalSandbox() && (
        <div className="form-msg" style={{ background: 'rgba(255,182,72,.12)', color: '#ffb648' }}>
          <b>Test mode:</b> payments go to Pesapal’s test system. No real money is charged.
        </div>
      )}
      <CheckoutForm
        planId={plan.id}
        options={options}
        initial={options.some((o) => o.value === period) ? period! : options[options.length - 1].value}
        email={user.email ?? ''}
      />
      <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 20 }}>
        You’ll pay on Pesapal’s secure page with <b>MTN Mobile Money</b>, <b>Airtel Money</b> or <b>Visa/Mastercard</b>.
        Your plan starts as soon as the payment is confirmed. It does not renew automatically: buy another week or month any time and it’s added on.
      </p>
    </div>
  );
}
