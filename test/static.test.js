import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CRON_UTC_HOURS } from "../lib/forecast-logic.js";

const root = new URL("../", import.meta.url);

test("la página es instalable en el iPhone y la leyenda está en español", () => {
  const html = readFileSync(new URL("index.html", root), "utf8");
  assert.match(html, /lang="es"/);
  assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /apple-mobile-web-app-title" content="Viento medio"/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /manifest.webmanifest/);
  assert.match(html, /theme-color/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /al menos 3 horas seguidas/);
  assert.match(html, /09:00 y las 20:00/);
  assert.match(html, /Malgrat/);
  assert.match(html, /Barcarés/);
  assert.match(html, /Orzales/);

  const manifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", root), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "es");
  assert.equal(manifest.start_url, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "180x180" || icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
});

test("el workflow programa las seis horas UTC y un disparo manual", () => {
  const yaml = readFileSync(new URL(".github/workflows/forecast.yml", root), "utf8");
  const hours = [...yaml.matchAll(/cron:\s*"0 (\d+) \* \* \*"/g)].map((match) => Number(match[1]));
  assert.deepEqual(hours.sort((a, b) => a - b), [...CRON_UTC_HOURS].sort((a, b) => a - b));
  assert.match(yaml, /workflow_dispatch/);
  assert.match(yaml, /Europe\/Madrid/);
});
