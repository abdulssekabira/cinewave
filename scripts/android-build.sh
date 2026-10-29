#!/usr/bin/env bash
# One-command Android build for GLE Movies (run inside a GitHub Codespace).
# It signs you in to Expo, creates the Expo project the first time,
# then builds an installable APK on Expo's servers.
set -e
cd "$(dirname "$0")/.."

echo ""
echo "== GLE Movies Android build =="
echo ""
echo "1/4 Installing (takes a minute or two)…"
npm install --no-audit --no-fund --loglevel=error

cd apps/mobile
echo ""
echo "2/4 Sign in to Expo (use the Expo account you created)."
npx --yes eas-cli@latest whoami >/dev/null 2>&1 || npx --yes eas-cli@latest login

echo ""
echo "3/4 Connecting this app to your Expo account (answer Y if asked)…"
npx --yes eas-cli@latest init

echo ""
echo "4/4 Starting the build on Expo's servers."
echo "    If it asks to 'Generate a new Android Keystore', answer Y."
npx --yes eas-cli@latest build --platform android --profile "${1:-preview}" --no-wait

# Save the Expo project ID in the code so future builds can start from expo.dev.
cd ../..
if ! git diff --quiet -- apps/mobile/app.json; then
  git add apps/mobile/app.json
  git -c user.name="GLE Movies build" -c user.email="build@glemovies.com" commit -m "Link Expo project" >/dev/null
  git push >/dev/null 2>&1 && echo "Saved the Expo project link to GitHub." || echo "Note: could not push the project link (that's OK)."
fi

echo ""
echo "Done. The build is running on Expo's servers (usually 10–30 minutes)."
echo "Open expo.dev on your phone → your project → Builds to download the APK when it's ready."
