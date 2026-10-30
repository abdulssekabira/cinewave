import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Get the app',
  description: 'Download the GLE Movies app for Android.',
};
export const dynamic = 'force-dynamic';

/** Public page to share: glemovies.com/app */
export default async function AppPage() {
  const sb = await createClient();
  const { data } = await sb.from('site_settings').select('key, value').in('key', ['android_apk_url', 'android_version', 'android_note']);
  const get = (k: string) => data?.find((r) => r.key === k)?.value?.trim() || null;
  const url = get('android_apk_url');
  const version = get('android_version');
  const note = get('android_note');

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', padding: '28px 0 8px' }}>
        <img src="/icon.png" alt="" width={88} height={88} style={{ borderRadius: 20, margin: '0 auto 16px', display: 'block' }} />
        <h1 className="page-title" style={{ marginBottom: 6 }}>GLE Movies for Android</h1>
        <p className="muted" style={{ margin: 0 }}>
          Watch movies and series, continue where you stopped, and download to watch offline.
          {version ? ` Version ${version}.` : ''}
        </p>
      </div>

      {url ? (
        <>
          <div style={{ textAlign: 'center', margin: '22px 0 28px' }}>
            <a href={url} className="btn btn-accent" style={{ minWidth: 260 }} rel="nofollow">Download for Android</a>
            {note && <p className="muted" style={{ marginTop: 12 }}>{note}</p>}
          </div>

          <section className="app-steps">
            <h2>How to install</h2>
            <ol>
              <li>Tap <b>Download for Android</b>. If Chrome asks, tap <b>Download anyway</b>.</li>
              <li>Open the downloaded file (from the notification or your <b>Downloads</b>).</li>
              <li>If Android says installing from this source isn’t allowed, tap <b>Settings</b>, turn on <b>Allow from this source</b>, go back and tap <b>Install</b>.</li>
              <li>If Play Protect warns about an unknown app, tap <b>More details → Install anyway</b>. This is normal for apps that aren’t on Google Play yet.</li>
              <li>Open <b>GLE Movies</b> and sign in with your username or email.</li>
            </ol>
            <p className="muted">
              Already have the app? Installing again updates it and keeps you signed in. Most updates also arrive by
              themselves the next time you reopen the app.
            </p>
          </section>
        </>
      ) : (
        <p className="muted" style={{ textAlign: 'center', margin: '28px 0' }}>The Android app is coming soon.</p>
      )}

      <p className="muted" style={{ textAlign: 'center', marginTop: 28 }}>
        On iPhone or a computer? Watch on <Link href="/">glemovies.com</Link> in your browser.
      </p>
    </div>
  );
}
