// Applies patches/ (the download add-on fix for the Android app).
// The website build doesn't need it, so it never fails there; an app build
// on EAS must have it, so it fails loudly there.
const { spawnSync } = require('child_process');
const path = require('path');
let bin;
try {
  bin = path.join(path.dirname(require.resolve('patch-package/package.json')), 'index.js');
} catch {
  if (process.env.EAS_BUILD) { console.error('patch-package is missing'); process.exit(1); }
  console.log('patch-package not installed here; skipping app patches');
  process.exit(0);
}
const r = spawnSync(process.execPath, [bin], { stdio: 'inherit' });
if (r.status !== 0 && process.env.EAS_BUILD) process.exit(r.status ?? 1);
process.exit(0);
