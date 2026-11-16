"""The Goodreads profile parser, against a trimmed copy of the real page.

    uv run --no-project --with pytest pytest scripts -q
"""

from pathlib import Path

import pytest

import reading

PAGE = (Path(__file__).parent / "fixtures" / "goodreads-profile.html").read_text()


def test_current_book_with_page_progress():
    [book] = reading.parse(PAGE)["reading"]
    assert book["title"] == "Lonesome Dove"
    assert book["series"] == "Lonesome Dove, #1"
    assert book["author"] == "Larry McMurtry"
    assert (book["page"], book["pages"], book["percent"]) == (230, 960, 0.24)
    assert book["updated"] == "2026-09-08"
    assert book["url"] == "https://www.goodreads.com/book/show/256008.Lonesome_Dove"
    assert book["cover_src"].endswith("/256008._SY400_.jpg")


def test_favorites_drop_the_second_edition_and_tidy_names():
    favorites = reading.parse(PAGE)["favorites"]
    titles = [b["title"] for b in favorites]
    assert titles[:3] == ["The Secret History", "Stoner", "11/22/63"]
    assert titles.count("Project Hail Mary") == 1
    assert len(favorites) == 10
    assert favorites[2]["author"] == "Stephen King"  # Goodreads writes "Stephen  King"


def test_shelf_counts():
    assert reading.parse(PAGE)["shelves"] == {"to-read": 57, "currently-reading": 1, "read": 41, "did-not-finish": 0}


def test_percent_progress():
    page = PAGE.replace("(page 230 of 960)", "(24%)")
    [book] = reading.parse(page)["reading"]
    assert (book["page"], book["percent"]) == (None, 0.24)


def test_rejects_a_page_that_is_not_the_profile():
    with pytest.raises(ValueError, match="not the profile"):
        reading.parse("<html><head><title>Sign in</title></head></html>")


def test_rejects_a_reading_box_it_cannot_read():
    page = PAGE.replace('class="bookTitle"', 'class="title"')
    with pytest.raises(ValueError, match="none was parsed"):
        reading.parse(page)


@pytest.mark.parametrize(
    ("src", "want"),
    [
        ("https://x/books/1559668037l/256008._SX98_.jpg", "https://x/books/1559668037l/256008._SY400_.jpg"),
        ("https://x/books/1/29044._SY75_.jpg", "https://x/books/1/29044._SY400_.jpg"),
        ("https://x/books/1/29044.jpg", "https://x/books/1/29044._SY400_.jpg"),
    ],
)
def test_sized_cover(src, want):
    assert reading.sized_cover(src) == want
