import { notFound } from 'next/navigation';
import type { Plan } from '@cinewave/shared';
import { requireStaff } from '@/lib/admin';
import { PlanForm } from '@/components/admin/PlanForm';

export default async function AdminPlans() {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) notFound();
  const [{ data: p }, { data: subs }] = await Promise.all([
    sb.from('plans').select('*').order('rank'),
    sb.from('subscriptions').select('plan_id').eq('status', 'active'),
  ]);
  const plans = (p ?? []) as Plan[];
  const count = (id: string) => (subs ?? []).filter((s) => s.plan_id === id).length;

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Plans &amp; prices</h1>
          <p className="a-muted" style={{ margin: '4px 0 0' }}>
            Changes show on the website straight away. People who already paid keep what they paid for until their period ends.
          </p>
        </div>
      </div>
      <div className="a-plan-grid">
        {plans.map((plan) => <PlanForm key={plan.id} plan={plan} subscribers={count(plan.id)} />)}
      </div>
      <p className="a-muted" style={{ marginTop: 16 }}>
        Which films each plan unlocks is set per film (Films → “Who can watch”). A higher plan always includes everything below it.
      </p>
    </>
  );
}
