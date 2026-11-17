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
import urllib.parse
import urllib.request
import webbrowser

REDIRECT = "http://127.0.0.1:8888/callback"
REPO = "jlattanzi4/jlattanzi4.github.io"


def main() -> int:
    client_id = input("Spotify app client ID: ").strip()
    secret = getpass.getpass("Spotify app client secret (hidden): ").strip()
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

    basic = base64.b64encode(f"{client_id}:{secret}".encode()).decode()
    body = urllib.parse.urlencode(
        {"grant_type": "authorization_code", "code": got["code"], "redirect_uri": REDIRECT}
    ).encode()
    req = urllib.request.Request(
        "https://accounts.spotify.com/api/token", data=body, headers={"Authorization": f"Basic {basic}"}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        refresh = json.load(r)["refresh_token"]

    for name, value in (
        ("SPOTIFY_CLIENT_ID", client_id),
        ("SPOTIFY_CLIENT_SECRET", secret),
        ("SPOTIFY_REFRESH_TOKEN", refresh),
    ):
        subprocess.run(["gh", "secret", "set", name, "--repo", REPO], input=value, text=True, check=True)
    print(f"Saved three secrets to {REPO}. The next 'Refresh the desk' run will put the song on the desk.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
