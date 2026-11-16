// My watch: the Seiko 5 Sports × Rowing Blazers × Wind Vintage Rally Diver (SRPM21), 38 mm,
// lying on the desk with its bracelet open. It shows the visitor's time, day and date; its
// seconds hand steps six times a second (the 4R36 beats 21,600 an hour); its LumiBrite glows
// when the lights go down; and it turns over to show the movement through the caseback.
//
// Local frame: the dial faces +y, 12 o'clock points to −z, 3 o'clock to +x.

import * as THREE from "three";
import { tween, motion, canvasTexture, rng, lerp, clamp, mesh, box } from "./kit.js";

const DIAL = 0.0139;      // dial radius
const INSERT = [0.01425, 0.0183];
const BEZEL = 0.019;      // 38 mm
const GREEN = "#13503a", CREAM = "#eee6cf", CHECK = "#226a46";
const LUME_DARK = new THREE.Color("#86f0d0"); // LumiBrite glows blue-green
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Clock angle (clockwise from 12) to a direction in the dial plane.
const dir = (a) => [Math.sin(a), -Math.cos(a)];

// ------------------------------------------------------------ the dial
function dialTextures() {
  const S = 1024, C = S / 2, px = C / DIAL;
  const colour = document.createElement("canvas"), glow = document.createElement("canvas");
  colour.width = colour.height = glow.width = glow.height = S;
  const g = colour.getContext("2d"), e = glow.getContext("2d");
  e.fillStyle = "#000"; e.fillRect(0, 0, S, S);
  // Forest green, with a faint grain and a little darker toward the edge.
  g.fillStyle = GREEN; g.fillRect(0, 0, S, S);
  const r = rng(12);
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.035})`; g.fillRect(r() * S, r() * S, 1.5, 1.5); }
  const vig = g.createRadialGradient(C, C, C * 0.5, C, C, C);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.28)");
  g.fillStyle = vig; g.fillRect(0, 0, S, S);
  // Minute track at the edge.
  g.fillStyle = "rgba(240, 236, 224, 0.9)";
  for (let i = 0; i < 60; i++) {
    g.save(); g.translate(C, C); g.rotate((i / 60) * Math.PI * 2);
    g.fillRect(-1.5, -C + 8, 3, i % 5 ? 20 : 28);
    g.restore();
  }
  // Markers: cream LumiBrite in polished surrounds. Dots, batons at 6 and 9, a triangle at 12.
  const both = (fn) => { fn(g, CREAM, "#d9dde0"); fn(e, "#fff", null); };
  const RM = 0.0108 * px;
  for (let h = 0; h < 12; h++) {
    if (h === 3) continue; // the day-date window
    both((ctx, fill, edge) => {
      ctx.save(); ctx.translate(C, C); ctx.rotate((h / 12) * Math.PI * 2);
      ctx.fillStyle = fill; ctx.strokeStyle = edge || fill; ctx.lineWidth = edge ? 8 : 0;
      ctx.beginPath();
      if (h === 0) { ctx.moveTo(-62, -C + 70); ctx.lineTo(62, -C + 70); ctx.lineTo(0, -C + 190); ctx.closePath(); }
      else if (h === 6 || h === 9) ctx.roundRect(-24, -RM - 78, 48, 156, 24);
      else ctx.arc(0, -RM, 40, 0, Math.PI * 2);
      ctx.fill(); if (edge) ctx.stroke();
      ctx.restore();
    });
  }
  // Signatures: SEIKO and the 5 below 12, Rowing Blazers above 6.
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#f4f1ea";
  g.font = "700 60px 'Instrument Sans', sans-serif";
  g.letterSpacing = "6px";
  g.fillText("SEIKO", C + 3, C - 220);
  g.letterSpacing = "0px";
  g.font = "italic 800 62px 'Instrument Sans', sans-serif";
  g.fillText("5", C, C - 150);
  g.fillRect(C - 24, C - 118, 48, 5);
  g.fillStyle = CREAM; g.font = "400 76px 'UnifrakturMaguntia', serif";
  g.fillText("Rowing", C, C + 132);
  g.fillText("Blazers", C, C + 205);
  g.fillStyle = "rgba(240, 236, 224, 0.8)"; g.font = "500 17px 'Instrument Sans', sans-serif";
  g.fillText("MADE IN JAPAN", C - 175, C + 388);
  g.fillText("4R36-18L0", C + 175, C + 388);
  const base = g.getImageData(0, 0, S, S);
  const tex = new THREE.CanvasTexture(colour);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const glowTex = new THREE.CanvasTexture(glow);
  // Day and date at 3, redrawn when the day changes.
  let shown = "";
  const calendar = () => {
    const d = new Date();
    const key = d.toDateString();
    if (key === shown) return;
    shown = key;
    g.putImageData(base, 0, 0);
    const y = C;
    g.fillStyle = "#c9ced2"; g.beginPath(); g.roundRect(C + 196, y - 42, 238, 84, 6); g.fill();
    g.fillStyle = "#f8f7f2"; g.fillRect(C + 204, y - 34, 140, 68); g.fillRect(C + 352, y - 34, 74, 68);
    g.fillStyle = "#16181a"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 46px 'Instrument Sans', sans-serif"; g.fillText(DAYS[d.getDay()], C + 274, y + 2);
    g.fillText(String(d.getDate()), C + 389, y + 2);
    tex.needsUpdate = true;
  };
  calendar();
  return { map: tex, emissiveMap: glowTex, calendar };
}

// The checkerboard rally bezel: two rows of green and cream squares, with cream patches
// carrying the 10-minute numerals and a triangle at zero. Numerals in the lower half are
// turned to read upright.
function bezelTexture() {
  return canvasTexture(1024, 1024, (g, S) => {
    const C = S / 2, rIn = C * INSERT[0] / INSERT[1], rMid = (rIn + C) / 2;
    g.fillStyle = CREAM; g.fillRect(0, 0, S, S);
    const seg = (Math.PI * 2) / 60;
    for (let i = 0; i < 60; i++) {
      if (i % 10 <= 1 || i % 10 >= 9) continue; // under a numeral patch
      for (const [r0, r1, row] of [[rMid, C, 0], [rIn, rMid, 1]]) {
        if ((i + row) % 2) continue;
        const a0 = -Math.PI / 2 + i * seg - seg / 2, a1 = a0 + seg;
        g.fillStyle = CHECK;
        g.beginPath(); g.arc(C, C, r1, a0, a1); g.arc(C, C, r0, a1, a0, true); g.closePath(); g.fill();
      }
    }
    g.fillStyle = CHECK; g.textAlign = "center"; g.textBaseline = "middle";
    for (let k = 0; k < 6; k++) {
      g.save(); g.translate(C, C); g.rotate((k / 6) * Math.PI * 2);
      if (k === 0) {
        g.beginPath(); g.moveTo(-40, -C + 20); g.lineTo(40, -C + 20); g.lineTo(0, -rIn - 12); g.closePath(); g.fill();
      } else {
        g.translate(0, -rMid);
        if (k >= 2 && k <= 4) g.rotate(Math.PI);
        g.font = "700 78px 'Barlow Condensed', sans-serif";
        g.fillText(String(k * 10), 0, 4);
      }
      g.restore();
    }
  });
}

// The caseback's glass: a dripping gold faucet printed over the movement.
function faucetTexture() {
  return canvasTexture(512, 512, (g) => {
    const gold = g.createLinearGradient(0, 120, 0, 380);
    gold.addColorStop(0, "#f2d58a"); gold.addColorStop(0.5, "#c99a3f"); gold.addColorStop(1, "#e8c46f");
    g.fillStyle = gold; g.strokeStyle = "#8a6420"; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(140, 236); g.lineTo(300, 236); g.quadraticCurveTo(372, 236, 372, 300); g.lineTo(372, 330);
    g.lineTo(336, 330); g.lineTo(336, 304); g.quadraticCurveTo(336, 272, 300, 272); g.lineTo(140, 272); g.closePath();
    g.fill(); g.stroke();
    g.beginPath(); g.roundRect(118, 220, 30, 68, 8); g.fill(); g.stroke();
    // The handle: a cross on a stem.
    g.beginPath(); g.roundRect(228, 186, 22, 52, 6); g.fill(); g.stroke();
    g.beginPath(); g.roundRect(190, 168, 98, 22, 10); g.fill(); g.stroke();
    // The drip.
    g.fillStyle = "#4a8fe0";
    g.beginPath(); g.moveTo(354, 352); g.quadraticCurveTo(334, 384, 354, 398); g.quadraticCurveTo(374, 384, 354, 352); g.fill();
  });
}

function caseRingTexture() {
  return canvasTexture(1024, 1024, (g, S) => {
    const C = S / 2, r = rng(4);
    g.fillStyle = "#c6c9cc"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(0,0,0,${r() * 0.05})`; g.beginPath(); g.arc(C, C, 370 + r() * 140, 0, 7); g.stroke(); }
    g.fillStyle = "rgba(40,42,46,0.75)"; g.font = "500 28px 'Instrument Sans', sans-serif"; g.textAlign = "center";
    const text = "SEIKO  ·  WATER RESIST 10 BAR  ·  STAINLESS STEEL  ·  4R36  ·  LIMITED EDITION OF 2,500  ·  ";
    [...text].forEach((ch, i) => { g.save(); g.translate(C, C); g.rotate((i / text.length) * Math.PI * 2); g.fillText(ch, 0, -C + 62); g.restore(); });
  });
}

const stripes = (base, text) => canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let x = -h; x < w + h; x += 46) {
    const grad = g.createLinearGradient(x, 0, x + 46, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(0.5, "rgba(255,255,255,0.22)"); grad.addColorStop(1, "rgba(0,0,0,0.12)");
    g.save(); g.translate(x + 23, h / 2); g.rotate(0.5); g.translate(-x - 23, -h / 2);
    g.fillStyle = grad; g.fillRect(x, -h, 46, h * 3); g.restore();
  }
  if (text) {
    g.save(); g.translate(w / 2, h / 2);
    g.fillStyle = "rgba(40, 40, 44, 0.7)"; g.font = "600 28px 'Instrument Sans', sans-serif"; g.textAlign = "center";
    const chars = [...text]; const span = Math.PI * 0.8;
    chars.forEach((ch, i) => { g.save(); g.rotate(-span / 2 + (i / (chars.length - 1)) * span); g.translate(0, -w * 0.4); g.fillText(ch, 0, 0); g.restore(); });
    g.restore();
  }
});

const perlage = () => canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = "#b9bcbf"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h + 20; y += 22) for (let x = 0; x < w + 20; x += 22) {
    const grad = g.createRadialGradient(x, y, 0, x, y, 16);
    grad.addColorStop(0, "rgba(255,255,255,0.18)"); grad.addColorStop(0.7, "rgba(0,0,0,0.08)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill();
  }
});

// The red-and-white seconds hand, drawn along its length (the tip is at the top).
const secondsTexture = () => canvasTexture(32, 512, (g, w, h) => {
  g.fillStyle = "#e9e6df"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#c8102e";
  for (let y = 120; y < 330; y += 42) g.fillRect(0, y, w, 21);
  g.fillRect(0, 0, w, 60);
  g.fillRect(0, h - 70, w, 70);
});

// ------------------------------------------------------------ geometry
// Seiko 5 Sports hands: a shaft that ends in an arrowhead.
function arrowHand(len, shaft, head, headLen, tail) {
  const s = new THREE.Shape();
  s.moveTo(-shaft / 2, -tail);
  s.lineTo(shaft / 2, -tail);
  s.lineTo(shaft / 2, len - headLen);
  s.lineTo(head / 2, len - headLen);
  s.lineTo(0, len);
  s.lineTo(-head / 2, len - headLen);
  s.lineTo(-shaft / 2, len - headLen);
  s.closePath();
  return s;
}
const flat = (shape, thick) => {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // the shape's +y becomes −z: the hand points at 12 when unrotated
  return geo;
};

// ---------------------------------------------------------------- watch
export function buildWatch(scene, { x, y, z, ry }) {
  const root = new THREE.Group();
  root.position.set(x, y, z); root.rotation.y = ry;
  scene.add(root);
  const body = new THREE.Group(); // turns over around the 12-6 axis
  root.add(body);
  const REST = 0.0058, REST_DOWN = 0.0063; // centre heights, dial up and dial down
  body.position.y = REST;

  const polished = new THREE.MeshPhysicalMaterial({ color: "#d4d7da", metalness: 1, roughness: 0.16, clearcoat: 0.3 });
  const brushed = new THREE.MeshStandardMaterial({ color: "#c3c6c9", metalness: 1, roughness: 0.34 });

  // Case: a lathe profile from the caseback up to the bezel seat.
  const profile = [[0.0128, -0.0058], [0.0172, -0.0054], [0.0183, -0.0038], [0.0187, 0.0018], [0.0184, 0.0026], [0.0165, 0.0027]].map(([r, h]) => new THREE.Vector2(r, h));
  body.add(mesh(new THREE.LatheGeometry(profile, 72), brushed));
  // Lugs: 20 mm between them, 44 mm tip to tip.
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const lug = mesh(box(0.0042, 0.0047, 0.0102, 0.0006, 2), brushed);
    lug.position.set(sx * 0.0122, -0.0009, sz * 0.0172);
    lug.rotation.x = sz * 0.2;
    body.add(lug);
  }
  // The crown at 4, tucked into a shoulder of the case.
  const [cx, cz] = dir((4 / 12) * Math.PI * 2);
  const shoulder = mesh(box(0.0068, 0.0058, 0.0105, 0.0016), brushed);
  shoulder.position.set(cx * 0.0172, -0.0012, cz * 0.0172);
  shoulder.rotation.y = -Math.atan2(cz, cx);
  const crown = mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.0032, 28), polished);
  crown.rotation.order = "YZX";
  crown.rotation.set(0, -Math.atan2(cz, cx), Math.PI / 2);
  crown.position.set(cx * 0.0212, -0.0012, cz * 0.0212);
  body.add(shoulder, crown);

  // Bezel: a coin edge with big teeth, and the checkerboard insert.
  const edge = new THREE.CylinderGeometry(BEZEL, BEZEL, 0.0024, 120, 1, true);
  const ep = edge.attributes.position;
  for (let i = 0; i < ep.count; i++) {
    const a = Math.atan2(ep.getZ(i), ep.getX(i));
    const k = 1 + (Math.round((a / (Math.PI * 2)) * 120) % 2 ? 0.012 : -0.008);
    ep.setX(i, ep.getX(i) * k); ep.setZ(i, ep.getZ(i) * k);
  }
  edge.computeVertexNormals();
  const bezel = new THREE.Group();
  bezel.position.y = 0.0039;
  bezel.add(mesh(edge, polished));
  const insert = mesh(new THREE.RingGeometry(INSERT[0], INSERT[1], 120, 1), new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: bezelTexture(), metalness: 0.35, roughness: 0.38, clearcoat: 0.4 }), { cast: false });
  insert.rotation.x = -Math.PI / 2; insert.position.y = 0.0012;
  const lip = mesh(new THREE.RingGeometry(INSERT[1], BEZEL, 120, 1), polished, { cast: false });
  lip.rotation.x = -Math.PI / 2; lip.position.y = 0.0012;
  bezel.add(insert, lip);
  body.add(bezel);

  // Dial and hands.
  const dialTex = dialTextures();
  const lumeMats = [];
  const lume = (extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.6, emissive: LUME_DARK, emissiveIntensity: 0, ...extra });
    lumeMats.push(m);
    return m;
  };
  const dial = mesh(new THREE.CircleGeometry(DIAL, 96), lume({ color: "#ffffff", map: dialTex.map, emissiveMap: dialTex.emissiveMap, roughness: 0.55, metalness: 0.1 }), { cast: false });
  dial.rotation.x = -Math.PI / 2; dial.position.y = 0.0022;
  body.add(dial);
  const hands = new THREE.Group();
  hands.position.y = 0.0025;
  body.add(hands);
  const makeHand = (shape, fillShape, yy) => {
    const h = new THREE.Group();
    h.position.y = yy;
    h.add(mesh(flat(shape, 0.00025), polished));
    const fill = mesh(flat(fillShape, 0.0001), lume(), { cast: false });
    fill.position.y = 0.00026;
    h.add(fill);
    hands.add(h);
    return h;
  };
  const hourHand = makeHand(arrowHand(0.0083, 0.0019, 0.0034, 0.0026, 0.0018), arrowHand(0.0079, 0.0011, 0.0024, 0.0022, -0.0012), 0);
  const minuteHand = makeHand(arrowHand(0.0128, 0.0014, 0.0028, 0.0026, 0.0024), arrowHand(0.0123, 0.0008, 0.0019, 0.0022, -0.0016), 0.00045);
  const secondHand = new THREE.Group();
  secondHand.position.y = 0.0009;
  // Box faces: +x, −x, +y (the painted side), −y, +z, −z.
  const secPaint = new THREE.MeshStandardMaterial({ map: secondsTexture(), roughness: 0.45 });
  const secEdge = new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.45 });
  const secShaft = mesh(new THREE.BoxGeometry(0.00042, 0.0002, 0.0172), [secEdge, secEdge, secPaint, secEdge, secEdge, secEdge], { cast: false });
  secShaft.position.z = -0.0044; // from a short counterweight behind the pinion out to the minute track
  const hub = mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.0005, 20), polished, { cast: false });
  secondHand.add(secShaft, hub);
  hands.add(secondHand);

  // Hardlex crystal: a gentle dome, nearly invisible but for its reflections.
  const crystal = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 64, 8, 0, Math.PI * 2, 0, Math.asin(0.0143 / 0.045)),
    new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.02, transparent: true, opacity: 0.1, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false }),
  );
  crystal.position.y = 0.0063 - 0.045;
  body.add(crystal);

  // Caseback: a steel ring and a window over the 4R36, with the faucet printed on the glass.
  const back = new THREE.Group();
  back.position.y = -0.0058;
  back.rotation.z = Math.PI; // faces −y; turned over with the watch, it reads the right way round
  body.add(back);
  const ring = mesh(new THREE.RingGeometry(0.0124, 0.0172, 96), new THREE.MeshStandardMaterial({ color: "#ffffff", map: caseRingTexture(), metalness: 1, roughness: 0.3 }), { cast: false });
  ring.rotation.x = -Math.PI / 2;
  back.add(ring);
  const movement = new THREE.Group();
  movement.position.y = -0.0036;
  back.add(movement);
  const plate = mesh(new THREE.CircleGeometry(0.0128, 72), new THREE.MeshStandardMaterial({ color: "#ffffff", map: perlage(), metalness: 1, roughness: 0.38 }), { cast: false });
  plate.rotation.x = -Math.PI / 2;
  movement.add(plate);
  const bridgeShape = new THREE.Shape();
  bridgeShape.absarc(0, 0, 0.012, 1.1, Math.PI * 2 - 0.6, false);
  bridgeShape.lineTo(0.0012, 0);
  bridgeShape.closePath();
  const bridgeTex = stripes("#c0c3c6");
  bridgeTex.wrapS = bridgeTex.wrapT = THREE.RepeatWrapping; bridgeTex.repeat.set(30, 30);
  const bridge = mesh(new THREE.ExtrudeGeometry(bridgeShape, { depth: 0.0008, bevelEnabled: true, bevelThickness: 0.0002, bevelSize: 0.0002, bevelSegments: 2, curveSegments: 40 }), new THREE.MeshStandardMaterial({ color: "#ffffff", map: bridgeTex, metalness: 1, roughness: 0.3 }));
  bridge.rotation.x = -Math.PI / 2; bridge.position.y = 0.0001;
  movement.add(bridge);
  const ruby = new THREE.MeshPhysicalMaterial({ color: "#9e0b2b", roughness: 0.08, clearcoat: 1 });
  const screwMat = new THREE.MeshStandardMaterial({ color: "#c9ccd0", metalness: 1, roughness: 0.25 });
  for (const [jx, jz] of [[-0.0056, -0.0056], [-0.0075, 0.0036], [0.0018, -0.0085], [-0.002, 0.0075]]) {
    const j = mesh(new THREE.CylinderGeometry(0.00055, 0.00055, 0.0004, 16), ruby, { cast: false });
    j.position.set(jx, 0.0011, jz); movement.add(j);
  }
  for (const [sx, sz] of [[-0.0102, -0.002], [-0.004, -0.0102], [0.0045, 0.0098], [-0.0085, 0.0066]]) {
    const s = mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.0003, 14), screwMat, { cast: false });
    s.position.set(sx, 0.0011, sz); movement.add(s);
  }
  const balance = new THREE.Group();
  balance.position.set(0.0064, 0.0005, -0.0008);
  const gold = new THREE.MeshStandardMaterial({ color: "#d6b46a", metalness: 1, roughness: 0.25 });
  const rim = mesh(new THREE.TorusGeometry(0.0032, 0.00033, 8, 48), gold, { cast: false });
  rim.rotation.x = Math.PI / 2;
  balance.add(rim);
  for (const a of [0, Math.PI / 2]) { const arm = mesh(box(0.0064, 0.0002, 0.0003, 0.0001), gold, { cast: false }); arm.rotation.y = a; balance.add(arm); }
  const spiralPts = [];
  for (let i = 0; i <= 220; i++) { const t = i / 220, a = t * Math.PI * 2 * 9, rr = 0.0004 + t * 0.0022; spiralPts.push(new THREE.Vector3(Math.cos(a) * rr, -0.0003, Math.sin(a) * rr)); }
  const spring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(spiralPts), new THREE.LineBasicMaterial({ color: "#3a4b70" }));
  balance.add(spring);
  movement.add(balance);
  const cock = mesh(box(0.0015, 0.0006, 0.0074, 0.0003), new THREE.MeshStandardMaterial({ color: "#ffffff", map: stripes("#c0c3c6"), metalness: 1, roughness: 0.3 }));
  cock.position.set(0.0064, 0.0015, -0.0008); cock.rotation.y = 0.9;
  movement.add(cock);
  // The rotor: a half disc on a centre bearing, signed.
  const rotor = new THREE.Group();
  rotor.position.y = 0.0023;
  const rotorShape = new THREE.Shape();
  rotorShape.absarc(0, 0, 0.0119, 0, Math.PI, false);
  rotorShape.lineTo(-0.0024, 0);
  rotorShape.absarc(0, 0, 0.0024, Math.PI, 0, true);
  rotorShape.closePath();
  const rotorGeo = new THREE.ExtrudeGeometry(rotorShape, { depth: 0.0006, bevelEnabled: true, bevelThickness: 0.00015, bevelSize: 0.00015, bevelSegments: 2, curveSegments: 48 });
  const ruv = rotorGeo.attributes.uv, rp = rotorGeo.attributes.position;
  for (let i = 0; i < ruv.count; i++) ruv.setXY(i, rp.getX(i) / 0.0238 + 0.5, rp.getY(i) / 0.0238 + 0.5);
  const rotorMesh = mesh(rotorGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", map: stripes("#c4c7ca", "SEIKO  4R36  TWENTY-FOUR JEWELS"), metalness: 1, roughness: 0.26 }));
  rotorMesh.rotation.x = -Math.PI / 2;
  const bearing = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.0009, 32), screwMat);
  bearing.position.y = 0.0004;
  rotor.add(rotorMesh, bearing);
  movement.add(rotor);
  // The window, and the faucet printed on it.
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.0126, 64), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.03, transparent: true, opacity: 0.08, clearcoat: 1, envMapIntensity: 2, depthWrite: false }));
  glass.rotation.x = -Math.PI / 2; glass.position.y = 0.00005;
  const faucet = new THREE.Mesh(new THREE.PlaneGeometry(0.0236, 0.0236), new THREE.MeshStandardMaterial({ map: faucetTexture(), transparent: true, metalness: 0.9, roughness: 0.3, depthWrite: false }));
  faucet.rotation.x = -Math.PI / 2; faucet.position.y = -0.0001;
  back.add(glass, faucet);

  // The bracelet, open: three-link rows, brushed, with the folded clasp on the 12 o'clock side.
  const PITCH = 0.0062; // links sit almost edge to edge, like a real three-link bracelet
  const halves = [{ sz: -1, rows: 7 }, { sz: 1, rows: 11 }];
  const centres = new THREE.InstancedMesh(box(0.0094, 0.003, 0.0061, 0.0004, 2), brushed, 18);
  const outers = new THREE.InstancedMesh(box(0.0049, 0.0031, 0.0061, 0.0005, 2), brushed, 36);
  const ends = new THREE.InstancedMesh(box(0.0198, 0.0032, 0.0056, 0.0006, 2), brushed, 2);
  for (const m of [centres, outers, ends]) { m.castShadow = true; m.receiveShadow = true; body.add(m); }
  const claspTex = canvasTexture(256, 512, (g, w, h) => {
    const r = rng(8);
    g.fillStyle = "#c3c6c9"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * w, r() * h, w * 0.3, 1); }
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2);
    g.fillStyle = "rgba(60,62,66,0.85)"; g.font = "700 64px 'Instrument Sans', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("SEIKO", 0, 0); g.restore();
  });
  const clasp = mesh(box(0.0182, 0.0055, 0.034, 0.0015), [brushed, brushed, new THREE.MeshStandardMaterial({ map: claspTex, metalness: 1, roughness: 0.34 }), brushed, brushed, brushed]);
  body.add(clasp);
  // Each half leaves the lugs and lies on the desk; turned over, it bends the other way.
  const bend = (s, k) => {
    const down = -0.0012 + (-0.0042 + 0.0012) * THREE.MathUtils.smoothstep(s, 0, 0.012);
    const up = -0.0012 + (REST_DOWN - 0.0016 + 0.0012) * THREE.MathUtils.smoothstep(s, 0, 0.014);
    return lerp(down, up, k);
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), axis = new THREE.Vector3(1, 0, 0);
  const place = (k) => {
    let c = 0, o = 0, eI = 0;
    for (const { sz, rows } of halves) {
      const z0 = 0.0204; // just inside the lug tips
      const at = (s) => {
        const yA = bend(s, k), yB = bend(s + 0.001, k);
        q.setFromAxisAngle(axis, -sz * Math.atan2(yB - yA, 0.001));
        return yA;
      };
      let yy = at(0.0031);
      p3.set(0, yy, sz * (z0 + 0.0031)); m4.compose(p3, q, one); ends.setMatrixAt(eI++, m4);
      for (let row = 0; row < rows; row++) {
        const s = 0.0062 + PITCH * (row + 0.5);
        yy = at(s);
        p3.set(0, yy, sz * (z0 + s)); m4.compose(p3, q, one); centres.setMatrixAt(c++, m4);
        for (const ox of [-0.00725, 0.00725]) { p3.set(ox, yy + 0.00005, sz * (z0 + s)); m4.compose(p3, q, one); outers.setMatrixAt(o++, m4); }
      }
      if (sz < 0) {
        const s = 0.0062 + PITCH * rows + 0.017;
        clasp.position.set(0, at(s) + 0.0012 * (1 - 2 * k), sz * (z0 + s));
        clasp.quaternion.copy(q);
      }
    }
    for (const m of [centres, outers, ends]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  };
  place(0);

  // ------------------------------------------------------------ motion
  let charge = 1, flipped = false, flipK = 0, placedK = 0, rotorV = 0, rotorA = 0, turning = false;
  let lastT = performance.now();
  const update = (now, light) => {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    // LumiBrite charges in light, then fades fast and settles to a long dim glow in the dark.
    const lit = light.lamp * 0.65 + light.bar * 0.35;
    charge = lit > 0.3 ? Math.min(1, charge + dt * 0.5) : Math.max(0.22, charge - dt * charge * 0.035);
    const dark = clamp(1 - lit * 1.1);
    for (const m of lumeMats) m.emissiveIntensity = 0.03 + dark * charge * 2.4;
    // Time: hours and minutes glide; seconds step six times a second.
    const d = new Date();
    const ms = d.getSeconds() * 1000 + d.getMilliseconds();
    const s = motion.reduce ? Math.floor(ms / 1000) : Math.floor(ms / (1000 / 6)) / 6;
    const m = d.getMinutes() + ms / 60000;
    const h = (d.getHours() % 12) + m / 60;
    secondHand.rotation.y = -(s / 60) * Math.PI * 2;
    minuteHand.rotation.y = -(m / 60) * Math.PI * 2;
    hourHand.rotation.y = -(h / 12) * Math.PI * 2;
    if (d.getSeconds() === 0) dialTex.calendar();
    // The balance swings at 3 Hz; the rotor coasts on its bearing and settles.
    if (flipK > 0.01 && !motion.reduce) {
      const ph = (now / 1000) * Math.PI * 2 * 3;
      balance.rotation.y = Math.sin(ph) * 4.4;
      spring.scale.setScalar(1 + Math.sin(ph) * 0.05);
      const tilt = Math.sin(body.rotation.z);
      rotorV += (-Math.sin(rotorA) * 30 * Math.abs(tilt) - rotorV * 1.4) * dt;
      rotorA += rotorV * dt;
      rotor.rotation.y = rotorA;
    }
    if (Math.abs(flipK - placedK) > 1e-4) { place(flipK); placedK = flipK; }
  };

  async function turnOver() {
    if (turning) return;
    turning = true;
    flipped = !flipped;
    const from = flipped ? 0 : 1, to = flipped ? 1 : 0;
    rotorV += (flipped ? 1 : -1) * (9 + Math.random() * 4);
    await tween(1100, (k) => {
      flipK = lerp(from, to, k);
      body.rotation.z = flipK * Math.PI;
      body.position.y = lerp(REST, REST_DOWN, flipK) + Math.sin(k * Math.PI) * 0.03;
    }, "inOut");
    turning = false;
  }

  return {
    root,
    label: "Seiko × Rowing Blazers",
    sub: "My favorite watch. Take a closer look",
    view: { offset: new THREE.Vector3(0, 0.1, 0.07), target: new THREE.Vector3(0, 0.005, 0) },
    caption: () => (flipped
      ? "The 4R36 through the caseback, under a dripping faucet printed on the glass. The balance swings three times a second; the rotor winds the spring as you move."
      : "Seiko 5 Sports × Rowing Blazers × Wind Vintage Rally Diver, 38 mm, one of 2,500. It shows your time, day and date. Turn the lights down and the lume glows."),
    actions: () => [{ label: flipped ? "Turn it back" : "Turn it over", run: turnOver }],
    press: turnOver,
    reset: async () => { if (flipped) await turnOver(); },
    update,
  };
}
