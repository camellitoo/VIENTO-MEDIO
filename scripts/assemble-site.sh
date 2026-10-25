#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$root/_site"
mkdir -p "$root/_site/lib" "$root/_site/icons" "$root/_site/data"
cp "$root/index.html" "$root/styles.css" "$root/app.js" "$root/manifest.webmanifest" "$root/sw.js" "$root/.nojekyll" "$root/favicon.ico" "$root/_site/"
cp "$root/lib/"*.js "$root/_site/lib/"
cp "$root/icons/"*.png "$root/icons/"*.svg "$root/_site/icons/"
cp "$root/data/forecast.json" "$root/_site/data/"
