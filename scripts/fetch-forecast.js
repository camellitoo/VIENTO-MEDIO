import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildForecast, validateForecast } from "../lib/build-forecast.js";
import { formatOffsetIso } from "../lib/forecast-logic.js";
import { SOURCES, SPOTS } from "../lib/spots.js";

const UA = "viento-medio/1.0 (+https://github.com/camellitoo/viento-medio)";
const OUT = new URL("../data/forecast.json", import.meta.url);

export function forecastUrl(spot, source) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(spot.latitude));
  url.searchParams.set("longitude", String(spot.longitude));
  url.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m,temperature_2m,weather_code");
  url.searchParams.set("wind_speed_unit", "kn");
  url.searchParams.set("timezone", spot.timezone);
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("models", source.model);
  url.searchParams.set("cell_selection", spot.cellSelection);
  return url;
}

export async function requestJson(url, { fetchImpl = fetch, attempts = 3 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (body?.error) throw new Error(body.reason || "Open-Meteo rechazó la petición");
      if (!body?.hourly?.time) throw new Error("la respuesta no trae horas");
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastError;
}

export async function collectResults({ fetchImpl = fetch, spots = SPOTS, sources = SOURCES } = {}) {
  const jobs = [];
  for (const spot of spots) {
    for (const source of sources) {
      jobs.push({ spot, source });
    }
  }
  const settled = await Promise.all(
    jobs.map(async ({ spot, source }) => {
      try {
        const body = await requestJson(forecastUrl(spot, source), { fetchImpl });
        return { spotId: spot.id, sourceId: source.id, ok: true, error: null, body };
      } catch (error) {
        return {
          spotId: spot.id,
          sourceId: source.id,
          ok: false,
          error: error instanceof Error ? error.message : "no respondió",
          body: null,
        };
      }
    }),
  );
  return settled;
}

export async function createForecast(options = {}) {
  const results = await collectResults(options);
  const anyOk = results.some((result) => result.ok);
  if (!anyOk) {
    const detail = results.map((result) => `${result.spotId}/${result.sourceId}: ${result.error}`).join("; ");
    throw new Error(`Ninguna fuente respondió. ${detail}`);
  }
  const forecast = buildForecast({
    generatedAt: formatOffsetIso(options.now ?? new Date()),
    results,
    spots: options.spots,
    sources: options.sources,
  });
  const errors = validateForecast(forecast);
  if (errors.length > 0) throw new Error(errors.join("; "));
  const anyWind = forecast.spots.some((spot) => spot.days.some((day) => day.hours.some((hour) => hour.windKt != null)));
  if (!anyWind) throw new Error("Las fuentes respondieron sin velocidades de viento");
  return forecast;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const forecast = await createForecast();
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(forecast, null, 2)}\n`);
  const failed = forecast.sources.filter((source) => !source.ok).map((source) => source.id);
  console.log(
    `Pronóstico escrito. Fuentes caídas: ${failed.length ? failed.join(", ") : "ninguna"}. Días: ${forecast.spots[0].days.length}.`,
  );
}
