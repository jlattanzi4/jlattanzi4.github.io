# jlattanzi4.github.io

Joseph Lattanzi's portfolio: https://jlattanzi4.github.io/

You sit at my desk, late in the evening. Everything on it does something:

| On the desk | What it does |
|---|---|
| The monitor | Click it and you lean in to a working desktop, with a window for each project |
| A manila folder (the SEC study) | Opens to a marked-up page, then shows the study, where real sentences from a 10-K redline themselves |
| A football (the NFL optimizer) | Spins, then shows this week's survivor pick, computed in your browser by the optimizer's own engine |
| A brick-built F1 car (Box Box) | Does a lap of the monitor, then opens an F1 start-lights reaction test |
| The thesis on two of my favorite books | Opens the readmission thesis |
| The book I'm reading | Its real cover, as thick as its page count, with a lift ticket at my page. It opens to that page, and the monitor shows my progress and favorites from Goodreads |
| A watch | Keeps your time and date, glows when the lights go down, and turns over to show the movement |
| A snow globe | A mountain with a chairlift that runs. Shake it |
| A macro pad | Accept, Continue, Reject and an effort knob, for working with an AI agent. Guess which key is worn shiny |
| Sunglasses, espresso, AirPods, snake plant | Fold out, a sip at a time, a lid that pops, a wiggle |
| Sticky notes | Email, GitHub, LinkedIn |
| The desk lamp and the monitor light | Switch on and off |
| The keyboard | Its keys go down when you type on yours |

Below the desk is the same work as a plain list, which is also what shows without JavaScript or WebGL. Keyboard users can Tab through every object; the watch, the snow globe and the macro pad open a close-up with buttons for what they do.

## How it's built

[three.js](https://threejs.org/) from a CDN, no build step. Everything is modeled from simple shapes at real-world size, in meters, with textures drawn on canvases.

- `room/look.js`: the lighting and the camera's side of the picture. Every light has a source you can see: the desk lamp, the light bar on the monitor, the screen, an LED strip behind the monitor, and moonlight from a window off to the right. Rendered in linear HDR with bloom on light sources only, AgX tone mapping, a light probe of the lit desk for reflections, and a little vignette and grain.
- `room/props.js`: the room, the desk, and most of what's on it.
- `room/watch.js`, `room/globe.js`, `room/book.js`, `room/macropad.js`: the objects with more going on.
- `room/screen.js`: the monitor's desktop, painted onto the screen from the chair and shown as real HTML when you lean in, plus the live parts (the NFL pick, the redline, the start lights, the reading shelf).
- `room/main.js`: the camera, hovering, clicking, close-ups and keyboard access. `room/kit.js` has the shared helpers.
- `room.css`, `index.html`.

The NFL pick loads `/nfl-survivor-optimizer/js/worker.js` and its data from the same domain. If that isn't available, the window links to the optimizer instead.

### The reading shelf

`reading/shelf.json` and the covers in `reading/covers/` come from my public Goodreads profile. Goodreads no longer issues API keys and its robots.txt disallows the shelf RSS feeds, but it allows the profile page, which lists the book I'm reading with page progress, my favorites and my shelf counts. `scripts/reading.py` (standard library only) reads that page, and the [Refresh the reading shelf](.github/workflows/reading.yml) workflow runs it once a day and commits any change. If the page doesn't parse, the script exits without writing, so the last good shelf stays up. The covers are kept here because Goodreads' image host sends no CORS headers, and WebGL can only draw images from the same site.

## Running it locally

Serve the folder with the NFL project's `docs/` mounted at `/nfl-survivor-optimizer/` so the live pick works, for example with symlinks in a temporary folder and `python3 -m http.server`. Add `?debug` to the URL to get the scene, camera and lights as `window.desk` in the console.

Refresh the shelf and test its parser:

```sh
python3 scripts/reading.py
uv run --no-project --with pytest pytest scripts -q
```
