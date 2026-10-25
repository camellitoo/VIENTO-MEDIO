import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateForecast } from "../lib/build-forecast.js";
import { SOURCES, SPOTS } from "../lib/spots.js";

test("el pronóstico guardado trae números reales y el resalte cuadra", () => {
  const data = JSON.parse(readFileSync(new URL("../data/forecast.json", import.meta.url), "utf8"));
  assert.deepEqual(validateForecast(data), []);
  assert.deepEqual(
    data.spots.map((spot) => spot.id),
    SPOTS.map((spot) => spot.id),
  );
  assert.deepEqual(
    data.sources.map((source) => source.model),
    SOURCES.map((source) => source.model),
  );
  assert.ok(Number.isFinite(Date.parse(data.generatedAt)));

  for (const spot of data.spots) {
    const expected = SPOTS.find((item) => item.id === spot.id);
    assert.equal(spot.latitude, expected.latitude);
    assert.equal(spot.longitude, expected.longitude);
    assert.equal(spot.days.length, 7);
    const speeds = spot.days.flatMap((day) => day.hours.map((hour) => hour.windKt)).filter((value) => value != null);
    assert.ok(speeds.length >= 24 * 5, `${spot.id} apenas tiene viento`);
    for (const speed of speeds) {
      assert.ok(speed >= 0 && speed < 80, `${spot.id} ${speed}`);
    }
    const counted = spot.days.flatMap((day) => day.hours.map((hour) => hour.windSources));
    assert.ok(counted.some((count) => count >= 2), `${spot.id} no promedia más de una fuente`);
  }

  const working = data.sources.filter((source) => source.ok);
  assert.ok(working.length >= 2, "menos de dos modelos respondieron");
});
