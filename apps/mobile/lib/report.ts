import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const sent = new Map<string, number>();

/** Sends an error report to GLE Movies (Admin can read them), at most once a minute per message. */
export function reportError(kind: string, message: string, detail?: string | null) {
  const key = `${kind}:${message}`.slice(0, 300);
  const now = Date.now();
  if ((sent.get(key) ?? 0) > now - 60_000) return;
  sent.set(key, now);
  const consts = Platform.constants as { Model?: string; Brand?: string; Manufacturer?: string } | undefined;
  const device = [Platform.OS, String(Platform.Version), consts?.Brand ?? consts?.Manufacturer, consts?.Model].filter(Boolean).join(' ');
  const version = `${Constants.expoConfig?.version ?? '?'}${Updates.updateId ? ` · ${Updates.updateId.slice(0, 8)}` : ' · built-in'}`;
  supabase
    .from('app_errors')
    .insert({ kind: kind.slice(0, 40), message: (message || 'unknown').slice(0, 2000), detail: detail ? detail.slice(0, 4000) : null, app_version: version.slice(0, 60), device: device.slice(0, 200) })
    .then(() => {}, () => {});
}

let installed = false;
/** Reports crashes that happen outside a screen (keeps the normal behaviour too). */
export function installCrashReporter() {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: Error, fatal?: boolean) => void; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void } };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    try { reportError(fatal ? 'crash' : 'error', e?.message ?? String(e), e?.stack ?? null); } catch { /* ignore */ }
    prev(e, fatal);
  });
}
