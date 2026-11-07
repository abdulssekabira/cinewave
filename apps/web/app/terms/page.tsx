import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLines, LegalPage } from '@/components/legal/LegalPage';
import { BRAND, COMPANY, getContact } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of Service' };

export default async function Terms() {
  const c = await getContact();
  return (
    <LegalPage title="Terms of Service" current="/terms">
      <p>
        These terms are an agreement between you and {COMPANY} (“we”, “us”), which runs {BRAND} on glemovies.com and in the
        {` ${BRAND}`} app. By creating an account or watching on {BRAND}, you agree to them. If you don’t agree, please don’t use the service.
      </p>

      <h2>1. Your account</h2>
      <ul>
        <li>You must give a real email address and keep your password private. You’re responsible for what happens on your account.</li>
        <li>You must be 18 or older to create an account and pay. Younger viewers may watch with a parent or guardian’s permission and supervision.</li>
        <li>One account is for you and your household. Paid plans work on a limited number of devices (shown on the <Link href="/plans">Plans</Link> page); you can remove devices in Account → Devices.</li>
        <li>We may suspend or close accounts that break these terms, for example by sharing accounts widely, copying films or abusing payments or invites.</li>
      </ul>

      <h2>2. Plans and payment</h2>
      <ul>
        <li>The Free plan includes selected titles, possibly with adverts. Paid plans (Standard and Premium) unlock more titles and features as described on the <Link href="/plans">Plans</Link> page.</li>
        <li>Prices are in Uganda shillings (UGX) and shown before you pay. Payments are processed by Pesapal (MTN Mobile Money, Airtel Money, Visa and Mastercard). We never see or store your card details or mobile money PIN.</li>
        <li><b>No automatic renewal.</b> Each payment buys one week or one month of access. Paying again before it ends adds the new time on top.</li>
        <li>We may change prices for future payments. Time you have already paid for is not affected.</li>
        <li>Refunds are covered by our <Link href="/refunds">Refund Policy</Link>.</li>
      </ul>

      <h2>3. Invite friends</h2>
      <p>
        You can share your invite link or code. When the number of friends shown in your account sign up with it and confirm
        their email, you receive the free plan time described there, a limited number of times per account. Fake or duplicate
        accounts don’t count, and we may remove rewards gained that way. We may change or end the invite programme at any time;
        rewards already given stay until they expire.
      </p>

      <h2>4. Watching and downloads</h2>
      <ul>
        <li>Films and series are for personal, non-commercial viewing only. You may not copy, record, re-upload, sell, publicly show or share them.</li>
        <li>Offline downloads (where your plan and the title allow it) stay inside the app, expire after a set time and must be renewed online. They are removed if your plan ends or the device is removed from your account.</li>
        <li>What is available can change, and some titles are only available in some countries, as our licences allow.</li>
        <li>Streaming uses mobile data or Wi-Fi; your network provider’s charges apply.</li>
      </ul>

      <h2>5. Content and age ratings</h2>
      <p>
        Titles show an age rating and content notes where available. Parents and guardians are responsible for what children watch.
        Ratings from outside sources (such as IMDb) are shown for information only.
      </p>

      <h2>6. Our rights and yours</h2>
      <p>
        The films, series, artwork, the {BRAND} name and logo, and the website and app belong to us or to the people who licensed
        them to us. These terms give you a limited, personal right to watch; they don’t give you ownership of anything.
        If you believe something on {BRAND} infringes your rights, see <Link href="/copyright">Copyright &amp; takedown</Link>.
      </p>

      <h2>7. Things you must not do</h2>
      <ul>
        <li>Try to get around plans, device limits, regional limits, screen-recording protection or download protection.</li>
        <li>Use bots, scrapers or other automated tools on the service, or try to break its security.</li>
        <li>Upload or send anything unlawful through the service.</li>
      </ul>

      <h2>8. Availability and liability</h2>
      <p>
        We work hard to keep {BRAND} running, but we can’t promise it will always be available or error-free (for example during
        maintenance, network or power problems). To the extent the law allows, our total responsibility to you for any claim is
        limited to the amount you paid us in the 30 days before the claim. Nothing here limits rights you have under Ugandan
        consumer law that can’t be limited.
      </p>

      <h2>9. Ending your account</h2>
      <p>
        You can stop using {BRAND} at any time and ask us to delete your account (see our <Link href="/privacy">Privacy Policy</Link>).
        Paid time left at that point is not refunded, except as our Refund Policy says.
      </p>

      <h2>10. Changes and law</h2>
      <p>
        We may update these terms; the date at the top shows the latest version, and for important changes we’ll tell you on the
        site or by email. These terms are governed by the laws of Uganda, and disputes go to the courts of Uganda.
      </p>

      <h2>11. Contact</h2>
      <ContactLines c={c} />
    </LegalPage>
  );
}
