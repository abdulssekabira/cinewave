import AsyncStorage from '@react-native-async-storage/async-storage';
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

const LAST = 'gle:lastcrash';
let installed = false;
/** Reports crashes that happen outside a screen (keeps the normal behaviour too). */
export function installCrashReporter() {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: Error, fatal?: boolean) => void; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void } };
  const eu = g.ErrorUtils;
  if (!eu) return;
  // A crash from the last time the app was open that couldn't be sent then.
  AsyncStorage.getItem(LAST).then((raw) => {
    if (!raw) return;
    AsyncStorage.removeItem(LAST).catch(() => {});
    try { const c = JSON.parse(raw) as { m: string; d: string | null }; reportError('crash-saved', c.m, c.d); } catch { /* ignore */ }
  }).catch(() => {});
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    const m = e?.message ?? String(e);
    const d = e?.stack ?? null;
    try { reportError(fatal ? 'crash' : 'error', m, d); } catch { /* ignore */ }
    if (!fatal) { prev(e, fatal); return; }
    // Save it, and give the report a moment to reach us before the app closes.
    AsyncStorage.setItem(LAST, JSON.stringify({ m: m.slice(0, 2000), d: d ? d.slice(0, 4000) : null })).catch(() => {});
    setTimeout(() => prev(e, fatal), 1500);
  });
}
