# jlattanzi4.github.io

Joseph Lattanzi's portfolio: https://jlattanzi4.github.io/

You sit at my desk, late in the evening. Everything on it does something:

| On the desk | What it does |
|---|---|
| The monitor | Click it and you lean in to a working desktop, with a window for each project and a menu bar that works |
| A manila folder (the SEC study) | Opens to a marked-up page, then shows the study, where real sentences from a 10-K redline themselves |
| A football (the NFL optimizer) | Spins, then shows this week's survivor pick, computed in your browser by the optimizer's own engine |
| A brick-built F1 car (Box Box) | Does a lap of the monitor, then opens an F1 start-lights reaction test |
| The thesis on two of my favorite books | Opens the readmission thesis |
| The book I'm reading | Its real cover, as thick as its page count, with a lift ticket at my page. It opens to that page, and the monitor shows my progress and favorites from Goodreads |
| My watch, the Seiko 5 × Rowing Blazers Rally Diver | Shows your time, day and date, glows when the lights go down, and turns over to show the movement |
| A framed print of my GitHub contributions | A year of commits, refreshed weekly. Opens my profile |
| A macro pad | Accept, Continue, Reject and an effort knob, for working with an AI agent. Guess which key is worn shiny |
| Sticky notes on the monitor | Email, LinkedIn |
| The desk lamp and the monitor light | Switch on and off |
| The keyboard | Its keys go down when you type on yours |

The mouse, the AirPods, the espresso and the plant are just there, as on any desk.

Below the desk is the same work as a plain list, which is also what shows without JavaScript or WebGL. Keyboard users can Tab through every object; the watch and the macro pad open a close-up with buttons for what they do.

## How it's built

[three.js](https://threejs.org/) from a CDN, no build step. Everything is modeled from simple shapes at real-world size, in meters, with textures drawn on canvases.

- `room/look.js`: the lighting and the camera's side of the picture. Every light has a source you can see: the desk lamp, the light bar on the monitor, the screen, an LED strip behind the monitor, and moonlight from a window off to the right. Rendered in linear HDR with soft shadows, contact shadows where things meet the desk, bloom on light sources only, AgX tone mapping, a light probe of the lit desk for reflections, and a little lens fringing, vignette and grain.
- `room/props.js`: the room, the desk, and most of what's on it.
- `room/watch.js`, `room/book.js`, `room/github.js`, `room/macropad.js`: the objects with more going on.
- `room/screen.js`: the monitor's desktop, painted onto the screen from the chair and shown as real HTML when you lean in, plus the live parts (the NFL pick, the redline, the start lights, the reading shelf).

To load quickly it fetches the whole module graph at once (`modulepreload`), compiles every shader once, off the main thread where the browser allows, and photographs the desk for reflections only after the first frame.
- `room/main.js`: the camera, hovering, clicking, close-ups and keyboard access. `room/kit.js` has the shared helpers.
- `room.css`, `index.html`.

The NFL pick loads `/nfl-survivor-optimizer/js/worker.js` and its data from the same domain. If that isn't available, the window links to the optimizer instead.

### The book and the contribution graph

Two things on the desk come from elsewhere, and both live in `data/`:

- `data/shelf.json` and `data/covers/` come from my public Goodreads profile. Goodreads no longer issues API keys and its robots.txt disallows the shelf RSS feeds, but it allows the profile page, which lists the book I'm reading with page progress, my favorites and my shelf counts. `scripts/reading.py` reads that page. The covers are kept here because Goodreads' image host sends no CORS headers, and WebGL can only draw images from the same site.
- `data/github.json` is my contribution calendar from GitHub's GraphQL API, for the 52 full weeks to last Saturday, so it changes once a week. `scripts/github.py` writes it.

The [Refresh the desk](.github/workflows/desk-data.yml) workflow runs both once a day and commits any change. Each script checks what it read and exits without writing if anything looks wrong, so the last good file stays up; if either fails, the run fails, and GitHub sends an email.

## Running it locally

Serve the folder with the NFL project's `docs/` mounted at `/nfl-survivor-optimizer/` so the live pick works, for example with symlinks in a temporary folder and `python3 -m http.server`. Add `?debug` to the URL to get the scene, camera and lights as `window.desk` in the console.

Refresh the data and test the parsers (standard library only, Python 3.11 or later):

```sh
python3 scripts/reading.py
GITHUB_TOKEN=$(gh auth token) python3 scripts/github.py
uv run --no-project --with pytest pytest scripts -q
```
