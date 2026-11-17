"""The contribution-graph window and parser.

uv run --no-project --with pytest pytest scripts -q
"""

from datetime import date, timedelta

import pytest

import github


@pytest.mark.parametrize(
    ("today", "end"),
    [
        (date(2026, 11, 16), date(2026, 11, 14)),  # a Monday: last Saturday
        (date(2026, 11, 14), date(2026, 11, 7)),  # a Saturday isn't over yet
        (date(2026, 11, 15), date(2026, 11, 14)),  # a Sunday: yesterday
    ],
)
def test_window_is_52_full_weeks_to_last_saturday(today, end):
    start, got = github.window(today)
    assert got == end and got.weekday() == 5
    assert start.weekday() == 6 and (got - start).days == 363


def payload(start, days, level="FIRST_QUARTILE", count=2):
    week, weeks = [], []
    for i in range(days):
        week.append(
            {"date": (start + timedelta(days=i)).isoformat(), "contributionCount": count, "contributionLevel": level}
        )
        if len(week) == 7:
            weeks.append({"contributionDays": week})
            week = []
    if week:
        weeks.append({"contributionDays": week})
    return {
        "data": {
            "user": {"contributionsCollection": {"contributionCalendar": {"totalContributions": 0, "weeks": weeks}}}
        }
    }


def test_parse_counts_and_levels():
    start, end = github.window(date(2026, 11, 16))
    graph = github.parse(payload(start, 364), start, end)
    assert graph["total"] == 728
    assert graph["levels"] == "1" * 364
    assert (graph["start"], graph["end"]) == ("2025-11-16", "2026-11-14")


def test_parse_rejects_a_short_calendar():
    start, end = github.window(date(2026, 11, 16))
    with pytest.raises(ValueError, match="364 days"):
        github.parse(payload(start, 300), start, end)


def test_parse_rejects_errors():
    start, end = github.window(date(2026, 11, 16))
    with pytest.raises(ValueError, match="errors"):
        github.parse({"errors": [{"message": "Bad credentials"}]}, start, end)


def test_last_contribution_is_the_latest_day_with_any():
    start = date(2026, 11, 1)
    quiet = payload(start, 20, level="NONE", count=0)
    busy = payload(start, 5)  # Nov 1 to Nov 5
    assert github.last_contribution(busy, quiet) == "2026-11-05"
    assert github.last_contribution(quiet) is None
