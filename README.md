# jlattanzi4.github.io

Joseph Lattanzi's portfolio: https://jlattanzi4.github.io/

The home page is a desk. Each project lies on it as an object you can drag, throw and turn over:

- **A marked-up 10-K filing** (the SEC study). Its back redlines real sentences from Kellogg's fiscal 2019 risk section.
- **A survivor pick sheet** (the NFL optimizer). It shows this week's call, computed in the browser by the optimizer's own engine (`/nfl-survivor-optimizer/js/worker.js`) from its published data, so the sheet is as current as the optimizer.
- **A race ticket** (Box Box). Its back is an F1 start-lights reaction test.
- **A bound thesis** and **a business card**.

Under the desk is the same work as a plain list. Without JavaScript the pieces lie in a pile and everything still links.

## Files

- `index.html`: the content.
- `desk.css`: the mat, the pieces, and the pile layout used on narrow screens.
- `desk.js`: dragging, turning over, the rulers, and the three small live parts.
- `images/og.jpg`: the share card.

No build step. GitHub Pages serves `main`.

## Running it locally

The pick sheet loads the optimizer from the same domain, so serve the site with the NFL project's `docs/` folder mounted at `/nfl-survivor-optimizer/`. Without it the sheet shows a link instead of the call.
