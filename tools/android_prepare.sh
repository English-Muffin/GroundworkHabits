#!/bin/sh
# Generates the Android project (android/, never committed) from www/ and native/: Capacitor platform, the plain
# transparent launcher icons, and native/release.gradle (version from package.json, R8, optional release signing).
# Used by CI and by the F-Droid build recipe (tools/fdroid/). Needs node_modules (npm ci) first.
set -e
cd "$(dirname "$0")/.."
rm -rf android
npx cap add android
npx cap sync android
# no adaptive icon: launchers fill an adaptive icon's empty background with a colour
rm -rf android/app/src/main/res/mipmap-anydpi-v26
cp -r native/android-res/* android/app/src/main/res/
echo "apply from: '../../native/release.gradle'" >> android/app/build.gradle
