// The computer on the desk: what its screen shows from the chair (a painted canvas),
// and the real desktop that takes over when you lean in (HTML, scaled to the screen).

import * as THREE from "three";

export const OS_W = 1280, OS_H = 720;
const $ = (sel, root = document) => root.querySelector(sel);
const pct = (v, d = 1) => `${(100 * v).toFixed(d)}%`;

// ------------------------------------------------------------ the dock
export const APPS = [
  { id: "nfl", name: "Survivor" },
  { id: "sec", name: "Boilerplate" },
  { id: "box", name: "Box Box" },
  { id: "thesis", name: "Thesis" },
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
  if (id === "about") {
    tile("#e9e7e1");
    g.fillStyle = "#161616"; g.font = "600 40px 'Instrument Sans', sans-serif"; g.textAlign = "center"; g.fillText("JL", 50, 64);
  }
  g.restore();
}

function clockText(d = new Date()) {
  return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

// What the screen shows from the chair: wallpaper, the name, and the dock.
export function paintIdle(canvas, night) {
  const g = canvas.getContext("2d");
  const w = OS_W, h = OS_H;
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#14233a"); bg.addColorStop(0.55, "#2c5274"); bg.addColorStop(1, "#86a6b9");
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.78, h * 0.22, 10, w * 0.78, h * 0.22, w * 0.6);
  glow.addColorStop(0, "rgba(255, 214, 170, 0.35)"); glow.addColorStop(1, "rgba(255, 214, 170, 0)");
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  // menu bar
  g.fillStyle = "rgba(10, 16, 26, 0.35)"; g.fillRect(0, 0, w, 30);
  g.fillStyle = "#fff"; g.font = "600 15px 'Instrument Sans', sans-serif"; g.textBaseline = "middle";
  g.fillText("Joseph Lattanzi", 20, 15);
  g.fillStyle = "rgba(255,255,255,0.75)"; g.font = "400 15px 'Instrument Sans', sans-serif";
  g.fillText("Projects", 158, 15); g.fillText("Contact", 230, 15);
  g.textAlign = "right"; g.fillStyle = "#fff"; g.fillText(clockText(), w - 20, 15); g.textAlign = "left";
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
  rounded(g, dx, dy, dw, s + 26, 26); g.fillStyle = "rgba(255,255,255,0.18)"; g.fill();
  g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1; g.stroke();
  APPS.forEach((a, i) => drawIcon(g, a.id, dx + 20 + i * (s + gap), dy + 13, s));
  if (night) { g.fillStyle = "rgba(0,0,0,0.08)"; g.fillRect(0, 0, w, h); }
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
    let week = 1;
    data.week_starts.forEach((iso, i) => { if (now >= Date.parse(iso)) week = i + 1; });
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
    const { data, week, result, best, team } = await theCall();
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

// --------------------------------------------------------------- the desktop
export function createScreen({ onLeave, reduce }) {
  const screen = $("#screen");
  const os = $("#os", screen);
  const clock = $("#clock", screen);
  const tick = () => { clock.textContent = clockText(); };
  tick(); setInterval(tick, 20000);

  // Dock icons as small canvases, so they match the screen exactly.
  for (const btn of screen.querySelectorAll(".dock button")) {
    const c = document.createElement("canvas");
    c.width = c.height = 152;
    drawIcon(c.getContext("2d"), btn.dataset.app, 0, 0, 152);
    btn.prepend(c);
    btn.addEventListener("click", () => openApp(btn.dataset.app));
  }

  const resetLights = lightsGame($('[data-win="box"]', screen));
  let current = null;
  function openApp(id) {
    for (const w of screen.querySelectorAll(".win")) w.hidden = w.dataset.win !== id;
    for (const b of screen.querySelectorAll(".dock button")) b.classList.toggle("active", b.dataset.app === id);
    current = id;
    rlRun++;
    if (id !== "box") resetLights();
    const win = $(`[data-win="${id}"]`, screen);
    if (id === "nfl") fillCall(win);
    if (id === "sec") playRedline($(".redline", win), reduce());
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
      screen.classList.remove("on");
      closeApp();
      screen.hidden = true;
    },
    escape() {
      if (current && !screen.classList.contains("compact")) { closeApp(); return true; }
      return false;
    },
    onLeave,
  };
}

export function screenTexture(night) {
  const canvas = document.createElement("canvas");
  canvas.width = OS_W; canvas.height = OS_H;
  paintIdle(canvas, night);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, repaint(n) { paintIdle(canvas, n); tex.needsUpdate = true; } };
}
