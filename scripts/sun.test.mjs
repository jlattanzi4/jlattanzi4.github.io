// node --test scripts/sun.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sunPosition, daylight, bostonClock } from "../room/sun.js";

// Reference positions for Boston (42.3601, −71.0589) from the astral library, without refraction.
const REF = [
  ["2026-06-21T16:42:00Z", 71.06, 177.1],   // solstice, solar noon
  ["2026-12-21T16:50:00Z", 24.18, 181.91],  // winter solstice, solar noon
  ["2026-03-20T16:50:00Z", 47.67, 179.4],   // equinox
  ["2026-11-17T21:00:00Z", 2.53, 241.03],   // twenty minutes before today's sunset
  ["2026-11-17T03:00:00Z", -59.95, 314.29], // night
  ["2026-07-04T23:30:00Z", 8.01, 293.67],   // a summer evening
];

test("the sun's position matches a reference to within a quarter of a degree", () => {
  for (const [iso, elevation, azimuth] of REF) {
    const p = sunPosition(new Date(iso));
    assert.ok(Math.abs(p.elevation - elevation) < 0.25, `${iso}: elevation ${p.elevation} vs ${elevation}`);
    assert.ok(Math.abs(p.azimuth - azimuth) < 0.5, `${iso}: azimuth ${p.azimuth} vs ${azimuth}`);
  }
});

test("deep night is the desk as it was: moonlight, lamp and bar on", () => {
  const d = daylight(-30, 0);
  assert.equal(d.moon, 1);
  assert.equal(d.window, 0);
  assert.equal(d.fill, 0.45);
  assert.equal(d.exposure, 1.45);
  assert.equal(d.bias, 26);
  assert.equal(d.bloom, 2.2);
  assert.deepEqual([d.lamp, d.bar], [true, true]);
});

test("noon on a clear day is sunlit, with the lamp and bar off and the bloom held back", () => {
  const d = daylight(40, 0);
  assert.equal(d.moon, 0);
  assert.ok(d.window >= 50);
  assert.ok(d.exposure < 1);
  assert.ok(d.bloom > 4);
  assert.deepEqual([d.lamp, d.bar], [false, false]);
});

test("golden hour is warm and low, with the bar still on", () => {
  const d = daylight(4, 0);
  const [r, , b] = d.windowColour;
  assert.ok(r > b * 3, "warm");
  assert.ok(d.angle < 20, "low");
  assert.deepEqual([d.lamp, d.bar], [false, true]);
});

test("the light changes smoothly from night to day", () => {
  let last = daylight(-30, 0).exposure;
  for (let e = -29; e <= 60; e++) {
    const x = daylight(e, 0).exposure;
    assert.ok(x <= last + 1e-9 && last - x < 0.05, `exposure jumps at ${e}°`);
    last = x;
  }
});

test("cloud dims and softens the sun, and greys the light", () => {
  const clear = daylight(40, 0), overcast = daylight(40, 1);
  assert.ok(overcast.window < clear.window * 0.25, "no hard sun patch under overcast");
  const spread = (c) => Math.max(...c) - Math.min(...c);
  assert.ok(spread(overcast.windowColour) < spread(clear.windowColour), "greyer");
  assert.equal(daylight(10, 1).lamp, true, "a dark, rainy late afternoon has the lamp on");
  assert.equal(overcast.lamp, false, "an overcast noon doesn't");
  assert.equal(daylight(-30, 1).window, 0, "at night the cloud is the moonlight's business (window.js)");
});

test("?at= previews a Boston time; anything else is the real clock", () => {
  const now = new Date("2026-11-17T15:00:00Z"); // 10 am in Boston
  const at = (s) => bostonClock(s, () => now)();
  assert.equal(at("?at=17:30").toISOString(), "2026-11-17T22:30:00.000Z"); // EST, UTC−5
  assert.equal(at("?at=2026-06-21T12:00:00-04:00").toISOString(), "2026-06-21T16:00:00.000Z");
  assert.equal(at("").toISOString(), now.toISOString());
  assert.equal(at("?at=nonsense").toISOString(), now.toISOString());
  const summer = bostonClock("?at=09:15", () => new Date("2026-07-04T12:00:00Z"))();
  assert.equal(summer.toISOString(), "2026-07-04T13:15:00.000Z"); // EDT, UTC−4
});
