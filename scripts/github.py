"""Refresh data/github.json, the contribution graph framed on the wall, from GitHub's GraphQL API.

The graph covers the 52 full weeks up to last Saturday, so the file changes once a week,
not every day. It needs a token in GITHUB_TOKEN: the workflow's own token is enough, and
locally `GITHUB_TOKEN=$(gh auth token) python3 scripts/github.py` works.

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


def parse(payload: dict, start: date, end: date) -> dict:
    if payload.get("errors"):
        raise ValueError(f"GitHub returned errors: {payload['errors']}")
    calendar = payload["data"]["user"]["contributionsCollection"]["contributionCalendar"]
    days = [d for w in calendar["weeks"] for d in w["contributionDays"]]
    days = [d for d in days if start.isoformat() <= d["date"] <= end.isoformat()]
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
    start, end = window(datetime.now(UTC).date())
    try:
        graph = parse(fetch(start, end, token), start, end)
    except Exception as e:  # noqa: BLE001 - any failure means: keep the last good file
        print(f"github: not updated: {e}", file=sys.stderr)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(graph, indent=2) + "\n")
    print(f"github: {graph['total']} contributions, {start} to {end}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
