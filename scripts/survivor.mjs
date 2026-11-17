// Keep data/survivor.json: how one survivor entry has done this season by following the
// NFL optimizer's call every week, the call the desk shows for a pool of 50.
//
// Each week's pick is made the way a person would have made it: from the optimizer's data as
// it stood just before that week's first kickoff (the version in the NFL repo's git history),
// with the teams already used ruled out. Then it's graded against the final result. A tie
// counts as a loss, as it does in most pools. Weeks already in the file are kept as they are,
// so a pick, once made, never changes; only a missing result gets filled in.
//
//   node scripts/survivor.mjs [path to a clone of nfl-survivor-optimizer, with its history]
//
// Like the other refresh scripts, it checks what it read and exits 1 without writing if
// anything looks wrong, so the last good file stays up.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "data/survivor.json");
const SEASON = "docs/data/season.json";
const POOL = 50;

const git = (repo, ...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 64 << 20 });
const seasonAt = (repo, rev) => JSON.parse(git(repo, "show", `${rev}:${SEASON}`));
const kickoff = (g) => Date.parse(g.kickoff || g.commence);

// The first kickoff of each week, from the latest schedule.
export function firstKickoffs(season) {
  const first = new Map();
  for (const g of season.games) {
    const t = kickoff(g);
    if (Number.isNaN(t)) continue;
    if (!first.has(g.week) || t < first.get(g.week)) first.set(g.week, t);
  }
  return first;
}

// The next week's entry, picked from `before` (the data as it stood then).
export function pickWeek(analyze, before, week, used, at) {
  if (!before.games.some((g) => g.week === week && g.p != null)) throw new Error(`no prices for week ${week} before its first kickoff`);
  const { candidates } = analyze(before, { used, currentWeek: week, poolSize: POOL, nSims: 20000, seed: 7, lives: 1, now: at });
  const best = candidates[0];
  if (!best) throw new Error(`no pick for week ${week}`);
  const g = best.thisWeek;
  return { week, team: best.team, opp: g.opp, site: g.site, p: g.p, result: null, picked_from: before.generated_at };
}

export function grade(entry, latest) {
  const g = latest.games.find((x) => x.week === entry.week && x.team === entry.team);
  return g?.result ? { ...entry, result: g.result, score: g.score ?? null } : entry;
}

// Team nicknames, so the desk can say "the Rams".
export function named(entry, season) {
  const nick = (abbr) => season.teams.find((t) => t.abbr === abbr)?.nick ?? abbr;
  return { ...entry, name: nick(entry.team), opp_name: nick(entry.opp) };
}

export function status(weeks) {
  const out = weeks.find((w) => w.result && w.result !== "W");
  if (out) return { alive: false, out_in: out.week };
  return { alive: true, survived: weeks.filter((w) => w.result === "W").length };
}

async function main() {
  const repo = resolve(process.argv[2] || resolve(ROOT, "../nfl-survivor-optimizer"));
  const { analyze } = await import(pathToFileURL(resolve(repo, "docs/js/engine.js")).href);
  const latest = seasonAt(repo, "HEAD");
  const kicks = firstKickoffs(latest);
  const kept = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  let weeks = kept?.season === latest.season ? kept.weeks.map((w) => (w.result ? w : grade(w, latest))) : [];
  const now = Date.now();
  while (status(weeks).alive && weeks.every((w) => w.result)) {
    const week = (weeks.at(-1)?.week ?? 0) + 1;
    const kick = kicks.get(week);
    if (week > 18 || kick == null || kick > now) break;
    const rev = git(repo, "log", "-1", "--format=%H", `--before=${new Date(kick).toISOString()}`, "--", SEASON).trim();
    if (!rev) throw new Error(`no data from before week ${week}`);
    const entry = named(grade(pickWeek(analyze, seasonAt(repo, rev), week, weeks.map((w) => w.team), kick - 60_000), latest), latest);
    weeks.push(entry);
  }
  const record = { season: latest.season, pool: POOL, updated: latest.generated_at, ...status(weeks), weeks };
  writeFileSync(OUT, JSON.stringify(record, null, 2) + "\n");
  const s = record.alive ? `alive, ${record.survived} weeks survived` : `out in week ${record.out_in}`;
  console.log(`survivor: ${s}: ${weeks.map((w) => `${w.week}:${w.team}${w.result ? `(${w.result})` : ""}`).join(" ")}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`survivor: not updated: ${e.message}`); process.exit(1); });
}
