// node --test scripts/call-week.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { callWeek } from "../room/call-week.js";

// Two weeks shaped like a real one: Thursday night, eight games in Sunday's early slate, two
// late, Sunday night and Monday night. One row per team, as in the optimizer's season.json.
const slate = (week, days) => {
  const at = (d, h) => new Date(Date.UTC(2026, 10, d, h)).toISOString();
  const kicks = [at(days.thu, 1), ...Array(8).fill(at(days.sun, 18)), at(days.sun, 21), at(days.sun, 21), at(days.sun + 1, 1), at(days.sun + 2, 1)];
  return kicks.flatMap((kickoff, i) => [
    { week, team: `H${week}${i}`, p: 0.7, kickoff, result: null },
    { week, team: `A${week}${i}`, p: 0.3, kickoff, result: null },
  ]);
};
// Eighteen weeks, each starting on a Tuesday morning; with `first` on 2026-09-08, week 11
// starts on 2026-11-17.
const tuesdays = (first) => Array.from({ length: 18 }, (_, i) => new Date(Date.parse(first) + i * 7 * 864e5).toISOString());
const season = (first) => ({
  week_starts: tuesdays(first),
  games: [...slate(11, { thu: 20, sun: 22 }), ...slate(12, { thu: 27, sun: 29 })],
});
const data = season("2026-09-08T06:00:00Z");
const at = (iso) => Date.parse(iso);

test("before Thursday's kickoff, it's this week's call", () => {
  assert.equal(callWeek(data, at("2026-11-18T17:00:00Z")), 11);
});

test("from Thursday night to Sunday morning, it's still this week's call", () => {
  assert.equal(callWeek(data, at("2026-11-21T17:00:00Z")), 11); // Friday
  assert.equal(callWeek(data, at("2026-11-22T17:59:00Z")), 11); // a minute before the early slate
});

test("once the Sunday slate kicks off, it's next week's call", () => {
  assert.equal(callWeek(data, at("2026-11-22T18:00:00Z")), 12);
  assert.equal(callWeek(data, at("2026-11-23T02:00:00Z")), 12); // Sunday night
  assert.equal(callWeek(data, at("2026-11-24T02:00:00Z")), 12); // after Monday's kickoff
});

test("on Tuesday the new week starts with all its games ahead", () => {
  assert.equal(callWeek(data, at("2026-11-24T17:00:00Z")), 12);
});

test("a week counts its played games as started, even with the clock set back", () => {
  const played = structuredClone(data);
  for (const g of played.games) if (g.week === 11 && g.kickoff < "2026-11-22T19:00:00Z") g.result = "W";
  assert.equal(callWeek(played, at("2026-11-18T17:00:00Z")), 12);
});

test("next week needs prices before the call moves to it", () => {
  const unpriced = structuredClone(data);
  for (const g of unpriced.games) if (g.week === 12) g.p = null;
  assert.equal(callWeek(unpriced, at("2026-11-22T20:00:00Z")), null);
});

test("after the last week's slate, and between seasons, there's no call", () => {
  const last = season("2026-07-28T06:00:00Z"); // week 17 starts on 2026-11-17
  for (const g of last.games) g.week += 6; // the same two slates, as weeks 17 and 18
  assert.equal(callWeek(last, at("2026-11-29T20:00:00Z")), null);
  assert.equal(callWeek(last, at("2027-03-01T17:00:00Z")), null);
});
