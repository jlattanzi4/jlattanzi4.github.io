// A little LED sign on the desk with the next Red Line trains from Park Street and the
// Bluebikes dock outside it, live: a teaser for the question of whether a bike beats the T.
// Predictions come from the MBTA's v3 API (every 30 seconds while the page is in view), the
// dock from Bluebikes' public GBFS feed (every 3 minutes). Neither needs a key.

import * as THREE from "three";
import { canvasTexture, M, box, mesh } from "./kit.js";

const PREDICTIONS = "https://api-v3.mbta.com/predictions?filter%5Bstop%5D=place-pktrm&filter%5Broute%5D=Red&include=trip&sort=departure_time&page%5Blimit%5D=12";
const DOCKS = "https://gbfs.bluebikes.com/gbfs/en/station_status.json";
const DOCK_ID = "2093488029445054742"; // Park Street T Stop - Tremont St at Park St
const HEADSIGNS = ["Alewife", "Ashmont", "Braintree"];

// ------------------------------------------------------------ the data
async function trains() {
  const res = await fetch(PREDICTIONS);
  if (!res.ok) throw new Error(res.status);
  const { data, included = [] } = await res.json();
  const headsign = new Map(included.filter((t) => t.type === "trip").map((t) => [t.id, t.attributes.headsign]));
  const next = {};
  for (const p of data) {
    const t = Date.parse(p.attributes.departure_time || p.attributes.arrival_time || "");
    const where = headsign.get(p.relationships?.trip?.data?.id);
    if (Number.isNaN(t) || !HEADSIGNS.includes(where)) continue;
    if (!next[where] || t < next[where]) next[where] = t;
  }
  return next;
}
async function dock() {
  const res = await fetch(DOCKS);
  if (!res.ok) throw new Error(res.status);
  const s = (await res.json()).data.stations.find((x) => x.station_id === DOCK_ID);
  return s?.is_renting ? { bikes: s.num_bikes_available, docks: s.num_docks_available } : null;
}

// ---------------------------------------------------- a 3×5 pixel font
// Each glyph is five rows of three bits, top row first.
const FONT = {
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7], 4: [5, 5, 7, 1, 1],
  5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 1, 1], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7], " ": [0, 0, 0, 0, 0], ":": [0, 2, 0, 2, 0], "-": [0, 0, 7, 0, 0], ".": [0, 0, 0, 0, 2],
};
const textWidth = (s) => s.length * 4 - 1;

// ------------------------------------------------------------ the sign
const COLS = 64, ROWS = 32, DOT = 8;
const AMBER = "#ffad2e", RED = "#e8382b", BLUE = "#3aa0ff", DIM = "#8a7a62";

export function buildDepartures(scene, { x, y, z, ry }) {
  // The LEDs, lit or not, as a grid of colours; drawn as round dots at 8 pixels each.
  const grid = new Array(COLS * ROWS).fill(null);
  const set = (cx, cy, c) => { if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) grid[cy * COLS + cx] = c; };
  const write = (s, cx, cy, c) => {
    for (const ch of s.toUpperCase()) {
      (FONT[ch] || FONT[" "]).forEach((row, r) => { for (let b = 0; b < 3; b++) if (row & (4 >> b)) set(cx + b, cy + r, c); });
      cx += 4;
    }
  };
  const right = (s, cy, c) => write(s, COLS - 1 - textWidth(s), cy, c);
  const tex = canvasTexture(COLS * DOT, ROWS * DOT, () => {});
  const g = tex.image.getContext("2d");
  function paint() {
    g.fillStyle = "#050404"; g.fillRect(0, 0, COLS * DOT, ROWS * DOT);
    for (let i = 0; i < grid.length; i++) {
      const cx = (i % COLS) * DOT + DOT / 2, cy = Math.floor(i / COLS) * DOT + DOT / 2;
      g.fillStyle = grid[i] || "#17120d";
      g.beginPath(); g.arc(cx, cy, DOT * 0.36, 0, Math.PI * 2); g.fill();
    }
    tex.needsUpdate = true;
  }

  // The box: walnut, a dark face, the LEDs behind smoked acrylic, tipped back a little.
  const root = new THREE.Group();
  const W = 0.136, H = 0.072, D = 0.038;
  const body = mesh(box(W, H, D, 0.006), M("#4a3122", 0.55));
  body.position.y = H / 2;
  const bezel = mesh(new THREE.PlaneGeometry(W - 0.012, H - 0.012), M("#0b0a09", 0.3), { cast: false });
  bezel.position.set(0, H / 2, D / 2 + 0.0004);
  const face = mesh(new THREE.PlaneGeometry(W - 0.02, (W - 0.02) / 2), M("#ffffff", 0.25, 0, { map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 1.4 }), { cast: false });
  face.position.set(0, H / 2, D / 2 + 0.0008);
  const tilt = new THREE.Group();
  tilt.rotation.x = -0.12;
  tilt.add(body, bezel, face);
  root.add(tilt);
  root.position.set(x, y, z);
  root.rotation.y = ry;
  scene.add(root);

  // ---- what it says
  let next = null, bikes = null, failed = false;
  const mins = (t) => Math.floor((t - Date.now()) / 60000);
  // The Red Line stops running a little after midnight and starts again around five.
  const overnight = () => { const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" })); return h >= 1 && h < 5; };
  const when = (t) => { const m = mins(t); return m < 1 ? "ARR" : `${m} MIN`; };
  function render() {
    grid.fill(null);
    const clock = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).replace(/ [AP]M/, "");
    write("PARK ST", 1, 1, DIM);
    right(clock, 1, DIM);
    const live = HEADSIGNS.filter((h) => next?.[h] && mins(next[h]) > -1);
    if (failed && !next) write("NO SIGNAL", 1, 13, AMBER);
    else if (next && !live.length && overnight()) { write("NO TRAINS", 1, 9, AMBER); write("TILL MORNING", 1, 16, AMBER); }
    else if (next && !live.length) write("NO PREDICTIONS", 1, 13, AMBER);
    else live.forEach((h, i) => {
      const cy = 8 + i * 6;
      for (let b = 0; b < 2; b++) for (let r = 0; r < 5; r++) set(b, cy + r, RED);
      write(h, 3, cy, AMBER);
      // "10 MIN" if it fits after the name, "10M" if it doesn't.
      const t = when(next[h]);
      right(3 + textWidth(h) + 2 < COLS - 1 - textWidth(t) ? t : t.replace(" MIN", "M"), cy, AMBER);
    });
    if (bikes) { write(`${bikes.bikes} BIKES`, 1, 26, BLUE); right(`${bikes.docks} DOCKS`, 26, BLUE); }
    paint();
  }

  async function poll() {
    try { next = await trains(); failed = false; } catch { failed = true; }
    render();
  }
  async function pollBikes() {
    try { bikes = await dock(); } catch { /* keep the last count */ }
    render();
  }
  render();

  const item = {
    root,
    label: "Park Street, live",
    get sub() {
      const live = HEADSIGNS.filter((h) => next?.[h] && mins(next[h]) > -1);
      if (!next) return "The next Red Line trains, from the MBTA";
      if (!live.length) return overnight() ? "No Red Line trains till morning" : "No Red Line predictions right now";
      return `Red Line to ${live.map((h) => `${h} ${mins(next[h]) < 1 ? "now" : `in ${mins(next[h])} min`}`).join(", ")}`;
    },
    get note() {
      return bikes ? `Bluebikes outside: ${bikes.bikes} ${bikes.bikes === 1 ? "bike" : "bikes"}, ${bikes.docks} open ${bikes.docks === 1 ? "dock" : "docks"}. Which is faster? Working on it.` : "";
    },
    view: { offset: new THREE.Vector3(0, 0.05, 0.2), target: new THREE.Vector3(0, 0.038, 0) },
    caption: () => "Live from the MBTA and Bluebikes: the next Red Line trains from Park Street, and the bike dock outside.",
    actions: () => [],
    press: () => {},
    // Start fetching once the desk is up, and only while anyone can see it.
    start() {
      poll(); pollBikes();
      const every = (ms, fn) => setInterval(() => { if (!document.hidden) fn(); }, ms);
      every(30000, poll); every(180000, pollBikes); every(10000, render);
    },
  };
  return item;
}
