import type { Metadata } from 'next';
import { ContactLines, LegalPage } from '@/components/legal/LegalPage';
import { BRAND, getContact } from '@/lib/site';

export const metadata: Metadata = { title: 'Copyright & takedown' };

export default async function Copyright() {
  const c = await getContact();
  return (
    <LegalPage title="Copyright & takedown" current="/copyright">
      <p>
        {BRAND} respects the rights of film makers, studios, translators and VJs. We only want to show titles we have permission
        to show. If you own the rights to something on {BRAND} and haven’t given permission, tell us and we’ll act quickly.
      </p>

      <h2>How to report</h2>
      <p>Send a notice using the contact details below with:</p>
      <ol>
        <li>Your name, organisation (if any), email and phone number.</li>
        <li>The work you own, and the link to it on {BRAND} (for example glemovies.com/title/…).</li>
        <li>Proof or a clear explanation that you own it or act for the owner.</li>
        <li>A statement that you believe in good faith the use isn’t authorised, and that the information in your notice is accurate.</li>
        <li>Your signature (typed name is fine).</li>
      </ol>

      <h2>What we do</h2>
      <ul>
        <li>We acknowledge valid notices within 2 working days and normally remove or disable the title within 3 working days while we review it.</li>
        <li>If the title was uploaded under an agreement with a partner, we contact them; if they show they have the rights, we may restore it and tell you.</li>
        <li>We keep records of notices and remove repeat problems from the service.</li>
      </ul>

      <h2>Want to partner with us?</h2>
      <p>Film makers, studios and VJs who’d like their work on {BRAND} under a licence or revenue-share agreement are welcome to get in touch.</p>

      <h2>Contact</h2>
      <ContactLines c={c} />
    </LegalPage>
  );
}
