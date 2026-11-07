'use client';

import { useActionState } from 'react';
import { saveAd, saveAdTiming, type AdState } from '@/app/admin/ads/actions';
import { ImageUpload } from './ImageUpload';

type AdRow = { id: string; name: string; headline: string; subtext: string | null; image_url: string | null; link_url: string | null; cta: string; starts_at: string; ends_at: string | null; weight: number };

const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export function AdForm({ ad }: { ad?: AdRow }) {
  const [state, action, pending] = useActionState<AdState, FormData>(saveAd, {});
  return (
    <form action={action}>
      {ad && <input type="hidden" name="id" value={ad.id} />}
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <div className="a-grid2">
        <div className="a-field">
          <label>Name (only you see this)</label>
          <input name="name" className="input" defaultValue={ad?.name} placeholder="e.g. Kampala Phones – November" required />
        </div>
        <div className="a-field">
          <label>Button text</label>
          <input name="cta" className="input" defaultValue={ad?.cta ?? 'Visit'} maxLength={18} />
        </div>
      </div>
      <div className="a-field">
        <label>Headline (what viewers read)</label>
        <input name="headline" className="input" defaultValue={ad?.headline} maxLength={70} placeholder="e.g. 50% off smartphones this week" required />
      </div>
      <div className="a-field">
        <label>Second line (optional)</label>
        <input name="subtext" className="input" defaultValue={ad?.subtext ?? ''} maxLength={110} placeholder="e.g. Kampala Road · Call 07…" />
      </div>
      <div className="a-field">
        <label>Link (optional, opens when tapped)</label>
        <input name="link_url" className="input" defaultValue={ad?.link_url ?? ''} placeholder="https://…" />
      </div>
      <ImageUpload name="image_url" label="Logo or picture (optional)" hint="A logo or small picture. It shows as a small square on the left of the bar." initial={ad?.image_url ?? null} shape="wide" />
      <div className="a-grid3">
        <div className="a-field">
          <label>Starts</label>
          <input name="starts_at" type="date" className="input" defaultValue={day(ad?.starts_at ?? null)} />
        </div>
        <div className="a-field">
          <label>Ends (optional)</label>
          <input name="ends_at" type="date" className="input" defaultValue={day(ad?.ends_at ?? null)} />
        </div>
        <div className="a-field">
          <label>How often vs other adverts (1–10)</label>
          <input name="weight" className="input" inputMode="numeric" defaultValue={ad?.weight ?? 1} />
        </div>
      </div>
      <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Saving…' : ad ? 'Save advert' : 'Add advert'}</button>
    </form>
  );
}

export function AdTimingForm({ first, every, show }: { first: string; every: string; show: string }) {
  const [state, action, pending] = useActionState<AdState, FormData>(saveAdTiming, {});
  return (
    <form action={action}>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <div className="a-grid3">
        <div className="a-field"><label>First advert after (minutes)</label><input name="ad_first_after_min" className="input" inputMode="decimal" defaultValue={first} /></div>
        <div className="a-field"><label>Then every (minutes)</label><input name="ad_every_min" className="input" inputMode="decimal" defaultValue={every} /></div>
        <div className="a-field"><label>Show for (seconds)</label><input name="ad_show_sec" className="input" inputMode="numeric" defaultValue={show} /></div>
      </div>
      <button className="btn btn-gray btn-small" disabled={pending}>{pending ? 'Saving…' : 'Save timing'}</button>
    </form>
  );
}
