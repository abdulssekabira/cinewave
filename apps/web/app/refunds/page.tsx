import type { Metadata } from 'next';
import { ContactLines, LegalPage } from '@/components/legal/LegalPage';
import { BRAND, getContact } from '@/lib/site';

export const metadata: Metadata = { title: 'Refund Policy' };

export default async function Refunds() {
  const c = await getContact();
  return (
    <LegalPage title="Refund Policy" current="/refunds">
      <p>
        {BRAND} plans are paid one week or one month at a time and <b>never renew automatically</b>, so you’re only charged when
        you choose to pay.
      </p>

      <h2>When we refund</h2>
      <ul>
        <li><b>Charged but no access:</b> money left your account but your plan didn’t start within 24 hours. We’ll either start your plan or refund you.</li>
        <li><b>Charged twice</b> for the same purchase: we refund the extra payment.</li>
        <li><b>Service down:</b> if {BRAND} was unavailable for more than 48 hours in a row during your paid time, we add the lost days to your plan, or refund them if you prefer.</li>
        <li><b>Paid by mistake</b> and you haven’t watched anything with the new plan: ask within 48 hours of paying.</li>
      </ul>

      <h2>When we don’t refund</h2>
      <ul>
        <li>Time already used, or a plan you changed your mind about after watching with it.</li>
        <li>Problems caused by your own internet, data bundle or device (we’ll still help you get it working).</li>
        <li>Accounts closed for breaking our Terms of Service.</li>
      </ul>

      <h2>How to ask</h2>
      <ol>
        <li>Contact us within <b>7 days</b> of the payment using the details below, from your account’s email address.</li>
        <li>Include your username, the date and amount, and the payment method (MTN, Airtel or card), plus the transaction ID or SMS if you have it.</li>
        <li>We reply within 3 working days. Approved refunds go back to the same payment method through Pesapal, usually within 7–14 working days depending on your provider.</li>
      </ol>

      <h2>Contact</h2>
      <ContactLines c={c} />
    </LegalPage>
  );
}
