import { civilDate, formatUpdated, partsInTimeZone } from "./lib/forecast-logic.js";
import { renderBanner, renderSourceNotes, renderSpot } from "./lib/render.js";

const tabs = [...document.querySelectorAll("[data-spot]")];
const app = document.querySelector("#app");
const updated = document.querySelector("#updated");
const banner = document.querySelector("#banner");
const notes = document.querySelector("#notes");
const themeButton = document.querySelector("#theme");

let forecast = null;
let spotId = initialSpot();

themeButton?.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effective = current || (prefersDark ? "dark" : "light");
  const next = effective === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("tema", next);
  } catch {
    /* la página sigue funcionando sin almacenamiento */
  }
  themeButton.textContent = next === "dark" ? "Claro" : "Oscuro";
  themeButton.setAttribute("aria-label", next === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
});

syncThemeButton();

tabs.forEach((tab) => {
  tab.addEventListener("click", () => selectSpot(tab.dataset.spot));
});

app.addEventListener("click", (event) => {
  const webcam = event.target.closest("[data-webcam-open]");
  if (webcam) {
    const panel = document.getElementById(webcam.getAttribute("aria-controls"));
    const open = webcam.getAttribute("aria-expanded") === "true";
    webcam.setAttribute("aria-expanded", open ? "false" : "true");
    webcam.textContent = open ? "Ver la playa en directo" : "Ocultar la webcam";
    if (panel) {
      panel.hidden = open;
      const frame = panel.querySelector("[data-webcam-frame]");
      if (!open && frame && !frame.getAttribute("src")) frame.setAttribute("src", frame.dataset.src);
    }
    return;
  }

  const toggle = event.target.closest(".day-toggle");
  if (!toggle) return;
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
  const more = toggle.querySelector(".day-more");
  if (more) more.textContent = expanded ? "Ver horas" : "Ocultar horas";
  const panel = document.getElementById(toggle.getAttribute("aria-controls"));
  if (panel) panel.hidden = expanded;
});

window.addEventListener("hashchange", () => {
  const next = spotFromHash();
  if (next && next !== spotId) selectSpot(next, { updateHash: false });
});

loadForecast();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

async function loadForecast() {
  try {
    const response = await fetch(new URL("data/forecast.json", document.baseURI), { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    forecast = await response.json();
    updated.textContent = formatUpdated(forecast.generatedAt);
    banner.innerHTML = renderBanner(forecast);
    notes.innerHTML = renderSourceNotes(forecast);
    selectSpot(spotId, { updateHash: false });
  } catch {
    updated.textContent = "No se ha podido leer el pronóstico.";
    app.innerHTML = `<p class="banner">El archivo de datos no está disponible. Cuando el flujo de GitHub Actions termine, recarga la página.</p>`;
  }
}

function selectSpot(id, { updateHash = true } = {}) {
  if (!forecast) return;
  const spot = forecast.spots.find((item) => item.id === id) ?? forecast.spots[0];
  spotId = spot.id;
  for (const tab of tabs) {
    const selected = tab.dataset.spot === spot.id;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
  }
  const now = new Date();
  const today = civilDate(now, spot.timezone);
  const hour = partsInTimeZone(now, spot.timezone).hour;
  app.innerHTML = renderSpot(spot, { today, expandedDates: new Set([today]), nowHour: hour });
  if (updateHash) {
    const next = `#${spot.id}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }
}

function initialSpot() {
  return spotFromHash() ?? "malgrat";
}

function spotFromHash() {
  const id = location.hash.replace("#", "");
  return ["malgrat", "barcares", "orzales"].includes(id) ? id : null;
}

function syncThemeButton() {
  if (!themeButton) return;
  const explicit = document.documentElement.getAttribute("data-theme");
  const dark = explicit ? explicit === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  themeButton.textContent = dark ? "Claro" : "Oscuro";
  themeButton.setAttribute("aria-label", dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
}
