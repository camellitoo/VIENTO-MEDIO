import assert from "node:assert/strict";
import test from "node:test";
import {
  CRON_UTC_HOURS,
  FETCH_LOCAL_HOURS,
  arrowRotation,
  averageWind,
  compassLabel,
  evaluateWindow,
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

test("el cron de UTC cubre las 08:00, 16:00 y 00:00 de Madrid en invierno, verano y los cambios de hora", () => {
  const samples = [
    ["2026-01-15T07:00:00Z", true],
    ["2026-01-15T06:00:00Z", false],
    ["2026-01-15T15:00:00Z", true],
    ["2026-01-15T14:00:00Z", false],
    ["2026-01-14T23:00:00Z", true],
    ["2026-01-14T22:00:00Z", false],
    ["2026-07-15T06:00:00Z", true],
    ["2026-07-15T07:00:00Z", false],
    ["2026-07-15T14:00:00Z", true],
    ["2026-07-15T15:00:00Z", false],
    ["2026-07-14T22:00:00Z", true],
    ["2026-07-14T23:00:00Z", false],
    ["2026-10-24T22:00:00Z", true],
    ["2026-10-24T23:00:00Z", false],
    ["2026-10-25T07:00:00Z", true],
    ["2026-10-25T06:00:00Z", false],
    ["2026-10-25T15:00:00Z", true],
    ["2026-10-25T14:00:00Z", false],
    ["2026-03-28T23:00:00Z", true],
    ["2026-03-28T22:00:00Z", false],
    ["2026-03-29T06:00:00Z", true],
    ["2026-03-29T07:00:00Z", false],
    ["2026-03-29T14:00:00Z", true],
    ["2026-03-29T15:00:00Z", false],
  ];
  for (const [iso, expected] of samples) {
    assert.equal(shouldFetch(new Date(iso)).run, expected, iso);
  }
  assert.equal(shouldFetch(new Date("2026-01-15T03:00:00Z"), { force: true }).run, true);
  assert.equal(shouldFetch(new Date("2026-01-15T03:00:00Z"), { force: true }).reason, "manual");
});

test("cada día de 2026 y 2027 las tres horas locales caen en un cron y su gemela de horario no", () => {
  const twin = { 6: 7, 7: 6, 14: 15, 15: 14, 22: 23, 23: 22 };
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
          assert.equal(shouldFetch(utc).run, true);
          const other = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), twin[utc.getUTCHours()]));
          assert.equal(shouldFetch(other).run, false, other.toISOString());
        }
      }
    }
  }
});
