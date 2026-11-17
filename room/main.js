// Sitting at the desk. The camera is your head; everything on the desk does something.

import * as THREE from "three";
import { TOP, motion, tween, stepTweens, fetchJSON, moved } from "./kit.js";
import { buildDesk } from "./props.js";
import { buildWatch } from "./watch.js";
import { loadShelf, buildBook } from "./book.js";
import { buildMacropad } from "./macropad.js";
import { loadGithub, buildGithubPrint } from "./github.js";
import { buildDepartures } from "./departures.js";
import { buildDrafts } from "./drafts.js";
import { createLook, quality } from "./look.js";
import { createScreen, screenTexture, theCall, recordLine } from "./screen.js";
import { bostonSky } from "./window.js";

performance.mark("desk:modules");
const room = document.getElementById("room");
const canvas = document.getElementById("scene");
const label = document.getElementById("label");
const hint = document.getElementById("hint");
const back = document.getElementById("back");
const loading = document.getElementById("loading");
const hotspots = document.getElementById("hotspots");
const inspectBar = document.getElementById("inspect");
const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
motion.reduce = reduceQuery.matches;
reduceQuery.addEventListener("change", (e) => { motion.reduce = e.matches; });

const fontsReady = Promise.race([
  Promise.all(["600 64px Caveat", "600 40px 'Source Serif 4'", "400 40px 'Source Serif 4'", "500 20px 'Instrument Sans'", "600 20px 'Instrument Sans'", "700 70px 'Barlow Condensed'", "400 40px 'UnifrakturMaguntia'"].map((f) => document.fonts.load(f))),
  new Promise((ok) => setTimeout(ok, 2500)),
]);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
} catch {
  document.documentElement.classList.remove("desk");
  document.body.classList.add("flat");
  throw new Error("WebGL unavailable; showing the list instead");
}
const tier = quality();
renderer.setPixelRatio(tier.pixelRatio);

const scene = new THREE.Scene();
const [shelf, graph, record, music] = await Promise.all([loadShelf(), loadGithub(), fetchJSON("data/survivor.json"), fetchJSON("data/music.json"), fontsReady]);
performance.mark("desk:data");

const screenTex = screenTexture();
const { items, updates, onMat, pods } = buildDesk(scene, { screenTexture: screenTex.tex, spines: shelf?.spines, lastWatered: graph?.last_contribution, listening: Boolean(music) });
items.watch = buildWatch(scene, { x: -0.335, y: TOP, z: -0.43, ry: -0.35 });
items.macropad = buildMacropad(scene, { x: 0.325, y: onMat, z: -0.262, ry: -0.04 });
const book = buildBook(scene, shelf, { x: -0.54, z: -0.385, ry: 0.28 });
if (book) items.book = book;
items.github = buildGithubPrint(scene, graph, { x: 0.585, y: 1.2, z: -0.846 });
items.football.note = recordLine(record);
// The AirPods are just AirPods, unless Spotify has told the desk what's been on repeat.
if (music) items.pods = { root: pods, label: "AirPods", sub: `On repeat lately: “${music.track}” by ${music.artist}`, note: "From my Spotify. Click to listen", href: music.url, hover: pods.userData.open };
items.departures = buildDepartures(scene, { x: 0.6, y: TOP, z: -0.38, ry: -0.45 });
items.drafts = buildDrafts(scene, { x: -0.655, y: TOP, z: -0.79 }); // the back corner, beside the lamp

// --------------------------------------------------------------- camera
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 20);
const look = createLook(renderer, scene, camera, items, tier);
performance.mark("desk:built");

const HOME_TARGET = new THREE.Vector3(0, 0.95, -0.42);
const HOME_DIR = new THREE.Vector3(0, 0.31, 0.8).normalize();
const SCREEN_CENTER = new THREE.Vector3(0, 1.08, -0.5915);
const SCREEN_W = 0.62, SCREEN_H = 0.3488;
const view = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
let mode = "desk"; // desk | moving | screen | inspect
const gaze = { x: 0, y: 0, tx: 0, ty: 0, pan: 0, panTo: 0 };

// On a phone the view is narrow, so it frames the monitor and keyboard and a swipe looks around.
const tallView = () => camera.aspect < 0.9;
function homePose() {
  const a = camera.aspect;
  const tall = tallView();
  camera.fov = tall ? 62 : 46;
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // Far enough back to see the whole desk across, from the folder to the departure sign.
  const fitW = tall ? 0.8 : 1.46;
  const d = Math.max(tall ? 0.9 : 1.08, fitW / 2 / (half * a));
  const target = tall ? new THREE.Vector3(0, 0.9, -0.42) : HOME_TARGET.clone();
  return { pos: target.clone().addScaledVector(HOME_DIR, d), target };
}
function screenPose() {
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.max(SCREEN_H / 2 / half, SCREEN_W / 2 / (half * camera.aspect)) / 0.94;
  return { pos: SCREEN_CENTER.clone().add(new THREE.Vector3(0, 0, d)), target: SCREEN_CENTER.clone() };
}
// A close look at one object: its own framing, backed off on a narrow screen.
function inspectPose(item) {
  item.root.updateMatrixWorld(true);
  const target = item.view.target.clone().applyMatrix4(item.root.matrixWorld);
  const pos = item.view.offset.clone().applyMatrix4(item.root.matrixWorld);
  if (tallView()) pos.lerp(target, -0.45);
  return { pos, target };
}
function screenRect() {
  const r = canvas.getBoundingClientRect();
  const p = (x, y) => new THREE.Vector3(x, y, SCREEN_CENTER.z).project(camera);
  const a = p(-SCREEN_W / 2, SCREEN_CENTER.y + SCREEN_H / 2), b = p(SCREEN_W / 2, SCREEN_CENTER.y - SCREEN_H / 2);
  const left = (a.x + 1) / 2 * r.width, top = (1 - a.y) / 2 * r.height;
  return { left, top, width: (b.x - a.x) / 2 * r.width, height: (a.y - b.y) / 2 * r.height };
}
function applyView() {
  const pos = view.pos.clone(), target = view.target.clone();
  if (mode === "desk" && tallView()) {
    // A swipe turns your head toward either end of the desk.
    pos.x += gaze.pan * 0.12; target.x += gaze.pan * 0.42;
  } else if (mode === "desk" && !motion.reduce) {
    pos.x += gaze.x * 0.05; pos.y += gaze.y * 0.025;
    target.x += gaze.x * 0.02; target.y += gaze.y * 0.012;
  }
  camera.position.copy(pos);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

function resize() {
  const w = room.clientWidth, h = room.clientHeight;
  renderer.setSize(w, h, false);
  look.setSize(w, h, renderer.getPixelRatio());
  camera.aspect = w / h;
  if (mode === "desk") Object.assign(view, homePose());
  else if (mode === "screen") { homePose(); Object.assign(view, screenPose()); }
  else if (mode === "inspect" && inspecting) { homePose(); Object.assign(view, inspectPose(inspecting)); }
  camera.updateProjectionMatrix();
  applyView();
  if (mode === "screen") { camera.updateMatrixWorld(); desktop.place(screenRect()); }
}

async function moveTo(pose, ms = 950) {
  const p0 = camera.position.clone(), t0 = view.target.clone();
  await tween(ms, (k) => {
    view.pos.lerpVectors(p0, pose.pos, k);
    view.target.lerpVectors(t0, pose.target, k);
  }, "inOut");
}

// Whatever had keyboard focus before leaning in gets it back afterwards.
let returnFocus = null;
const rememberFocus = () => { returnFocus = document.activeElement?.classList.contains("spot") ? document.activeElement : null; };
const restoreFocus = () => { returnFocus?.focus({ preventScroll: true }); returnFocus = null; };

// -------------------------------------------------------------- desktop
const desktop = createScreen({ reduce: () => motion.reduce, shelf, record });
async function lookAtScreen(app) {
  if (mode === "moving") return;
  rememberFocus();
  mode = "moving";
  hideLabel(); hint.classList.add("gone");
  await moveTo(screenPose());
  applyView(); camera.updateMatrixWorld();
  mode = "screen";
  desktop.show(screenRect(), app);
  back.hidden = false;
  room.classList.add("leaning");
}
async function backToDesk() {
  if (mode === "inspect") { leaveInspect(); return; }
  if (mode !== "screen") return;
  desktop.hide();
  back.hidden = true;
  room.classList.remove("leaning");
  items.folder.close();
  items.book?.close();
  mode = "moving";
  await moveTo(homePose(), 850);
  mode = "desk";
  restoreFocus();
}

// ------------------------------------------------------ a closer look
let inspecting = null;
async function inspect(id) {
  if (mode !== "desk") return;
  const item = items[id];
  rememberFocus();
  mode = "moving";
  inspecting = item;
  hideLabel(); hint.classList.add("gone");
  await moveTo(inspectPose(item), 900);
  mode = "inspect";
  back.hidden = false;
  room.classList.add("leaning", "inspecting");
  showInspect(item, true);
  item.onInspect?.();
}
function showInspect(item, focus) {
  inspectBar.hidden = false;
  inspectBar.querySelector("b").textContent = item.label;
  inspectBar.querySelector("span").textContent = item.caption();
  const buttons = item.actions().map((a) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = a.label;
    b.addEventListener("click", async () => {
      await a.run();
      if (inspecting === item) showInspect(item, false);
    });
    return b;
  });
  const holder = inspectBar.querySelector(".inspect-actions");
  const had = holder.contains(document.activeElement) ? [...holder.children].indexOf(document.activeElement) : -1;
  holder.replaceChildren(...buttons);
  if (focus) buttons[0]?.focus({ preventScroll: true });
  else if (had >= 0) buttons[Math.min(had, buttons.length - 1)]?.focus({ preventScroll: true });
}
async function leaveInspect() {
  if (mode !== "inspect") return;
  const item = inspecting;
  inspectBar.hidden = true;
  back.hidden = true;
  room.classList.remove("leaning", "inspecting");
  mode = "moving";
  item.reset?.();
  await moveTo(homePose(), 850);
  inspecting = null;
  mode = "desk";
  restoreFocus();
}

back.addEventListener("click", backToDesk);
addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (mode === "screen" && !desktop.escape()) backToDesk();
  else if (mode === "inspect") leaveInspect();
});

// ---------------------------------------------------- what is under the pointer
const pickables = [];
for (const [id, item] of Object.entries(items)) {
  item.id = id;
  item.baseY = item.root.position.y;
  item.lift = 0;
  item.hoverK = 0; // for objects that answer a hover themselves (`hover(k)`), eased 0 to 1
}
// Tag meshes after every item exists, innermost item last, so a note stuck on the folder is the note.
const order = Object.keys(items).sort((a, b) => depth(items[a].root) - depth(items[b].root));
function depth(o) { let n = 0; while (o.parent) { n++; o = o.parent; } return n; }
for (const id of order) items[id].root.traverse((o) => { if (o.isMesh) { o.userData.item = id; if (!pickables.includes(o)) pickables.push(o); } });

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2(9, 9);
let hovered = null;
let busy = false;

function anchor(item) {
  const box = new THREE.Box3().setFromObject(item.root);
  const c = box.getCenter(new THREE.Vector3());
  return new THREE.Vector3(c.x, box.max.y + 0.01, c.z);
}
function toScreen(v) {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * room.clientWidth, y: (1 - p.y) / 2 * room.clientHeight, behind: p.z > 1 };
}
function showLabel(id) {
  if (!id || mode !== "desk") { hideLabel(); return; }
  const item = items[id];
  label.querySelector("b").textContent = item.label;
  label.querySelector("span").textContent = item.sub;
  label.querySelector("small").textContent = item.note || "";
  const s = toScreen(anchor(item));
  // Keep the whole label on screen: it sits above its object unless that would cut it off.
  const w = label.offsetWidth, h = label.offsetHeight;
  label.style.left = `${Math.min(room.clientWidth - w / 2 - 8, Math.max(w / 2 + 8, s.x))}px`;
  label.style.top = `${Math.max(h + 62, s.y)}px`; // clear of the buttons along the top edge
  label.classList.add("on");
}
function hideLabel() { label.classList.remove("on"); }

function pick() {
  if (mode !== "desk" && mode !== "inspect") return null;
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(pickables, false).find((h) => h.object.visible);
  if (!hit) return null;
  const id = hit.object.userData.item;
  if (mode === "inspect" && items[id] !== inspecting) return null;
  return { id, object: hit.object };
}

canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  if (e.pointerType === "mouse") {
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    gaze.tx = pointer.x; gaze.ty = pointer.y;
  }
  if (downAt && tallView() && e.pointerType !== "mouse") {
    gaze.panTo = Math.max(-1, Math.min(1, downAt.pan - (e.clientX - downAt.x) / (r.width * 0.6)));
  }
});
canvas.addEventListener("pointerleave", () => { pointer.set(9, 9); gaze.tx = 0; gaze.ty = 0; });
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY, pan: gaze.panTo }; });
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
  downAt = null;
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const hit = pick();
  if (mode === "inspect") {
    if (!hit) { leaveInspect(); return; }
    Promise.resolve(inspecting.press(hit.object)).then(() => { if (inspecting) showInspect(inspecting, false); });
    return;
  }
  if (hit) activate(hit.id);
});

async function setLight(which, on) {
  const from = look.state[which], to = on ? 1 : 0;
  await tween(motion.reduce ? 0 : 450, (k) => { look.state[which] = from + (to - from) * k; look.apply(); }, "inOut");
  look.captureLight();
}

async function activate(id) {
  const item = items[id];
  if (busy || mode !== "desk") return;
  hint.classList.add("gone");
  if (item.href) {
    if (item.href.startsWith("mailto:")) location.href = item.href;
    else window.open(item.href, "_blank", "noopener");
    return;
  }
  if (id === "monitor") { lookAtScreen("home"); return; }
  if (id === "lamp" || id === "lightbar") {
    const which = id === "lamp" ? "lamp" : "bar";
    const on = look.state[which] < 0.5;
    item.sub = on ? "Switch it off" : "Switch it on";
    await setLight(which, on);
    showLabel(hovered);
    return;
  }
  if (id === "keyboard") { showLabel(id); return; }
  if (item.view) { inspect(id); return; }
  if (!item.act) return;
  busy = true;
  try {
    const app = await item.act();
    showLabel(hovered);
    if (app) await lookAtScreen(app);
  } finally { busy = false; }
}

// Keyboard users reach every object through buttons laid over the scene:
// the computer first, then the projects, the things that are mine, the ways to reach me, and the rest.
const TAB_ORDER = ["monitor", "folder", "football", "car", "thesis", "book", "watch", "macropad", "github", "drafts", "departures", "pods", "mail", "linkedin", "cup", "keyboard", "lamp", "lightbar"];
const spots = TAB_ORDER.filter((id) => items[id]).map((id) => items[id]).map((item) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "spot";
  b.setAttribute("aria-label", `${item.label}. ${item.sub}`);
  b.addEventListener("click", () => activate(item.id));
  b.addEventListener("focus", () => { placeSpots(); hovered = item.id; showLabel(item.id); });
  b.addEventListener("blur", () => { hovered = null; hideLabel(); });
  hotspots.append(b);
  return { b, item };
});
function placeSpots() {
  for (const { b, item } of spots) {
    const s = toScreen(anchor(item));
    b.style.left = `${s.x}px`; b.style.top = `${s.y + 18}px`;
    b.setAttribute("aria-label", `${item.label}. ${item.sub}`);
  }
}

// Type on your keyboard; the one on the desk follows.
const typing = (e) => !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement);
addEventListener("keydown", (e) => { if (typing(e)) items.keyboard.pressKey(e.code, true); });
addEventListener("keyup", (e) => { items.keyboard.pressKey(e.code, false); });
addEventListener("blur", () => { for (const c of ["ShiftLeft", "MetaLeft", "AltLeft", "ControlLeft"]) items.keyboard.pressKey(c, false); });

// A few words, typed at the desk, do things. The keyboard's label gives away the first.
let saying = null; // a label that's speaking up, which hovering doesn't replace until it's done
function say(id, text, ms = 3200) {
  const item = items[id], sub = item.sub;
  item.sub = text;
  saying = id;
  showLabel(id);
  setTimeout(() => {
    item.sub = sub;
    saying = null;
    if (hovered) showLabel(hovered); else hideLabel();
  }, ms);
}
const WORDS = {
  coffee: () => items.cup.refill(),
  espresso: () => items.cup.refill(),
  lights: () => { const on = look.state.lamp < 0.5; items.lamp.sub = on ? "Switch it off" : "Switch it on"; return setLight("lamp", on); },
  "box box": () => items.car.lap(),
  touchdown: () => items.football.spin(),
  water: () => say("plant", "Nice try. It only drinks commits"),
};
let typed = "";
addEventListener("keydown", async (e) => {
  if (!typing(e) || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || mode !== "desk" || listOpen()) return;
  typed = (typed + e.key.toLowerCase()).slice(-12);
  const word = Object.keys(WORDS).find((w) => typed.endsWith(w));
  if (!word || busy) return;
  typed = "";
  hint.classList.add("gone");
  busy = true;
  try { await WORDS[word](); } finally { busy = false; }
});

// ------------------------------------------------ the list, as a sheet over the desk
// The sheet opens and closes by itself (it's #list, styled with :target), so it works before
// this script has run. Here: Esc closes it, Tab stays inside it, and the desk stops drawing.
const list = document.getElementById("list");
const listOpen = () => location.hash === "#list";
let wasOpen = false;
function onHash() {
  const open = listOpen();
  room.inert = open;
  // Leaving a fragment drops focus to the page, so it goes back to the link that opened the list.
  if (open) list.querySelector(".list-close").focus({ preventScroll: true });
  else if (wasOpen && (document.activeElement === document.body || list.contains(document.activeElement))) room.querySelector(".to-list").focus({ preventScroll: true });
  wasOpen = open;
}
addEventListener("hashchange", onHash);
onHash();
addEventListener("keydown", (e) => { if (e.key === "Escape" && listOpen()) location.hash = "room"; });

// ----------------------------------------------------------------- loop
const NO_LIFT = new Set(["monitor", "mail", "linkedin", "lamp", "lightbar", "keyboard", "github"]);
let running = true;
let frames = 0;
// Frame times over the first seconds, to choose how many pixels to render (see quality()).
const timing = { last: 0, gaps: [] };
function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  if (frames > 2 && listOpen()) return; // nothing to see behind the sheet
  stepTweens(now);
  gaze.x += (gaze.tx - gaze.x) * 0.05;
  gaze.y += (gaze.ty - gaze.y) * 0.05;
  gaze.pan += (gaze.panTo - gaze.pan) * 0.12;
  applyView();

  const hit = pointer.x > 2 ? null : pick();
  const id = hit ? hit.id : null;
  if (mode === "inspect") {
    canvas.style.cursor = id ? "pointer" : "";
  } else if (id !== hovered && !document.activeElement?.classList.contains("spot")) {
    hovered = id;
    canvas.style.cursor = id && !items[id].decor ? "pointer" : ""; // decor has a label, nothing to click
    if (saying) showLabel(saying); else if (id) showLabel(id); else hideLabel();
  } else if (mode === "desk" && (saying || hovered)) showLabel(saying || hovered);
  for (const item of Object.values(items)) {
    const want = item.id === hovered && mode === "desk" && !NO_LIFT.has(item.id) && !item.decor && !busy ? 0.008 : 0;
    item.lift += (want - item.lift) * 0.2;
    if (Math.abs(item.lift) > 1e-5 || want) {
      const y = item.baseY + item.lift;
      if (Math.abs(item.root.position.y - y) > 1e-6) { item.root.position.y = y; moved(); }
    }
    if (item.hover) {
      const on = item.id === hovered && mode === "desk" && !busy ? 1 : 0;
      if (Math.abs(on - item.hoverK) > 1e-4) { item.hoverK += (on - item.hoverK) * 0.12; item.hover(item.hoverK); moved(); }
    }
  }
  for (const u of updates) u(now);
  items.watch.update(now, look.state);
  items.macropad.update(now);
  look.render(now, motion.reduce);
  if (frames === 0) performance.mark("desk:first-frame");
  if (frames++ === 1) { loading.classList.add("gone"); room.classList.add("ready"); }
  if (frames % 4 === 0 && mode === "desk") placeSpots();
  // If the first seconds run slow, do less: drop MSAA if it's on, then render fewer pixels, 2x,
  // then 1.5x, then 1x. Judged on the median of 90 frames, so a one-off hitch (the reflections
  // being photographed) doesn't count.
  if (frames > 30 && timing.gaps !== null) {
    if (timing.last) timing.gaps.push(now - timing.last);
    timing.last = now;
    if (timing.gaps.length === 90) {
      const median = timing.gaps.sort((a, b) => a - b)[45];
      const ratio = renderer.getPixelRatio();
      if (median > 20 && (look.msaa || ratio > 1)) {
        const hadMsaa = look.msaa;
        look.lighten();
        if (!hadMsaa) renderer.setPixelRatio(ratio > 1.5 ? 1.5 : 1);
        resize();
        timing.gaps = []; timing.last = 0; // and look again at the new size
      } else timing.gaps = null; // fast enough: stop measuring
    }
  }
}

new IntersectionObserver(([e]) => {
  const was = running;
  running = e.isIntersecting && !document.hidden;
  if (running && !was) requestAnimationFrame(frame);
}).observe(room);
document.addEventListener("visibilitychange", () => {
  const was = running;
  running = !document.hidden;
  if (running && !was) requestAnimationFrame(frame);
});
addEventListener("resize", resize);
resize();
placeSpots();
// Compile every shader before the first frame without blocking the page (browsers that
// support it compile in parallel), then photograph the lit desk for reflections once it's up.
// Never wait on it for long: if a browser is slow to report, the first frame compiles the rest.
await Promise.race([look.compile().catch(() => {}), new Promise((ok) => setTimeout(ok, 1500))]);
requestAnimationFrame(frame);
requestAnimationFrame(() => requestAnimationFrame(() => look.captureLight()));
setTimeout(() => look.captureLight(), 1500); // again once everything has drawn once
setTimeout(() => theCall().catch(() => {}), 1500); // warm up this week's pick in the background
// Boston's sky, through the window and in the menu bar, again every 15 minutes.
const lookOutside = () => bostonSky().then((sky) => { if (!sky) return; look.sky.setSky(sky); screenTex.setSky(sky); desktop.setSky(sky); });
setTimeout(lookOutside, 1200);
setTimeout(() => items.departures.start(), 1300);
setInterval(lookOutside, 15 * 60 * 1000);
if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { desk: { THREE, scene, camera, renderer, look, items, inspect, leaveInspect } });
