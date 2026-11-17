"""Refresh data/github.json from GitHub's GraphQL API: the contribution graph framed on the wall,
and the day of my last contribution, which is when the snake plant was last watered.

The graph covers the 52 full weeks up to last Saturday, so it changes once a week; the last
contribution can change any day. It needs a token in GITHUB_TOKEN: the workflow's own token is
enough, and locally `GITHUB_TOKEN=$(gh auth token) python3 scripts/github.py` works.

Like scripts/reading.py, it validates the response and exits 1 without writing if anything
looks wrong, so the last good graph stays up.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

LOGIN = "jlattanzi4"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "github.json"
LEVELS = {"NONE": 0, "FIRST_QUARTILE": 1, "SECOND_QUARTILE": 2, "THIRD_QUARTILE": 3, "FOURTH_QUARTILE": 4}
QUERY = """
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}
"""


def window(today: date) -> tuple[date, date]:
    """The 52 full weeks, Sunday to Saturday, that end on the last Saturday before today."""
    end = today - timedelta(days=(today.weekday() + 2) % 7 or 7)
    return end - timedelta(weeks=52) + timedelta(days=1), end


def calendar_days(payload: dict) -> list[dict]:
    if payload.get("errors"):
        raise ValueError(f"GitHub returned errors: {payload['errors']}")
    calendar = payload["data"]["user"]["contributionsCollection"]["contributionCalendar"]
    return [d for w in calendar["weeks"] for d in w["contributionDays"]]


def last_contribution(*payloads: dict) -> str | None:
    """The latest day, across the calendars given, with at least one contribution."""
    days = [d["date"] for p in payloads for d in calendar_days(p) if d["contributionCount"] > 0]
    return max(days) if days else None


def parse(payload: dict, start: date, end: date) -> dict:
    days = [d for d in calendar_days(payload) if start.isoformat() <= d["date"] <= end.isoformat()]
    if len(days) != 364:
        raise ValueError(f"expected 364 days from {start} to {end}, got {len(days)}")
    if days[0]["date"] != start.isoformat() or days[-1]["date"] != end.isoformat():
        raise ValueError("the calendar doesn't cover the window")
    return {
        "login": LOGIN,
        "profile": f"https://github.com/{LOGIN}",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total": sum(d["contributionCount"] for d in days),
        # One digit a day, 0 (none) to 4 (busiest quartile), Sunday first, oldest week first.
        "levels": "".join(str(LEVELS[d["contributionLevel"]]) for d in days),
    }


def fetch(start: date, end: date, token: str) -> dict:
    body = json.dumps(
        {
            "query": QUERY,
            "variables": {"login": LOGIN, "from": f"{start}T00:00:00Z", "to": f"{end}T23:59:59Z"},
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=body,
        headers={
            "Authorization": f"bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "jlattanzi4.github.io",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main() -> int:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("github: not updated: set GITHUB_TOKEN", file=sys.stderr)
        return 1
    today = datetime.now(UTC).date()
    start, end = window(today)
    try:
        year = fetch(start, end, token)
        graph = parse(year, start, end)
        # A query may span at most a year, so the days since last Saturday are a second one.
        recent = fetch(end + timedelta(days=1), today, token)
        graph["last_contribution"] = last_contribution(year, recent)
    except Exception as e:  # noqa: BLE001 - any failure means: keep the last good file
        print(f"github: not updated: {e}", file=sys.stderr)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(graph, indent=2) + "\n")
    print(f"github: {graph['total']} contributions, {start} to {end}; last on {graph['last_contribution']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
