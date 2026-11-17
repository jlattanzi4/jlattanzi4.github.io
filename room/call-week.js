// Which week the NFL window's call is for, at a moment `now` (ms), from the optimizer's
// season.json. No imports, so the tests can run it in Node.
//
// A week runs from its start in `week_starts` (Tuesday morning) to the next one. Its call
// stands while at least half its games are still to kick off, so from Tuesday through Sunday
// morning, with Thursday's game (and any Saturday or overseas ones) gone. Once more than half
// have started, normally when Sunday's early slate kicks off, the best pick from what's left
// is forced onto a game or two, often an underdog. So the call moves to next week, which the
// optimizer prices well ahead. After week 18's slate, and between seasons, there's no call.
export const LAST_WEEK = 18;

const priced = (data, week) => data.games.filter((g) => g.week === week && g.p != null);
const started = (g, now) => g.result != null || (g.kickoff != null && Date.parse(g.kickoff) <= now);

// The week on the calendar: the last one to have started, or week 1 before the season.
export function weekOf(data, now) {
  let week = 1;
  data.week_starts.forEach((iso, i) => { if (now >= Date.parse(iso)) week = i + 1; });
  return week;
}

export function callWeek(data, now) {
  const week = weekOf(data, now);
  const games = priced(data, week);
  const ahead = games.filter((g) => !started(g, now)).length;
  if (games.length && ahead * 2 >= games.length) return week;
  const next = week + 1;
  return next <= LAST_WEEK && priced(data, next).some((g) => !started(g, now)) ? next : null;
}
