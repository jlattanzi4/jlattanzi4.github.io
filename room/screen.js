// The computer on the desk: what its screen shows from the chair (a painted canvas),
// and the real desktop that takes over when you lean in (HTML, scaled to the screen).

import * as THREE from "three";
import { moonPhase, drawMoon, skyLine, skySentence } from "./window.js";
import { callWeek, weekOf, LAST_WEEK } from "./call-week.js";

export const OS_W = 1280, OS_H = 720;
const $ = (sel, root = document) => root.querySelector(sel);
const pct = (v, d = 1) => `${(100 * v).toFixed(d)}%`;

// ------------------------------------------------------------ the dock
export const APPS = [
  { id: "nfl", name: "Survivor" },
  { id: "sec", name: "Boilerplate" },
  { id: "box", name: "Box Box" },
  { id: "thesis", name: "Thesis" },
  { id: "reading", name: "Reading" },
  { id: "about", name: "About me" },
];

function rounded(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Each app's icon, drawn the same way on the canvas and (as an image) in the DOM dock.
export function drawIcon(g, id, x, y, s) {
  g.save();
  g.translate(x, y);
  const k = s / 100;
  g.scale(k, k);
  const tile = (fill) => { rounded(g, 0, 0, 100, 100, 23); g.fillStyle = fill; g.fill(); };
  if (id === "nfl") {
    tile("#0f1914");
    g.save(); g.translate(50, 50); g.rotate(-0.6);
    g.beginPath(); g.ellipse(0, 0, 34, 20, 0, 0, 7); g.fillStyle = "#f5c84c"; g.fill();
    g.fillStyle = "#0f1914"; g.fillRect(-12, -1.5, 24, 3);
    for (let i = -2; i <= 2; i++) g.fillRect(i * 5 - 1, -6, 2, 12);
    g.restore();
  }
  if (id === "sec") {
    tile("#f7f7f4");
    g.fillStyle = "#c9ccd1"; for (let i = 0; i < 6; i++) g.fillRect(20, 22 + i * 10, i === 5 ? 34 : 60, 4);
    g.fillStyle = "#d03b3b"; g.fillRect(18, 43, 64, 3);
    g.fillStyle = "#2a78d6"; g.fillRect(20, 78, 52, 4);
  }
  if (id === "box") {
    tile("#121317");
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.arc(22 + i * 14, 40 + j * 16, 5.5, 0, 7); g.fillStyle = "#ff1e14"; g.fill(); }
    g.fillStyle = "#e10600"; g.fillRect(0, 84, 100, 6);
  }
  if (id === "thesis") {
    tile("#1d2740");
    g.fillStyle = "#141b2d"; g.fillRect(0, 0, 14, 100);
    g.fillStyle = "#e3cf93"; g.font = "600 52px 'Source Serif 4', serif"; g.textAlign = "center"; g.fillText("?", 56, 68);
  }
  if (id === "reading") {
    tile("#2a2017");
    // An open book seen from above.
    g.fillStyle = "#efe6d3";
    g.beginPath(); g.moveTo(16, 34); g.quadraticCurveTo(33, 28, 49, 36); g.lineTo(49, 74); g.quadraticCurveTo(33, 66, 16, 72); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(84, 34); g.quadraticCurveTo(67, 28, 51, 36); g.lineTo(51, 74); g.quadraticCurveTo(67, 66, 84, 72); g.closePath(); g.fill();
    g.fillStyle = "rgba(60, 50, 40, 0.45)";
    for (let i = 0; i < 4; i++) { g.fillRect(22, 42 + i * 7, 22, 2.5); g.fillRect(56, 42 + i * 7, 22, 2.5); }
    g.fillStyle = "#e4572e"; g.fillRect(60, 22, 7, 22);
  }
  if (id === "about") {
    tile("#e9e7e1");
    g.fillStyle = "#161616"; g.font = "600 40px 'Instrument Sans', sans-serif"; g.textAlign = "center"; g.fillText("JL", 50, 64);
  }
  g.restore();
}

function clockText(d = new Date()) {
  return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

// Boston's weather in the menu bar, beside the clock, the way a Mac shows it: the moon in its
// phase, then the temperature and the sky (room/window.js). Until it loads, just the moon.
let skyNow = null;

// The wallpaper: contour lines over a dark blue, like a topographic map of a ski area.
// Drawn once, then shared by the screen seen from the chair and the desktop you lean in to.
let wallpaper = null;
export function wallpaperCanvas() {
  if (wallpaper) return wallpaper;
  const w = OS_W, h = OS_H;
  wallpaper = document.createElement("canvas");
  wallpaper.width = w; wallpaper.height = h;
  const g = wallpaper.getContext("2d");
  const peaks = [[0.72, 0.3, 0.2, 1], [0.86, 0.58, 0.14, 0.7], [0.55, 0.62, 0.16, 0.55], [0.3, 0.85, 0.22, 0.45], [0.95, 0.12, 0.12, 0.5], [0.12, 0.25, 0.18, 0.25]];
  // The terrain is smooth, so work out its height on a grid every 4 px and interpolate between
  // grid points: the same lines for a sixteenth of the work.
  const S = 4, gw = Math.ceil(w / S) + 2, gh = Math.ceil(h / S) + 2;
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const u = (gx * S) / w, v = ((gy * S) / h) * (h / w);
    let e = 0;
    for (const [px, py, sd, a] of peaks) { const dx = u - px, dy = v - py * (h / w); e += a * Math.exp(-(dx * dx + dy * dy) / (2 * sd * sd)); }
    e += 0.035 * Math.sin(u * 23 + Math.sin(v * 17) * 1.5) + 0.025 * Math.sin(v * 29 - u * 11);
    grid[gy * gw + gx] = e * 26; // 26 contour intervals over the range
  }
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const fy = y / S, iy = fy | 0, ty = fy - iy;
    for (let x = 0; x < w; x++) {
      const fx = x / S, ix = fx | 0, tx = fx - ix, k = iy * gw + ix;
      const a = grid[k], b = grid[k + 1], c = grid[k + gw], dd = grid[k + gw + 1], q = a - b - c + dd;
      const e = a + (b - a) * tx + (c - a) * ty + q * tx * ty;
      const grad = Math.hypot((b - a + q * ty) / S, (c - a + q * tx) / S) + 1e-4;
      const i = y * w + x;
      const t = (x / w) * 0.55 + (y / h) * 0.45;
      // Base: deep navy toward slate.
      let r = 11 + t * 12, gr = 18 + t * 20, bl = 31 + t * 30;
      const dist = Math.abs(e - Math.round(e)) / grad; // pixels to the nearest contour
      const index = Math.round(e) % 5 === 0;
      const al = Math.max(0, 1 - dist / (index ? 1.1 : 0.7)) * (index ? 0.34 : 0.17);
      r += (150 - r) * al; gr += (190 - gr) * al; bl += (215 - bl) * al;
      d[i * 4] = r; d[i * 4 + 1] = gr; d[i * 4 + 2] = bl; d[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return wallpaper;
}

// What the screen shows from the chair: wallpaper, the name, and the dock.
export function paintIdle(canvas) {
  const g = canvas.getContext("2d");
  const w = OS_W, h = OS_H;
  g.drawImage(wallpaperCanvas(), 0, 0);
  // menu bar
  g.fillStyle = "rgba(4, 8, 14, 0.4)"; g.fillRect(0, 0, w, 30);
  g.fillStyle = "#fff"; g.font = "600 15px 'Instrument Sans', sans-serif"; g.textBaseline = "middle";
  g.fillText("Joseph Lattanzi", 20, 15);
  g.fillStyle = "rgba(255,255,255,0.75)"; g.font = "400 15px 'Instrument Sans', sans-serif";
  g.fillText("Projects", 158, 15); g.fillText("Contact", 230, 15);
  g.textAlign = "right"; g.fillStyle = "#fff"; g.fillText(clockText(), w - 20, 15);
  const moon = moonPhase(), wx = skyLine(skyNow, moon);
  const wxRight = w - 20 - g.measureText(clockText()).width - 22;
  g.fillStyle = "rgba(255,255,255,0.75)"; g.fillText(wx, wxRight, 15);
  drawMoon(g, wxRight - g.measureText(wx).width - 13, 15, 6.5, moon);
  g.textAlign = "left";
  // the name
  g.textBaseline = "alphabetic"; g.fillStyle = "#fff";
  g.font = "600 76px 'Instrument Sans', sans-serif"; g.fillText("Joseph Lattanzi", 84, 250);
  g.fillStyle = "rgba(255,255,255,0.85)"; g.font = "400 32px 'Instrument Sans', sans-serif";
  g.fillText("is a data scientist who measures messy things", 88, 306);
  g.fillText("and ships the answers.", 88, 348);
  g.fillStyle = "rgba(255,255,255,0.6)"; g.font = "500 20px 'Instrument Sans', sans-serif";
  g.fillText("Click the screen, or anything on the desk.", 88, 410);
  // the dock
  const n = APPS.length, s = 76, gap = 20, dw = n * s + (n - 1) * gap + 40;
  const dx = (w - dw) / 2, dy = h - s - 46;
  rounded(g, dx, dy, dw, s + 26, 26); g.fillStyle = "rgba(255,255,255,0.12)"; g.fill();
  g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1; g.stroke();
  APPS.forEach((a, i) => drawIcon(g, a.id, dx + 20 + i * (s + gap), dy + 13, s));
}

// ------------------------------------------------- live parts of the windows

// This week's survivor call, from the optimizer's own engine and data on this domain.
let callPromise = null;
export function theCall() {
  if (callPromise) return callPromise;
  callPromise = (async () => {
    const base = "/nfl-survivor-optimizer/";
    const data = await fetch(`${base}data/season.json`, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const now = Date.now();
    // This week's call until most of its games have kicked off, then next week's (call-week.js).
    const week = callWeek(data, now);
    if (week == null) {
      if (weekOf(data, now) >= LAST_WEEK) return { data, over: true };
      throw new Error("no week to call");
    }
    const worker = new Worker(`${base}js/worker.js`, { type: "module" });
    const result = await new Promise((ok, no) => {
      worker.onmessage = (e) => (e.data.error ? no(new Error(e.data.error)) : ok(e.data.result));
      worker.onerror = no;
      worker.postMessage({ id: 1, data, options: { used: [], currentWeek: week, poolSize: 50, nSims: 20000, seed: 7, lives: 1, myStrikes: 0, fieldStrikes: 0, locked: null, now } });
    });
    worker.terminate();
    const best = result.candidates[0];
    if (!best) throw new Error("no pick this week");
    return { data, week, result, best, team: data.teams.find((t) => t.abbr === best.team) };
  })();
  return callPromise;
}

function ago(iso) {
  const h = Math.round((Date.now() - Date.parse(iso)) / 36e5);
  return h < 1 ? "under an hour ago" : h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

async function fillCall(win) {
  try {
    const { data, week, result, best, team, over } = await theCall();
    if (over) {
      $(".c-week", win).textContent = `${data.season} season`;
      $(".c-name", win).textContent = "That’s the season";
      $(".c-game", win).textContent = "The next call comes with next season’s lines";
      $(".c-stats", win).hidden = $(".c-dot", win).hidden = true;
      return;
    }
    const g = best.thisWeek;
    const spread = g.spread == null ? "" : ` ${g.spread > 0 ? "+" : ""}${g.spread}`;
    $(".c-week", win).textContent = `Week ${week}`;
    $(".c-name", win).textContent = team ? team.nick : best.team;
    $(".c-dot", win).style.background = team ? team.colors[0] : "";
    $(".c-game", win).textContent = `${g.site === "home" ? "vs" : "at"} ${g.opp}${spread}`;
    $(".c-win", win).textContent = pct(g.p);
    $(".c-public", win).textContent = pct(g.pick);
    $(".c-equity", win).textContent = `${(best.equity * 50).toFixed(1)}×`;
    $(".c-foot", win).textContent = `Lines as of ${ago(data.generated_at)}`;
    $(".c-path", win).replaceChildren(...best.path.map(({ week: wk, team: t }) => {
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = t;
      li.append(`Wk ${wk}`, b);
      return li;
    }));
    const pts = [1, ...best.curve];
    const W = 300, H = 110, top = 8, bottom = 92;
    const line = pts.map((v, i) => `${((i / (pts.length - 1)) * W).toFixed(1)},${(top + (1 - v) * (bottom - top)).toFixed(1)}`).join(" ");
    $(".c-curve", win).innerHTML = `<line x1="0" x2="${W}" y1="${bottom}" y2="${bottom}" class="axis"/><polygon class="area" points="0,${bottom} ${line} ${W},${bottom}"/><polyline class="line" points="${line}"/><text x="0" y="${H - 2}">Wk ${result.weeks[0]}</text><text x="${W}" y="${H - 2}" text-anchor="end">Wk ${result.weeks[result.weeks.length - 1]}</text>`;
    $(".c-cap", win).textContent = `Chance the entry is still alive after each week: ${pct(best.pSurvive)} by week ${result.weeks[result.weeks.length - 1]}.`;
  } catch {
    $(".c-name", win).textContent = "Open the optimizer";
    $(".c-game", win).textContent = "for this week’s call";
  }
}

// How one entry has done this season by following the optimizer's call every week
// (data/survivor.json, from scripts/survivor.mjs), in a sentence and as a row of weeks.
const pctRound = (p) => `${Math.round(p * 100)}%`;
const score = (w) => (w.score || "").replace("-", "–");
export function recordLine(record) {
  const weeks = record?.weeks;
  if (!weeks?.length) return null;
  const wins = weeks.filter((w) => w.result === "W").length;
  const last = weeks.at(-1);
  if (!record.alive) {
    const how = last.result === "T" ? `Tied ${score(last)}` : `Lost ${score(last)}`;
    const before = wins ? `${wins} ${wins === 1 ? "win" : "wins"}, then ` : "";
    return `Its own picks: ${before}the ${last.name} in week ${last.week}. ${pctRound(last.p)} to win. ${how}.`;
  }
  return last.result ? `Its own picks this season: ${wins} for ${wins}, still alive.` : `Its own picks this season: ${wins} for ${wins}, and the ${last.name} this week.`;
}
function fillRecord(win, record) {
  const box = $(".c-record", win);
  if (!record?.weeks?.length) { box.hidden = true; return; }
  box.hidden = false;
  $(".c-rec", win).classList.toggle("long", record.weeks.length > 8);
  $(".c-rec", win).replaceChildren(...record.weeks.map((w) => {
    const li = document.createElement("li");
    li.className = w.result === "W" ? "won" : w.result ? "lost" : "";
    const b = document.createElement("b");
    b.textContent = w.team;
    li.title = `Week ${w.week}: the ${w.name} ${w.site === "home" ? "vs" : "at"} the ${w.opp_name}, ${pctRound(w.p)} to win${w.result ? `. ${w.result === "W" ? "Won" : w.result === "T" ? "Tied" : "Lost"} ${score(w)}` : ""}`;
    li.append(b);
    return li;
  }));
  const last = record.weeks.at(-1);
  $(".c-rec-cap", win).textContent = record.alive ? ""
    : `Out in week ${last.week}: the ${last.name}, ${pctRound(last.p)} to win, ${last.result === "T" ? "tied" : "lost"} ${score(last)}.`;
}

// Three real edits from Kellogg's fiscal 2019 risk section, struck and retyped.
const EDITS = [
  [["k", "Competition against "], ["d", "retailer"], ["i", "private label"], ["k", " brands could negatively impact our business."]],
  [["k", "Agricultural commodities, including corn, wheat, "], ["i", "rice, "], ["k", "potato flakes, vegetable oils, sugar and cocoa, are the principal raw materials used in our products."]],
  [["d", "Some"], ["i", "One of the"], ["k", " multiemployer plans in which we participate "], ["d", "are"], ["i", "is"], ["k", " reported to have significant underfunded liabilities."]],
];
let rlRun = 0;
async function playRedline(el, reduce) {
  const run = ++rlRun;
  const wait = (ms) => new Promise((ok, no) => setTimeout(() => (run === rlRun ? ok() : no()), ms));
  const draw = (edit, done) => {
    el.replaceChildren();
    const ins = [], dels = [];
    for (const [kind, text] of edit) {
      const s = document.createElement("span");
      if (kind === "k") s.textContent = text;
      if (kind === "d") { s.className = `rl-del${done ? " cut" : ""}`; s.textContent = text; dels.push(s); }
      if (kind === "i") { s.className = "rl-ins"; s.dataset.text = text; s.textContent = done ? text : ""; ins.push(s); }
      el.append(s);
      if (kind === "d") el.append(" ");
    }
    return { ins, dels };
  };
  let i = 0;
  try {
    for (;;) {
      const edit = EDITS[i++ % EDITS.length];
      if (reduce) { draw(edit, true); await wait(5000); continue; }
      const { ins, dels } = draw(edit, false);
      el.classList.remove("fading");
      await wait(800);
      for (const d of dels) { d.classList.add("cut"); await wait(260); }
      await wait(360);
      for (const s of ins) {
        s.classList.add("typing");
        for (const ch of s.dataset.text) { s.textContent += ch; await wait(46); }
        s.classList.remove("typing");
      }
      await wait(2600);
      el.classList.add("fading");
      await wait(320);
    }
  } catch { /* stopped */ }
}

// The F1 start lights: press when they go out.
function lightsGame(win) {
  const gantry = $(".gantry", win);
  const lights = [...gantry.querySelectorAll("i")];
  const read = $(".readout", win);
  let race = { phase: "idle", timers: [] };
  const to = (cols) => lights.forEach((l, i) => l.classList.toggle("on", i % 5 < cols));
  const reset = () => { race.timers.forEach(clearTimeout); race = { phase: "idle", timers: [] }; to(0); };
  gantry.addEventListener("click", () => {
    if (race.phase === "idle") {
      race.phase = "lighting";
      read.textContent = "Wait for it…";
      for (let c = 1; c <= 5; c++) race.timers.push(setTimeout(() => to(c), c * 900));
      race.timers.push(setTimeout(() => { to(0); race.phase = "go"; race.t0 = performance.now(); }, 5 * 900 + 600 + Math.random() * 2200));
      return;
    }
    if (race.phase === "lighting") { reset(); read.innerHTML = "<b>Jump start</b>Too early. Press the lights to go again."; return; }
    if (race.phase === "go") {
      const s = (performance.now() - race.t0) / 1000;
      reset();
      let best = Number(localStorage.getItem("desk:best")) || s;
      if (s < best) best = s;
      try { localStorage.setItem("desk:best", String(best)); } catch { /* ignore */ }
      read.innerHTML = `<b>${s.toFixed(3)} s</b>An F1 driver: about 0.2 s. Your best: ${best.toFixed(3)} s.`;
    }
  });
  return reset;
}

// What Joe is reading, from his Goodreads shelf.
function fillReading(win, shelf) {
  const data = shelf?.data;
  const book = data?.reading?.[0];
  const link = (href, child) => { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.append(child); return a; };
  if (data) $(".r-shelf", win).href = data.profile;
  if (!book) {
    $(".r-now", win).hidden = true;
  } else {
    $(".r-now", win).hidden = false;
    const cover = $(".r-cover", win);
    if (book.cover) cover.src = book.cover;
    cover.alt = `The cover of ${book.title}`;
    $(".r-title", win).textContent = book.title;
    $(".r-title", win).href = book.url;
    $(".r-author", win).textContent = book.author || "";
    const p = book.percent ?? 0;
    $(".r-bar i", win).style.width = `${Math.round(p * 100)}%`;
    $(".r-bar", win).setAttribute("aria-valuenow", String(Math.round(p * 100)));
    const when = book.updated ? new Date(`${book.updated}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : null;
    const where = book.page && book.pages ? `Page ${book.page} of ${book.pages}` : `${Math.round(p * 100)}% of the way in`;
    $(".r-progress", win).textContent = when ? `${where}, as of ${when}.` : `${where}.`;
  }
  const favs = data?.favorites || [];
  $(".r-favs", win).replaceChildren(...favs.map((b) => {
    const li = document.createElement("li");
    const im = document.createElement("img");
    im.src = b.cover || ""; im.alt = `${b.title}${b.author ? `, by ${b.author}` : ""}`; im.loading = "lazy";
    li.append(link(b.url, im));
    return li;
  }));
  $(".r-fav-h", win).hidden = !favs.length;
  const shelves = data?.shelves;
  $(".r-counts", win).textContent = shelves ? `${shelves.read} read, ${shelves["to-read"]} waiting on the to-read shelf.` : "";
}

// --------------------------------------------------------------- the desktop
export function createScreen({ onLeave, reduce, shelf, record }) {
  const screen = $("#screen");
  const os = $("#os", screen);
  const paper = wallpaperCanvas();
  paper.className = "wallpaper";
  paper.setAttribute("aria-hidden", "true");
  os.prepend(paper);
  const clock = $("#clock", screen);
  const wx = $("#wx", screen);
  const tick = () => {
    clock.textContent = clockText();
    const moon = moonPhase();
    const c = $("canvas", wx), g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    drawMoon(g, c.width / 2, c.height / 2, c.width / 2 - 2, moon);
    $("span", wx).textContent = skyLine(skyNow, moon);
    wx.title = skySentence(skyNow, moon);
  };
  tick(); setInterval(tick, 20000);

  // Dock icons as small canvases, so they match the screen exactly.
  for (const btn of screen.querySelectorAll(".dock button")) {
    const c = document.createElement("canvas");
    c.width = c.height = 152;
    drawIcon(c.getContext("2d"), btn.dataset.app, 0, 0, 152);
    btn.prepend(c);
    btn.addEventListener("click", () => openApp(btn.dataset.app));
  }

  // The menu bar: one menu open at a time; choosing an item opens its window or link.
  const menus = [...screen.querySelectorAll(".menu")].map((m) => ({ btn: $(".menu-btn", m), list: $(".menu-list", m) }));
  const closeMenus = () => { let was = false; for (const m of menus) { if (!m.list.hidden) was = true; m.list.hidden = true; m.btn.setAttribute("aria-expanded", "false"); } return was; };
  for (const m of menus) {
    m.btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = m.list.hidden;
      closeMenus();
      if (open) { m.list.hidden = false; m.btn.setAttribute("aria-expanded", "true"); m.list.querySelector("button, a")?.focus({ preventScroll: true }); }
    });
    for (const item of m.list.querySelectorAll("button[data-app]")) item.addEventListener("click", () => { closeMenus(); openApp(item.dataset.app); });
    for (const a of m.list.querySelectorAll("a")) a.addEventListener("click", () => closeMenus());
  }
  os.addEventListener("click", (e) => { if (!e.target.closest(".menu")) closeMenus(); });

  const resetLights = lightsGame($('[data-win="box"]', screen));
  let current = null;
  function openApp(id) {
    for (const w of screen.querySelectorAll(".win")) w.hidden = w.dataset.win !== id;
    for (const b of screen.querySelectorAll(".dock button")) b.classList.toggle("active", b.dataset.app === id);
    current = id;
    rlRun++;
    if (id !== "box") resetLights();
    const win = $(`[data-win="${id}"]`, screen);
    if (id === "nfl") { fillCall(win); fillRecord(win, record); }
    if (id === "sec") playRedline($(".redline", win), reduce());
    if (id === "reading") fillReading(win, shelf);
    if (win) requestAnimationFrame(() => $(".win-close", win)?.focus({ preventScroll: true }));
  }
  function closeApp() {
    for (const w of screen.querySelectorAll(".win")) w.hidden = true;
    for (const b of screen.querySelectorAll(".dock button")) b.classList.remove("active");
    current = null; rlRun++; resetLights();
  }
  for (const b of screen.querySelectorAll(".win-close")) b.addEventListener("click", () => closeApp());

  // Fit the 1280 x 720 desktop onto the monitor's screen as the camera sees it.
  function place(rect) {
    const compact = rect.width < 720;
    screen.classList.toggle("compact", compact);
    if (compact) {
      os.style.transform = ""; os.style.left = ""; os.style.top = "";
      return;
    }
    const k = rect.width / OS_W;
    os.style.left = `${rect.left}px`;
    os.style.top = `${rect.top}px`;
    os.style.transform = `scale(${k})`;
  }

  return {
    setSky(sky) { skyNow = sky; tick(); },
    get open() { return !screen.hidden; },
    get app() { return current; },
    show(rect, app) {
      place(rect);
      screen.hidden = false;
      requestAnimationFrame(() => screen.classList.add("on"));
      if (app && app !== "home") openApp(app); else { closeApp(); requestAnimationFrame(() => $(".dock button", screen).focus({ preventScroll: true })); }
    },
    place,
    hide() {
      closeMenus();
      screen.classList.remove("on");
      closeApp();
      screen.hidden = true;
    },
    escape() {
      if (closeMenus()) return true;
      if (current && !screen.classList.contains("compact")) { closeApp(); return true; }
      return false;
    },
    onLeave,
  };
}

export function screenTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = OS_W; canvas.height = OS_H;
  paintIdle(canvas);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // Keep the menu-bar clock current.
  const repaint = () => { paintIdle(canvas); tex.needsUpdate = true; };
  setInterval(repaint, 30000);
  return { tex, setSky(sky) { skyNow = sky; repaint(); } };
}
