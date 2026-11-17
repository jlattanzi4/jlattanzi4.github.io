"""Refresh data/music.json: what I've had on repeat lately, from Spotify, for the AirPods on the desk.

It's my top track over Spotify's "short term" (about the last four weeks). It needs three
secrets: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET from an app on Spotify's developer
dashboard, and SPOTIFY_REFRESH_TOKEN from signing in to it once with scripts/spotify_auth.py.
Without them it does nothing and exits 0, so the desk simply has no song on it.

Like the other refresh scripts, it checks what it read and exits 1 without writing if
anything looks wrong, so the last good file stays up.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "music.json"
TOKEN_URL = "https://accounts.spotify.com/api/token"
TOP_URL = "https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=1"


def access_token(client_id: str, secret: str, refresh: str) -> str:
    basic = base64.b64encode(f"{client_id}:{secret}".encode()).decode()
    body = urllib.parse.urlencode({"grant_type": "refresh_token", "refresh_token": refresh}).encode()
    req = urllib.request.Request(TOKEN_URL, data=body, headers={"Authorization": f"Basic {basic}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["access_token"]


def parse(payload: dict, today: str) -> dict:
    items = payload.get("items") or []
    if not items:
        raise ValueError("no top tracks")
    t = items[0]
    track, artists = t.get("name"), [a.get("name") for a in t.get("artists", []) if a.get("name")]
    url = (t.get("external_urls") or {}).get("spotify", "")
    if not track or not artists or not url.startswith("https://open.spotify.com/track/"):
        raise ValueError(f"unexpected track: {t!r:.200}")
    return {
        "track": track,
        "artist": ", ".join(artists[:2]),
        "url": url,
        "range": "about the last four weeks",
        "updated": today,
    }


def main() -> int:
    keys = ("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN")
    if not all(os.environ.get(k) for k in keys):
        print("spotify: skipped: not set up (see scripts/spotify_auth.py)")
        return 0
    try:
        token = access_token(*(os.environ[k] for k in keys))
        req = urllib.request.Request(TOP_URL, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            music = parse(json.load(r), datetime.now(UTC).date().isoformat())
    except Exception as e:  # noqa: BLE001 - any failure means: keep the last good file
        print(f"spotify: not updated: {e}", file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(music, indent=2, ensure_ascii=False) + "\n")
    print(f"spotify: {music['track']} by {music['artist']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
