// node --test scripts/survivor.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { firstKickoffs, pickWeek, grade, named, status } from "./survivor.mjs";

const season = {
  generated_at: "2026-10-01T12:00:00Z",
  teams: [{ abbr: "LAR", nick: "Rams" }, { abbr: "ARI", nick: "Cardinals" }],
  games: [
    { week: 6, team: "LAR", opp: "ARI", site: "home", p: 0.85, kickoff: "2026-10-18T20:25:00Z", result: "L", score: "16-18" },
    { week: 6, team: "ARI", opp: "LAR", site: "away", p: 0.15, kickoff: "2026-10-18T20:25:00Z", result: "W", score: "18-16" },
    { week: 6, team: "KC", opp: "DEN", site: "home", p: 0.7, kickoff: "2026-10-16T00:15:00Z" },
  ],
};

test("the first kickoff of a week is its earliest game", () => {
  assert.equal(firstKickoffs(season).get(6), Date.parse("2026-10-16T00:15:00Z"));
});

test("a pick is the engine's best candidate, with the teams already used passed on", () => {
  let seen;
  const analyze = (_, opts) => { seen = opts; return { candidates: [{ team: "LAR", thisWeek: { opp: "ARI", site: "home", p: 0.85 } }] }; };
  const entry = pickWeek(analyze, season, 6, ["JAX"], 123);
  assert.deepEqual(seen.used, ["JAX"]);
  assert.equal(seen.now, 123);
  assert.deepEqual([entry.team, entry.p, entry.result], ["LAR", 0.85, null]);
});

test("no prices or no candidate means no pick, rather than a made-up one", () => {
  const none = () => ({ candidates: [] });
  assert.throws(() => pickWeek(none, season, 6, [], 0), /no pick/);
  assert.throws(() => pickWeek(none, season, 7, [], 0), /no prices/);
});

test("grading fills in the result and score, and names the teams", () => {
  const e = named(grade({ week: 6, team: "LAR", opp: "ARI", result: null }, season), season);
  assert.deepEqual([e.result, e.score, e.name, e.opp_name], ["L", "16-18", "Rams", "Cardinals"]);
});

test("a loss or a tie ends the entry", () => {
  assert.deepEqual(status([{ week: 1, result: "W" }, { week: 2, result: null }]), { alive: true, survived: 1 });
  assert.deepEqual(status([{ week: 1, result: "W" }, { week: 2, result: "T" }]), { alive: false, out_in: 2 });
});
