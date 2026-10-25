import { SOURCE_COUNT } from "./spots.js";
import {
  arrowRotation,
  compassLabel,
  formatCoord,
  formatDayLabel,
  formatKt,
  formatSources,
  formatTemp,
  weatherKind,
} from "./forecast-logic.js";

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function weatherIcon(kind) {
  const common = 'viewBox="0 0 24 24" aria-hidden="true"';
  if (kind === "clear") {
    return `<svg ${common}><circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/></g></svg>`;
  }
  if (kind === "mainly" || kind === "partly") {
    return `<svg ${common}><circle cx="8" cy="9" r="3" fill="currentColor"/><path d="M8 14h8a3.5 3.5 0 0 0 0-7 4.5 4.5 0 0 0-8.4 1.5A3 3 0 0 0 8 14z" fill="currentColor" opacity=".9"/></svg>`;
  }
  if (kind === "overcast" || kind === "fog") {
    return `<svg ${common}><path d="M7 17h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.6A3.5 3.5 0 0 0 7 17z" fill="currentColor"/></svg>`;
  }
  if (kind === "snow") {
    return `<svg ${common}><path d="M12 3v18M5 7.5l14 9M19 7.5l-14 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>`;
  }
  if (kind === "storm") {
    return `<svg ${common}><path d="M7 15h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.4A3 3 0 0 0 7 15z" fill="currentColor"/><path d="M11 15.5 9 20h3l-1 3 4-5h-3l1-2.5z" fill="currentColor"/></svg>`;
  }
  if (kind === "drizzle" || kind === "rain" || kind === "shower") {
    return `<svg ${common}><path d="M7 13h10a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.3A3 3 0 0 0 7 13z" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 16.5 8 20M12 16.5 11 20M15 16.5 14 20"/></g></svg>`;
  }
  return `<svg ${common}><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 10h.5M14.5 10H15M9 15c1.2 1 4.8 1 6 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

function hourRow(hour, { past = false } = {}) {
  const qualifying = hour.qualifies === true;
  const rotation = arrowRotation(hour.windDir);
  const arrow =
    rotation == null
      ? `<span class="arrow arrow--empty" aria-hidden="true">–</span>`
      : `<svg class="arrow" viewBox="0 0 24 24" style="transform:rotate(${rotation}deg)" aria-hidden="true"><path d="M12 2.5 18 11h-4v10h-4V11H6z" fill="currentColor"/></svg>`;
  const letters = compassLabel(hour.windDir);
  const from = letters === "–" ? "sin dirección" : `viento del ${letters}`;
  const classes = ["hour", qualifying ? "hour--sum" : "", past ? "hour--past" : ""].filter(Boolean).join(" ");
  return `<div class="${classes}" data-qualifies="${qualifying ? "true" : "false"}" role="row">
    <span class="hour-time">${String(hour.hour).padStart(2, "0")}:00</span>
    ${arrow}
    <span class="hour-dir" aria-label="${escapeHtml(from)}">${escapeHtml(letters)}</span>
    <span class="hour-speed">${escapeHtml(formatKt(hour.windKt))}</span>
    <span class="src" title="Fuentes que entraron en la media">${escapeHtml(formatSources(hour.windSources, SOURCE_COUNT))}</span>
    ${qualifying ? `<span class="pill">suma</span>` : `<span class="pill pill--empty"></span>`}
  </div>`;
}

export function renderBanner(forecast) {
  const failed = (forecast.sources ?? []).filter((source) => source.ok === false);
  if (failed.length === 0) return "";
  const names = failed.map((source) => `${source.name} (hueco ${source.slotLabel})`).join(", ");
  return `<p class="banner" role="status">${escapeHtml(names)} no respondió en esta actualización. La media usa solo las fuentes con dato.</p>`;
}

export function renderSpot(spot, { today = null, expandedDates = null, nowHour = null } = {}) {
  const days = spot.days ?? [];
  const open = expandedDates instanceof Set ? expandedDates : new Set(today ? [today] : []);
  const webcam = spot.webcam
    ? `<div class="webcam">
        <button type="button" class="webcam-open" data-webcam-open aria-expanded="false" aria-controls="webcam-${escapeHtml(spot.id)}">Ver la playa en directo</button>
        <div id="webcam-${escapeHtml(spot.id)}" class="webcam-panel" hidden>
          <a class="text-link" href="${escapeHtml(spot.webcam.pageUrl)}" target="_blank" rel="noopener noreferrer">Si no se ve aquí, ábrela en ${escapeHtml(spot.webcam.provider)}</a>
          <div class="webcam-frame">
            <iframe data-webcam-frame title="${escapeHtml(spot.webcam.title)}" data-src="${escapeHtml(spot.webcam.embedUrl)}" allow="fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
          </div>
          <p class="fine">Imagen pública de ${escapeHtml(spot.detail)}, operada por ${escapeHtml(spot.webcam.provider)}.</p>
        </div>
      </div>`
    : "";

  const cards = days
    .map((day) => {
      const qualifying = new Set(day.qualifyingHours ?? []);
      const visible = (day.hours ?? []).filter((hour) => hour.hour >= 9 && hour.hour <= 20);
      const isToday = day.date === today;
      const expanded = open.has(day.date);
      const panelId = `hours-${spot.id}-${day.date}`;
      const rows = visible
        .map((hour) =>
          hourRow(
            { ...hour, qualifies: qualifying.has(hour.hour) },
            { past: isToday && nowHour != null && hour.hour < nowHour },
          ),
        )
        .join("");
      const maxDir = compassLabel(day.windMaxDir);
      return `<article class="day${day.highlight ? " day--wind" : ""}" data-date="${escapeHtml(day.date)}" data-highlight="${day.highlight ? "true" : "false"}">
        <button type="button" class="day-toggle" aria-expanded="${expanded ? "true" : "false"}" aria-controls="${panelId}">
          <span class="day-date">${isToday ? "Hoy · " : ""}${escapeHtml(formatDayLabel(day.date))}</span>
          ${day.highlight ? `<span class="badge">Buen viento</span>` : ""}
          <span class="day-weather">${weatherIcon(weatherKind(day.weatherCode))}<span>${escapeHtml(day.weatherLabel)}</span></span>
          <span class="day-wind"><span class="day-max">${escapeHtml(formatKt(day.windMaxKt))}</span><span class="day-dir">${escapeHtml(maxDir)}</span></span>
          <span class="day-temp">${escapeHtml(formatTemp(day.tempMax))} / ${escapeHtml(formatTemp(day.tempMin))} <span class="src">${escapeHtml(formatSources(day.tempSources, SOURCE_COUNT))}</span></span>
          <span class="day-more">${expanded ? "Ocultar horas" : "Ver horas"}</span>
        </button>
        <div id="${panelId}" class="hours" ${expanded ? "" : "hidden"}>
          <div class="hours-head" aria-hidden="true"><span>Hora</span><span></span><span>Dir.</span><span>Media</span><span>Fuentes</span><span></span></div>
          ${rows || `<p class="fine">Sin horas entre las 09:00 y las 20:00.</p>`}
        </div>
      </article>`;
    })
    .join("");

  return `<section class="spot" data-spot-panel="${escapeHtml(spot.id)}" aria-labelledby="tab-${escapeHtml(spot.id)}">
    <header class="spot-head">
      <h2>${escapeHtml(spot.name)}</h2>
      <p>${escapeHtml(spot.detail)} · ${escapeHtml(spot.area)}</p>
      <p class="fine">${escapeHtml(formatCoord(spot.latitude, spot.longitude))}. ${escapeHtml(spot.cellNote ?? "")}</p>
    </header>
    ${webcam}
    <div class="days">${cards || `<p class="banner">No hay días en este pronóstico.</p>`}</div>
  </section>`;
}

export function renderSourceNotes(forecast) {
  const items = (forecast.sources ?? [])
    .map(
      (source) =>
        `<li><strong>Hueco ${escapeHtml(source.slotLabel)}:</strong> ${escapeHtml(source.name)} (${escapeHtml(source.provider)}), vía ${escapeHtml(source.via)}. ${escapeHtml(source.reason)}</li>`,
    )
    .join("");
  return `<details class="notes">
    <summary>De dónde salen estos números</summary>
    <ul>${items}</ul>
    <p>La velocidad de cada hora es la media aritmética, en nudos, de las fuentes que respondieron. Si falta una, verás 2/3 o 1/3. Si faltan las tres, pone «sin dato». No se inventa ningún valor. La flecha apunta hacia donde sopla; las letras (N, SO, O…) dicen de dónde viene.</p>
  </details>`;
}
