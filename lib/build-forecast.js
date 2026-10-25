import { SOURCES, SPOTS, SOURCE_COUNT } from "./spots.js";
import {
  averageNumbers,
  averageWind,
  evaluateWindow,
  hourFromLocalIso,
  majorityCode,
  weatherLabel,
} from "./forecast-logic.js";

function hourlyMap(body) {
  const hourly = body?.hourly;
  if (!hourly?.time) return null;
  const map = new Map();
  hourly.time.forEach((time, index) => {
    map.set(time, {
      speedKt: hourly.wind_speed_10m?.[index] ?? null,
      directionDeg: hourly.wind_direction_10m?.[index] ?? null,
      tempC: hourly.temperature_2m?.[index] ?? null,
      weatherCode: hourly.weather_code?.[index] ?? null,
    });
  });
  return map;
}

function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}

/**
 * Une las respuestas de las fuentes. Si una falla, entra en la media
 * solo con las que devolvieron un número.
 */
export function buildForecast({ generatedAt, results, spots = SPOTS, sources = SOURCES }) {
  const bySpot = new Map();
  for (const spot of spots) bySpot.set(spot.id, []);
  for (const result of results) {
    if (!bySpot.has(result.spotId)) bySpot.set(result.spotId, []);
    bySpot.get(result.spotId).push(result);
  }

  const sourceSummary = sources.map((source) => {
    const rows = results.filter((result) => result.sourceId === source.id);
    const failed = rows.filter((result) => !result.ok);
    return {
      id: source.id,
      slot: source.slot,
      slotLabel: source.slotLabel,
      name: source.name,
      model: source.model,
      provider: source.provider,
      via: source.via,
      reason: source.reason,
      ok: rows.some((result) => result.ok),
      spotsOk: rows.filter((result) => result.ok).length,
      spots: rows.length,
      error: failed[0]?.error ?? null,
    };
  });

  const builtSpots = spots.map((spot) => {
    const rows = bySpot.get(spot.id) ?? [];
    const prepared = sources.map((source) => {
      const result = rows.find((row) => row.sourceId === source.id);
      const ok = Boolean(result?.ok && result.body);
      return {
        source,
        ok,
        error: result?.error ?? (ok ? null : "no respondió"),
        map: ok ? hourlyMap(result.body) : null,
        grid: ok
          ? {
              latitude: result.body.latitude ?? null,
              longitude: result.body.longitude ?? null,
              elevation: result.body.elevation ?? null,
            }
          : null,
      };
    });

    const times = new Set();
    for (const row of prepared) {
      if (!row.map) continue;
      for (const time of row.map.keys()) times.add(time);
    }

    const hours = [...times]
      .sort()
      .map((time) => {
        const parsed = hourFromLocalIso(time);
        if (!parsed) return null;
        const samples = prepared.map((row) => {
          const point = row.map?.get(time);
          if (!point) return null;
          return {
            speedKt: finiteOrNull(point.speedKt),
            directionDeg: finiteOrNull(point.directionDeg),
            tempC: finiteOrNull(point.tempC),
            weatherCode: integerOrNull(point.weatherCode),
          };
        });
        const wind = averageWind(
          samples.map((sample) =>
            sample && sample.speedKt != null ? { speedKt: sample.speedKt, directionDeg: sample.directionDeg } : null,
          ),
        );
        const temp = averageNumbers(samples.map((sample) => sample?.tempC ?? null));
        const codes = samples.map((sample) => sample?.weatherCode).filter((code) => code != null);
        return {
          time,
          hour: parsed.hour,
          windKt: wind.windKt,
          windDir: wind.windDir,
          windSources: wind.sources,
          tempC: temp.value,
          tempSources: temp.sources,
          weatherCode: majorityCode(codes),
          weatherSources: codes.length,
        };
      })
      .filter(Boolean);

    const byDate = new Map();
    for (const hour of hours) {
      const date = hour.time.slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(hour);
    }

    const days = [...byDate.keys()].sort().map((date) => {
      const dayHours = byDate.get(date).sort((a, b) => a.hour - b.hour || a.time.localeCompare(b.time));
      const verdict = evaluateWindow(dayHours);
      const daytime = dayHours.filter((hour) => hour.hour >= 9 && hour.hour <= 20);
      const weatherPool = daytime.length > 0 ? daytime : dayHours;
      const weatherCode = majorityCode(weatherPool.map((hour) => hour.weatherCode));
      const voters = weatherPool.filter((hour) => hour.weatherCode === weatherCode && weatherCode != null);
      const weatherSources = voters.length
        ? Math.min(...voters.map((hour) => hour.weatherSources))
        : 0;

      const temps = dayHours.filter((hour) => hour.tempC != null);
      const tempMinHour = temps.reduce((best, hour) => (best == null || hour.tempC < best.tempC ? hour : best), null);
      const tempMaxHour = temps.reduce((best, hour) => (best == null || hour.tempC > best.tempC ? hour : best), null);
      const windPool = daytime.filter((hour) => hour.windKt != null);
      const windMax = windPool.reduce((best, hour) => (best == null || hour.windKt > best.windKt ? hour : best), null);

      return {
        date,
        weatherCode,
        weatherLabel: weatherLabel(weatherCode),
        weatherSources,
        tempMin: tempMinHour?.tempC ?? null,
        tempMax: tempMaxHour?.tempC ?? null,
        tempSources:
          tempMinHour && tempMaxHour ? Math.min(tempMinHour.tempSources, tempMaxHour.tempSources) : 0,
        windMaxKt: windMax?.windKt ?? null,
        windMaxDir: windMax?.windDir ?? null,
        windMaxHour: windMax?.hour ?? null,
        windMaxSources: windMax?.windSources ?? 0,
        highlight: verdict.highlight,
        qualifyingHours: verdict.qualifyingHours,
        hours: dayHours,
      };
    });

    return {
      id: spot.id,
      name: spot.name,
      shortName: spot.shortName,
      area: spot.area,
      detail: spot.detail,
      latitude: spot.latitude,
      longitude: spot.longitude,
      timezone: spot.timezone,
      cellSelection: spot.cellSelection,
      cellNote: spot.cellNote,
      webcam: spot.webcam,
      sources: prepared.map((row) => ({
        id: row.source.id,
        name: row.source.name,
        slotLabel: row.source.slotLabel,
        ok: row.ok,
        error: row.ok ? null : row.error,
        grid: row.grid,
      })),
      days,
    };
  });

  return {
    generatedAt,
    timezone: "Europe/Madrid",
    sourceCount: sources.length || SOURCE_COUNT,
    thresholdKt: 10,
    minStreak: 3,
    window: { start: 9, end: 20 },
    sources: sourceSummary,
    spots: builtSpots,
  };
}

export function validateForecast(data, { expectDays = 7 } = {}) {
  const errors = [];
  if (!data || typeof data !== "object") return ["el pronóstico no es un objeto"];
  if (typeof data.generatedAt !== "string") errors.push("falta generatedAt");
  if (!Array.isArray(data.spots) || data.spots.length === 0) errors.push("no hay spots");
  for (const spot of data.spots ?? []) {
    if (!Array.isArray(spot.days) || spot.days.length === 0) {
      errors.push(`${spot.id}: sin días`);
      continue;
    }
    if (expectDays && spot.days.length < expectDays) {
      errors.push(`${spot.id}: se esperaban ${expectDays} días y hay ${spot.days.length}`);
    }
    for (const day of spot.days) {
      const verdict = evaluateWindow(day.hours ?? []);
      if (verdict.highlight !== day.highlight) {
        errors.push(`${spot.id} ${day.date}: el resalte no coincide`);
      }
      const stored = [...(day.qualifyingHours ?? [])].sort((a, b) => a - b);
      if (stored.join(",") !== verdict.qualifyingHours.join(",")) {
        errors.push(`${spot.id} ${day.date}: las horas marcadas no coinciden`);
      }
      const present = new Set((day.hours ?? []).map((hour) => hour.hour));
      for (let hour = 9; hour <= 20; hour += 1) {
        if (!present.has(hour)) errors.push(`${spot.id} ${day.date}: falta la hora ${hour}`);
      }
      for (const hour of day.hours ?? []) {
        if (hour.windKt == null && hour.windSources !== 0) {
          errors.push(`${spot.id} ${hour.time}: viento nulo con fuentes`);
        }
        if (hour.windKt != null && (hour.windSources < 1 || hour.windSources > 3)) {
          errors.push(`${spot.id} ${hour.time}: número de fuentes inválido`);
        }
      }
    }
  }
  return errors;
}
