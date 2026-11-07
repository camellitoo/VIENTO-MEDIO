/** Horas civiles de Madrid a las que apunta el cron: 00:00, 08:00 y 16:00. */
export const FETCH_LOCAL_HOURS = [0, 8, 16];

/**
 * El cron de GitHub Actions va en UTC y a menudo arranca horas más tarde.
 * En verano las tomas caen en 6, 14 y 22 UTC; en invierno, en 7, 15 y 23.
 * Se programan las seis. La descarga no exige esa hora exacta: mira cuánto
 * tiempo lleva generado el pronóstico.
 */
export const CRON_UTC_HOURS = [6, 7, 14, 15, 22, 23];

/** Cadencia prevista entre tomas. */
export const FETCH_INTERVAL_MS = 8 * 60 * 60 * 1000;

/**
 * Margen por debajo de las 8 horas. Se vuelve a descargar si el archivo
 * tiene al menos 6 horas, para que un cron retrasado no se quede fuera
 * y el cron gemelo (una o dos horas después) no repita la toma.
 */
export const FETCH_MARGIN_MS = 2 * 60 * 60 * 1000;

export const FETCH_MAX_AGE_MS = FETCH_INTERVAL_MS - FETCH_MARGIN_MS;

export const WINDOW_START = 9;
export const WINDOW_END = 20;
export const WIND_THRESHOLD_KT = 10;
export const MIN_STREAK = 3;
export const MADRID = "Europe/Madrid";

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];

const WEATHER = {
  0: "Despejado",
  1: "Casi despejado",
  2: "Parcialmente nublado",
  3: "Cubierto",
  45: "Niebla",
  48: "Niebla",
  51: "Llovizna",
  53: "Llovizna",
  55: "Llovizna fuerte",
  56: "Llovizna helada",
  57: "Llovizna helada",
  61: "Lluvia débil",
  63: "Lluvia",
  65: "Lluvia fuerte",
  66: "Lluvia helada",
  67: "Lluvia helada",
  71: "Nieve débil",
  73: "Nieve",
  75: "Nieve fuerte",
  77: "Granos de nieve",
  80: "Chubascos",
  81: "Chubascos",
  82: "Chubascos fuertes",
  85: "Chubascos de nieve",
  86: "Chubascos de nieve",
  95: "Tormenta",
  96: "Tormenta con granizo",
  99: "Tormenta con granizo",
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function weatherLabel(code) {
  if (!Number.isInteger(code)) return "Sin tiempo";
  return WEATHER[code] ?? "Tiempo variable";
}

export function weatherKind(code) {
  if (!Number.isInteger(code)) return "unknown";
  if (code === 0) return "clear";
  if (code === 1) return "mainly";
  if (code === 2) return "partly";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 71 && code <= 77) return "snow";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 80) return "shower";
  if (code >= 61) return "rain";
  return "unknown";
}

export function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function normalizeDeg(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return ((Math.round(value) % 360) + 360) % 360;
}

export function compassLabel(deg) {
  const normal = normalizeDeg(deg);
  if (normal == null) return "–";
  const index = Math.round(normal / 22.5) % 16;
  return COMPASS[index];
}

/** La flecha mira hacia donde sopla el viento; las letras dicen de dónde viene. */
export function arrowRotation(deg) {
  const normal = normalizeDeg(deg);
  if (normal == null) return null;
  return (normal + 180) % 360;
}

export function averageNumbers(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (usable.length === 0) return { value: null, sources: 0 };
  const mean = usable.reduce((sum, value) => sum + value, 0) / usable.length;
  return { value: round1(mean), sources: usable.length };
}

/**
 * La velocidad es la media aritmética de las fuentes válidas.
 * La dirección es la media circular, sin ponderar por la velocidad,
 * y se omite si los vectores se anulan.
 */
export function averageWind(samples) {
  const usable = [];
  for (const sample of samples) {
    if (!sample) continue;
    const speed = sample.speedKt;
    if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0) continue;
    usable.push(sample);
  }
  if (usable.length === 0) return { windKt: null, windDir: null, sources: 0 };

  const mean = usable.reduce((sum, sample) => sum + sample.speedKt, 0) / usable.length;
  const directed = usable.filter(
    (sample) =>
      sample.speedKt > 0 &&
      typeof sample.directionDeg === "number" &&
      Number.isFinite(sample.directionDeg),
  );

  let windDir = null;
  if (directed.length > 0) {
    let east = 0;
    let north = 0;
    for (const sample of directed) {
      const radians = (sample.directionDeg * Math.PI) / 180;
      east += Math.sin(radians);
      north += Math.cos(radians);
    }
    east /= directed.length;
    north /= directed.length;
    if (east * east + north * north > 1e-6) {
      windDir = normalizeDeg((Math.atan2(east, north) * 180) / Math.PI);
    }
  }

  return { windKt: round1(mean), windDir, sources: usable.length };
}

export function majorityCode(codes) {
  const counts = new Map();
  for (const code of codes) {
    if (!Number.isInteger(code) || code < 0) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best = null;
  let bestCount = -1;
  for (const [code, count] of counts) {
    if (count > bestCount || (count === bestCount && code < best)) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Marca un día si, entre las 09:00 y las 20:00 inclusive, hay al menos
 * tres horas seguidas con viento medio estrictamente mayor de 10 nudos.
 * Solo se marcan las horas que forman esa racha. Un hueco o un valor
 * ausente rompen la racha. Las horas fuera de la ventana no cuentan.
 */
export function evaluateWindow(hours) {
  const inWindow = hours
    .filter((hour) => Number.isInteger(hour.hour) && hour.hour >= WINDOW_START && hour.hour <= WINDOW_END)
    .slice()
    .sort((a, b) => a.hour - b.hour);

  const seen = new Set();
  const unique = [];
  for (const hour of inWindow) {
    if (seen.has(hour.hour)) continue;
    seen.add(hour.hour);
    unique.push(hour);
  }

  const qualifying = new Set();
  let run = [];
  let previous = null;

  const flush = () => {
    if (run.length >= MIN_STREAK) {
      for (const hour of run) qualifying.add(hour.hour);
    }
    run = [];
  };

  for (const hour of unique) {
    const above =
      typeof hour.windKt === "number" && Number.isFinite(hour.windKt) && hour.windKt > WIND_THRESHOLD_KT;
    const consecutive = previous == null || hour.hour === previous + 1;
    if (above && (run.length === 0 || consecutive)) {
      run.push(hour);
    } else {
      flush();
      run = above ? [hour] : [];
    }
    previous = hour.hour;
  }
  flush();

  return {
    highlight: qualifying.size > 0,
    qualifyingHours: [...qualifying].sort((a, b) => a - b),
  };
}

export function hourFromLocalIso(iso) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return null;
  return { date: match[1], hour: Number(match[2]), minute: Number(match[3]) };
}

export function formatDayLabel(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day} ${MONTHS[month - 1]}`;
}

export function formatKt(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "sin dato";
  return `${value.toFixed(1).replace(".", ",")} kt`;
}

export function formatTemp(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "–";
  return `${value.toFixed(1).replace(".", ",")}°`;
}

export function formatSources(count, total = 3) {
  const safe = Number.isInteger(count) && count > 0 ? count : 0;
  return `${safe}/${total}`;
}

export function formatCoord(latitude, longitude) {
  const ns = latitude >= 0 ? "N" : "S";
  const ew = longitude >= 0 ? "E" : "O";
  const decimals = Math.abs(longitude) > 0 && Math.abs(longitude) < 5 ? 4 : 4;
  return `${Math.abs(latitude).toFixed(decimals)}° ${ns}, ${Math.abs(longitude).toFixed(decimals)}° ${ew}`;
}

export function partsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function civilDate(date, timeZone) {
  const parts = partsInTimeZone(date, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function offsetMinutes(date, timeZone) {
  const parts = partsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

export function formatOffsetIso(date, timeZone = MADRID) {
  const offset = offsetMinutes(date, timeZone);
  const shifted = new Date(date.getTime() + offset * 60000);
  const stamp = shifted.toISOString().slice(0, 19);
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${stamp}${sign}${hours}:${minutes}`;
}

/** Convierte una hora civil de Madrid a UTC. Las 00:00, 08:00 y 16:00 no caen en la hora ambigua. */
export function madridLocalToUtc(year, month, day, hour, minute = 0) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  let utc = new Date(guess.getTime() - offsetMinutes(guess, MADRID) * 60000);
  const refined = offsetMinutes(utc, MADRID);
  utc = new Date(guess.getTime() - refined * 60000);
  return utc;
}

export function forecastGeneratedAt(text) {
  try {
    const data = JSON.parse(text);
    return typeof data?.generatedAt === "string" ? data.generatedAt : null;
  } catch {
    return null;
  }
}

/**
 * Un disparo manual siempre descarga. En el cron, la toma se hace si no hay
 * fecha o si generatedAt tiene al menos FETCH_MAX_AGE_MS. Así da igual que
 * GitHub dispare el workflow varias horas después de las 00:00, 08:00 o 16:00.
 */
export function shouldFetch(now, { force = false, generatedAt = null } = {}) {
  if (force) return { run: true, reason: "manual", generatedAt };
  const parsed = typeof generatedAt === "string" ? new Date(generatedAt) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return { run: true, reason: "sin-fecha", generatedAt };
  }
  const ageMs = now.getTime() - parsed.getTime();
  const ageHours = Math.round((ageMs / 3600000) * 10) / 10;
  const run = ageMs >= FETCH_MAX_AGE_MS;
  return {
    run,
    reason: run ? "antiguo" : "reciente",
    ageHours,
    generatedAt,
  };
}

export function formatUpdated(iso, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sin fecha de actualización";
  const absolute = new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  let relative = "";
  if (minutes >= 0 && minutes < 2) relative = "ahora mismo";
  else if (minutes >= 2 && minutes < 60) relative = `hace ${minutes} min`;
  else if (minutes >= 60 && minutes < 48 * 60) relative = `hace ${Math.round(minutes / 60)} h`;
  return relative ? `Actualizado ${absolute} (${relative})` : `Actualizado ${absolute}`;
}
