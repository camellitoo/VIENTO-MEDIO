import assert from "node:assert/strict";
import test from "node:test";
import { buildForecast, validateForecast } from "../lib/build-forecast.js";
import { SOURCES } from "../lib/spots.js";
import { renderSpot } from "../lib/render.js";
import { syntheticForecast } from "./synthetic.js";

test("los casos sintéticos resaltan solo la racha real y cuentan las fuentes", () => {
  const forecast = syntheticForecast();
  const day = (id) => forecast.spots.find((spot) => spot.id === id).days[0];

  assert.equal(day("racha").highlight, true);
  assert.deepEqual(day("racha").qualifyingHours, [12, 13, 14, 15]);
  assert.equal(day("racha").hours.find((hour) => hour.hour === 12).windKt, 14);
  assert.equal(day("racha").hours.find((hour) => hour.hour === 12).windSources, 3);

  assert.equal(day("corta").highlight, false);
  assert.deepEqual(day("corta").qualifyingHours, []);

  assert.equal(day("justo").highlight, false);
  assert.equal(day("justo").hours.find((hour) => hour.hour === 10).windKt, 10);

  assert.equal(day("borde").highlight, true);
  assert.deepEqual(day("borde").qualifyingHours, [18, 19, 20]);

  assert.equal(day("hueco").highlight, true);
  assert.deepEqual(day("hueco").qualifyingHours, [9, 10, 11]);

  assert.equal(day("parcial").highlight, true);
  assert.deepEqual(day("parcial").qualifyingHours, [11, 12, 13]);
  assert.equal(day("parcial").hours.find((hour) => hour.hour === 11).windSources, 2);

  assert.equal(day("vacio").highlight, false);
  assert.equal(day("vacio").hours.find((hour) => hour.hour === 12).windKt, null);
  assert.equal(day("vacio").windMaxKt, null);

  assert.equal(validateForecast(forecast, { expectDays: 2 }).length, 0);
  assert.equal(forecast.sources.find((source) => source.id === "gfs").ok, true);
});

function panel(html, id) {
  const match = html.match(new RegExp(`data-spot-panel="${id}"[\\s\\S]*?</section>`));
  assert.ok(match, id);
  return match[0];
}

test("la pantalla marca el día, las horas que suman y las fuentes que faltan", () => {
  const forecast = syntheticForecast();
  const html = forecast.spots.map((spot) => renderSpot(spot, { today: "2026-10-25", nowHour: 10 })).join("\n");
  const onDate = (id, highlight) => {
    assert.match(panel(html, id), new RegExp(`data-date="2026-10-25" data-highlight="${highlight}"`));
  };

  onDate("racha", "true");
  onDate("corta", "false");
  onDate("justo", "false");
  onDate("borde", "true");
  onDate("hueco", "true");
  onDate("parcial", "true");
  onDate("vacio", "false");

  assert.equal((panel(html, "racha").match(/data-qualifies="true"/g) ?? []).length, 4);
  assert.equal((panel(html, "borde").match(/data-qualifies="true"/g) ?? []).length, 3);
  assert.equal((panel(html, "hueco").match(/data-qualifies="true"/g) ?? []).length, 3);
  assert.equal((panel(html, "corta").match(/data-qualifies="true"/g) ?? []).length, 0);
  assert.match(panel(html, "borde"), /data-date="2026-10-25"[\s\S]*data-qualifies="false"[\s\S]*18:00/);
  assert.match(html, /Buen viento/);
  assert.match(html, />suma</);
  assert.match(panel(html, "parcial"), /2\/3/);
  assert.match(panel(html, "vacio"), /sin dato/);
  assert.match(panel(html, "racha"), /SO/);
  assert.equal((html.match(/Ver la playa en directo/g) ?? []).length, 1);
  assert.match(panel(html, "barcares"), /skaping\.com\/le-barcares\/dosses/);
  assert.doesNotMatch(panel(html, "racha"), /Ver la playa en directo/);
  assert.match(html, /hour--past/);
  assert.doesNotMatch(html, /Suave/);
});

test("el html escapa el nombre del spot", () => {
  const html = renderSpot({
    id: "x",
    name: "<script>",
    detail: "detalle",
    area: "zona",
    latitude: 1,
    longitude: 2,
    cellNote: "nota",
    webcam: null,
    days: [],
  });
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("10,06 nudos redondeados a 10,1 sí resaltan y 10,04 no", () => {
  const hours = (speed) => {
    const time = [];
    const wind = [];
    for (let hour = 0; hour < 24; hour += 1) {
      time.push(`2026-10-25T${String(hour).padStart(2, "0")}:00`);
      wind.push(hour >= 9 && hour <= 11 ? speed : 4);
    }
    return {
      latitude: 1,
      longitude: 1,
      elevation: 1,
      hourly: {
        time,
        wind_speed_10m: wind,
        wind_direction_10m: wind.map(() => 180),
        temperature_2m: wind.map(() => 15),
        weather_code: wind.map(() => 0),
      },
    };
  };
  const make = (speed) =>
    buildForecast({
      generatedAt: "2026-10-25T08:00:00+01:00",
      spots: [
        {
          id: "umbral",
          name: "Umbral",
          shortName: "Umbral",
          area: "prueba",
          detail: "prueba",
          latitude: 1,
          longitude: 1,
          timezone: "Europe/Madrid",
          cellSelection: "land",
          cellNote: "prueba",
          webcam: null,
        },
      ],
      sources: [SOURCES[0]],
      results: [{ spotId: "umbral", sourceId: "gfs", ok: true, error: null, body: hours(speed) }],
    });

  assert.equal(make(10.06).spots[0].days[0].highlight, true);
  assert.equal(make(10.06).spots[0].days[0].hours.find((hour) => hour.hour === 9).windKt, 10.1);
  assert.equal(make(10.04).spots[0].days[0].highlight, false);
  assert.equal(make(10.04).spots[0].days[0].hours.find((hour) => hour.hour === 9).windKt, 10);
});
