# jlattanzi4.github.io

Joseph Lattanzi's portfolio: https://jlattanzi4.github.io/

You sit at my desk, late in the evening. Everything on it does something:

| On the desk | What it does |
|---|---|
| The monitor | Click it and you lean in to a working desktop, with a window for each project and a menu bar that works |
| A manila folder (the SEC study) | Opens to a marked-up page, then shows the study, where real sentences from a 10-K redline themselves |
| A football (the NFL optimizer) | Spins, then shows this week's survivor pick, computed in your browser by the optimizer's own engine, and how its own picks have done this season |
| A brick-built F1 car (Box Box) | Does a lap of the monitor, then opens an F1 start-lights reaction test |
| The thesis on two of my favorite books | Opens the readmission thesis |
| The book I'm reading | Its real cover, as thick as its page count, with a lift ticket at my page. It opens to that page, and the monitor shows my progress and favorites from Goodreads |
| My watch, the Seiko 5 × Rowing Blazers Rally Diver | Shows your time, day and date, glows when the lights go down, and turns over to show the movement |
| A framed print of my GitHub contributions | A year of commits, refreshed weekly. Opens my profile |
| A macro pad | Accept, Continue, Reject and an effort knob, for working with an AI agent. Guess which key is worn shiny |
| Sticky notes on the monitor | Email, LinkedIn |
| The desk lamp and the monitor light | Switch on and off |
| The keyboard | Its keys go down when you type on yours, and a few words do things |
| An espresso | A sip at a time. When it's empty, click for another |
| A snake plant | Watered with every commit: the longer since my last contribution on GitHub, the more it wilts |
| The window (you only see its light) | Boston's sky, right now: rain runs down the wall, snow banks up on the sill, the moon is in its real phase. The monitor's menu bar says the weather |
| A little LED sign | The next Red Line trains from Broadway and the Bluebikes dock outside, live |
| The AirPods | What I've had on repeat lately, from Spotify. Click to listen |
| A wastebasket in the corner | Crumpled drafts: things I tried and cut. Fish one out and it uncrumples to say why |

The mouse is just there, as on any desk.

The same work is also a plain list: "See it as a list" pulls it over the desk, and it's the whole page without JavaScript or WebGL. Keyboard users can Tab through every object; the watch, the macro pad, the sign and the wastebasket open a close-up with buttons for what they do.

## How it's built

[three.js](https://threejs.org/) from a CDN, no build step. Everything is modeled from simple shapes at real-world size, in meters, with textures drawn on canvases.

- `room/look.js`: the lighting and the camera's side of the picture. Every light has a source you can see: the desk lamp, the light bar on the monitor, the screen, an LED strip behind the monitor, and moonlight from a window behind your right shoulder. Rendered in linear HDR with soft shadows, contact shadows where things meet the desk, bloom on light sources only, AgX tone mapping, a light probe of the lit desk for reflections, and a little lens fringing, vignette and grain.
- `room/props.js`: the room, the desk, and most of what's on it.
- `room/watch.js`, `room/book.js`, `room/github.js`, `room/macropad.js`, `room/departures.js`, `room/drafts.js`: the objects with more going on.
- `room/window.js`: the window. The moonlight is a spotlight carrying a picture of the window (its panes, and rain, snow or lightning, redrawn as they move) that it throws on the wall, set by Open-Meteo's current weather for Boston; the moon's phase is worked out here.
- `room/screen.js`: the monitor's desktop, painted onto the screen from the chair and shown as real HTML when you lean in, plus the live parts (the NFL pick, the redline, the start lights, the reading shelf).

To load quickly it fetches the whole module graph at once (`modulepreload`) and compiles every shader once, for the buffer the desk is drawn into, off the main thread where the browser allows. Materials that differ only in which maps they have get a plain white map, so they share a program: on a first visit, compiling is most of the wait. It photographs the desk for reflections only after the first frame.
- `room/main.js`: the camera, hovering, clicking, close-ups and keyboard access. `room/kit.js` has the shared helpers.
- `room.css`, `index.html`.

The NFL pick loads `/nfl-survivor-optimizer/js/worker.js` and its data from the same domain. If that isn't available, the window links to the optimizer instead.

### What comes from elsewhere

Three things are live, fetched by your browser after the desk is up: Boston's weather (Open-Meteo), Red Line predictions (the MBTA's v3 API) and the Bluebikes dock (Bluebikes' GBFS feed). None needs a key. The rest is refreshed daily into `data/`:

- `data/shelf.json` and `data/covers/` come from my public Goodreads profile. Goodreads no longer issues API keys and its robots.txt disallows the shelf RSS feeds, but it allows the profile page, which lists the book I'm reading with page progress, my favorites and my shelf counts. `scripts/reading.py` reads that page. The covers are kept here because Goodreads' image host sends no CORS headers, and WebGL can only draw images from the same site.
- `data/github.json` is my contribution calendar from GitHub's GraphQL API, for the 52 full weeks to last Saturday, so the graph changes once a week, and the day of my last contribution, which is when the plant was last watered. `scripts/github.py` writes it.
- `data/survivor.json` is one survivor entry that followed the NFL optimizer's call every week this season, for a pool of 50. Each pick is made from the optimizer's data as it stood just before that week's first kickoff (that version, from the NFL repo's history), with the teams already used ruled out, then graded against the result; a tie counts as a loss. A pick, once in the file, never changes. The weeks before this file existed were filled in from those same snapshots, with today's version of the engine. `scripts/survivor.mjs` writes it.
- `data/music.json` is my top track on Spotify over about the last four weeks. `scripts/spotify.py` writes it, once three secrets are set by signing in once with `scripts/spotify_auth.py`; until then it's `null` and the AirPods are just AirPods.

The [Refresh the desk](.github/workflows/desk-data.yml) workflow runs them once a day and commits any change. Each script checks what it read and exits without writing if anything looks wrong, so the last good file stays up; if any fails, the run fails, and GitHub sends an email.

## Running it locally

Serve the folder with the NFL project's `docs/` mounted at `/nfl-survivor-optimizer/` so the live pick works, for example with symlinks in a temporary folder and `python3 -m http.server`. Add `?debug` to the URL to get the scene, camera and lights as `window.desk` in the console.

Refresh the data and test the parsers (standard library only, Python 3.11 or later):

```sh
python3 scripts/reading.py
GITHUB_TOKEN=$(gh auth token) python3 scripts/github.py
node scripts/survivor.mjs ../nfl-survivor-optimizer   # a clone with its history
python3 scripts/spotify.py                            # needs the three SPOTIFY_ variables
uv run --no-project --with pytest pytest scripts -q
node --test scripts/survivor.test.mjs
```

To set up Spotify, make an app at https://developer.spotify.com/dashboard with the redirect URI `http://127.0.0.1:8888/callback`, then run `python3 scripts/spotify_auth.py`: it signs you in once and saves the secrets to the repo with the GitHub CLI.
