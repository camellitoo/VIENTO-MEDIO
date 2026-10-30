import assert from "node:assert/strict";
import test from "node:test";
import {
  CRON_UTC_HOURS,
  FETCH_INTERVAL_MS,
  FETCH_LOCAL_HOURS,
  FETCH_MARGIN_MS,
  FETCH_MAX_AGE_MS,
  arrowRotation,
  averageWind,
  compassLabel,
  evaluateWindow,
  forecastGeneratedAt,
  formatCoord,
  formatKt,
  madridLocalToUtc,
  partsInTimeZone,
  round1,
  shouldFetch,
} from "../lib/forecast-logic.js";

test("la media de velocidad es aritmética y no el módulo del vector", () => {
  const bothWays = averageWind([
    { speedKt: 10, directionDeg: 0 },
    { speedKt: 20, directionDeg: 180 },
  ]);
  assert.equal(bothWays.windKt, 15);
  assert.equal(bothWays.windDir, null);
  assert.equal(bothWays.sources, 2);
});

test("una fuente caída no entra en la media", () => {
  const result = averageWind([
    { speedKt: 12, directionDeg: 90 },
    null,
    { speedKt: 18, directionDeg: 90 },
  ]);
  assert.equal(result.windKt, 15);
  assert.equal(result.windDir, 90);
  assert.equal(result.sources, 2);
});

test("si no hay ninguna fuente el valor queda vacío", () => {
  const result = averageWind([null, { speedKt: null }, { speedKt: -1, directionDeg: 10 }]);
  assert.equal(result.windKt, null);
  assert.equal(result.sources, 0);
});

test("la dirección media cruza el norte sin irse a 180", () => {
  const result = averageWind([
    { speedKt: 10, directionDeg: 350 },
    { speedKt: 10, directionDeg: 10 },
  ]);
  assert.equal(result.windDir, 0);
  assert.equal(compassLabel(result.windDir), "N");
});

test("la rosa de los vientos usa letras en español", () => {
  assert.equal(compassLabel(0), "N");
  assert.equal(compassLabel(225), "SO");
  assert.equal(compassLabel(270), "O");
  assert.equal(compassLabel(202.5), "SSO");
  assert.equal(compassLabel(360), "N");
  assert.equal(arrowRotation(0), 180);
  assert.equal(arrowRotation(90), 270);
});

test("el redondeo a un decimal decide el umbral de 10 nudos", () => {
  assert.equal(round1(10.04), 10);
  assert.equal(round1(10.06), 10.1);
  assert.equal(formatKt(10.1), "10,1 kt");
  assert.equal(formatKt(null), "sin dato");
});

test("tres horas seguidas por encima de 10 nudos marcan el día y esas horas", () => {
  const verdict = evaluateWindow([
    { hour: 11, windKt: 8 },
    { hour: 12, windKt: 12 },
    { hour: 13, windKt: 12.5 },
    { hour: 14, windKt: 11 },
    { hour: 15, windKt: 14 },
    { hour: 16, windKt: 4 },
  ]);
  assert.equal(verdict.highlight, true);
  assert.deepEqual(verdict.qualifyingHours, [12, 13, 14, 15]);
});

test("dos horas seguidas no bastan", () => {
  const verdict = evaluateWindow([
    { hour: 12, windKt: 16 },
    { hour: 13, windKt: 16 },
    { hour: 14, windKt: 5 },
  ]);
  assert.equal(verdict.highlight, false);
  assert.deepEqual(verdict.qualifyingHours, []);
});

test("10,0 nudos exactos no superan el umbral", () => {
  const verdict = evaluateWindow([
    { hour: 10, windKt: 10 },
    { hour: 11, windKt: 10 },
    { hour: 12, windKt: 10 },
  ]);
  assert.equal(verdict.highlight, false);
});

test("10,1 durante tres horas sí cuenta", () => {
  const verdict = evaluateWindow([
    { hour: 9, windKt: 10.1 },
    { hour: 10, windKt: 10.1 },
    { hour: 11, windKt: 10.1 },
  ]);
  assert.deepEqual(verdict.qualifyingHours, [9, 10, 11]);
});

test("un hueco rompe la racha y solo marca el tramo de tres", () => {
  const verdict = evaluateWindow([
    { hour: 9, windKt: 12 },
    { hour: 10, windKt: 12 },
    { hour: 11, windKt: 12 },
    { hour: 12, windKt: 4 },
    { hour: 13, windKt: 15 },
    { hour: 14, windKt: 15 },
  ]);
  assert.deepEqual(verdict.qualifyingHours, [9, 10, 11]);
});

test("una hora sin dato rompe la racha", () => {
  const verdict = evaluateWindow([
    { hour: 14, windKt: 15 },
    { hour: 15, windKt: null },
    { hour: 16, windKt: 15 },
    { hour: 17, windKt: 15 },
  ]);
  assert.equal(verdict.highlight, false);
});

test("las horas fuera de 09:00 a 20:00 no cuentan aunque haya mucho viento", () => {
  const verdict = evaluateWindow([
    { hour: 8, windKt: 25 },
    { hour: 18, windKt: 11 },
    { hour: 19, windKt: 11.2 },
    { hour: 20, windKt: 13 },
    { hour: 21, windKt: 25 },
  ]);
  assert.equal(verdict.highlight, true);
  assert.deepEqual(verdict.qualifyingHours, [18, 19, 20]);
});

test("dos rachas separadas marcan todas sus horas", () => {
  const verdict = evaluateWindow([
    { hour: 9, windKt: 11 },
    { hour: 10, windKt: 11 },
    { hour: 11, windKt: 11 },
    { hour: 12, windKt: 2 },
    { hour: 16, windKt: 14 },
    { hour: 17, windKt: 14 },
    { hour: 18, windKt: 14 },
    { hour: 19, windKt: 14 },
  ]);
  assert.deepEqual(verdict.qualifyingHours, [9, 10, 11, 16, 17, 18, 19]);
});

test("la entrada desordenada se ordena antes de medir la racha", () => {
  const verdict = evaluateWindow([
    { hour: 12, windKt: 13 },
    { hour: 10, windKt: 13 },
    { hour: 11, windKt: 13 },
  ]);
  assert.deepEqual(verdict.qualifyingHours, [10, 11, 12]);
});

test("Orzales se escribe con longitud oeste", () => {
  assert.equal(formatCoord(43.0005, -4.0698), "43.0005° N, 4.0698° O");
});

test("se descarga si el pronóstico tiene 6 horas o más, con margen sobre las 8", () => {
  assert.equal(FETCH_INTERVAL_MS, 8 * 60 * 60 * 1000);
  assert.equal(FETCH_MARGIN_MS, 2 * 60 * 60 * 1000);
  assert.equal(FETCH_MAX_AGE_MS, 6 * 60 * 60 * 1000);

  const generatedAt = "2026-10-26T00:40:49+01:00";
  const fresh = shouldFetch(new Date("2026-10-26T02:40:49+01:00"), { generatedAt });
  assert.equal(fresh.run, false);
  assert.equal(fresh.reason, "reciente");
  assert.equal(fresh.ageHours, 2);

  const justBefore = shouldFetch(new Date("2026-10-26T06:40:48+01:00"), { generatedAt });
  assert.equal(justBefore.run, false);
  assert.equal(justBefore.reason, "reciente");

  const boundary = shouldFetch(new Date("2026-10-26T06:40:49+01:00"), { generatedAt });
  assert.equal(boundary.run, true);
  assert.equal(boundary.reason, "antiguo");
  assert.equal(boundary.ageHours, 6);
});

test("un cron retrasado del 30 de octubre habría descargado el archivo del día 26", () => {
  const generatedAt = "2026-10-26T00:40:49+01:00";
  const delayed = shouldFetch(new Date("2026-10-30T02:26:51Z"), { generatedAt });
  assert.equal(delayed.run, true);
  assert.equal(delayed.reason, "antiguo");
  assert.ok(delayed.ageHours > 90);

  const morning = shouldFetch(new Date("2026-10-29T13:54:38Z"), { generatedAt });
  assert.equal(morning.run, true);
  assert.equal(morning.reason, "antiguo");
});

test("el disparo manual siempre descarga y una fecha ausente también", () => {
  const generatedAt = "2026-10-30T11:00:00+01:00";
  const now = new Date("2026-10-30T11:20:00+01:00");
  const manual = shouldFetch(now, { force: true, generatedAt });
  assert.equal(manual.run, true);
  assert.equal(manual.reason, "manual");

  assert.equal(shouldFetch(now).run, true);
  assert.equal(shouldFetch(now).reason, "sin-fecha");
  assert.equal(shouldFetch(now, { generatedAt: "ayer" }).reason, "sin-fecha");
  assert.equal(shouldFetch(now, { generatedAt: "" }).reason, "sin-fecha");
  assert.equal(forecastGeneratedAt("{"), null);
  assert.equal(forecastGeneratedAt('{"generatedAt":"2026-10-26T00:40:49+01:00"}'), "2026-10-26T00:40:49+01:00");
  assert.equal(forecastGeneratedAt('{"generatedAt":1}'), null);

  const future = shouldFetch(new Date("2026-10-26T00:00:00Z"), { generatedAt: "2026-10-26T05:00:00+01:00" });
  assert.equal(future.run, false);
  assert.equal(future.reason, "reciente");
});

test("cada día de 2026 y 2027 las tres horas locales caen en un cron de UTC", () => {
  for (let year = 2026; year <= 2027; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      for (let day = 1; day <= days; day += 1) {
        for (const hour of FETCH_LOCAL_HOURS) {
          const utc = madridLocalToUtc(year, month, day, hour);
          const back = partsInTimeZone(utc, "Europe/Madrid");
          assert.equal(back.hour, hour, `${year}-${month}-${day} ${hour}`);
          assert.equal(back.day, day);
          assert.equal(back.month, month);
          assert.ok(CRON_UTC_HOURS.includes(utc.getUTCHours()));
        }
      }
    }
  }
});
