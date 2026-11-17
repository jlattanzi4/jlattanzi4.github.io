"""The one-time Spotify sign-in reports what Spotify says when it says no.

uv run --no-project --with pytest pytest scripts -q
"""

import io
import urllib.error

import pytest
import spotify_auth


def test_a_refusal_comes_back_in_spotifys_words(monkeypatch):
    def refuse(req, timeout):
        body = io.BytesIO(b'{"error":"invalid_client","error_description":"Invalid client secret"}')
        raise urllib.error.HTTPError(req.full_url, 400, "Bad Request", {}, body)

    monkeypatch.setattr(spotify_auth.urllib.request, "urlopen", refuse)
    with pytest.raises(spotify_auth.SpotifyError, match=r"invalid_client \(Invalid client secret\)"):
        spotify_auth.token("id", "secret", {"grant_type": "client_credentials"})
