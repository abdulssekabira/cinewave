import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSb } from '@supabase/supabase-js';
import { settle } from '@/lib/pesapal';

/**
 * Pesapal calls this whenever a payment's status changes. We never trust the
 * call itself: settle() asks Pesapal for the real status before recording it.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const tracking = q.get('OrderTrackingId') ?? '';
  const ref = q.get('OrderMerchantReference') ?? '';
  const type = q.get('OrderNotificationType') ?? 'IPNCHANGE';
  let status = 200;
  try {
    if (!tracking) throw new Error('missing id');
    const sb = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    await settle(sb, tracking);
  } catch {
    status = 500;
  }
  return NextResponse.json({ orderNotificationType: type, orderTrackingId: tracking, orderMerchantReference: ref, status });
}
