import { buildForecast } from "../lib/build-forecast.js";
import { SOURCES } from "../lib/spots.js";

function stamp(day, hour) {
  return `${day}T${String(hour).padStart(2, "0")}:00`;
}

function bodyFor(speedAt, { nullHours = new Set(), fail = false } = {}) {
  if (fail) return null;
  const time = [];
  const wind_speed_10m = [];
  const wind_direction_10m = [];
  const temperature_2m = [];
  const weather_code = [];
  for (const day of ["2026-10-25", "2026-10-26"]) {
    for (let hour = 0; hour < 24; hour += 1) {
      time.push(stamp(day, hour));
      const calm = day === "2026-10-26";
      const missing = !calm && nullHours.has(hour);
      wind_speed_10m.push(missing ? null : calm ? 4 : speedAt(hour));
      wind_direction_10m.push(missing ? null : 225);
      temperature_2m.push(missing ? null : calm ? 12 : 18 + hour / 10);
      weather_code.push(missing ? null : 1);
    }
  }
  return {
    latitude: 41.6,
    longitude: 2.7,
    elevation: 4,
    hourly: { time, wind_speed_10m, wind_direction_10m, temperature_2m, weather_code },
  };
}

function spot(id, name, speedAt, options = {}) {
  return {
    id,
    name,
    shortName: name,
    area: "Caso sintético",
    detail: options.detail ?? "Prueba",
    latitude: options.latitude ?? 41.64,
    longitude: options.longitude ?? 2.75,
    timezone: "Europe/Madrid",
    cellSelection: "sea",
    cellNote: "Caso de prueba.",
    webcam: options.webcam ?? null,
  };
}

function resultsFor(spotId, speedAt, { dropSource = null, nullHours = new Set() } = {}) {
  return SOURCES.map((source) => {
    const fail = source.id === dropSource;
    return {
      spotId,
      sourceId: source.id,
      ok: !fail,
      error: fail ? "no respondió" : null,
      body: bodyFor(speedAt, { fail, nullHours: source.id === "icon" ? nullHours : new Set() }),
    };
  });
}

/** Pronóstico sintético. Las expectativas están en el test, no aquí. */
export function syntheticForecast() {
  const spots = [
    spot("racha", "Racha"),
    spot("corta", "Corta"),
    spot("justo", "Justo"),
    spot("borde", "Borde"),
    spot("hueco", "Hueco"),
    spot("parcial", "Parcial"),
    spot("vacio", "Vacío"),
    spot("barcares", "Barcarés", () => 6, {
      detail: "Playa de Les Dosses",
      latitude: 42.83733193,
      longitude: 3.02343965,
      webcam: {
        title: "Webcam de Les Dosses",
        provider: "Skaping",
        pageUrl: "https://www.skaping.com/le-barcares/dosses",
        embedUrl: "https://www.skaping.com/le-barcares/dosses",
      },
    }),
  ];

  const patterns = {
    racha: (hour) => (hour >= 12 && hour <= 15 ? 14 : 5),
    corta: (hour) => (hour === 12 || hour === 13 ? 16 : 5),
    justo: (hour) => (hour >= 10 && hour <= 12 ? 10 : 4),
    borde: (hour) => {
      if (hour === 8 || hour === 21) return 25;
      if (hour >= 18 && hour <= 20) return 11.2;
      return 3;
    },
    hueco: (hour) => {
      if (hour >= 9 && hour <= 11) return 12;
      if (hour === 12) return 4;
      if (hour === 13 || hour === 14) return 15;
      return 5;
    },
    parcial: (hour) => (hour >= 11 && hour <= 13 ? 15 : 4),
    vacio: () => 0,
    barcares: () => 6,
  };

  const results = spots.flatMap((item) => {
    if (item.id === "parcial") {
      return resultsFor(item.id, patterns.parcial, { dropSource: "gfs" });
    }
    if (item.id === "vacio") {
      const silent = new Set(Array.from({ length: 24 }, (_, hour) => hour));
      return SOURCES.map((source) => ({
        spotId: item.id,
        sourceId: source.id,
        ok: true,
        error: null,
        body: bodyFor(() => null, { nullHours: silent }),
      }));
    }
    return resultsFor(item.id, patterns[item.id]);
  });

  return buildForecast({
    generatedAt: "2026-10-25T08:00:00+01:00",
    results,
    spots,
    sources: SOURCES,
  });
}
