"""The Spotify reader's parser.

uv run --no-project --with pytest pytest scripts -q
"""

import pytest
import spotify


def track(name="Ventura Highway", artists=("America",), url="https://open.spotify.com/track/abc"):
    return {"items": [{"name": name, "artists": [{"name": a} for a in artists], "external_urls": {"spotify": url}}]}


def test_parse_reads_the_top_track():
    music = spotify.parse(track(artists=("A", "B", "C")), "2026-11-16")
    assert music == {
        "track": "Ventura Highway",
        "artist": "A, B",
        "url": "https://open.spotify.com/track/abc",
        "range": "about the last four weeks",
        "updated": "2026-11-16",
    }


@pytest.mark.parametrize(
    "payload", [{"items": []}, track(name=""), track(artists=()), track(url="https://evil.example/x")]
)
def test_parse_rejects_anything_odd(payload):
    with pytest.raises(ValueError):
        spotify.parse(payload, "2026-11-16")


def test_without_credentials_it_does_nothing(monkeypatch, capsys):
    for k in ("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    assert spotify.main() == 0
    assert "skipped" in capsys.readouterr().out
