"""Refresh reading/shelf.json, the book on the desk, from Joe's public Goodreads profile.

Goodreads gives no API keys to new apps, and its robots.txt disallows the shelf RSS
feeds, but it allows the profile page (/user/show/...). That page lists the book being
read with its page progress, the featured shelf, and the shelf counts, which is all the
desk needs. A scheduled workflow runs this once a day.

The script validates what it parsed and exits 1 without writing anything if the page
doesn't look like the profile (a sign-in wall, a changed layout), so a bad run leaves
the last good shelf published.

Run it with plain Python 3.10 or later; it uses only the standard library:

    python3 scripts/reading.py
"""

from __future__ import annotations

import html
import json
import re
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

PROFILE = "https://www.goodreads.com/user/show/164485726-joseph-lattanzi"
NAME = "Joseph Lattanzi"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "reading" / "shelf.json"
COVERS = ROOT / "reading" / "covers"
AGENT = "jlattanzi4.github.io reading shelf (+https://github.com/jlattanzi4/jlattanzi4.github.io)"
BASE = "https://www.goodreads.com"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def text(fragment: str) -> str:
    """Tag-free, unescaped, single-spaced text ("Stephen  King" becomes "Stephen King")."""
    no_tags = re.sub(r"<[^>]+>", "", fragment)
    return re.sub(r"\s+", " ", html.unescape(no_tags).replace("‎", "")).strip()


def block(page: str, marker: str) -> str:
    """The profile box that contains `marker`, up to the end of that box."""
    start = page.find(marker)
    if start < 0:
        return ""
    end = page.find('class="bigBoxBottom"', start)
    return page[start : end if end > 0 else len(page)]


def sized_cover(src: str, height: int = 400) -> str:
    # Goodreads picks an image size with a code like ._SX98_ or ._SY75_ before the
    # extension. 400 px tall is sharp on the desk and window and about 30 KB; the originals run to 600 KB.
    bare = re.sub(r"\._S[XY]\d+_(?=\.\w+$)", "", src)
    return re.sub(r"(\.\w+)$", rf"._SY{height}_\1", bare)


def book_id(href: str) -> str:
    m = re.search(r"/book/show/(\d+)", href)
    if not m:
        raise ValueError(f"no book id in {href!r}")
    return m.group(1)


def split_series(title: str) -> tuple[str, str | None]:
    """'Lonesome Dove (Lonesome Dove, #1)' -> ('Lonesome Dove', 'Lonesome Dove, #1')."""
    m = re.match(r"^(.*?)\s*\(([^()]*#[\d.]+)\)$", title)
    return (m.group(1), m.group(2)) if m else (title, None)


def parse_date(s: str) -> str | None:
    try:
        return datetime.strptime(s.strip(), "%b %d, %Y %I:%M%p").date().isoformat()
    except ValueError:
        return None


def parse_reading(page: str) -> list[dict]:
    box = block(page, 'id="currentlyReadingReviews"')
    books = []
    for update in re.split(r'<div class="Updates', box)[1:]:
        a = re.search(r'<a class="bookTitle" href="([^"]+)">(.*?)</a>', update, re.DOTALL)
        if not a:
            continue
        author = re.search(r'<a class="authorName"[^>]*>(.*?)</a>', update, re.DOTALL)
        img = re.search(r'<img [^>]*src="([^"]+)"', update)
        title, series = split_series(text(a.group(2)))
        book = {
            "id": book_id(a.group(1)),
            "title": title,
            "series": series,
            "author": text(author.group(1)) if author else None,
            "url": BASE + a.group(1).split("?")[0],
            "cover_src": sized_cover(html.unescape(img.group(1))) if img else None,
            "page": None,
            "pages": None,
            "percent": None,
            "updated": None,
        }
        # Progress reads "(page 230 of 960)" or, when updated by percentage, "(24%)".
        pages = re.search(r"\(page (\d+) of (\d+)\)", update)
        pct = re.search(r"\((\d+)%\)", update)
        if pages:
            book["page"], book["pages"] = int(pages.group(1)), int(pages.group(2))
            book["percent"] = round(book["page"] / book["pages"], 3) if book["pages"] else None
        elif pct:
            book["percent"] = int(pct.group(1)) / 100
        when = re.search(r'user_status/show/\d+">([A-Z][a-z]{2} \d{2}, \d{4} \d{1,2}:\d{2}[AP]M)</a>', update)
        if when:
            book["updated"] = parse_date(when.group(1))
        books.append(book)
    return books


def parse_favorites(page: str) -> list[dict]:
    box = block(page, 'id="featured_shelf"')
    seen, books = set(), []
    for href, alt, src in re.findall(r'<a href="(/book/show/[^"]+)"><img alt="([^"]*)"[^>]*src="([^"]+)"', box):
        label = text(alt)
        title, _, author = label.rpartition(" by ")
        title, series = split_series(title or label)
        if title.lower() in seen:  # the same book in two editions
            continue
        seen.add(title.lower())
        books.append(
            {
                "id": book_id(href),
                "title": title,
                "series": series,
                "author": author or None,
                "url": BASE + href,
                "cover_src": sized_cover(html.unescape(src)),
            }
        )
    return books


def parse_counts(page: str) -> dict[str, int]:
    counts = {}
    for shelf, n in re.findall(
        r'class="actionLinkLite userShowPageShelfListItem" href="[^"]*shelf=([\w-]+)">[^(<]*\((\d+)\)', page
    ):
        counts[shelf] = int(n)
    return counts


def parse(page: str) -> dict:
    title = re.search(r"<title>(.*?)</title>", page, re.DOTALL)
    if not title or NAME not in text(title.group(1)):
        raise ValueError("this is not the profile page (signed out wall or a changed layout?)")
    reading, favorites, counts = parse_reading(page), parse_favorites(page), parse_counts(page)
    if "read" not in counts:
        raise ValueError("no shelf counts on the page; the layout may have changed")
    if counts.get("currently-reading", 0) > 0 and not reading:
        raise ValueError("the profile says a book is being read, but none was parsed")
    for b in reading + favorites:
        if not b["title"] or not b["id"]:
            raise ValueError(f"incomplete book: {b}")
    return {"profile": PROFILE, "reading": reading, "favorites": favorites, "shelves": counts}


def save_covers(shelf: dict) -> None:
    """Keep a copy of each cover here, so the desk can draw it as a WebGL texture
    (Goodreads' image host sends no CORS headers) and nothing breaks if a URL changes."""
    COVERS.mkdir(parents=True, exist_ok=True)
    keep = set()
    for b in shelf["reading"] + shelf["favorites"]:
        src = b.pop("cover_src")
        b["cover"] = None
        if not src or "nophoto" in src:
            continue
        name = f"{b['id']}.jpg"
        path = COVERS / name
        if not path.exists():
            data = fetch(src)
            if not data.startswith(b"\xff\xd8"):
                raise ValueError(f"cover for {b['title']} is not a JPEG")
            path.write_bytes(data)
        b["cover"] = f"reading/covers/{name}"
        keep.add(name)
    for old in COVERS.glob("*.jpg"):
        if old.name not in keep:
            old.unlink()


def main() -> int:
    try:
        shelf = parse(fetch(PROFILE).decode("utf-8", "replace"))
        save_covers(shelf)
    except Exception as e:  # noqa: BLE001 - any failure means: keep the last good file
        print(f"reading: not updated: {e}", file=sys.stderr)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(shelf, indent=2, ensure_ascii=False) + "\n")
    now = shelf["reading"][0]["title"] if shelf["reading"] else "nothing"
    print(f"reading: {now}; {len(shelf['favorites'])} favorites; shelves {shelf['shelves']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
