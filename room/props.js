// The desk, the room it stands in, and the things on it that aren't personal keepsakes
// (those are in watch.js, globe.js, book.js and macropad.js). Real-world size, in metres:
// the desk top is at y = TOP and the viewer sits at its front edge, looking toward −z.

import * as THREE from "three";
import { TOP, motion, tween, lerp, canvasTexture, rng, wrapText, M, P, box, mesh, at, roundedRectPath } from "./kit.js";

// ----------------------------------------------------------- textures

// Oiled walnut, five boards running left to right. One pass draws the colour, a second the
// roughness (the open pores and dark grain catch less light than the oiled flat-sawn wood).
function walnut(kind) {
  return canvasTexture(2048, 1024, (g, w, h) => {
    const r = rng(17);
    const colour = kind === "colour";
    g.fillStyle = colour ? "#3a2416" : "#7a7a7a";
    g.fillRect(0, 0, w, h);
    const boards = 5;
    for (let b = 0; b < boards; b++) {
      const y0 = (b * h) / boards, bh = h / boards;
      g.save();
      g.beginPath(); g.rect(0, y0, w, bh); g.clip();
      if (colour) {
        const l = 15 + r() * 7;
        g.fillStyle = `hsl(${20 + r() * 8}, ${32 + r() * 10}%, ${l}%)`;
        g.fillRect(0, y0, w, bh);
        // Slow light and dark drifts along the board.
        for (let i = 0; i < 9; i++) {
          const cx = r() * w, cy = y0 + r() * bh, rad = 120 + r() * 380;
          const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
          const light = r() < 0.5;
          grad.addColorStop(0, light ? "rgba(140, 90, 55, 0.16)" : "rgba(10, 5, 2, 0.22)");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = grad;
          g.save(); g.translate(cx, cy); g.scale(3.2, 0.5); g.translate(-cx, -cy);
          g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
          g.restore();
        }
      }
      // Cathedral figure: nested arches pointing along the grain, on most boards.
      if (r() < 0.75) {
        const cx = w * (0.2 + r() * 0.6), cy = y0 + bh * (0.35 + r() * 0.3);
        for (let k = 0; k < 16; k++) {
          const spread = 80 + k * (34 + r() * 10), lift = bh * (0.12 + k * 0.035);
          g.strokeStyle = colour ? `rgba(18, 9, 4, ${0.1 + r() * 0.16})` : `rgba(160,160,160,${0.25 + r() * 0.2})`;
          g.lineWidth = 1 + r() * 2.5;
          g.beginPath();
          for (let x = 0; x <= w; x += 12) {
            const t = (x - cx) / spread;
            const y = cy + lift * (1 - Math.exp(-t * t)) - bh * 0.3 + k * 2.2 + Math.sin(x * 0.004 + k) * 3;
            if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
      }
      // Straight grain lines and pores.
      for (let i = 0; i < 120; i++) {
        const y = y0 + r() * bh;
        g.strokeStyle = colour ? `rgba(16, 8, 3, ${0.06 + r() * 0.16})` : `rgba(170,170,170,${0.15 + r() * 0.25})`;
        g.lineWidth = 0.5 + r() * 1.6;
        g.beginPath();
        const amp = 1 + r() * 4, f = 0.0015 + r() * 0.003, ph = r() * 10;
        for (let x = 0; x <= w; x += 14) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
        g.stroke();
      }
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = colour ? `rgba(8, 4, 2, ${0.12 + r() * 0.25})` : `rgba(200,200,200,${0.3 + r() * 0.3})`;
        g.fillRect(r() * w, y0 + r() * bh, 2 + r() * 7, 1);
      }
      g.restore();
      // The seam between boards.
      g.fillStyle = colour ? "rgba(6, 3, 1, 0.55)" : "rgba(220,220,220,0.8)";
      g.fillRect(0, y0, w, 2);
    }
  }, { color: kind === "colour" });
}

// Flat paint over plaster: a dark slate grey with a faint mottle, so the warm lights read against it.
const plasterTexture = () => canvasTexture(1024, 512, (g, w, h) => {
  g.fillStyle = "#5d6366"; g.fillRect(0, 0, w, h);
  const r = rng(29);
  for (let i = 0; i < 260; i++) {
    const x = r() * w, y = r() * h, rad = 20 + r() * 90;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, r() < 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.04)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.035})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
}, { repeat: [3, 2] });

// Wool felt: fine fibres and a little fuzz.
const feltTexture = () => canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
  const r = rng(41);
  for (let i = 0; i < 14000; i++) {
    const x = r() * w, y = r() * h, a = r() * Math.PI, l = 2 + r() * 6;
    g.strokeStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${0.05 + r() * 0.12})`;
    g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}, { repeat: [3, 1.3], color: false });

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
const redlineTexture = () => canvasTexture(1024, 1325, (g, w) => {
  g.fillStyle = "#fbfbf9"; g.fillRect(0, 0, w, 1325);
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
  g.fillStyle = "#fbfaf6"; g.fillRect(150, 200, 724, 230);
  g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 2; g.strokeRect(150, 200, 724, 230);
  g.fillStyle = "#1c1e21"; g.font = "600 46px 'Source Serif 4', serif"; g.fillText("SEC 10-K risk sections", 190, 290);
  g.font = "400 34px 'Source Serif 4', serif"; g.fillStyle = "#4a4d52"; g.fillText("How much is boilerplate?", 190, 350);
  g.font = "400 26px 'Instrument Sans', sans-serif"; g.fillText("47,643 filings, 2007 to 2020", 190, 400);
  g.save(); g.translate(560, 720); g.rotate(-0.16);
  g.strokeStyle = "rgba(200, 40, 40, 0.82)"; g.lineWidth = 9; g.strokeRect(-200, -80, 400, 160);
  g.fillStyle = "rgba(200, 40, 40, 0.82)"; g.font = "700 74px 'Barlow Condensed', sans-serif"; g.textAlign = "center";
  g.fillText("73% COPIED", 0, 26);
  g.restore();
});

const thesisTexture = () => canvasTexture(860, 1120, (g, w, h) => {
  g.fillStyle = "#2a3a5e"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#141b2d"; g.fillRect(0, 0, 56, h);
  g.fillStyle = "#e3cf93"; g.textAlign = "center";
  g.font = "400 30px 'Source Serif 4', serif"; g.fillText("Master’s capstone, Applied Data Science", w / 2 + 28, 170);
  g.font = "600 92px 'Source Serif 4', serif"; g.fillText("Who comes", w / 2 + 28, 440); g.fillText("back?", w / 2 + 28, 540);
  g.font = "italic 400 40px 'Source Serif 4', serif"; g.fillText("Predicting 30-day hospital readmission", w / 2 + 28, 640);
  g.font = "400 32px 'Source Serif 4', serif"; g.fillText("Joseph Lattanzi", w / 2 + 28, 950); g.fillText("2025", w / 2 + 28, 1000);
});

// A cloth hardcover's spine, lying flat with the title across it.
const spineTexture = (title, author, colour) => canvasTexture(1024, 128, (g, w, h) => {
  const c = new THREE.Color(colour).convertLinearToSRGB();
  const hsl = {}; c.getHSL(hsl);
  // Cloth bindings run dark: keep the cover's hue, cap the lightness.
  const base = new THREE.Color().setHSL(hsl.h, Math.min(0.55, hsl.s * 0.9), Math.min(0.32, Math.max(0.12, hsl.l * 0.7)));
  g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, w, h);
  const r = rng(title.length * 13);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 1); }
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
  g.fillStyle = "#e9dcc0";
  g.textBaseline = "middle";
  g.font = "600 54px 'Source Serif 4', serif";
  g.fillText(title, 56, h / 2 + 2);
  g.font = "400 34px 'Source Serif 4', serif";
  g.textAlign = "right";
  g.fillText(author, w - 56, h / 2 + 2);
});

const footballTexture = () => canvasTexture(1024, 512, (g, w, h) => {
  g.fillStyle = "#6e3418"; g.fillRect(0, 0, w, h);
  const r = rng(11);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,200,160"}, ${r() * 0.08})`; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 2, 0, 7); g.fill(); }
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

// Tortoiseshell acetate: honey and amber blotches in dark brown.
const tortoiseTexture = () => canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = "#3a1a08"; g.fillRect(0, 0, w, h);
  const r = rng(53);
  for (let i = 0; i < 140; i++) {
    const x = r() * w, y = r() * h, rx = 10 + r() * 46, ry = rx * (0.3 + r() * 0.5);
    const tone = r();
    const col = tone < 0.45 ? [196, 120, 40] : tone < 0.75 ? [150, 72, 22] : [228, 168, 82];
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, `rgba(${col}, ${0.5 + r() * 0.4})`); grad.addColorStop(1, `rgba(${col}, 0)`);
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI); g.scale(1, ry / rx);
    g.fillStyle = grad; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore();
  }
  for (let i = 0; i < 60; i++) {
    const x = r() * w, y = r() * h, rad = 6 + r() * 20;
    g.fillStyle = `rgba(12, 5, 2, ${0.4 + r() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, rad, rad * 0.6, r() * 3, 0, 7); g.fill();
  }
}, { repeat: [7, 7] });

// ------------------------------------------------------------- the desk
export function buildDesk(scene, { screenTexture, spines = [] }) {
  const items = {};
  const updates = [];

  // The room: a plaster wall and a dark floor far below.
  const wall = mesh(new THREE.PlaneGeometry(8, 4), M("#ffffff", 0.92, 0, { map: plasterTexture() }), { cast: false });
  wall.position.set(0, 1.6, -0.86);
  scene.add(wall);
  const floor = mesh(new THREE.PlaneGeometry(8, 8), M("#17130f", 0.9), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Deeper than a real desk toward the chair, so a tall phone view never runs off its front edge.
  const deskTop = mesh(box(1.8, 0.04, 1.15, 0.008, 4), new THREE.MeshPhysicalMaterial({
    color: "#ffffff", map: walnut("colour"), roughness: 1, roughnessMap: walnut("rough"),
    clearcoat: 0.25, clearcoatRoughness: 0.45,
  }));
  deskTop.material.roughnessMap.colorSpace = THREE.NoColorSpace;
  deskTop.position.set(0, TOP - 0.02, -0.275);
  scene.add(deskTop);
  for (const x of [-0.84, 0.84]) {
    const leg = mesh(box(0.05, TOP - 0.04, 0.8, 0.01), M("#1c1714", 0.6));
    leg.position.set(x, (TOP - 0.04) / 2, -0.42);
    scene.add(leg);
  }

  // A felt desk mat under the keyboard, trackpad and macro pad.
  const MAT = { x: 0.085, z: -0.25, w: 0.66, d: 0.33, h: 0.003 };
  const felt = feltTexture();
  const mat = mesh(box(MAT.w, MAT.h, MAT.d, 0.0015, 2), M("#26282b", 1, 0, { roughnessMap: felt, bumpMap: felt, bumpScale: 0.9 }), { cast: false });
  mat.position.set(MAT.x, TOP + MAT.h / 2, MAT.z);
  scene.add(mat);
  const ON_MAT = TOP + MAT.h;

  // ---- the monitor
  const monitor = new THREE.Group();
  const alu = M("#b9bcc0", 0.32, 0.8);
  const base = mesh(box(0.2, 0.01, 0.17, 0.004), alu);
  base.position.set(0, TOP + 0.005, -0.56);
  const neck = mesh(box(0.15, 0.32, 0.012, 0.004), alu);
  neck.position.set(0, TOP + 0.16, -0.635); neck.rotation.x = 0.14;
  const body = mesh(box(0.66, 0.39, 0.02, 0.012, 4), alu);
  body.position.set(0, 1.08, -0.605);
  const glass = mesh(box(0.652, 0.382, 0.004, 0.009, 3), P("#060708", 0.12, { clearcoat: 1 }), { cast: false });
  glass.position.set(0, 1.08, -0.594);
  // A display is an emitter, brighter than anything it lights: its texture is scaled above 1.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3488), new THREE.MeshBasicMaterial({ map: screenTexture, color: new THREE.Color(1.35, 1.35, 1.35) }));
  screen.position.set(0, 1.08, -0.5915);
  monitor.add(base, neck, body, glass, screen);
  scene.add(monitor);
  items.monitor = { root: monitor, label: "The computer", sub: "Open the projects", screen };

  // ---- the light bar on top of the monitor: its beam is set up with the other lights.
  const bar = new THREE.Group();
  const anod = M("#1a1b1d", 0.38, 0.55);
  const tube = mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.5, 24), anod);
  tube.rotation.z = Math.PI / 2;
  const capL = mesh(new THREE.CylinderGeometry(0.0097, 0.0097, 0.004, 24), M("#2b2c2f", 0.3, 0.7));
  capL.rotation.z = Math.PI / 2; capL.position.x = -0.252;
  const capR = capL.clone(); capR.position.x = 0.252;
  const clamp = mesh(box(0.05, 0.03, 0.036, 0.004), anod);
  clamp.position.set(0, -0.012, -0.024);
  // The emitter: a strip on the underside, angled toward the keyboard.
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.0055), new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffe7c9", emissiveIntensity: 0 }));
  strip.rotation.x = Math.PI / 2 + 0.75;
  strip.position.set(0, -0.0072, 0.0058);
  bar.add(tube, capL, capR, clamp, strip);
  bar.position.set(0, 1.275 + 0.0095, -0.598);
  scene.add(bar);
  items.lightbar = { root: bar, label: "Monitor light", sub: "Switch it off", strip };

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
  const keys = new THREE.InstancedMesh(keyGeo, M("#efeeea", 0.5), count);
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
      const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x + kw / 2, 0.0065, -0.042 + ri * u), new THREE.Quaternion(), new THREE.Vector3(kw - gap, 1, 1));
      keys.setMatrixAt(n, m4);
      keyRest.push(m4.clone());
      keyIndex.set(code, n);
      x += kw; n++;
    }
  });
  kb.add(keys);
  at(kb, -0.07, ON_MAT + 0.004, -0.262);
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

  const pad = mesh(box(0.13, 0.006, 0.112, 0.008, 3), P("#e6e6e3", 0.3, { clearcoat: 0.3 }));
  at(pad, 0.155, ON_MAT + 0.003, -0.262, -0.02);
  scene.add(pad);

  // ---- espresso: saucer, cup, crema, steam
  const cup = new THREE.Group();
  const ceramic = P("#f4f2ed", 0.28, { clearcoat: 0.8 });
  const saucer = mesh(new THREE.CylinderGeometry(0.06, 0.046, 0.008, 48), ceramic);
  saucer.position.y = 0.004;
  const profile = [[0, 0], [0.021, 0], [0.025, 0.004], [0.03, 0.028], [0.033, 0.05], [0.0305, 0.051], [0.0275, 0.03], [0.022, 0.009], [0, 0.009]].map(([x, y]) => new THREE.Vector2(x, y));
  const vessel = mesh(new THREE.LatheGeometry(profile, 48), ceramic);
  vessel.position.y = 0.008;
  const handle = mesh(new THREE.TorusGeometry(0.012, 0.0035, 12, 24, Math.PI * 1.15), ceramic);
  handle.position.set(0.036, 0.034, 0); handle.rotation.z = -Math.PI / 2 - 0.25;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.0285, 40), M("#ffffff", 0.2, 0, { map: cremaTexture() }));
  coffee.rotation.x = -Math.PI / 2;
  const level = (f) => { const y = 0.012 + f * 0.036; coffee.position.y = 0.008 + y; coffee.scale.setScalar(0.74 + f * 0.26); coffee.visible = f > 0.02; };
  level(1);
  const steamTex = steamTexture();
  const puffs = [0, 1, 2, 3].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: "#c9c4bb", transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.set(0.03, 0.06, 1);
    s.userData.phase = i / 4;
    cup.add(s);
    return s;
  });
  cup.add(saucer, vessel, handle, coffee);
  at(cup, 0.5, TOP, -0.19, 0.6);
  scene.add(cup);
  let full = 1, steamBoost = 0;
  updates.push((t) => {
    steamBoost = Math.max(0, steamBoost - 0.01);
    for (const s of puffs) {
      const p = (t * 0.00018 + s.userData.phase) % 1;
      s.position.set(Math.sin(p * 6 + s.userData.phase * 9) * 0.008, 0.06 + p * 0.1, Math.cos(p * 5) * 0.004);
      s.scale.set(0.025 + p * 0.03, 0.05 + p * 0.05, 1);
      s.material.opacity = full > 0.05 ? Math.sin(p * Math.PI) * 0.07 * (0.6 + full * 0.4 + steamBoost) : 0;
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
  const gloss = P("#f2f2f0", 0.18, { clearcoat: 1 });
  const caseBase = mesh(box(0.06, 0.016, 0.045, 0.008, 5), gloss);
  caseBase.position.y = 0.008;
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.0165, -0.0225);
  const lid = mesh(box(0.06, 0.009, 0.045, 0.0045, 5), gloss);
  lid.position.set(0, 0.0045, 0.0225);
  hinge.add(lid);
  const bud = (x) => { const b = mesh(new THREE.CapsuleGeometry(0.0055, 0.008, 6, 12), gloss); b.position.set(x, 0.017, -0.004); return b; };
  const led = mesh(new THREE.CircleGeometry(0.0012, 12), new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#3fdc6a", emissiveIntensity: 4 }), { cast: false });
  led.position.set(0, 0.009, 0.0226);
  pods.add(caseBase, hinge, bud(-0.012), bud(0.012), led);
  at(pods, 0.335, ON_MAT, -0.13, -0.45);
  scene.add(pods);
  let podsOpen = false;
  items.pods = {
    root: pods, label: "AirPods", sub: "Pop the lid",
    async act() {
      podsOpen = !podsOpen;
      const from = hinge.rotation.x, to = podsOpen ? -1.75 : 0;
      items.pods.sub = podsOpen ? "Close the lid" : "Pop the lid";
      await tween(560, (k) => { hinge.rotation.x = lerp(from, to, k); }, podsOpen ? "spring" : "out");
    },
  };

  // ---- sticky notes: the contact details
  const note = (color, lines, w = 0.076, curl = 0.004, backlit = 0) => {
    const geo = new THREE.PlaneGeometry(w, w, 8, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = Math.max(0, (-y / (w / 2)));
      pos.setZ(i, t * t * curl);
    }
    geo.computeVertexNormals();
    // On the screen, the display behind shines through the paper.
    const map = stickyTexture(color, lines);
    return mesh(geo, M("#ffffff", 0.85, 0, { map, side: THREE.DoubleSide, emissive: backlit ? "#ffffff" : "#000000", emissiveMap: backlit ? map : null, emissiveIntensity: backlit }), { cast: true });
  };
  const mailNote = note("#ffe066", [["Say hi!", 150], ["email me", 104]], 0.076, 0.004, 0.22);
  mailNote.position.set(-0.262, 0.94, -0.5885); mailNote.rotation.z = 0.06;
  scene.add(mailNote);
  items.mail = { root: mailNote, label: "Email", sub: "lattanzi.joseph@gmail.com", href: "mailto:lattanzi.joseph@gmail.com" };

  const liNote = note("#9fd3f5", [["Linked", 140], ["in", 140]], 0.066, 0.004, 0.22);
  liNote.position.set(0.27, 1.2, -0.5885); liNote.rotation.z = -0.1;
  scene.add(liNote);
  items.linkedin = { root: liNote, label: "LinkedIn", sub: "linkedin.com/in/joseph-lattanzi", href: "https://www.linkedin.com/in/joseph-lattanzi/" };

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
  at(folder, -0.395, TOP, -0.135, 0.14);
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

  // The GitHub note is stuck to the folder's cover, so it rides along when the folder opens.
  const ghNote = note("#ffa6c9", [["GitHub", 140], ["the code", 100]], 0.07, 0.003);
  ghNote.rotation.x = -Math.PI / 2; ghNote.rotation.z = -0.22;
  ghNote.position.set(fw * 0.74, 0.0009, fd * 0.3);
  spine.add(ghNote);
  items.github = { root: ghNote, label: "GitHub", sub: "github.com/jlattanzi4", href: "https://github.com/jlattanzi4" };

  // ---- the thesis, on two favourite books
  const books = new THREE.Group();
  const cloth = (c) => M(c, 0.85);
  const stackBook = (w, h, d, spineInfo, fallback) => {
    const c = spineInfo ? cloth(spineInfo.color) : cloth(fallback);
    const face = spineInfo ? M("#ffffff", 0.8, 0, { map: spineTexture(spineInfo.title, spineInfo.author, spineInfo.color) }) : c;
    const pages = M("#e8e1d0", 0.95);
    // Box faces: +x, −x, +y, −y, +z (toward the chair: the spine), −z.
    return mesh(box(w, h, d, 0.002), [pages, c, c, c, face, pages]);
  };
  const b1 = stackBook(0.235, 0.034, 0.16, spines[0], "#3d4a40"); b1.position.y = 0.017;
  const b2 = stackBook(0.22, 0.028, 0.15, spines[1], "#5a3a2a"); b2.position.set(0.004, 0.034 + 0.014, 0.003); b2.rotation.y = 0.05;
  const thesisTex = thesisTexture();
  const navy = M("#2a3a5e", 0.7);
  const thesis = mesh(box(0.2, 0.012, 0.26, 0.002), [navy, navy, M("#ffffff", 0.65, 0, { map: thesisTex }), navy, navy, navy]);
  thesis.position.set(-0.004, 0.062 + 0.006, -0.01); thesis.rotation.y = -0.06;
  books.add(b1, b2, thesis);
  at(books, -0.47, TOP, -0.64, 0.1);
  scene.add(books);
  items.thesis = {
    root: books, label: "Who comes back?", sub: "Master’s capstone, 2025",
    async act() {
      await tween(420, (k) => { thesis.position.y = 0.068 + Math.sin(k * Math.PI) * 0.035; thesis.rotation.x = Math.sin(k * Math.PI) * 0.25; }, "inOut");
      return "thesis";
    },
  };

  // ---- the football, on a small stand: the NFL optimizer
  const ballGroup = new THREE.Group();
  const stand = mesh(box(0.07, 0.014, 0.05, 0.004), M("#2a1a10", 0.5));
  stand.position.y = 0.007;
  const ball = mesh(new THREE.SphereGeometry(0.05, 48, 32), M("#ffffff", 0.62, 0, { map: footballTexture() }));
  ball.scale.set(1, 1.62, 1);
  const ballSpin = new THREE.Group();
  ballSpin.rotation.z = Math.PI / 2;
  ballSpin.add(ball);
  const ballHolder = new THREE.Group();
  ballHolder.position.y = 0.06;
  ballHolder.add(ballSpin);
  ballGroup.add(stand, ballHolder);
  at(ballGroup, 0.43, TOP, -0.58, -0.5);
  scene.add(ballGroup);
  items.football = {
    root: ballGroup, label: "NFL Survivor Optimizer", sub: "This week’s pick, live",
    async act() {
      await tween(900, (k) => { ball.rotation.y = k * Math.PI * 4; ballHolder.position.y = 0.06 + Math.sin(k * Math.PI) * 0.09; }, "out");
      ball.rotation.y = 0;
      return "nfl";
    },
  };

  // ---- a brick-built F1 car: Box Box. It does a lap of the monitor.
  const car = brickCar();
  const carHome = { x: 0.275, z: -0.44, ry: Math.PI * 0.93 };
  at(car.root, carHome.x, TOP, carHome.z, carHome.ry);
  scene.add(car.root);
  const lap = new THREE.CatmullRomCurve3([
    new THREE.Vector3(carHome.x, TOP, carHome.z),
    new THREE.Vector3(0.1, TOP, -0.43),
    new THREE.Vector3(-0.1, TOP, -0.44),
    new THREE.Vector3(-0.155, TOP, -0.56),
    new THREE.Vector3(-0.1, TOP, -0.71),
    new THREE.Vector3(0.13, TOP, -0.72),
    new THREE.Vector3(0.23, TOP, -0.6),
  ], true, "catmullrom", 0.5);
  items.car = {
    root: car.root, label: "Box Box", sub: "Fantasy F1 for your group chat",
    async act() {
      if (motion.reduce) return "box";
      const p = new THREE.Vector3(), d = new THREE.Vector3();
      await tween(2300, (k) => {
        lap.getPointAt(k, p); lap.getTangentAt(k, d);
        car.root.position.copy(p);
        car.root.rotation.y = Math.atan2(-d.z, d.x);
        car.spin(k * 70);
      }, "inOut");
      at(car.root, carHome.x, TOP, carHome.z, carHome.ry);
      return "box";
    },
  };

  // ---- snake plant in a stoneware pot
  const plant = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.1, 32), M("#c9c4b8", 0.85));
  pot.position.y = 0.05;
  const soil = mesh(new THREE.CircleGeometry(0.05, 24), M("#2a1e15", 1), { cast: false });
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.094;
  plant.add(pot, soil);
  const leaves = [];
  const leafMat = M("#2d5534", 0.6);
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
  at(plant, 0.69, TOP, -0.68);
  scene.add(plant);
  items.plant = {
    root: plant, label: "Snake plant", sub: "Hard to kill",
    async act() {
      const rest = leaves.map((l) => l.rotation.z);
      await tween(1100, (k) => leaves.forEach((l, i) => { l.rotation.z = rest[i] + Math.sin(k * Math.PI * 6 + i) * 0.12 * (1 - k); }), "linear");
    },
  };

  // ---- desk lamp: a warm pool of light on the left of the desk
  const lamp = new THREE.Group();
  const lampMat = M("#1b1c1e", 0.4, 0.4);
  const brass = M("#b8955a", 0.3, 0.85);
  const lbase = mesh(new THREE.CylinderGeometry(0.065, 0.072, 0.016, 48), lampMat);
  lbase.position.y = 0.008;
  const pole = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.43, 16), lampMat);
  pole.position.y = 0.23;
  const knuckle = mesh(new THREE.SphereGeometry(0.011, 20, 14), brass);
  knuckle.position.y = 0.445;
  const arm = mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.27, 16), lampMat);
  arm.rotation.z = Math.PI / 2 - 0.08; arm.position.set(0.135, 0.455, 0);
  const shade = mesh(new THREE.CylinderGeometry(0.03, 0.058, 0.1, 40, 1, true), M("#1b1c1e", 0.42, 0.35, { side: THREE.FrontSide }));
  shade.position.set(0.272, 0.425, 0); shade.rotation.z = 0.12;
  // The inside of the shade glows with the bulb's light: brightest near the bulb.
  const glowMap = canvasTexture(4, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.5, "#b8b8b8"); grad.addColorStop(1, "#5a5a5a");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  const inner = mesh(new THREE.CylinderGeometry(0.0295, 0.0575, 0.099, 40, 1, true), new THREE.MeshStandardMaterial({ color: "#2a2520", roughness: 0.9, emissive: "#ffb366", emissiveMap: glowMap, emissiveIntensity: 0, side: THREE.BackSide }), { cast: false });
  inner.position.copy(shade.position); inner.rotation.copy(shade.rotation);
  const cap = mesh(new THREE.SphereGeometry(0.031, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lampMat);
  cap.position.set(0.268, 0.474, 0); cap.rotation.z = 0.12;
  const bulb = mesh(new THREE.SphereGeometry(0.02, 20, 14), new THREE.MeshStandardMaterial({ color: "#fff3d6", emissive: "#ffc98a", emissiveIntensity: 0 }), { cast: false });
  bulb.position.set(0.276, 0.405, 0);
  lamp.add(lbase, pole, knuckle, arm, shade, inner, cap, bulb);
  at(lamp, -0.74, TOP, -0.66, -0.62);
  scene.add(lamp);
  items.lamp = { root: lamp, label: "Desk lamp", sub: "Switch it off", bulb, inner };

  // ---- on the wall: a framed print of the redline figure
  const frame = new THREE.Group();
  const frameMat = M("#141416", 0.5);
  frame.add(mesh(box(0.37, 0.27, 0.02, 0.003), frameMat));
  const matBoard = mesh(new THREE.PlaneGeometry(0.34, 0.24), M("#efede7", 0.95), { cast: false });
  matBoard.position.z = 0.0105;
  const printTex = new THREE.TextureLoader().load("images/redline-print.png");
  printTex.colorSpace = THREE.SRGBColorSpace; printTex.anisotropy = 8;
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.179), M("#ffffff", 0.9, 0, { map: printTex }));
  print.position.z = 0.011;
  // Glazing: a faint reflection across the glass.
  const glazing = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.04, transparent: true, opacity: 0.08, clearcoat: 1 }));
  glazing.position.z = 0.0125;
  frame.add(matBoard, print, glazing);
  frame.position.set(0.6, 1.21, -0.846);
  frame.rotation.z = 0.004;
  scene.add(frame);
  items.print = { root: frame, label: "A print of the SEC study’s figure", sub: "One filing, marked up against the year before", act: async () => "sec" };

  // ---- sunglasses, folded, by the monitor
  const shades = sunglasses();
  at(shades.root, 0.5, TOP, -0.39, -0.45);
  scene.add(shades.root);
  let unfolded = false;
  items.sunglasses = {
    root: shades.root, label: "Sunglasses", sub: "Unfold them",
    async act() {
      unfolded = !unfolded;
      items.sunglasses.sub = unfolded ? "Fold them" : "Unfold them";
      const from = shades.open, to = unfolded ? 1 : 0;
      await tween(650, (k) => shades.set(lerp(from, to, k)), "inOut");
    },
  };

  return { items, updates, onMat: ON_MAT };
}

// ------------------------------------------------------- a brick-built F1 car
// Built on an 8 mm stud grid out of plates (3.2 mm), bricks (9.6 mm), slopes and tiles,
// in the house colours of the Box Box icon. No maker's marks on the studs.
function brickCar() {
  const root = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);
  const S = 0.008, PL = 0.0032, BR = 0.0096, gapB = 0.00015;
  const abs = (c, rough = 0.32) => new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.2 });
  const RED = abs("#b8141c"), WHITE = abs("#eeece6"), BLACK = abs("#1a1a1c", 0.4), YELLOW = abs("#f2b705"), GREY = abs("#9a9ea3", 0.35);
  const studs = new Map(); // material -> matrices
  const stud = (mat, x, y, z) => {
    if (!studs.has(mat)) studs.set(mat, []);
    studs.get(mat).push(new THREE.Matrix4().makeTranslation(x, y + 0.00085, z));
  };
  // A rectangular piece: x0..x1 (studs, along the car), z0..z1 (studs, across), y in metres.
  const piece = (mat, x0, x1, z0, z1, y, h, withStuds = true) => {
    const w = (x1 - x0) * S, d = (z1 - z0) * S;
    const m = mesh(box(w - gapB * 2, h - gapB, d - gapB * 2, 0.0005, 1), mat);
    m.position.set((x0 + x1) / 2 * S, y + h / 2, (z0 + z1) / 2 * S);
    model.add(m);
    if (withStuds) for (let i = x0; i < x1; i++) for (let j = z0; j < z1; j++) stud(mat, (i + 0.5) * S, y + h, (j + 0.5) * S);
    return m;
  };
  // A slope: rises from `low` at x0 to full height at x1 (or falls, if x1 < x0).
  const slope = (mat, x0, x1, z0, z1, y, h, low = 0.3) => {
    const L = Math.abs(x1 - x0) * S, d = (z1 - z0) * S;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(L, 0); shape.lineTo(L, h - gapB); shape.lineTo(L * 0.25, h - gapB); shape.lineTo(0, h * low);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d - gapB * 2, bevelEnabled: false });
    geo.translate(0, 0, -(d - gapB * 2) / 2);
    const m = mesh(geo, mat);
    m.position.set(Math.min(x0, x1) * S + (x1 < x0 ? L : 0), y, (z0 + z1) / 2 * S);
    if (x1 < x0) m.scale.x = -1;
    model.add(m);
    return m;
  };
  const Y0 = 0.0062; // the floor sits this high, between the wheels
  // Floor and monocoque.
  piece(BLACK, -6, 4, -3, 3, Y0, PL, false);
  piece(RED, -5, 7, -1, 1, Y0 + PL, BR, false);
  slope(RED, 10, 7, -1, 1, Y0 + PL, BR, 0.35); // the nose, falling toward the front wing
  // Sidepods with intakes and a white tile stripe.
  for (const [z0, z1] of [[1, 3], [-3, -1]]) {
    piece(RED, -4, 1, z0, z1, Y0 + PL, BR, false);
    slope(RED, 2, 1, z0, z1, Y0 + PL, BR, 0.25);
    piece(WHITE, -4, 1, z0, z1, Y0 + PL + BR, PL * 0.7, false);
  }
  // Engine cover rising to the airbox, behind the cockpit.
  slope(RED, 1, -1, -1, 1, Y0 + PL + BR, BR, 0.2);
  piece(RED, -5, -1, -1, 1, Y0 + PL + BR, BR * 0.66, false);
  piece(BLACK, -2, -1, -0.5, 0.5, Y0 + PL + BR + BR * 0.66, PL * 1.4, false);
  // Driver: a round yellow helmet with a dark visor, under the halo.
  const helmet = mesh(new THREE.SphereGeometry(0.0062, 20, 14), YELLOW);
  helmet.position.set(2.2 * S, Y0 + PL + BR + 0.004, 0);
  const visor = mesh(new THREE.SphereGeometry(0.0063, 20, 8, -0.9, 1.8, 1.2, 0.55), abs("#101216", 0.1));
  visor.position.copy(helmet.position);
  model.add(helmet, visor);
  const halo = mesh(new THREE.TorusGeometry(0.0085, 0.0011, 8, 24, Math.PI), BLACK);
  halo.position.set(2.4 * S, Y0 + PL + BR + 0.002, 0); halo.rotation.y = Math.PI / 2;
  model.add(halo);
  // Front wing: a black plate with red end plates, studs showing.
  piece(BLACK, 8, 11, -4.5, 4.5, Y0 - 0.002, PL);
  for (const z of [-4.5, 3.5]) piece(RED, 8, 11, z, z + 1, Y0 - 0.002 + PL, PL * 1.5, false);
  // Rear wing on two posts, with a white upper flap.
  for (const z of [-1.4, 0.4]) piece(BLACK, -7, -6, z, z + 1, Y0 + PL, BR * 2.2, false);
  piece(BLACK, -7.5, -5.5, -3.5, 3.5, Y0 + PL + BR * 2.2, PL);
  piece(WHITE, -7.2, -6.2, -3.5, 3.5, Y0 + PL * 2 + BR * 2.2, PL * 0.8, false);
  for (const z of [-3.2, 2.4]) piece(RED, -7.8, -5.3, z, z + 0.8, Y0 + PL * 2, BR * 2.2 + PL * 1.6, false);
  // Studs, instanced per colour.
  const studGeo = new THREE.CylinderGeometry(0.0024, 0.0024, 0.0017, 18);
  for (const [mat, list] of studs) {
    const inst = new THREE.InstancedMesh(studGeo, mat, list.length);
    list.forEach((m4, i) => inst.setMatrixAt(i, m4));
    inst.castShadow = true; inst.receiveShadow = true;
    model.add(inst);
  }
  // Wheels: chunky slicks with grey hubs.
  const wheels = [];
  const rubber = M("#151515", 0.82);
  for (const [x, z, rad, wid] of [[6, 3.9, 0.0105, 0.0105], [6, -3.9, 0.0105, 0.0105], [-4.5, 4.05, 0.0118, 0.0135], [-4.5, -4.05, 0.0118, 0.0135]]) {
    const wheel = new THREE.Group();
    const tyre = mesh(new THREE.CylinderGeometry(rad, rad, wid, 28), rubber);
    const hub = mesh(new THREE.CylinderGeometry(rad * 0.58, rad * 0.58, wid + 0.0006, 20), GREY);
    tyre.rotation.x = hub.rotation.x = Math.PI / 2;
    wheel.add(tyre, hub);
    wheel.position.set(x * S, rad, z * S);
    model.add(wheel);
    wheels.push(wheel);
  }
  model.scale.setScalar(0.86);
  return { root, spin: (a) => { for (const w of wheels) w.rotation.z = -a; } };
}

// ------------------------------------------------------------ sunglasses
// Tortoiseshell acetate with dark green lenses, built from a 2D outline: the front is one
// extruded shape with two lens holes and a keyhole bridge; the temples fold on hinges.
function sunglasses() {
  const root = new THREE.Group();
  // Two rims joined by a keyhole bridge: square at the brow, rounder toward the cheek.
  const W = 0.067, H = 0.024, B = -0.02, IN = 0.008;
  const rt = 0.01, rb = 0.019, ri = 0.012;
  const outline = new THREE.Shape();
  outline.moveTo(-W + rt, H);
  outline.lineTo(W - rt, H); outline.quadraticCurveTo(W, H, W, H - rt);
  outline.lineTo(W, B + rb); outline.quadraticCurveTo(W, B, W - rb, B);
  outline.lineTo(IN + ri, B); outline.quadraticCurveTo(IN, B, IN, B + ri);
  outline.lineTo(IN, 0.004); outline.quadraticCurveTo(0, 0.024, -IN, 0.004);
  outline.lineTo(-IN, B + ri); outline.quadraticCurveTo(-IN, B, -IN - ri, B);
  outline.lineTo(-W + rb, B); outline.quadraticCurveTo(-W, B, -W, B + rb);
  outline.lineTo(-W, H - rt); outline.quadraticCurveTo(-W, H, -W + rt, H);
  const lensShape = (cx) => roundedRectPath(new THREE.Shape(), cx, 0.002, 0.05, 0.036, 0.0115);
  const holes = [-0.0375, 0.0375].map((cx) => roundedRectPath(new THREE.Path(), cx, 0.002, 0.05, 0.036, 0.0115));
  outline.holes.push(...holes);
  const depth = 0.0045;
  const frontGeo = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: true, bevelThickness: 0.0011, bevelSize: 0.0007, bevelSegments: 3, curveSegments: 20 });
  frontGeo.translate(0, 0, -depth / 2);
  const acetate = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: tortoiseTexture(), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const front = mesh(frontGeo, acetate);
  // Green G-15-style lenses: dark, glossy, with a little of the room reflected in them.
  const lensMat = new THREE.MeshPhysicalMaterial({ color: "#26402c", roughness: 0.03, metalness: 0.35, transparent: true, opacity: 0.8, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4, side: THREE.DoubleSide });
  for (const cx of [-0.0375, 0.0375]) {
    const lens = mesh(new THREE.ShapeGeometry(lensShape(cx), 20), lensMat, { cast: true, receive: false });
    lens.position.z = 0.0002;
    front.add(lens);
  }
  // Temples: hinged at the outer edges, folding in behind the lenses.
  const temples = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * (W - 0.002), H - 0.008, -depth / 2 - 0.0012);
    const arm = mesh(box(0.0035, 0.007, 0.138, 0.0015), acetate);
    arm.position.z = -0.069;
    const tip = mesh(box(0.0035, 0.006, 0.03, 0.0015), acetate);
    tip.position.set(0, -0.009, -0.132); tip.rotation.x = 0.55;
    hinge.add(arm, tip);
    front.add(hinge);
    temples.push({ hinge, side });
  }
  // Folded, they lie back on their temples with the lenses up, catching the monitor and the light bar.
  front.position.y = 0.0125;
  front.rotation.x = -1.0;
  root.add(front);
  const g = { root, open: 0 };
  g.set = (k) => {
    g.open = k;
    for (const { hinge, side } of temples) {
      // Folded: each temple swings in across the back (the right one sits a little further back).
      const folded = side * (Math.PI / 2 - 0.06);
      hinge.rotation.y = lerp(folded, 0, k);
      hinge.position.z = -depth / 2 - 0.0012 - (side > 0 ? 0.004 : 0) * (1 - k);
    }
    // Open, they stand on the frame and the temple tips, leaning back.
    front.rotation.x = lerp(-1.0, -0.3, k);
    front.position.y = lerp(0.0125, H + 0.0066, k);
  };
  g.set(0);
  return g;
}
