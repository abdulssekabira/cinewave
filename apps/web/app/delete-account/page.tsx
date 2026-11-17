import type { Metadata } from 'next';
import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { HelpLine } from '@/components/HelpLine';
import { DeleteForm } from './DeleteForm';

export const metadata: Metadata = { title: 'Delete your account', description: 'How to delete your GLE Movies account and data.' };
export const dynamic = 'force-dynamic';

export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const sp = await searchParams;
  const user = sp.done ? null : (await getUser()).user;
  return (
    <div className="page legal" style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1>Delete your GLE Movies account</h1>
      {sp.done ? (
        <div className="form-msg ok" role="status">Your account and data have been deleted. Thank you for watching with GLE Movies.</div>
      ) : (
        <>
          <p>You can delete your account at any time, from the app (<b>Profile → Delete account</b>) or on this page.</p>
          <h2>What gets deleted</h2>
          <ul>
            <li>Your account, email address, username and profile</li>
            <li>Your watchlist, viewing progress, reviews, scene comments and notifications</li>
            <li>Your device sign-ins and offline download licences</li>
            <li>Any plan or free time left on the account (it can&rsquo;t be refunded or moved)</li>
          </ul>
          <p>
            Deletion happens straight away and can&rsquo;t be undone. Records of payments you made are kept as required for
            accounting and tax, without being linked to an account. Films downloaded on your phone stop playing.
          </p>
          <h2>Delete now</h2>
          {user ? (
            <>
              <p>Signed in as <b>{user.email}</b>.</p>
              <DeleteForm />
            </>
          ) : (
            <p>
              <Link className="btn btn-accent" href="/login?next=/delete-account">Sign in to delete your account</Link>
            </p>
          )}
          <h2>Can&rsquo;t sign in?</h2>
          <p>Contact us from the email address on your account and we&rsquo;ll delete it for you within 7 days.</p>
          <HelpLine title="" topic="deleting my account" />
        </>
      )}
    </div>
  );
}
