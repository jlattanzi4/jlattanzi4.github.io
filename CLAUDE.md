# jlattanzi4.github.io

The portfolio: a three.js desk you sit at (`room/`), no build step, with a plain list (`#list` in `index.html`) that is also the whole page without JavaScript. The README explains how it's built.

## Keeping it current

Work in the project repos changes what this site says. When a session changes something a project shows here (its headline number, description, status, links, stack, or a project is added or retired), open a PR on this repo in the same session that updates every place below. Joe merges it; never push to `main`.

### Where each project appears

| What | Where |
|---|---|
| Name, one-line description, links | `index.html`: the window (`<section data-win="<id>">`), the menu (`button[data-app]` under Projects), the list (`#list`, the no-JS fallback), and the meta description and `og:` tags in `<head>` |
| Dock icon and short name | `room/screen.js`: `APPS`, and `drawIcon()` for the icon |
| Its object on the desk: hover label and line | `room/props.js` (`items.<object> = { label, sub }`) or the object's own module |
| Numbers baked into a texture | `room/props.js`: the SEC folder (`47,643 filings, 2007 to 2020`, `73% COPIED`); check for others with `grep -n fillText room/*.js` |
| Live data | NFL: `theCall()` in `room/screen.js` reads the optimizer's `season.json`; `data/survivor.json` from `scripts/survivor.mjs` |
| The desk table | `README.md`, "On the desk" |
| The profile README | `jlattanzi4/jlattanzi4`, `README.md`: the intro, the "Now" list and the projects table (a separate PR on that repo) |

Project ids: `nfl` (football), `sec` (manila folder), `box` (brick-built F1 car), `thesis` (the bound thesis on two books).

### A new project

It gets all of the above, plus an object on the desk that means something (see the README's table for the bar: one artifact per project, real data where it can have it, keyboard access, phone framing). Propose the object to Joe before building it.

### Checks before the PR

- Serve locally with `Cache-Control: no-store` (a plain `http.server` lets the browser reuse old modules) and open the changed window on desktop and phone.
- `node --test scripts/*.test.mjs` and `uv run --no-project --with pytest pytest scripts -q`.
- Numbers match the project's own README or report, word for word.
