# jlattanzi4.github.io

Joseph Lattanzi's portfolio: https://jlattanzi4.github.io/

You sit at my desk. Everything on it does something:

| On the desk | What it does |
|---|---|
| The monitor | Click it and you lean in to a working desktop, with a window for each project |
| A manila folder (the SEC study) | Opens to a marked-up page, then shows the study, where real sentences from a 10-K redline themselves |
| A football (the NFL optimizer) | Spins, then shows this week's survivor pick, computed in your browser by the optimizer's own engine |
| A toy F1 car (Box Box) | Does a lap of the monitor, then opens an F1 start-lights reaction test |
| The thesis on a stack of books | Opens the readmission thesis |
| Sticky notes | Email, GitHub, LinkedIn |
| Espresso, AirPods, snake plant | A sip at a time, a lid that pops, a wiggle |
| The desk lamp | Switches the room between day and night |
| The keyboard | Its keys go down when you type on yours |

Below the desk is the same work as a plain list, which is also what shows without JavaScript or WebGL. Keyboard users can Tab through every object.

## How it's built

[three.js](https://threejs.org/) from a CDN, no build step:

- `room/props.js`: the desk and everything on it, built from simple shapes at real-world size, with textures drawn on canvases.
- `room/screen.js`: the monitor's desktop, painted onto the screen from the chair and shown as real HTML when you lean in, plus the live parts (the NFL pick, the redline, the start lights).
- `room/main.js`: the camera, the lights, day and night, hovering, clicking, and keyboard access.
- `room.css`, `index.html`.

The NFL pick loads `/nfl-survivor-optimizer/js/worker.js` and its data from the same domain. If that isn't available, the window links to the optimizer instead.

## Running it locally

Serve the folder with the NFL project's `docs/` mounted at `/nfl-survivor-optimizer/` so the live pick works, for example with symlinks in a temporary folder and `python3 -m http.server`.
