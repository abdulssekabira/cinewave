import type { Metadata } from 'next';
import { ContactLines, LegalPage } from '@/components/legal/LegalPage';
import { BRAND, COMPANY, getContact } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default async function Privacy() {
  const c = await getContact();
  return (
    <LegalPage title="Privacy Policy" current="/privacy">
      <p>
        This policy explains what personal information {COMPANY} collects when you use {BRAND} (glemovies.com and the app),
        why, and your choices. We follow Uganda’s Data Protection and Privacy Act, 2019.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> email address, username, display name and password (stored securely as a scrambled hash, never readable by us).</li>
        <li><b>Payments:</b> the plan you bought, amount, date, payment status and method type, and the phone number you choose to enter for mobile money. Pesapal processes the payment; we never receive card numbers or PINs.</li>
        <li><b>Viewing:</b> your list, what you watch and where you stopped (so you can resume), and downloads on your devices.</li>
        <li><b>Devices:</b> the signed-in devices on your account (device/browser type and last use), to apply your plan’s device limit.</li>
        <li><b>Country:</b> worked out from your connection or profile, because some titles are only licensed in some countries.</li>
        <li><b>Invites:</b> which account invited you, if you used an invite code.</li>
        <li><b>Technical logs:</b> basic logs (such as errors and IP address) kept for a short time for security and fixing problems.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account, play films, resume where you stopped and keep downloads working.</li>
        <li>To take payments, give you the plan you paid for and handle refunds.</li>
        <li>To protect the service and the films (device limits, regional licences, fraud and abuse prevention).</li>
        <li>To send account emails such as confirming your email or resetting your password. We don’t send marketing without your permission.</li>
        <li>To understand which titles are popular so we can choose what to add.</li>
      </ul>

      <h2>Who helps us (service providers)</h2>
      <p>We share only what’s needed with companies that run parts of {BRAND} for us, under their own security and privacy terms:</p>
      <ul>
        <li>Supabase (accounts and database, hosted in Frankfurt, Germany)</li>
        <li>Vercel (website hosting)</li>
        <li>Cloudflare and Mux (video storage and streaming)</li>
        <li>Pesapal (payments)</li>
        <li>Resend (account emails)</li>
        <li>Expo (app updates and builds)</li>
      </ul>
      <p>Some of these store data outside Uganda. We don’t sell your personal information. We may disclose it if the law requires it.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account information while your account is open. Payment records are kept as long as tax and accounting law
        requires. When you delete your account, we delete or anonymise the rest within 30 days.
      </p>

      <h2>Your rights and choices</h2>
      <ul>
        <li>See and change your profile details in Account.</li>
        <li>Remove devices in Account → Devices; sign out to remove downloads from a device.</li>
        <li>Ask us for a copy of your information, to correct it, or to <b>delete your account</b>: contact us using the details below from your account’s email address. We’ll reply within 30 days.</li>
        <li>You can also complain to Uganda’s Personal Data Protection Office.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Connections are encrypted (HTTPS), passwords are hashed, access to data is restricted by account, and video links are
        short-lived and protected. No system is perfectly secure, so please use a strong, unique password.
      </p>

      <h2>Children</h2>
      <p>Accounts are for adults (18+). We don’t knowingly collect information from children; contact us if you think a child has made an account.</p>

      <h2>Cookies and storage</h2>
      <p>
        We use essential cookies and your device’s storage to keep you signed in, remember where you stopped and remember an invite
        code. We don’t use advertising trackers.
      </p>

      <h2>Changes</h2>
      <p>We’ll update the date at the top when this policy changes and tell you about important changes.</p>

      <h2>Contact</h2>
      <ContactLines c={c} />
    </LegalPage>
  );
}
