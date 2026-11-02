import type { SupabaseClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

export type Referrals = {
  code: string;
  joined: number;
  counted: number;
  needed: number;
  reward_days: number;
  rewards: number;
  max_rewards: number;
  standard_until: string | null;
};

export async function myReferrals(sb: SupabaseClient): Promise<Referrals | null> {
  const { data } = await sb.rpc('my_referrals_v2');
  const r = (Array.isArray(data) ? data[0] : data) as Referrals | undefined;
  return r?.code ? r : null;
}

export const inviteLink = (code: string) => `https://www.glemovies.com/r/${code}`;

export function inviteQrSvg(code: string) {
  return QRCode.toString(inviteLink(code), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
}

export const rewardLabel = (days: number) => (days % 30 === 0 ? `${days / 30} month${days === 30 ? '' : 's'}` : `${days} days`);
