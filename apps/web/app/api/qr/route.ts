import { NextResponse, type NextRequest } from 'next/server';
import QRCode from 'qrcode';

/** QR image of an invite link (PNG), used by the app's Invite friends screen. */
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!code) return new NextResponse('Missing code', { status: 400 });
  const png = await QRCode.toBuffer(`https://www.glemovies.com/r/${code}`, { width: 600, margin: 2, errorCorrectionLevel: 'M' });
  return new NextResponse(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
