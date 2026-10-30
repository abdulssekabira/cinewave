'use client';

import { useActionState } from 'react';
import { saveAppSettings, type FormState } from '@/app/admin/plans/actions';

export function AppLinkForm({ url, version, note }: { url: string; version: string; note: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAppSettings, {});
  return (
    <form action={action}>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <div className="a-field">
        <label htmlFor="apk-url">Download link (the .apk file)</label>
        <input id="apk-url" name="android_apk_url" className="input" type="url" defaultValue={url} placeholder="https://expo.dev/artifacts/eas/….apk" />
        <small className="a-hint">On expo.dev → Builds → your build → hold the Install/Download button → Copy link.</small>
      </div>
      <div className="a-grid2 tight">
        <div className="a-field">
          <label htmlFor="apk-ver">Version</label>
          <input id="apk-ver" name="android_version" className="input" defaultValue={version} placeholder="1.1.0" />
        </div>
        <div className="a-field">
          <label htmlFor="apk-note">Short note (optional)</label>
          <input id="apk-note" name="android_note" className="input" defaultValue={note} placeholder="Test version" />
        </div>
      </div>
      <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
