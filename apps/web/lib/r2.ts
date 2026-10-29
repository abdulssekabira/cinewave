import { AwsClient } from 'aws4fetch';

/**
 * Cloudflare R2 (S3-compatible) storage for films. Server only: the keys
 * never reach the browser. Viewers and uploaders only ever get short-lived
 * signed links for one file.
 *
 * Vercel variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET (e.g. "gle-movies").
 */

/**
 * Tolerates small pasting slips in Vercel: spaces/new lines, the full
 * "S3 API" link instead of the Account ID, or a bucket name with slashes.
 */
const env = (k: string) => (process.env[k] ?? '').trim().replace(/^["']|["']$/g, '');
const accountId = () => {
  const raw = env('R2_ACCOUNT_ID');
  return /[0-9a-f]{32}/i.exec(raw)?.[0]?.toLowerCase() ?? raw;
};
const bucket = () => env('R2_BUCKET').replace(/^.*\//, '').replace(/\/+$/, '') || env('R2_BUCKET');

export function r2Configured() {
  return Boolean(env('R2_ACCOUNT_ID') && env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY') && env('R2_BUCKET'));
}

/** Plain-language check of the settings, for the admin page. */
export function r2SettingsProblem(): string | null {
  if (!r2Configured()) return 'Cloudflare storage isn’t connected yet: add the R2 keys in Vercel, then redeploy.';
  if (!/^[0-9a-f]{32}$/.test(accountId())) return 'R2_ACCOUNT_ID in Vercel doesn’t look right. It should be the 32-character Account ID from the R2 page.';
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket())) return 'R2_BUCKET in Vercel should be just the bucket name: gle-movies';
  return null;
}

let client: AwsClient | null = null;
function aws() {
  const problem = r2SettingsProblem();
  if (problem) throw new Error(problem);
  client ??= new AwsClient({
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    service: 's3',
    region: 'auto',
  });
  return client;
}

const base = () => `https://${accountId()}.r2.cloudflarestorage.com/${bucket()}`;
const bucketUrl = base;
const objectUrl = (key: string) => `${base()}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function call(url: string, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await aws().fetch(url, init);
  } catch (e) {
    const problem = r2SettingsProblem();
    throw new Error(problem ?? `Couldn’t reach Cloudflare storage (${e instanceof Error ? (e.cause as Error | undefined)?.message ?? e.message : 'network error'}).`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
    const msg = /<Message>([^<]+)<\/Message>/.exec(body)?.[1];
    throw new Error(`Cloudflare storage: ${code ?? res.status}${msg ? ` – ${msg}` : ''}`);
  }
  return res;
}

const tag = (xml: string, name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1] ?? null;

/** A signed link to one file, valid for `seconds` (max 7 days). */
export async function signedGet(key: string, seconds = 6 * 3600, downloadName?: string) {
  const u = new URL(objectUrl(key));
  u.searchParams.set('X-Amz-Expires', String(Math.min(604800, Math.max(60, Math.round(seconds)))));
  if (downloadName) u.searchParams.set('response-content-disposition', `attachment; filename="${downloadName.replace(/"/g, '')}"`);
  const signed = await aws().sign(u.toString(), { method: 'GET', aws: { signQuery: true } });
  return signed.url;
}

// ------------------------------------------------------------- uploads

/** Big files go up in pieces of this size (R2 needs ≥ 5 MB, same size except the last). */
export const PART_SIZE = 16 * 1024 * 1024;

export async function createMultipart(key: string, contentType: string) {
  const res = await call(`${objectUrl(key)}?uploads`, { method: 'POST', headers: { 'Content-Type': contentType || 'video/mp4' } });
  const id = tag(await res.text(), 'UploadId');
  if (!id) throw new Error('Cloudflare storage didn’t start the upload.');
  return id;
}

/** Signed links the browser PUTs each piece to (valid 7 days so slow uploads can finish). */
export async function signParts(key: string, uploadId: string, parts: number[]) {
  return Promise.all(
    parts.map(async (n) => {
      const u = new URL(objectUrl(key));
      u.searchParams.set('partNumber', String(n));
      u.searchParams.set('uploadId', uploadId);
      u.searchParams.set('X-Amz-Expires', '604800');
      const s = await aws().sign(u.toString(), { method: 'PUT', aws: { signQuery: true } });
      return { n, url: s.url };
    }),
  );
}

/** Pieces already stored (so an upload can continue after a reload). */
export async function listParts(key: string, uploadId: string) {
  const out: { n: number; etag: string; size: number }[] = [];
  let marker = '';
  for (let i = 0; i < 20; i++) {
    const u = new URL(objectUrl(key));
    u.searchParams.set('uploadId', uploadId);
    if (marker) u.searchParams.set('part-number-marker', marker);
    const xml = await (await call(u.toString())).text();
    for (const m of xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
      out.push({ n: Number(tag(m[1], 'PartNumber')), etag: tag(m[1], 'ETag') ?? '', size: Number(tag(m[1], 'Size')) });
    }
    if (tag(xml, 'IsTruncated') !== 'true') break;
    marker = tag(xml, 'NextPartNumberMarker') ?? '';
    if (!marker) break;
  }
  return out;
}

export async function completeMultipart(key: string, uploadId: string, parts: { n: number; etag: string }[]) {
  const body =
    '<CompleteMultipartUpload>' +
    parts
      .sort((a, b) => a.n - b.n)
      .map((p) => `<Part><PartNumber>${p.n}</PartNumber><ETag>${p.etag.replace(/&/g, '&amp;')}</ETag></Part>`)
      .join('') +
    '</CompleteMultipartUpload>';
  const u = new URL(objectUrl(key));
  u.searchParams.set('uploadId', uploadId);
  await call(u.toString(), { method: 'POST', body, headers: { 'Content-Type': 'application/xml' } });
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  const res = await aws().fetch(objectUrl(key), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (res.status === 403) throw new Error('Cloudflare storage: AccessDenied');
  if (!res.ok) throw new Error(`Cloudflare storage: ${res.status}`);
  return { size: Number(res.headers.get('content-length') ?? 0) };
}

/** Lists files under a folder (used by the bulk import). */
export async function listObjects(prefix: string, max = 1000) {
  const out: { key: string; size: number }[] = [];
  let token = '';
  while (out.length < max) {
    const u = new URL(bucketUrl());
    u.searchParams.set('list-type', '2');
    u.searchParams.set('prefix', prefix);
    u.searchParams.set('max-keys', '1000');
    if (token) u.searchParams.set('continuation-token', token);
    const xml = await (await call(u.toString())).text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = tag(m[1], 'Key');
      if (key) out.push({ key: key.replace(/&amp;/g, '&'), size: Number(tag(m[1], 'Size')) });
    }
    if (tag(xml, 'IsTruncated') !== 'true') break;
    token = tag(xml, 'NextContinuationToken') ?? '';
    if (!token) break;
  }
  return out.slice(0, max);
}

/**
 * Lets the admin page upload straight to storage from glemovies.com.
 * Needs an "Admin Read & Write" R2 token; done once, automatically.
 */
let corsDone = false;
export async function ensureCors(origins: string[]) {
  if (corsDone) return;
  const rules = `<CORSConfiguration><CORSRule>${origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join('')}` +
    '<AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>' +
    '<AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>86400</MaxAgeSeconds></CORSRule></CORSConfiguration>';
  const u = new URL(bucketUrl());
  u.searchParams.set('cors', '');
  const md5 = await contentMd5(rules);
  await call(u.toString().replace('cors=', 'cors'), { method: 'PUT', body: rules, headers: { 'Content-Type': 'application/xml', 'Content-MD5': md5 } });
  corsDone = true;
}

async function contentMd5(s: string) {
  const { createHash } = await import('node:crypto');
  return createHash('md5').update(s).digest('base64');
}
