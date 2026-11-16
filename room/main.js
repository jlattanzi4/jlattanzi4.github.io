// Sitting at the desk. The camera is your head; everything on the desk does something.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildDesk, motion, tween, stepTweens, TOP } from "./props.js";
import { createScreen, screenTexture, theCall } from "./screen.js";

const room = document.getElementById("room");
const canvas = document.getElementById("scene");
const label = document.getElementById("label");
const hint = document.getElementById("hint");
const back = document.getElementById("back");
const loading = document.getElementById("loading");
const hotspots = document.getElementById("hotspots");
const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
motion.reduce = reduceQuery.matches;
reduceQuery.addEventListener("change", (e) => { motion.reduce = e.matches; });

const fontsReady = Promise.race([
  Promise.all(["600 64px Caveat", "600 40px 'Source Serif 4'", "400 40px 'Source Serif 4'", "500 20px 'Instrument Sans'", "600 20px 'Instrument Sans'", "700 70px 'Barlow Condensed'"].map((f) => document.fonts.load(f))),
  new Promise((ok) => setTimeout(ok, 2500)),
]);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch {
  document.body.classList.add("flat");
  throw new Error("WebGL unavailable; showing the list instead");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#1b1d1f");
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

await fontsReady;

let night = matchMedia("(prefers-color-scheme: dark)").matches;
const screenTex = screenTexture(night);
const { items, updates } = buildDesk(scene, screenTex.tex);

// ---------------------------------------------------------------- light
const sky = new THREE.HemisphereLight("#eef3f8", "#8a6d55", 0.9);
const sun = new THREE.DirectionalLight("#fff3e2", 2.4);
sun.position.set(-1.3, 2.3, 1.0);
sun.target.position.set(0, TOP, -0.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.5, far: 5 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.015;
const glow = new THREE.PointLight("#a9c8ff", 0, 1.3, 1.8);
glow.position.set(0, 1.06, -0.45);
scene.add(sky, sun, sun.target, glow);

const lampItem = items.lamp;
function setLight(t) {
  // t: 0 is day, 1 is night with the lamp on.
  sky.intensity = 0.9 - 0.82 * t;
  sun.intensity = 2.4 * (1 - t);
  lampItem.light.intensity = 3.6 * t;
  lampItem.bulb.material.emissiveIntensity = 3 * t;
  glow.intensity = 0.35 * t;
  scene.environmentIntensity = 0.5 - 0.42 * t;
  renderer.toneMappingExposure = 1 + 0.15 * t;
}
setLight(night ? 1 : 0);
lampItem.sub = night ? "Turn the lights up" : "Turn the lights down";
async function toggleNight() {
  night = !night;
  lampItem.sub = night ? "Turn the lights up" : "Turn the lights down";
  screenTex.repaint(night);
  const from = night ? 0 : 1, to = night ? 1 : 0;
  await tween(700, (k) => setLight(from + (to - from) * k), "inOut");
  showLabel(hovered);
}

// --------------------------------------------------------------- camera
const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 20);
const HOME_TARGET = new THREE.Vector3(0, 0.95, -0.42);
const HOME_DIR = new THREE.Vector3(0, 0.31, 0.8).normalize();
const SCREEN_CENTER = new THREE.Vector3(0, 1.08, -0.5915);
const SCREEN_W = 0.62, SCREEN_H = 0.3488;
const view = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
let mode = "desk"; // desk | moving | screen
const look = { x: 0, y: 0, tx: 0, ty: 0, pan: 0, panTo: 0 };

// On a phone the view is narrow, so it frames the monitor and keyboard and a swipe looks around.
const tallView = () => camera.aspect < 0.9;
function homePose() {
  const a = camera.aspect;
  const tall = tallView();
  camera.fov = tall ? 62 : 46;
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // Far enough back to see the whole desk across, from the folder to the espresso.
  const fitW = tall ? 0.8 : 1.4;
  const d = Math.max(tall ? 0.9 : 1.08, fitW / 2 / (half * a));
  const target = tall ? new THREE.Vector3(0, 0.9, -0.42) : HOME_TARGET.clone();
  return { pos: target.clone().addScaledVector(HOME_DIR, d), target };
}
function screenPose() {
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.max(SCREEN_H / 2 / half, SCREEN_W / 2 / (half * camera.aspect)) / 0.94;
  return { pos: SCREEN_CENTER.clone().add(new THREE.Vector3(0, 0, d)), target: SCREEN_CENTER.clone() };
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
    pos.x += look.pan * 0.12; target.x += look.pan * 0.42;
  } else if (mode === "desk" && !motion.reduce) {
    pos.x += look.x * 0.05; pos.y += look.y * 0.025;
    target.x += look.x * 0.02; target.y += look.y * 0.012;
  }
  camera.position.copy(pos);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

function resize() {
  const w = room.clientWidth, h = room.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (mode === "desk") Object.assign(view, homePose());
  else if (mode === "screen") { homePose(); Object.assign(view, screenPose()); }
  camera.updateProjectionMatrix();
  applyView();
  if (mode === "screen") { camera.updateMatrixWorld(); desktop.place(screenRect()); }
}

async function moveTo(pose, ms = 950) {
  const p0 = view.pos.clone(), t0 = view.target.clone();
  // Start from where the camera actually is, including the drift from the pointer.
  p0.copy(camera.position);
  await tween(ms, (k) => {
    view.pos.lerpVectors(p0, pose.pos, k);
    view.target.lerpVectors(t0, pose.target, k);
  }, "inOut");
}

// -------------------------------------------------------------- desktop
const desktop = createScreen({ reduce: () => motion.reduce });
async function lookAtScreen(app) {
  if (mode === "moving") return;
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
  if (mode !== "screen") return;
  desktop.hide();
  back.hidden = true;
  room.classList.remove("leaning");
  items.folder.close();
  mode = "moving";
  await moveTo(homePose(), 850);
  mode = "desk";
}
back.addEventListener("click", backToDesk);
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mode === "screen") { if (!desktop.escape()) backToDesk(); }
});

// ---------------------------------------------------- what is under the pointer
const pickables = [];
for (const [id, item] of Object.entries(items)) {
  item.id = id;
  item.root.traverse((o) => { if (o.isMesh) { o.userData.item = id; pickables.push(o); } });
  item.baseY = item.root.position.y;
  item.lift = 0;
}
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
  const s = toScreen(anchor(item));
  label.style.left = `${s.x}px`;
  label.style.top = `${s.y}px`;
  label.classList.add("on");
}
function hideLabel() { label.classList.remove("on"); }

function pick() {
  if (mode !== "desk") return null;
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  return hit ? hit.object.userData.item : null;
}

canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  if (e.pointerType === "mouse") {
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    look.tx = pointer.x; look.ty = pointer.y;
  }
  if (downAt && tallView() && e.pointerType !== "mouse") {
    look.panTo = Math.max(-1, Math.min(1, downAt.pan - (e.clientX - downAt.x) / (r.width * 0.6)));
  }
});
canvas.addEventListener("pointerleave", () => { pointer.set(9, 9); look.tx = 0; look.ty = 0; });
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY, pan: look.panTo }; });
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
  downAt = null;
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const id = pick();
  if (id) activate(id);
});

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
  if (id === "lamp") { toggleNight(); return; }
  if (id === "keyboard") { showLabel(id); return; }
  if (!item.act) return;
  busy = true;
  try {
    const app = await item.act();
    showLabel(hovered);
    if (app) await lookAtScreen(app);
  } finally { busy = false; }
}

// Keyboard users reach every object through buttons laid over the scene:
// the computer first, then the projects, the contact notes, and the rest.
const TAB_ORDER = ["monitor", "folder", "football", "car", "thesis", "print", "mail", "linkedin", "github", "cup", "pods", "keyboard", "plant", "lamp"];
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
  }
}

// Type on your keyboard; the one on the desk follows.
const typing = (e) => !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement);
addEventListener("keydown", (e) => { if (typing(e)) items.keyboard.pressKey(e.code, true); });
addEventListener("keyup", (e) => { items.keyboard.pressKey(e.code, false); });
addEventListener("blur", () => { for (const c of ["ShiftLeft", "MetaLeft", "AltLeft", "ControlLeft"]) items.keyboard.pressKey(c, false); });

// ----------------------------------------------------------------- loop
let running = true;
let frames = 0;
function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  stepTweens(now);
  look.x += (look.tx - look.x) * 0.05;
  look.y += (look.ty - look.y) * 0.05;
  look.pan += (look.panTo - look.pan) * 0.12;
  applyView();

  const id = pointer.x > 2 ? null : pick();
  if (id !== hovered && !document.activeElement?.classList.contains("spot")) {
    hovered = id;
    canvas.style.cursor = id ? "pointer" : "";
    if (id) showLabel(id); else hideLabel();
  } else if (hovered && mode === "desk") showLabel(hovered);
  for (const item of Object.values(items)) {
    const want = item.id === hovered && !["monitor", "mail", "linkedin", "lamp", "keyboard"].includes(item.id) && !busy ? 0.008 : 0;
    item.lift += (want - item.lift) * 0.2;
    if (Math.abs(item.lift) > 1e-5 || want) item.root.position.y = item.baseY + item.lift;
  }
  for (const u of updates) u(now, night);
  renderer.render(scene, camera);
  if (frames++ === 1) { loading.classList.add("gone"); room.classList.add("ready"); }
  if (frames % 4 === 0 && mode === "desk") placeSpots();
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
requestAnimationFrame(frame);
setTimeout(() => theCall().catch(() => {}), 1500); // warm up this week's pick in the background
