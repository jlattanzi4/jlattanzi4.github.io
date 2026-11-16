// Everything on the desk, built from simple shapes at real-world size (metres).
// The desk top is at y = 0.75; the viewer sits at the front edge, looking at the monitor (−z).

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const TOP = 0.75;

// ------------------------------------------------------------- tweens
const tweens = new Set();
export const motion = { reduce: false };
const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  spring: (t) => 1 - Math.cos(t * Math.PI * 4.5) * Math.exp(-t * 6),
  linear: (t) => t,
};
export function tween(duration, onUpdate, curve = "inOut") {
  return new Promise((done) => {
    if (motion.reduce || duration <= 0) { onUpdate(1); done(); return; }
    tweens.add({ start: performance.now(), duration, onUpdate, curve: ease[curve], done });
  });
}
export function stepTweens(now) {
  for (const t of tweens) {
    const p = Math.min(1, (now - t.start) / t.duration);
    t.onUpdate(t.curve(p));
    if (p >= 1) { tweens.delete(t); t.done(); }
  }
}
const lerp = (a, b, t) => a + (b - a) * t;

// ----------------------------------------------------------- textures
function canvasTexture(w, h, draw, { repeat } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat); }
  return tex;
}

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function wrapText(ctx, text, x, y, width, lineHeight, each) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > width && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => { ctx.fillText(l, x, y + i * lineHeight); if (each) each(l, x, y + i * lineHeight); });
  return y + lines.length * lineHeight;
}

const woodTexture = () => canvasTexture(2048, 1024, (g, w, h) => {
  const r = rng(7);
  g.fillStyle = "#a8774f"; g.fillRect(0, 0, w, h);
  // Planks, each a slightly different tone.
  const planks = 5;
  for (let p = 0; p < planks; p++) {
    const y0 = (p * h) / planks;
    g.fillStyle = `hsla(${24 + r() * 6}, ${38 + r() * 10}%, ${36 + r() * 8}%, 0.55)`;
    g.fillRect(0, y0, w, h / planks);
    for (let i = 0; i < 70; i++) {
      const y = y0 + r() * (h / planks);
      g.strokeStyle = `rgba(60, 32, 16, ${0.05 + r() * 0.12})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath();
      const amp = 2 + r() * 6, f = 0.002 + r() * 0.004, ph = r() * 10;
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
      g.stroke();
    }
    g.fillStyle = "rgba(40, 20, 10, 0.25)"; g.fillRect(0, y0, w, 2);
  }
  const shine = g.createLinearGradient(0, 0, w, h);
  shine.addColorStop(0, "rgba(255,240,220,0.06)"); shine.addColorStop(1, "rgba(0,0,0,0.08)");
  g.fillStyle = shine; g.fillRect(0, 0, w, h);
});

const stickyTexture = (bg, lines, accent) => canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0.06)"); grad.addColorStop(0.18, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,0.05)");
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.fillStyle = accent || "#2b2a28";
  g.textBaseline = "top";
  let y = 60;
  for (const [text, size] of lines) {
    g.font = `600 ${size}px Caveat, "Comic Sans MS", cursive`;
    y = wrapText(g, text, 44, y, w - 80, size * 1.05) + 16;
  }
});

// The page inside the folder: Kellogg's fiscal 2019 risk section, marked up against 2018's.
const redlineTexture = () => canvasTexture(1024, 1325, (g, w, h) => {
  g.fillStyle = "#fbfbf9"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#6b6f75"; g.font = "500 22px 'Instrument Sans', sans-serif"; g.fillText("Kellogg Co, Form 10-K for fiscal 2019", 80, 96);
  g.fillStyle = "#1c1e21"; g.font = "600 38px 'Source Serif 4', serif"; g.fillText("Item 1A. Risk factors", 80, 160);
  g.font = "400 27px 'Source Serif 4', serif";
  const para = (text, mark, y) => {
    g.fillStyle = mark === "cut" ? "#8a8e94" : "#1c1e21";
    return wrapText(g, text, 80, y, w - 160, 40, (line, x, ly) => {
      const lw = g.measureText(line).width;
      if (mark === "cut") { g.fillStyle = "#d03b3b"; g.fillRect(x, ly - 10, lw, 3); g.fillStyle = "#8a8e94"; }
      if (mark === "new") { g.fillStyle = "#2a78d6"; g.fillRect(x, ly + 8, lw, 3); g.fillStyle = "#1c1e21"; }
    }) + 22;
  };
  let y = 230;
  y = para("Future acquisitions could also result in potentially dilutive issuances of equity securities, the incurrence of debt, contingent liabilities and/or amortization expenses related to certain intangible assets and increased operating expenses.", "", y);
  y = para("The proposed divestiture of our cookies and fruit snacks businesses is subject to various risks and uncertainties, and may not be completed on the terms or timeline currently contemplated, if at all.", "cut", y);
  y = para("The divestiture of selected cookie, fruit and fruit-flavored snacks, pie crusts, and ice cream cone businesses, consummated on July 28, 2019, may not achieve some or all of the anticipated benefits.", "new", y);
  y = para("We may not realize the benefits we expect from revenue growth management. We are utilizing formal revenue growth management practices to help us realize price in a more effective way.", "", y);
  para("Competition against retailer private label brands could negatively impact our business.", "", y);
});

const folderTexture = () => canvasTexture(1024, 1330, (g, w, h) => {
  g.fillStyle = "#d9b77c"; g.fillRect(0, 0, w, h);
  const r = rng(3);
  for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(120, 80, 30, ${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
  // A typed label on the cover.
  g.fillStyle = "#fbfaf6"; g.fillRect(150, 200, 724, 230);
  g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 2; g.strokeRect(150, 200, 724, 230);
  g.fillStyle = "#1c1e21"; g.font = "600 46px 'Source Serif 4', serif"; g.fillText("SEC 10-K risk sections", 190, 290);
  g.font = "400 34px 'Source Serif 4', serif"; g.fillStyle = "#4a4d52"; g.fillText("How much is boilerplate?", 190, 350);
  g.font = "400 26px 'Instrument Sans', sans-serif"; g.fillText("47,643 filings, 2007 to 2020", 190, 400);
  // A rubber stamp.
  g.save(); g.translate(660, 760); g.rotate(-0.16);
  g.strokeStyle = "rgba(200, 40, 40, 0.82)"; g.lineWidth = 9; g.strokeRect(-200, -80, 400, 160);
  g.fillStyle = "rgba(200, 40, 40, 0.82)"; g.font = "700 74px 'Barlow Condensed', sans-serif"; g.textAlign = "center";
  g.fillText("73% COPIED", 0, 26);
  g.restore();
});

const thesisTexture = () => canvasTexture(860, 1120, (g, w, h) => {
  g.fillStyle = "#1d2740"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#141b2d"; g.fillRect(0, 0, 56, h);
  g.fillStyle = "#e3cf93"; g.textAlign = "center";
  g.font = "400 30px 'Source Serif 4', serif"; g.fillText("Master’s capstone, Applied Data Science", w / 2 + 28, 170);
  g.font = "600 92px 'Source Serif 4', serif"; g.fillText("Who comes", w / 2 + 28, 440); g.fillText("back?", w / 2 + 28, 540);
  g.font = "italic 400 40px 'Source Serif 4', serif"; g.fillText("Predicting 30-day hospital readmission", w / 2 + 28, 640);
  g.font = "400 32px 'Source Serif 4', serif"; g.fillText("Joseph Lattanzi", w / 2 + 28, 950); g.fillText("2025", w / 2 + 28, 1000);
});

const footballTexture = () => canvasTexture(1024, 512, (g, w, h) => {
  g.fillStyle = "#7a3a1b"; g.fillRect(0, 0, w, h);
  const r = rng(11);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,200,160"}, ${r() * 0.08})`; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 2, 0, 7); g.fill(); }
  // Seams, the laces, and the two stripes near the tips.
  g.strokeStyle = "rgba(40, 15, 5, 0.6)"; g.lineWidth = 3;
  for (const u of [0, 0.25, 0.5, 0.75]) { g.beginPath(); g.moveTo(u * w, 0); g.lineTo(u * w, h); g.stroke(); }
  g.fillStyle = "#f4efe6";
  g.fillRect(0.25 * w - 5, h * 0.33, 10, h * 0.34);
  for (let i = 0; i < 8; i++) g.fillRect(0.25 * w - 22, h * 0.35 + i * (h * 0.3 / 7), 44, 8);
  g.fillRect(0, h * 0.15, w, 14); g.fillRect(0, h * 0.85 - 14, w, 14);
});

const cremaTexture = () => canvasTexture(256, 256, (g, w, h) => {
  const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
  grad.addColorStop(0, "#c98c50"); grad.addColorStop(0.6, "#a8672f"); grad.addColorStop(0.92, "#5a3216"); grad.addColorStop(1, "#2a160a");
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const r = rng(5);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255, 230, 190, ${r() * 0.12})`; g.beginPath(); g.arc(r() * w, r() * h, r() * 3, 0, 7); g.fill(); }
});

const steamTexture = () => canvasTexture(128, 256, (g, w, h) => {
  const grad = g.createRadialGradient(w / 2, h * 0.55, 4, w / 2, h * 0.55, w * 0.48);
  grad.addColorStop(0, "rgba(255,255,255,0.55)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
});

// ------------------------------------------------------------ helpers
const M = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const P = (color, roughness, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.6, clearcoatRoughness: 0.25, ...extra });
const box = (w, h, d, r = 0.002, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2));
function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
function at(obj, x, y, z, ry = 0) { obj.position.set(x, y, z); obj.rotation.y = ry; return obj; }

// ===================================================================== the desk
export function buildDesk(scene, screenTexture) {
  const items = {};
  const updates = [];

  // The room: a wall, a floor far below, and the desk.
  const wall = mesh(new THREE.PlaneGeometry(8, 4), M("#c5ccc1", 0.95), { cast: false });
  wall.position.set(0, 1.6, -0.86);
  scene.add(wall);
  const floor = mesh(new THREE.PlaneGeometry(8, 8), M("#4a3f36", 0.9), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wood = woodTexture();
  // Deeper than a real desk toward the chair, so a tall phone view never runs off its front edge.
  const deskTop = mesh(box(1.8, 0.04, 1.15, 0.01, 4), M("#ffffff", 0.55, 0, { map: wood }));
  deskTop.position.set(0, TOP - 0.02, -0.275);
  scene.add(deskTop);
  for (const x of [-0.84, 0.84]) {
    const leg = mesh(box(0.05, TOP - 0.04, 0.8, 0.01), M("#2c2622", 0.7));
    leg.position.set(x, (TOP - 0.04) / 2, -0.42);
    scene.add(leg);
  }

  // ---- the monitor
  const monitor = new THREE.Group();
  const alu = M("#c8cacd", 0.32, 0.75);
  const base = mesh(box(0.2, 0.01, 0.17, 0.004), alu);
  base.position.set(0, TOP + 0.005, -0.56);
  const neck = mesh(box(0.15, 0.32, 0.012, 0.004), alu);
  neck.position.set(0, TOP + 0.16, -0.635); neck.rotation.x = 0.14;
  const body = mesh(box(0.66, 0.39, 0.02, 0.012, 4), alu);
  body.position.set(0, 1.08, -0.605);
  const glass = mesh(box(0.652, 0.382, 0.004, 0.009, 3), P("#08090b", 0.15, { clearcoat: 1 }), { cast: false });
  glass.position.set(0, 1.08, -0.594);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3488), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screen.position.set(0, 1.08, -0.5915);
  monitor.add(base, neck, body, glass, screen);
  scene.add(monitor);
  items.monitor = { root: monitor, label: "The computer", sub: "Open the projects", screen };

  // ---- keyboard, with keys that go down when you type on yours
  const kb = new THREE.Group();
  const kbBase = mesh(box(0.282, 0.008, 0.116, 0.004), alu);
  kb.add(kbBase);
  const rows = [
    [["Backquote", 1], ...[..."1234567890"].map((d) => [`Digit${d}`, 1]), ["Minus", 1], ["Equal", 1], ["Backspace", 1.5]],
    [["Tab", 1.5], ..."QWERTYUIOP".split("").map((c) => [`Key${c}`, 1]), ["BracketLeft", 1], ["BracketRight", 1], ["Backslash", 1]],
    [["CapsLock", 1.75], ..."ASDFGHJKL".split("").map((c) => [`Key${c}`, 1]), ["Semicolon", 1], ["Quote", 1], ["Enter", 1.75]],
    [["ShiftLeft", 2.25], ..."ZXCVBNM".split("").map((c) => [`Key${c}`, 1]), ["Comma", 1], ["Period", 1], ["Slash", 1], ["ShiftRight", 2.25]],
    [["ControlLeft", 1], ["AltLeft", 1], ["MetaLeft", 1.25], ["Space", 5.5], ["MetaRight", 1.25], ["AltRight", 1], ["ArrowLeft", 1], ["ArrowUp", 1], ["ArrowRight", 1]],
  ];
  const u = 0.0184, gap = 0.0028;
  const keyGeo = box(1, 0.0045, 0.0156, 0.0016, 2);
  const count = rows.reduce((n, r) => n + r.length, 0);
  const keys = new THREE.InstancedMesh(keyGeo, M("#f3f3f1", 0.55), count);
  keys.castShadow = true; keys.receiveShadow = true;
  const keyIndex = new Map();
  const keyRest = [];
  const keyDepth = new Float32Array(count);
  const keyTarget = new Float32Array(count);
  let n = 0;
  rows.forEach((row, ri) => {
    const width = row.reduce((s, [, w]) => s + w, 0) * u;
    let x = -width / 2;
    for (const [code, wUnits] of row) {
      const kw = wUnits * u;
      const m4 = new THREE.Matrix4().compose(
        new THREE.Vector3(x + kw / 2, 0.0065, -0.042 + ri * u),
        new THREE.Quaternion(),
        new THREE.Vector3(kw - gap, 1, 1),
      );
      keys.setMatrixAt(n, m4);
      keyRest.push(m4.clone());
      keyIndex.set(code, n);
      x += kw; n++;
    }
  });
  kb.add(keys);
  at(kb, -0.03, TOP + 0.004, -0.28);
  kb.rotation.x = 0.035;
  scene.add(kb);
  const pressKey = (code, down) => {
    const i = keyIndex.get(code) ?? keyIndex.get(code.replace("Right", "Left"));
    if (i == null) return false;
    keyTarget[i] = down ? 1 : 0;
    return true;
  };
  updates.push(() => {
    let dirty = false;
    for (let i = 0; i < count; i++) {
      const d = keyDepth[i] + (keyTarget[i] - keyDepth[i]) * 0.45;
      if (Math.abs(d - keyDepth[i]) > 1e-4) {
        keyDepth[i] = d;
        const m4 = keyRest[i].clone();
        m4.elements[13] -= d * 0.0028;
        keys.setMatrixAt(i, m4);
        dirty = true;
      }
    }
    if (dirty) keys.instanceMatrix.needsUpdate = true;
  });
  items.keyboard = { root: kb, label: "Keyboard", sub: "Type on yours and watch", pressKey };

  const pad = mesh(box(0.13, 0.006, 0.112, 0.008, 3), P("#e9e9e7", 0.3, { clearcoat: 0.3 }));
  at(pad, 0.19, TOP + 0.003, -0.28, -0.02);
  scene.add(pad);

  // ---- espresso: saucer, cup, crema, steam
  const cup = new THREE.Group();
  const ceramic = P("#fbfaf7", 0.28, { clearcoat: 0.8 });
  const saucer = mesh(new THREE.CylinderGeometry(0.06, 0.046, 0.008, 48), ceramic);
  saucer.position.y = 0.004;
  const profile = [[0, 0], [0.021, 0], [0.025, 0.004], [0.03, 0.028], [0.033, 0.05], [0.0305, 0.051], [0.0275, 0.03], [0.022, 0.009], [0, 0.009]].map(([x, y]) => new THREE.Vector2(x, y));
  const vessel = mesh(new THREE.LatheGeometry(profile, 48), ceramic);
  vessel.position.y = 0.008;
  const handle = mesh(new THREE.TorusGeometry(0.012, 0.0035, 12, 24, Math.PI * 1.15), ceramic);
  handle.position.set(0.036, 0.034, 0); handle.rotation.z = -Math.PI / 2 - 0.25;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.0285, 40), M("#ffffff", 0.25, 0, { map: cremaTexture() }));
  coffee.rotation.x = -Math.PI / 2;
  const level = (f) => { const y = 0.012 + f * 0.036; coffee.position.y = 0.008 + y; coffee.scale.setScalar(0.74 + f * 0.26); coffee.visible = f > 0.02; };
  level(1);
  const steamTex = steamTexture();
  const puffs = [0, 1, 2, 3].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.set(0.03, 0.06, 1);
    s.userData.phase = i / 4;
    cup.add(s);
    return s;
  });
  cup.add(saucer, vessel, handle, coffee);
  at(cup, 0.43, TOP, -0.22, 0.6);
  scene.add(cup);
  let full = 1, steamBoost = 0;
  updates.push((t, night) => {
    steamBoost = Math.max(0, steamBoost - 0.01);
    for (const s of puffs) {
      const p = (t * 0.00018 + s.userData.phase) % 1;
      s.position.set(Math.sin(p * 6 + s.userData.phase * 9) * 0.008, 0.06 + p * 0.1, Math.cos(p * 5) * 0.004);
      s.scale.set(0.025 + p * 0.03, 0.05 + p * 0.05, 1);
      s.material.opacity = full > 0.05 ? Math.sin(p * Math.PI) * (night ? 0.34 : 0.22) * (0.6 + full * 0.4 + steamBoost) : 0;
    }
  });
  items.cup = {
    root: cup, label: "Espresso", sub: "Take a sip",
    async act() {
      if (full <= 0.02) { items.cup.sub = "Take a sip"; await tween(700, (k) => level(k), "out"); full = 1; return; }
      steamBoost = 0.8;
      const from = full, to = Math.max(0, full - 0.34);
      await tween(380, (k) => { cup.rotation.z = Math.sin(k * Math.PI) * 0.12; }, "inOut");
      await tween(500, (k) => level(lerp(from, to, k)), "out");
      full = to;
      if (full <= 0.02) items.cup.sub = "Empty. Click for another";
    },
  };

  // ---- AirPods Pro case: the lid opens on a hinge
  const pods = new THREE.Group();
  const gloss = P("#f7f7f5", 0.18, { clearcoat: 1 });
  const caseBase = mesh(box(0.06, 0.016, 0.045, 0.008, 5), gloss);
  caseBase.position.y = 0.008;
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.0165, -0.0225);
  const lid = mesh(box(0.06, 0.009, 0.045, 0.0045, 5), gloss);
  lid.position.set(0, 0.0045, 0.0225);
  hinge.add(lid);
  const bud = (x) => { const b = mesh(new THREE.CapsuleGeometry(0.0055, 0.008, 6, 12), gloss); b.position.set(x, 0.017, -0.004); return b; };
  const led = mesh(new THREE.CircleGeometry(0.0012, 12), new THREE.MeshBasicMaterial({ color: "#3fdc6a" }), { cast: false });
  led.position.set(0, 0.009, 0.0226);
  pods.add(caseBase, hinge, bud(-0.012), bud(0.012), led);
  at(pods, 0.27, TOP, -0.15, -0.5);
  scene.add(pods);
  let podsOpen = false;
  items.pods = {
    root: pods, label: "AirPods", sub: "Pop the lid",
    async act() {
      podsOpen = !podsOpen;
      const from = hinge.rotation.x, to = podsOpen ? -1.75 : 0;
      led.material.color.set(podsOpen ? "#3fdc6a" : "#3fdc6a");
      items.pods.sub = podsOpen ? "Close the lid" : "Pop the lid";
      await tween(560, (k) => { hinge.rotation.x = lerp(from, to, k); }, podsOpen ? "spring" : "out");
    },
  };

  // ---- sticky notes: the contact details
  const note = (color, lines, w = 0.076, curl = 0.004) => {
    const geo = new THREE.PlaneGeometry(w, w, 8, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i); // bottom edge curls up a little
      const t = Math.max(0, (-y / (w / 2)));
      pos.setZ(i, t * t * curl);
    }
    geo.computeVertexNormals();
    const m = mesh(geo, M("#ffffff", 0.85, 0, { map: stickyTexture(color, lines), side: THREE.DoubleSide }), { cast: true });
    return m;
  };
  const mailNote = note("#ffe066", [["Say hi!", 150], ["email me", 104]]);
  mailNote.position.set(-0.262, 0.94, -0.5885); mailNote.rotation.z = 0.06;
  scene.add(mailNote);
  items.mail = { root: mailNote, label: "Email", sub: "lattanzi.joseph@gmail.com", href: "mailto:lattanzi.joseph@gmail.com" };

  const liNote = note("#9fd3f5", [["Linked", 140], ["in", 140]], 0.066);
  liNote.position.set(0.27, 1.2, -0.5885); liNote.rotation.z = -0.1;
  scene.add(liNote);
  items.linkedin = { root: liNote, label: "LinkedIn", sub: "linkedin.com/in/joseph-lattanzi", href: "https://www.linkedin.com/in/joseph-lattanzi/" };

  const ghNote = note("#ffa6c9", [["GitHub", 140], ["the code", 100]], 0.076, 0.006);
  ghNote.rotation.x = -Math.PI / 2; ghNote.rotation.z = 0.32;
  ghNote.position.set(-0.19, TOP + 0.0012, -0.13);
  scene.add(ghNote);
  items.github = { root: ghNote, label: "GitHub", sub: "github.com/jlattanzi4", href: "https://github.com/jlattanzi4" };

  // ---- the folder: the SEC study, which opens to a marked-up page
  const folder = new THREE.Group();
  const manila = M("#ffffff", 0.85, 0, { map: folderTexture() });
  const plainManila = M("#d9b77c", 0.85);
  const fw = 0.235, fd = 0.305;
  const back = mesh(new THREE.BoxGeometry(fw, 0.0015, fd), plainManila);
  back.position.y = 0.00075;
  const page = mesh(new THREE.BoxGeometry(fw - 0.016, 0.002, fd - 0.02), [M("#fbfbf9", 0.9), M("#fbfbf9", 0.9), M("#ffffff", 0.9, 0, { map: redlineTexture() }), M("#fbfbf9", 0.9), M("#fbfbf9", 0.9), M("#fbfbf9", 0.9)]);
  page.position.set(0.004, 0.0025, 0.004);
  const spine = new THREE.Group();
  spine.position.set(-fw / 2, 0.0045, 0);
  const cover = mesh(new THREE.BoxGeometry(fw, 0.0015, fd), [plainManila, plainManila, manila, plainManila, plainManila, plainManila]);
  cover.position.x = fw / 2;
  const tab = mesh(new THREE.BoxGeometry(0.07, 0.0015, 0.02), plainManila);
  tab.position.set(fw * 0.62, 0, -fd / 2 - 0.009);
  spine.add(cover, tab);
  folder.add(back, page, spine);
  at(folder, -0.39, TOP, -0.22, 0.16);
  scene.add(folder);
  let folderOpen = false;
  items.folder = {
    root: folder, label: "How much of a risk disclosure is boilerplate?", sub: "The SEC study. Open the folder",
    async act() {
      if (!folderOpen) { folderOpen = true; await tween(750, (k) => { spine.rotation.z = lerp(0, Math.PI * 0.985, k); spine.position.y = 0.0045 + Math.sin(k * Math.PI) * 0.03; }, "inOut"); }
      return "sec";
    },
    close() { if (folderOpen) { folderOpen = false; tween(600, (k) => { spine.rotation.z = lerp(Math.PI * 0.985, 0, k); }, "inOut"); } },
  };

  // ---- books, with the thesis on top
  const books = new THREE.Group();
  const b1 = mesh(box(0.17, 0.03, 0.235, 0.003), M("#3d5a4c", 0.8)); b1.position.y = 0.015;
  const b2 = mesh(box(0.155, 0.026, 0.22, 0.003), M("#a3542f", 0.8)); b2.position.set(0.006, 0.043, 0.004); b2.rotation.y = 0.07;
  const thesisTex = thesisTexture();
  const navy = M("#1d2740", 0.7);
  const thesis = mesh(box(0.2, 0.012, 0.26, 0.002), [navy, navy, M("#ffffff", 0.65, 0, { map: thesisTex }), navy, navy, navy]);
  thesis.position.set(-0.004, 0.0625, 0.0); thesis.rotation.y = -0.05;
  books.add(b1, b2, thesis);
  at(books, -0.45, TOP, -0.52, 0.12);
  scene.add(books);
  items.thesis = {
    root: books, label: "Who comes back?", sub: "Master’s capstone, 2025",
    async act() {
      await tween(420, (k) => { thesis.position.y = 0.0625 + Math.sin(k * Math.PI) * 0.035; thesis.rotation.x = Math.sin(k * Math.PI) * 0.25; }, "inOut");
      return "thesis";
    },
  };

  // ---- the football, on a small stand: the NFL optimizer
  const ballGroup = new THREE.Group();
  const stand = mesh(box(0.07, 0.014, 0.05, 0.004), M("#6e4a2f", 0.6));
  stand.position.y = 0.007;
  const ball = mesh(new THREE.SphereGeometry(0.05, 48, 32), M("#ffffff", 0.7, 0, { map: footballTexture() }));
  ball.scale.set(1, 1.62, 1);
  const ballSpin = new THREE.Group();
  ballSpin.rotation.z = Math.PI / 2;
  ballSpin.add(ball);
  const ballHolder = new THREE.Group();
  ballHolder.position.y = 0.06;
  ballHolder.add(ballSpin);
  ballGroup.add(stand, ballHolder);
  at(ballGroup, 0.44, TOP, -0.52, -0.5);
  scene.add(ballGroup);
  items.football = {
    root: ballGroup, label: "NFL Survivor Optimizer", sub: "This week’s pick, live",
    async act() {
      await tween(900, (k) => { ball.rotation.y = k * Math.PI * 4; ballHolder.position.y = 0.06 + Math.sin(k * Math.PI) * 0.09; }, "out");
      ball.rotation.y = 0;
      return "nfl";
    },
  };

  // ---- a toy F1 car: Box Box. It does a lap of the monitor.
  const car = new THREE.Group();
  const red = P("#d40a0a", 0.3, { clearcoat: 1 });
  const carbon = M("#16171a", 0.5);
  const chassis = mesh(box(0.11, 0.011, 0.026, 0.004), red); chassis.position.y = 0.012;
  const nose = mesh(new THREE.ConeGeometry(0.009, 0.05, 12), red); nose.rotation.z = -Math.PI / 2; nose.position.set(0.074, 0.011, 0); nose.scale.set(1, 1, 0.55);
  const pods2 = mesh(box(0.05, 0.012, 0.042, 0.004), red); pods2.position.set(-0.012, 0.011, 0);
  const engine = mesh(box(0.04, 0.016, 0.018, 0.005), red); engine.position.set(-0.03, 0.02, 0);
  const halo = mesh(new THREE.TorusGeometry(0.008, 0.0016, 8, 20, Math.PI), carbon); halo.position.set(0.008, 0.021, 0); halo.rotation.y = Math.PI / 2;
  const fwing = mesh(box(0.014, 0.0025, 0.056, 0.001), carbon); fwing.position.set(0.095, 0.006, 0);
  const rwing = mesh(box(0.012, 0.004, 0.048, 0.001), carbon); rwing.position.set(-0.058, 0.032, 0);
  const rpost = mesh(box(0.004, 0.018, 0.004, 0.001), carbon); rpost.position.set(-0.056, 0.022, 0);
  const wheels = [];
  for (const [x, z] of [[0.052, 0.027], [0.052, -0.027], [-0.04, 0.028], [-0.04, -0.028]]) {
    const w = mesh(new THREE.CylinderGeometry(0.0115, 0.0115, x < 0 ? 0.014 : 0.011, 20), carbon);
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.0115, z);
    wheels.push(w); car.add(w);
  }
  car.add(chassis, nose, pods2, engine, halo, fwing, rwing, rpost);
  const carHome = { x: 0.27, z: -0.43, ry: Math.PI * 0.92 };
  at(car, carHome.x, TOP, carHome.z, carHome.ry);
  scene.add(car);
  // A lap of the monitor: along the gap behind the keyboard, round the back of the stand, and home.
  const lap = new THREE.CatmullRomCurve3([
    new THREE.Vector3(carHome.x, TOP, carHome.z),
    new THREE.Vector3(0.1, TOP, -0.415),
    new THREE.Vector3(-0.12, TOP, -0.42),
    new THREE.Vector3(-0.2, TOP, -0.55),
    new THREE.Vector3(-0.13, TOP, -0.72),
    new THREE.Vector3(0.13, TOP, -0.73),
    new THREE.Vector3(0.24, TOP, -0.6),
  ], true, "catmullrom", 0.5);
  items.car = {
    root: car, label: "Box Box", sub: "Fantasy F1 for your group chat",
    async act() {
      if (motion.reduce) return "box";
      const p = new THREE.Vector3(), d = new THREE.Vector3();
      await tween(2200, (k) => {
        lap.getPointAt(k, p); lap.getTangentAt(k, d);
        car.position.copy(p);
        car.rotation.y = Math.atan2(-d.z, d.x);
        for (const w of wheels) w.rotation.y = k * 60;
      }, "inOut");
      at(car, carHome.x, TOP, carHome.z, carHome.ry);
      return "box";
    },
  };

  // ---- snake plant in a white pot
  const plant = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.1, 32), M("#efeee9", 0.8));
  pot.position.y = 0.05;
  const soil = mesh(new THREE.CircleGeometry(0.05, 24), M("#3a2a1e", 1), { cast: false });
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.094;
  plant.add(pot, soil);
  const leaves = [];
  const leafMat = M("#2f5a35", 0.65);
  const r = rng(21);
  for (let i = 0; i < 9; i++) {
    const h = 0.16 + r() * 0.14;
    const leaf = mesh(new THREE.ConeGeometry(0.016, h, 4, 1), leafMat);
    leaf.scale.z = 0.22;
    const holder = new THREE.Group();
    holder.position.set((r() - 0.5) * 0.05, 0.094, (r() - 0.5) * 0.05);
    holder.rotation.set((r() - 0.5) * 0.45, r() * Math.PI, (r() - 0.5) * 0.45);
    leaf.position.y = h / 2;
    holder.add(leaf);
    plant.add(holder);
    leaves.push(holder);
  }
  at(plant, 0.64, TOP, -0.66);
  scene.add(plant);
  items.plant = {
    root: plant, label: "Snake plant", sub: "Hard to kill",
    async act() {
      const rest = leaves.map((l) => l.rotation.z);
      await tween(1100, (k) => leaves.forEach((l, i) => { l.rotation.z = rest[i] + Math.sin(k * Math.PI * 6 + i) * 0.12 * (1 - k); }), "linear");
    },
  };

  // ---- desk lamp: it switches the room between day and night
  const lamp = new THREE.Group();
  const lampMat = M("#1f2023", 0.42, 0.35);
  const brass = M("#b8955a", 0.35, 0.8);
  const lbase = mesh(new THREE.CylinderGeometry(0.065, 0.072, 0.016, 48), lampMat);
  lbase.position.y = 0.008;
  const pole = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.43, 16), lampMat);
  pole.position.y = 0.23;
  const knuckle = mesh(new THREE.SphereGeometry(0.011, 20, 14), brass);
  knuckle.position.y = 0.445;
  const arm = mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.27, 16), lampMat);
  arm.rotation.z = Math.PI / 2 - 0.08; arm.position.set(0.135, 0.455, 0);
  const shade = mesh(new THREE.CylinderGeometry(0.03, 0.058, 0.1, 40, 1, true), M("#1f2023", 0.45, 0.3, { side: THREE.DoubleSide }));
  shade.position.set(0.272, 0.425, 0); shade.rotation.z = 0.12;
  const cap = mesh(new THREE.SphereGeometry(0.031, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lampMat);
  cap.position.set(0.268, 0.474, 0); cap.rotation.z = 0.12;
  const bulb = mesh(new THREE.SphereGeometry(0.022, 20, 14), new THREE.MeshStandardMaterial({ color: "#fff3d6", emissive: "#ffd79a", emissiveIntensity: 0 }), { cast: false });
  bulb.position.set(0.276, 0.4, 0);
  lamp.add(lbase, pole, knuckle, arm, shade, cap, bulb);
  at(lamp, -0.64, TOP, -0.64, -0.55);
  scene.add(lamp);
  const lampLight = new THREE.SpotLight("#ffcf8f", 0, 2.4, 0.95, 0.6, 1.6);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -0.0004;
  lampLight.shadow.normalBias = 0.01;
  scene.add(lampLight, lampLight.target);
  lamp.updateMatrixWorld(true);
  bulb.getWorldPosition(lampLight.position);
  lampLight.position.y -= 0.01;
  lampLight.target.position.set(-0.36, TOP, -0.36);
  items.lamp = { root: lamp, label: "Desk lamp", sub: "Turn the lights down", bulb, light: lampLight };

  // ---- on the wall: a framed print of the redline figure, and a clock that keeps real time
  const frame = new THREE.Group();
  const frameMat = M("#1c1c1e", 0.55);
  frame.add(mesh(box(0.37, 0.27, 0.02, 0.003), frameMat));
  const matBoard = mesh(new THREE.PlaneGeometry(0.34, 0.24), M("#f6f5f1", 0.95), { cast: false });
  matBoard.position.z = 0.0105;
  const printTex = new THREE.TextureLoader().load("images/redline-print.png");
  printTex.colorSpace = THREE.SRGBColorSpace; printTex.anisotropy = 8;
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.179), M("#ffffff", 0.9, 0, { map: printTex }));
  print.position.z = 0.011;
  frame.add(matBoard, print);
  frame.position.set(0.6, 1.21, -0.846);
  frame.rotation.z = 0.004;
  scene.add(frame);
  items.print = { root: frame, label: "A print of the SEC study’s figure", sub: "One filing, marked up against the year before", act: async () => "sec" };

  const clock = new THREE.Group();
  const rim = mesh(new THREE.TorusGeometry(0.075, 0.007, 16, 64), M("#1c1c1e", 0.4, 0.2));
  const face = mesh(new THREE.CircleGeometry(0.075, 64), M("#fbfaf7", 0.8), { cast: false });
  clock.add(rim, face);
  for (let i = 0; i < 12; i++) {
    const tick = mesh(new THREE.BoxGeometry(i % 3 ? 0.002 : 0.004, i % 3 ? 0.008 : 0.014, 0.001), M("#1c1c1e", 0.6), { cast: false });
    const a = (i / 12) * Math.PI * 2;
    tick.position.set(Math.sin(a) * 0.062, Math.cos(a) * 0.062, 0.002);
    tick.rotation.z = -a;
    clock.add(tick);
  }
  const hand = (len, w, color, z) => {
    const g = new THREE.Group();
    const h = mesh(new THREE.BoxGeometry(w, len, 0.0015), M(color, 0.5), { cast: false });
    h.position.y = len / 2 - 0.008;
    g.add(h); g.position.z = z;
    clock.add(g);
    return g;
  };
  const hourHand = hand(0.04, 0.004, "#1c1c1e", 0.004);
  const minuteHand = hand(0.058, 0.003, "#1c1c1e", 0.006);
  const secondHand = hand(0.064, 0.0012, "#d03b3b", 0.008);
  clock.position.set(-0.66, 1.27, -0.85);
  scene.add(clock);
  updates.push(() => {
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const h = (d.getHours() % 12) + m / 60;
    secondHand.rotation.z = -(s / 60) * Math.PI * 2;
    minuteHand.rotation.z = -(m / 60) * Math.PI * 2;
    hourHand.rotation.z = -(h / 12) * Math.PI * 2;
  });

  return { items, updates };
}
