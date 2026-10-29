/** "Chrome on Android", "Safari on iPhone", "GLE Movies app on Android"… */
export function deviceName(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device';
  const os = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux' : '';
  if (/GLE Movies app|okhttp|Expo|Dalvik/i.test(ua)) return `GLE Movies app${os ? ` on ${os}` : ''}`;
  const browser = /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /EdgA?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return os ? `${browser} on ${os}` : browser;
}

export type Device = {
  session_id: string;
  user_agent: string | null;
  signed_in_at: string;
  last_active: string;
  is_current: boolean;
  allowed: boolean;
};
