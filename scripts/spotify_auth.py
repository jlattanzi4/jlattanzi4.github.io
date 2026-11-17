"""Sign in to Spotify once, so the desk can show what I've had on repeat.

Before running it, make an app at https://developer.spotify.com/dashboard with the redirect
URI http://127.0.0.1:8888/callback (Spotify accepts a loopback address over plain http, not
"localhost"), and the Web API. Then, from the repo:

    python3 scripts/spotify_auth.py

It asks for the app's client ID and secret, opens Spotify's consent page in the browser
(asking only to read your top artists and tracks), catches the reply on this machine, and
stores the three values as the repository's Actions secrets with the GitHub CLI. Nothing is
written to disk.
"""

from __future__ import annotations

import base64
import getpass
import http.server
import json
import secrets
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

REDIRECT = "http://127.0.0.1:8888/callback"
REPO = "jlattanzi4/jlattanzi4.github.io"
TOKEN_URL = "https://accounts.spotify.com/api/token"
NAMES = ("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN")


class SpotifyError(Exception):
    """Spotify said no, in its own words (error and error_description)."""


def token(client_id: str, secret: str, form: dict) -> dict:
    basic = base64.b64encode(f"{client_id}:{secret}".encode()).decode()
    req = urllib.request.Request(
        TOKEN_URL,
        data=urllib.parse.urlencode(form).encode(),
        headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            body = json.load(e)
        except ValueError:
            body = {}
        raise SpotifyError(f"{body.get('error', e.code)} ({body.get('error_description', e.reason)})") from None


def main() -> int:
    client_id = input("Spotify app client ID: ").strip()
    secret = getpass.getpass("Spotify app client secret (hidden, paste once and press Enter): ").strip()
    # Check the pair before anything else, so a secret that didn't paste fails here, not after signing in.
    try:
        token(client_id, secret, {"grant_type": "client_credentials"})
    except SpotifyError as e:
        print(
            f"Spotify didn't accept that client ID and secret: {e}.\n"
            f"The secret you entered was {len(secret)} characters (Spotify's are 32). Copy both again from the "
            "app's Settings (View client secret) and run this again.",
            file=sys.stderr,
        )
        return 1
    print("Client ID and secret check out.")
    state = secrets.token_urlsafe(16)
    query = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "response_type": "code",
            "redirect_uri": REDIRECT,
            "scope": "user-top-read",
            "state": state,
        }
    )
    got: dict[str, str] = {}

    class Callback(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            params = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
            got.update(params)
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Done. You can close this tab and go back to the terminal.")

        def log_message(self, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 8888), Callback)
    url = f"https://accounts.spotify.com/authorize?{query}"
    print(f"Opening Spotify to sign in. If no browser opens, visit:\n{url}")
    webbrowser.open(url)
    while "code" not in got and "error" not in got:
        server.handle_request()
    if got.get("state") != state or "code" not in got:
        print(f"Sign-in didn't complete: {got.get('error', 'the reply did not match')}", file=sys.stderr)
        return 1

    try:
        refresh = token(
            client_id, secret, {"grant_type": "authorization_code", "code": got["code"], "redirect_uri": REDIRECT}
        )["refresh_token"]
    except SpotifyError as e:
        print(
            f"Signed in, but Spotify wouldn't trade the sign-in for a key: {e}.\n"
            f"Check that the app's redirect URI is exactly {REDIRECT}, then run this again.",
            file=sys.stderr,
        )
        return 1

    for name, value in zip(NAMES, (client_id, secret, refresh)):
        subprocess.run(["gh", "secret", "set", name, "--repo", REPO], input=value, text=True, check=True)
    saved = subprocess.run(["gh", "secret", "list", "--repo", REPO], check=True, capture_output=True, text=True).stdout
    missing = [n for n in NAMES if n not in saved]
    if missing:
        print(
            f"GitHub doesn't list {', '.join(missing)} as saved. Check `gh auth status` and run this again.",
            file=sys.stderr,
        )
        return 1
    print(f"Saved three secrets to {REPO}. Run 'Refresh the desk' to put the song on the desk now.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
