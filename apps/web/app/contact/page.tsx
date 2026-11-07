import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLines, LegalPage } from '@/components/legal/LegalPage';
import { getContact } from '@/lib/site';

export const metadata: Metadata = { title: 'Contact & help' };

export default async function Contact() {
  const c = await getContact();
  return (
    <LegalPage title="Contact & help" current="/contact">
      <h2>Get in touch</h2>
      <ContactLines c={c} />

      <h2>Quick help</h2>
      <ul>
        <li><b>Forgot your password?</b> Go to <Link href="/login?mode=reset">Reset password</Link>.</li>
        <li><b>“Too many devices”?</b> Remove one in <Link href="/account#devices">Account → Devices</Link>.</li>
        <li><b>Paid but your plan didn’t start?</b> Wait a few minutes and refresh your Account page. If it still hasn’t started after an hour, contact us with the date, amount and transaction ID.</li>
        <li><b>Film won’t play?</b> Check your connection and refresh the page; the player continues from where you stopped. On iPhone, some titles are still being prepared and play on Android or a computer first.</li>
        <li><b>Get the Android app:</b> <Link href="/app">glemovies.com/app</Link>.</li>
        <li><b>Delete your account:</b> contact us from your account’s email address and we’ll delete it within 30 days (see our <Link href="/privacy">Privacy Policy</Link>).</li>
      </ul>
    </LegalPage>
  );
}
