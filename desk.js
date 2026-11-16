// The desk: pick a piece up, throw it, turn it over.
// Each piece holds a small working part of its project: a sentence that redlines itself,
// this week's survivor pick from the optimizer's own engine, and an F1 start-lights test.

const mat = document.getElementById("mat");
const pieces = [...mat.querySelectorAll(".obj")];
const rulerX = mat.querySelector(".ruler-x");
const rulerY = mat.querySelector(".ruler-y");
const bandX = rulerX.querySelector(".band");
const bandY = rulerY.querySelector(".band");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const wide = matchMedia("(min-width: 1080px)");
const STORE = "desk:v1";
const REF_W = 1440, REF_H = 920; // the desk the home layout is drawn for

// Where each piece lies on a tidy desk: centre in the 1440 x 920 frame, and tilt in degrees.
// The whole desk scales to the window, so it always fits on one screen.
const HOME = {
  filing: { x: 1000, y: 318, r: 3 },
  pick: { x: 1268, y: 402, r: -4 },
  card: { x: 236, y: 560, r: -5 },
  ticket: { x: 622, y: 668, r: 2.5 },
  thesis: { x: 1012, y: 712, r: -2.5 },
};

const state = new Map();
let top = 20;
let desk = false;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const frame = () => {
  const w = mat.clientWidth;
  const k = clamp(Math.min(w / REF_W, (innerHeight - 8) / REF_H), 0.68, 1.15);
  return { w, h: mat.clientHeight, k, x0: (w - REF_W * k) / 2 };
};

// A piece lies at the desk's scale, and comes up to full size when turned over to be read.
function place(el) {
  const s = state.get(el);
  const k = frame().k;
  el.style.setProperty("--x", `${s.x - s.w / 2}px`);
  el.style.setProperty("--y", `${s.y - s.h / 2}px`);
  el.style.setProperty("--r", `${s.r}deg`);
  el.style.setProperty("--s", el.classList.contains("flipped") ? Math.max(1, k) : k);
}

function homeOf(id) {
  const f = frame();
  const h = HOME[id];
  return { x: f.x0 + h.x * f.k, y: h.y * f.k, r: h.r };
}

function save() {
  if (!desk) return;
  const f = frame();
  const out = {};
  for (const [el, s] of state) out[el.dataset.id] = { fx: (s.x - f.x0) / (REF_W * f.k), fy: s.y / (REF_H * f.k), r: s.base };
  try { localStorage.setItem(STORE, JSON.stringify(out)); } catch { /* private mode */ }
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch { return null; }
}

function keepOnDesk(s) {
  const f = frame();
  const m = 56 * f.k;
  s.x = clamp(s.x, 24 + m, f.w - m);
  s.y = clamp(s.y, 24 + m, f.h - m);
}

// ------------------------------------------------------------------ rulers
function rulerLabels() {
  for (const n of mat.querySelectorAll(".ruler .n")) n.remove();
  const f = frame();
  for (let x = 120; x < f.w; x += 120) {
    const n = document.createElement("span");
    n.className = "n"; n.textContent = x; n.style.left = `${x}px`;
    rulerX.append(n);
  }
  for (let y = 120; y < f.h; y += 120) {
    const n = document.createElement("span");
    n.className = "n"; n.textContent = y; n.style.top = `${y + 22}px`;
    rulerY.append(n);
  }
}

function measure(el) {
  if (!desk || !el) { bandX.classList.remove("on"); bandY.classList.remove("on"); return; }
  const m = mat.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const x = Math.round(b.left - m.left), y = Math.round(b.top - m.top);
  const w = Math.round(b.width), h = Math.round(b.height);
  bandX.style.left = `${x}px`; bandX.style.width = `${w}px`;
  bandX.dataset.a = x; bandX.dataset.b = x + w;
  bandY.style.top = `${y}px`; bandY.style.height = `${h}px`;
  bandX.classList.add("on"); bandY.classList.add("on");
}

// ---------------------------------------------------------------- the desk
function setUp() {
  desk = wide.matches;
  mat.classList.toggle("desk", desk);
  if (!desk) {
    mat.style.height = "";
    for (const el of pieces) for (const v of ["--x", "--y", "--r", "--s", "z-index"]) el.style.removeProperty(v);
    return;
  }
  const k0 = frame().k;
  mat.style.height = `${Math.round(REF_H * k0)}px`;
  mat.style.setProperty("--k", k0);
  const saved = load();
  const f = frame();
  mat.style.setProperty("--x0", `${f.x0}px`);
  pieces.forEach((el, i) => {
    const id = el.dataset.id;
    const home = homeOf(id);
    const s = state.get(el) || { w: el.offsetWidth, h: el.offsetHeight };
    const keep = saved && saved[id];
    Object.assign(s, keep && keep.fy != null ? { x: f.x0 + keep.fx * REF_W * f.k, y: keep.fy * REF_H * f.k, r: keep.r, base: keep.r } : { ...home, base: home.r });
    keepOnDesk(s);
    state.set(el, s);
    el.style.zIndex = 10 + i;
    place(el);
  });
  rulerLabels();
}

function dropIn() {
  if (reduce.matches || !desk) return;
  pieces.forEach((el, i) => {
    el.querySelector(".lift").animate(
      [{ opacity: 0, transform: "translateY(-28px) scale(1.07)" }, { opacity: 1, transform: "none" }],
      { duration: 560, delay: 160 + i * 90, easing: "cubic-bezier(0.2, 0.9, 0.25, 1.08)", fill: "backwards" },
    );
  });
}

// --------------------------------------------------------- drag and throw
for (const el of pieces) {
  // A selection frame's labels, like a design tool: the piece's name and size.
  const name = document.createElement("span");
  name.className = "sel-name"; name.textContent = el.dataset.name; name.setAttribute("aria-hidden", "true");
  const size = document.createElement("span");
  size.className = "sel-size"; size.textContent = `${el.offsetWidth} × ${el.offsetHeight}`; size.setAttribute("aria-hidden", "true");
  el.append(name, size);
  el.tabIndex = 0;
  el.querySelector(".back").inert = true;

  let drag = null;
  let glide = 0;

  el.addEventListener("pointerdown", (e) => {
    if (!desk || e.button !== 0 || e.target.closest("a, button")) return;
    e.preventDefault();
    cancelAnimationFrame(glide);
    el.setPointerCapture(e.pointerId);
    const s = state.get(el);
    drag = { px: e.clientX, py: e.clientY, ox: s.x, oy: s.y, moved: false, trail: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
    el.style.zIndex = ++top;
    el.classList.add("held");
    el.focus({ preventScroll: true });
    measure(el);
  });

  el.addEventListener("pointermove", (e) => {
    if (!drag) { if (desk && e.pointerType === "mouse") measure(el); return; }
    const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    const s = state.get(el);
    s.x = drag.ox + dx; s.y = drag.oy + dy;
    keepOnDesk(s);
    const now = performance.now();
    drag.trail.push({ t: now, x: e.clientX, y: e.clientY });
    while (drag.trail.length > 2 && now - drag.trail[0].t > 90) drag.trail.shift();
    if (!reduce.matches) {
      const a = drag.trail[0], b = drag.trail[drag.trail.length - 1];
      const vx = (b.x - a.x) / Math.max(1, b.t - a.t);
      s.r += (s.base + clamp(vx * 7, -11, 11) - s.r) * 0.25;
    }
    place(el);
    measure(el);
  });

  const release = () => {
    if (!drag) return;
    const was = drag;
    drag = null;
    el.classList.remove("held");
    if (!was.moved) { flip(el); measure(el); return; }
    const s = state.get(el);
    const a = was.trail[0], b = was.trail[was.trail.length - 1];
    let vx = (b.x - a.x) / Math.max(1, b.t - a.t), vy = (b.y - a.y) / Math.max(1, b.t - a.t);
    if (reduce.matches) { s.r = s.base; place(el); save(); return; }
    let last = performance.now();
    const step = (t) => {
      const dt = Math.min(32, t - last); last = t;
      const f = frame();
      s.x += vx * dt; s.y += vy * dt;
      const decay = Math.pow(0.9, dt / 16);
      vx *= decay; vy *= decay;
      if (s.x < 48 || s.x > f.w - 48) vx *= -0.35;
      if (s.y < 72 || s.y > f.h - 48) vy *= -0.35;
      keepOnDesk(s);
      s.r += (s.base - s.r) * 0.12;
      place(el);
      measure(document.activeElement === el || el.matches(":hover") ? el : null);
      if (Math.hypot(vx, vy) > 0.02 || Math.abs(s.r - s.base) > 0.05) glide = requestAnimationFrame(step);
      else { s.r = s.base; place(el); save(); }
    };
    glide = requestAnimationFrame(step);
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", () => { if (!drag) measure(null); });

  // On a phone the pieces sit in a pile; a tap turns one over.
  el.addEventListener("click", (e) => {
    if (desk || e.target.closest("a, button")) return;
    flip(el);
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.classList.contains("flipped")) { flip(el, false); el.focus(); return; }
    if (e.target !== el) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(el); return; }
    const step = e.shiftKey ? 40 : 8;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (move && desk) {
      e.preventDefault();
      const s = state.get(el);
      s.x += move[0]; s.y += move[1];
      keepOnDesk(s); place(el); measure(el); save();
    }
  });
  el.addEventListener("focus", () => { if (el.matches(":focus-visible")) measure(el); });
  el.addEventListener("blur", () => measure(null));
}

function flip(el, to = !el.classList.contains("flipped")) {
  el.classList.toggle("flipped", to);
  if (to && desk) el.style.zIndex = ++top;
  if (desk) place(el);
  el.querySelector(".front").inert = to;
  el.querySelector(".back").inert = !to;
  const on = flipHooks[el.dataset.id];
  if (on) on(to);
}

document.getElementById("tidy").addEventListener("click", () => {
  try { localStorage.removeItem(STORE); } catch { /* ignore */ }
  for (const el of pieces) {
    if (el.classList.contains("flipped")) flip(el, false);
    const s = state.get(el);
    Object.assign(s, homeOf(el.dataset.id));
    s.base = s.r;
    if (!reduce.matches) {
      el.style.transition = "translate 0.6s cubic-bezier(0.3, 1.1, 0.4, 1), rotate 0.6s cubic-bezier(0.3, 1.1, 0.4, 1), scale 0.45s";
      setTimeout(() => { el.style.transition = ""; }, 650);
    }
    place(el);
  }
});

// ------------------------------------------------- the filing: a live redline
// Three real edits from Kellogg's fiscal 2019 risk section, word for word.
const EDITS = [
  [["k", "Competition against "], ["d", "retailer"], ["i", "private label"], ["k", " brands could negatively impact our business."]],
  [["k", "Agricultural commodities, including corn, wheat, "], ["i", "rice, "], ["k", "potato flakes, vegetable oils, sugar and cocoa, are the principal raw materials used in our products."]],
  [["d", "Some"], ["i", "One of the"], ["k", " multiemployer plans in which we participate "], ["d", "are"], ["i", "is"], ["k", " reported to have significant underfunded liabilities."]],
];
const redline = document.getElementById("redline");
let rlRun = 0;
const wait = (ms, run) => new Promise((ok, no) => setTimeout(() => (run === rlRun ? ok() : no()), ms));

function drawEdit(edit, done) {
  redline.replaceChildren();
  const ins = [];
  const dels = [];
  for (const [kind, text] of edit) {
    const span = document.createElement("span");
    if (kind === "k") span.textContent = text;
    if (kind === "d") { span.className = "rl-del"; span.textContent = text; dels.push(span); if (done) span.classList.add("cut"); }
    if (kind === "i") { span.className = "rl-ins"; span.dataset.text = text; span.textContent = done ? text : ""; ins.push(span); }
    if (kind === "d") { redline.append(span, document.createTextNode(" ")); } else redline.append(span);
  }
  return { ins, dels };
}

async function playRedline() {
  const run = ++rlRun;
  let i = 0;
  try {
    for (;;) {
      const edit = EDITS[i % EDITS.length];
      if (reduce.matches) { drawEdit(edit, true); await wait(5000, run); i++; continue; }
      const { ins, dels } = drawEdit(edit, false);
      redline.classList.remove("fading");
      await wait(900, run);
      for (const d of dels) { d.classList.add("cut"); await wait(260, run); }
      await wait(380, run);
      for (const s of ins) {
        s.classList.add("typing");
        for (const ch of s.dataset.text) { s.textContent += ch; await wait(48, run); }
        s.classList.remove("typing");
      }
      await wait(2800, run);
      redline.classList.add("fading");
      await wait(320, run);
      i++;
    }
  } catch { /* stopped */ }
}

// ------------------------------------------- the pick sheet: this week's call
const $ = (id) => document.getElementById(id);
const pct = (v, d = 1) => `${(100 * v).toFixed(d)}%`;
let pick = null;

function ago(iso) {
  const h = Math.round((Date.now() - Date.parse(iso)) / 36e5);
  return h < 1 ? "under an hour ago" : h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

async function theCall() {
  const base = "/nfl-survivor-optimizer/";
  try {
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
    if (!best) throw new Error("no candidates");
    const team = data.teams.find((t) => t.abbr === best.team);
    const g = best.thisWeek;
    const spread = g.spread == null ? "" : ` ${g.spread > 0 ? "+" : ""}${g.spread}`;
    $("pick-week").textContent = `Week ${week}`;
    $("pick-name").textContent = team ? team.nick : best.team;
    $("pick-dot").style.background = team ? team.colors[0] : "";
    $("pick-game").textContent = `${g.site === "home" ? "vs" : "at"} ${g.opp}${spread}`;
    $("pick-win").textContent = pct(g.p);
    $("pick-public").textContent = pct(g.pick);
    $("pick-equity").textContent = `${(best.equity * 50).toFixed(1)}×`;
    $("pick-foot").textContent = `Lines as of ${ago(data.generated_at)}`;
    // The season the optimizer plans around this pick, a week at a time (first ten weeks shown).
    $("pick-path").replaceChildren(...best.path.slice(0, 10).map(({ week, team: t }) => {
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = t;
      li.append(`Wk ${week}`, b);
      return li;
    }));
    pick = { curve: best.curve, weeks: result.weeks, survive: best.pSurvive };
    $("pick-curve-cap").textContent = `Chance the entry is still alive, week ${result.weeks[0]} to ${result.weeks[result.weeks.length - 1]}: ${pct(best.pSurvive)} at the end`;
    drawCurve(false);
  } catch {
    $("pick-name").textContent = "This week";
    $("pick-game").textContent = "The call is on the optimizer";
    $("pick-foot").textContent = "Turn over for the link";
  }
}

function drawCurve(animate) {
  const svg = $("pick-curve");
  if (!pick || !pick.curve.length) return;
  const W = 240, H = 84, top = 6, bottom = 70;
  const pts = [1, ...pick.curve];
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => top + (1 - v) * (bottom - top);
  const line = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  svg.innerHTML =
    `<line class="axis" x1="0" x2="${W}" y1="${bottom}" y2="${bottom}"/>` +
    `<polygon class="area" points="0,${bottom} ${line} ${W},${bottom}"/>` +
    `<polyline class="line" points="${line}"/>` +
    `<text x="0" y="${H - 2}">Wk ${pick.weeks[0]}</text>` +
    `<text x="${W}" y="${H - 2}" text-anchor="end">Wk ${pick.weeks[pick.weeks.length - 1]}</text>`;
  if (animate && !reduce.matches) {
    const pl = svg.querySelector(".line");
    const len = pl.getTotalLength();
    pl.animate([{ strokeDasharray: `${len}`, strokeDashoffset: len }, { strokeDasharray: `${len}`, strokeDashoffset: 0 }], { duration: 1100, delay: 250, easing: "cubic-bezier(0.3, 0.6, 0.3, 1)", fill: "backwards" });
    svg.querySelector(".area").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 900, fill: "backwards" });
  }
}

// --------------------------------------------- the ticket: lights out
const gantry = document.getElementById("gantry");
const lights = [...gantry.querySelectorAll("i")];
const read = document.getElementById("lights-read");
let race = { phase: "idle", timers: [] };
const best = () => Number(localStorage.getItem("desk:best")) || null;

function lightsTo(columns) {
  lights.forEach((l, i) => l.classList.toggle("on", i % 5 < columns));
}
function resetRace() {
  race.timers.forEach(clearTimeout);
  race = { phase: "idle", timers: [] };
  lightsTo(0);
}

gantry.addEventListener("click", () => {
  if (race.phase === "idle") {
    race.phase = "lighting";
    read.textContent = "Wait for it…";
    for (let c = 1; c <= 5; c++) race.timers.push(setTimeout(() => lightsTo(c), c * 900));
    const out = 5 * 900 + 600 + Math.random() * 2200;
    race.timers.push(setTimeout(() => { lightsTo(0); race.phase = "go"; race.t0 = performance.now(); }, out));
    return;
  }
  if (race.phase === "lighting") {
    resetRace();
    read.innerHTML = "<b>Jump start</b>Too early. Press the lights to go again.";
    return;
  }
  if (race.phase === "go") {
    const s = (performance.now() - race.t0) / 1000;
    resetRace();
    const prev = best();
    if (!prev || s < prev) try { localStorage.setItem("desk:best", String(s)); } catch { /* ignore */ }
    const b = Math.min(s, prev || s);
    read.innerHTML = `<b>${s.toFixed(3)} s</b>An F1 driver: about 0.2 s. Your best: ${b.toFixed(3)} s.`;
  }
});

const flipHooks = {
  filing: (on) => { if (on) playRedline(); else rlRun++; },
  pick: (on) => { if (on) drawCurve(true); },
  ticket: (on) => { if (!on) resetRace(); },
};

// ------------------------------------------------------------------ start
setUp();
dropIn();
theCall();
let lastW = innerWidth;
addEventListener("resize", () => {
  if (innerWidth === lastW) return;
  lastW = innerWidth;
  setUp();
});
wide.addEventListener("change", setUp);
