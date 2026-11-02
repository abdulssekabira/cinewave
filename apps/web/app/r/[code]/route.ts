import { NextResponse, type NextRequest } from 'next/server';

/** Invite link: glemovies.com/r/K7P2QX → sign-up with the code filled in. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const url = new URL(`/login?mode=signup${code ? `&ref=${code}` : ''}`, req.nextUrl.origin);
  const res = NextResponse.redirect(url);
  if (code) res.cookies.set('gle_ref', code, { maxAge: 60 * 60 * 24 * 30, path: '/', sameSite: 'lax', secure: true });
  return res;
}
