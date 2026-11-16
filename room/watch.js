// An automatic dive watch, lying on the desk with its strap undone. It keeps the visitor's
// time and date, its seconds hand moves in eight steps a second (28,800 beats an hour), its
// lume charges under the lamp and glows when the lights go down, and it turns over to show
// the movement through a sapphire caseback, where the rotor swings from being moved.
//
// Local frame: the dial faces +y, 12 o'clock points to −z, the crown is at +x.

import * as THREE from "three";
import { tween, motion, canvasTexture, rng, lerp, clamp, mesh, box } from "./kit.js";

const RC = 0.0195; // case radius: a 39 mm watch
const DIAL = 0.0158;
const LUME = new THREE.Color("#8dffa6");

// ------------------------------------------------------------ textures
function dialTextures() {
  const S = 1024, C = S / 2, k = S / 2 / DIAL; // pixels per metre at the dial
  const colour = document.createElement("canvas");
  const glow = document.createElement("canvas");
  colour.width = colour.height = glow.width = glow.height = S;
  const g = colour.getContext("2d"), e = glow.getContext("2d");
  e.fillStyle = "#000"; e.fillRect(0, 0, S, S);
  // Sunburst black: thin wedges a shade lighter and darker.
  g.fillStyle = "#111315"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 360; i++) {
    g.fillStyle = i % 2 ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.05)";
    g.beginPath(); g.moveTo(C, C); g.arc(C, C, C, (i / 360) * Math.PI * 2, ((i + 1) / 360) * Math.PI * 2); g.fill();
  }
  const cream = "#efe6cf", steel = "#c9ccd0";
  // Minute track.
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    g.save(); g.translate(C, C); g.rotate(a);
    g.fillStyle = cream;
    g.fillRect(-1.6, -C + 14, 3.2, i % 5 ? 18 : 30);
    g.restore();
  }
  // Hour markers: a triangle at 12, batons at 3, 6 and 9, dots elsewhere. Each is lume in a steel surround.
  const both = (fn) => { for (const [ctx, fill, edge] of [[g, cream, steel], [e, "#fff", null]]) fn(ctx, fill, edge); };
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    if (h === 3) continue; // the date window is at 3
    both((ctx, fill, edge) => {
      ctx.save(); ctx.translate(C, C); ctx.rotate(a); ctx.translate(0, -C + 112);
      ctx.fillStyle = fill; ctx.strokeStyle = edge || fill; ctx.lineWidth = edge ? 7 : 0;
      ctx.beginPath();
      if (h === 0) { ctx.moveTo(-34, -36); ctx.lineTo(34, -36); ctx.lineTo(0, 40); ctx.closePath(); }
      else if (h % 3 === 0) ctx.rect(-15, -40, 30, 92);
      else ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill(); if (edge) ctx.stroke();
      ctx.restore();
    });
  }
  // Text at 6: a sterile dial, no maker's name.
  g.fillStyle = cream; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "600 30px 'Instrument Sans', sans-serif";
  g.fillText("AUTOMATIC", C, C + 175);
  g.font = "500 24px 'Instrument Sans', sans-serif"; g.fillStyle = "#c9573f";
  g.fillText("200 m", C, C + 212);
  const base = g.getImageData(0, 0, S, S);
  const tex = new THREE.CanvasTexture(colour);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const glowTex = new THREE.CanvasTexture(glow);
  // The date window at 3, redrawn when the day changes.
  let shown = -1;
  const date = () => {
    const d = new Date().getDate();
    if (d === shown) return;
    shown = d;
    g.putImageData(base, 0, 0);
    const x = C + C - 150, y = C;
    g.fillStyle = steel; g.fillRect(x - 40, y - 34, 80, 68);
    g.fillStyle = "#f7f5ef"; g.fillRect(x - 34, y - 28, 68, 56);
    g.fillStyle = "#16181a"; g.font = "600 44px 'Instrument Sans', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(d), x, y + 2);
    tex.needsUpdate = true;
  };
  date();
  return { map: tex, emissiveMap: glowTex, date, k };
}

function bezelTexture() {
  return canvasTexture(1024, 1024, (g, S) => {
    const C = S / 2;
    g.fillStyle = "#0c0d0e"; g.fillRect(0, 0, S, S);
    g.fillStyle = "#dcd6c8"; g.textAlign = "center"; g.textBaseline = "middle";
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      g.save(); g.translate(C, C); g.rotate(a);
      if (i === 0) {
        g.beginPath(); g.moveTo(-34, -C + 40); g.lineTo(34, -C + 40); g.lineTo(0, -C + 100); g.closePath(); g.fill();
      } else if (i % 10 === 0) {
        g.translate(0, -C + 72); g.font = "600 64px 'Barlow Condensed', sans-serif"; g.fillText(String(i), 0, 0);
      } else if (i < 15 || i % 5 === 0) {
        g.fillRect(-3, -C + 44, 6, i % 5 ? 30 : 46);
      }
      g.restore();
    }
  });
}

// Côtes de Genève on a bridge or the rotor: soft parallel bands of brushed metal.
function stripes(base, seed, { text } = {}) {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let x = -h; x < w + h; x += 46) {
      const grad = g.createLinearGradient(x, 0, x + 46, 0);
      grad.addColorStop(0, "rgba(255,255,255,0.0)"); grad.addColorStop(0.5, "rgba(255,255,255,0.22)"); grad.addColorStop(1, "rgba(0,0,0,0.12)");
      g.save(); g.translate(x + 23, h / 2); g.rotate(0.5); g.translate(-x - 23, -h / 2);
      g.fillStyle = grad; g.fillRect(x, -h, 46, h * 3); g.restore();
    }
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 1, 1); }
    if (text) {
      g.save(); g.translate(w / 2, h / 2);
      g.fillStyle = "rgba(60, 40, 10, 0.75)"; g.font = "600 30px 'Source Serif 4', serif"; g.textAlign = "center";
      const chars = [...text]; const span = Math.PI * 0.82;
      chars.forEach((ch, i) => {
        g.save(); g.rotate(-span / 2 + (i / (chars.length - 1)) * span); g.translate(0, -w * 0.4);
        g.fillText(ch, 0, 0); g.restore();
      });
      g.restore();
    }
  });
}

const perlage = () => canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = "#b9bcbf"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h + 20; y += 22) for (let x = 0; x < w + 20; x += 22) {
    const grad = g.createRadialGradient(x, y, 0, x, y, 16);
    grad.addColorStop(0, "rgba(255,255,255,0.18)"); grad.addColorStop(0.7, "rgba(0,0,0,0.08)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill();
  }
});

const leatherTexture = () => canvasTexture(256, 1024, (g, w, h) => {
  g.fillStyle = "#3b2416"; g.fillRect(0, 0, w, h);
  const r = rng(77);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,220,190"},${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
  // Stitching along both edges.
  g.fillStyle = "#cbb89a";
  for (let y = 10; y < h; y += 26) { g.fillRect(18, y, 5, 14); g.fillRect(w - 23, y, 5, 14); }
});

// ------------------------------------------------------------ geometry
function handShape(len, width, tail, tip = "sword") {
  const s = new THREE.Shape();
  s.moveTo(-width * 0.35, -tail);
  s.lineTo(width * 0.35, -tail);
  s.lineTo(width / 2, len * 0.15);
  if (tip === "sword") { s.lineTo(width / 2, len * 0.82); s.lineTo(0, len); s.lineTo(-width / 2, len * 0.82); }
  else { s.lineTo(width / 2, len); s.lineTo(-width / 2, len); }
  s.lineTo(-width / 2, len * 0.15);
  s.closePath();
  return s;
}
const flat = (shape, thick) => {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 12 });
  geo.rotateX(-Math.PI / 2); // the shape's +y becomes −z: the hand points at 12 when unrotated
  return geo;
};

// One half of the strap: a ribbon that leaves the lugs and lies on the desk. Two morph
// targets bend it toward the desk with the dial up, or the other way with the watch turned over.
function strapGeometry(length, w0, w1, tipped) {
  const T = 0.0032;
  const geo = new THREE.BoxGeometry(1, T, 1, 1, 1, 28);
  const pos = geo.attributes.position;
  const down = [], up = [];
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getZ(i) + 0.5; // 0 at the lug, 1 at the end
    let w = lerp(w0, w1, t);
    if (tipped && t > 0.9) w *= 1 - (t - 0.9) / 0.1 * 0.55;
    const x = pos.getX(i) * w, y = pos.getY(i), z = t * length;
    pos.setXYZ(i, x, y, z);
    const s = t < 0.32 ? Math.sin((t / 0.32) * Math.PI / 2) : 1;
    down.push(x, y - 0.0027 * s, z - 0.0012 * s);
    up.push(x, y + 0.0082 * s, z - 0.003 * s);
  }
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(down, 3), new THREE.Float32BufferAttribute(up, 3)];
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- watch
export function buildWatch(scene, { x, y, z, ry }) {
  const root = new THREE.Group();
  root.position.set(x, y, z); root.rotation.y = ry;
  scene.add(root);
  const body = new THREE.Group(); // turns over around the 12-6 axis
  root.add(body);
  const REST = 0.0062; // centre of the mid-case above the desk, dial up
  body.position.y = REST;

  const steel = new THREE.MeshPhysicalMaterial({ color: "#d4d7da", metalness: 1, roughness: 0.17, clearcoat: 0.3 });
  const brushed = new THREE.MeshStandardMaterial({ color: "#c3c6c9", metalness: 1, roughness: 0.36 });

  // Case: a lathe profile from the caseback edge up to the bezel seat.
  const profile = [[0.0136, -0.0062], [RC - 0.0012, -0.0058], [RC, -0.0042], [RC + 0.0004, 0.0026], [RC - 0.0002, 0.0036], [0.0172, 0.0037]].map(([r, h]) => new THREE.Vector2(r, h));
  const caseMesh = mesh(new THREE.LatheGeometry(profile, 72), steel);
  body.add(caseMesh);
  // Lugs.
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    // Each lug grows out of the case flank and turns down toward the strap.
    const lug = mesh(box(0.0034, 0.0044, 0.0118, 0.0005, 2), brushed);
    lug.position.set(sx * 0.0122, -0.0003, sz * (RC + 0.0006));
    lug.rotation.x = sz * 0.24;
    body.add(lug);
  }
  // Crown at 3.
  const crown = mesh(new THREE.CylinderGeometry(0.0033, 0.0033, 0.0032, 30), steel);
  crown.rotation.z = Math.PI / 2; crown.position.set(RC + 0.0018, 0.0002, 0);
  body.add(crown);

  // Bezel: a coin-edged ring with a black ceramic insert.
  const edge = new THREE.CylinderGeometry(RC + 0.0003, RC + 0.0003, 0.0023, 120, 1, true);
  const ep = edge.attributes.position;
  for (let i = 0; i < ep.count; i++) {
    const a = Math.atan2(ep.getZ(i), ep.getX(i));
    const s = 1 + (Math.round((a / (Math.PI * 2)) * 120) % 2 ? 0.006 : 0);
    ep.setX(i, ep.getX(i) * s); ep.setZ(i, ep.getZ(i) * s);
  }
  edge.computeVertexNormals();
  const bezel = new THREE.Group();
  bezel.position.y = 0.0048;
  bezel.add(mesh(edge, steel));
  const insert = mesh(new THREE.RingGeometry(DIAL + 0.0002, RC + 0.0001, 120, 1), new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: bezelTexture(), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 }), { cast: false });
  insert.rotation.x = -Math.PI / 2; insert.position.y = 0.00115;
  // The ring's UVs run 0..1 across its square, so the bezel texture lines up directly.
  bezel.add(insert);
  body.add(bezel);

  // Dial and hands.
  const dialTex = dialTextures();
  const lumeMats = [];
  const lume = (extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: "#efe6cf", roughness: 0.6, emissive: LUME, emissiveIntensity: 0, ...extra });
    lumeMats.push(m);
    return m;
  };
  const dial = mesh(new THREE.CircleGeometry(DIAL, 96), lume({ color: "#ffffff", map: dialTex.map, emissiveMap: dialTex.emissiveMap, roughness: 0.42, metalness: 0.2 }), { cast: false });
  dial.rotation.x = -Math.PI / 2; dial.position.y = 0.0028;
  body.add(dial);
  const hands = new THREE.Group();
  hands.position.y = 0.0031;
  body.add(hands);
  const makeHand = (len, width, tail, y, lumed = true, tip = "sword") => {
    const h = new THREE.Group();
    h.position.y = y;
    h.add(mesh(flat(handShape(len, width, tail, tip), 0.00025), steel));
    if (lumed) {
      const fill = mesh(flat(handShape(len * 0.86, width * 0.56, -len * 0.18, tip), 0.0001), lume(), { cast: false });
      fill.position.y = 0.00026;
      h.add(fill);
    }
    hands.add(h);
    return h;
  };
  const hourHand = makeHand(0.0098, 0.0021, 0.0018, 0);
  const minuteHand = makeHand(0.0146, 0.0016, 0.0022, 0.0004);
  const secondHand = new THREE.Group();
  secondHand.position.y = 0.0009;
  const secMat = new THREE.MeshPhysicalMaterial({ color: "#d9dcdf", metalness: 1, roughness: 0.2 });
  const secShaft = mesh(box(0.00035, 0.0002, 0.0205, 0.0001), secMat, { cast: false });
  secShaft.position.z = -0.0057;
  const lolly = mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.0003, 24), lume(), { cast: false });
  lolly.position.z = -0.0108;
  const tip = mesh(box(0.0004, 0.00022, 0.0024, 0.0001), new THREE.MeshStandardMaterial({ color: "#c9573f", roughness: 0.5 }), { cast: false });
  tip.position.z = -0.0148;
  const hub = mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.0005, 20), steel, { cast: false });
  secondHand.add(secShaft, lolly, tip, hub);
  hands.add(secondHand);

  // Crystal: a shallow sapphire dome, nearly invisible but for its reflections.
  const crystal = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 64, 8, 0, Math.PI * 2, 0, Math.asin(DIAL / 0.05)),
    new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.02, transparent: true, opacity: 0.1, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false }),
  );
  crystal.position.y = 0.0062 - 0.05 + 0.0002;
  body.add(crystal);

  // Caseback: a steel ring with a sapphire window over the movement.
  const back = new THREE.Group();
  back.position.y = -0.0062;
  back.rotation.z = Math.PI; // faces −y; turned over with the watch, it reads the right way round
  body.add(back);
  const ringTex = canvasTexture(1024, 1024, (g, S) => {
    const C = S / 2;
    g.fillStyle = "#c6c9cc"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.beginPath(); g.arc(C, C, 380 + Math.random() * 130, 0, 7); g.stroke(); }
    g.fillStyle = "rgba(40,42,46,0.75)"; g.font = "500 30px 'Instrument Sans', sans-serif"; g.textAlign = "center";
    const text = "STAINLESS STEEL  ·  WATER RESISTANT 200 M  ·  SAPPHIRE CRYSTAL  ·  AUTOMATIC  ·  ";
    [...text].forEach((ch, i) => { g.save(); g.translate(C, C); g.rotate((i / text.length) * Math.PI * 2); g.fillText(ch, 0, -C + 70); g.restore(); });
  });
  const ring = mesh(new THREE.RingGeometry(0.0138, RC - 0.0012, 96), new THREE.MeshStandardMaterial({ color: "#ffffff", map: ringTex, metalness: 1, roughness: 0.3 }), { cast: false });
  ring.rotation.x = -Math.PI / 2;
  back.add(ring);
  const movement = new THREE.Group();
  movement.position.y = -0.0036;
  back.add(movement);
  const plate = mesh(new THREE.CircleGeometry(0.0136, 72), new THREE.MeshStandardMaterial({ color: "#ffffff", map: perlage(), metalness: 1, roughness: 0.38 }), { cast: false });
  plate.rotation.x = -Math.PI / 2;
  movement.add(plate);
  // A three-quarter bridge with Côtes de Genève, cut away where the balance sits.
  const bridgeShape = new THREE.Shape();
  bridgeShape.absarc(0, 0, 0.0128, 1.1, Math.PI * 2 - 0.6, false);
  bridgeShape.lineTo(0.0012, 0);
  bridgeShape.closePath();
  const bridge = mesh(new THREE.ExtrudeGeometry(bridgeShape, { depth: 0.0008, bevelEnabled: true, bevelThickness: 0.0002, bevelSize: 0.0002, bevelSegments: 2, curveSegments: 40 }), new THREE.MeshStandardMaterial({ color: "#ffffff", map: stripes("#c0c3c6", 3), metalness: 1, roughness: 0.3 }));
  bridge.rotation.x = -Math.PI / 2; bridge.position.y = 0.0001;
  bridge.material.map.repeat.set(30, 30);
  bridge.material.map.wrapS = bridge.material.map.wrapT = THREE.RepeatWrapping;
  movement.add(bridge);
  const ruby = new THREE.MeshPhysicalMaterial({ color: "#9e0b2b", roughness: 0.08, clearcoat: 1, sheen: 0.5 });
  const blued = new THREE.MeshStandardMaterial({ color: "#1d3a8c", metalness: 1, roughness: 0.25 });
  for (const [jx, jz] of [[-0.006, -0.006], [-0.008, 0.004], [0.002, -0.009], [-0.002, 0.008], [0.0065, 0.0062]]) {
    const j = mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.0004, 16), ruby, { cast: false });
    j.position.set(jx, 0.0011, jz); movement.add(j);
  }
  for (const [sx, sz] of [[-0.011, -0.002], [-0.004, -0.011], [0.005, 0.0105], [-0.009, 0.007], [0.0105, -0.0035]]) {
    const s = mesh(new THREE.CylinderGeometry(0.00065, 0.00065, 0.0003, 14), blued, { cast: false });
    s.position.set(sx, 0.0011, sz); movement.add(s);
  }
  // Balance wheel and hairspring in the cut-away, at about 4 o'clock seen from the back.
  const balance = new THREE.Group();
  balance.position.set(0.0068, 0.0005, -0.0008);
  const glucydur = new THREE.MeshStandardMaterial({ color: "#d6b46a", metalness: 1, roughness: 0.25 });
  balance.add(mesh(new THREE.TorusGeometry(0.0034, 0.00035, 8, 48), glucydur, { cast: false }));
  balance.children[0].rotation.x = Math.PI / 2;
  for (const a of [0, Math.PI / 2]) {
    const arm = mesh(box(0.0068, 0.0002, 0.0003, 0.0001), glucydur, { cast: false });
    arm.rotation.y = a; balance.add(arm);
  }
  const spiralPts = [];
  for (let i = 0; i <= 220; i++) { const t = i / 220, a = t * Math.PI * 2 * 9, rr = 0.0004 + t * 0.0024; spiralPts.push(new THREE.Vector3(Math.cos(a) * rr, -0.0003, Math.sin(a) * rr)); }
  const spring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(spiralPts), new THREE.LineBasicMaterial({ color: "#3a4b70" }));
  balance.add(spring);
  movement.add(balance);
  const cock = mesh(box(0.0016, 0.0006, 0.0078, 0.0003), new THREE.MeshStandardMaterial({ color: "#ffffff", map: stripes("#c0c3c6", 5), metalness: 1, roughness: 0.3 }));
  cock.position.set(0.0068, 0.0015, -0.0008); cock.rotation.y = 0.9;
  movement.add(cock);
  const cockJewel = mesh(new THREE.CylinderGeometry(0.00055, 0.00055, 0.0003, 16), ruby, { cast: false });
  cockJewel.position.set(0.0068, 0.0019, -0.0008);
  movement.add(cockJewel);
  // The rotor: a half disc on a centre bearing, with its specification engraved.
  const rotor = new THREE.Group();
  rotor.position.y = 0.0023;
  const rotorShape = new THREE.Shape();
  rotorShape.absarc(0, 0, 0.0128, 0, Math.PI, false);
  rotorShape.lineTo(-0.0024, 0);
  rotorShape.absarc(0, 0, 0.0024, Math.PI, 0, true);
  rotorShape.closePath();
  const rotorGeo = new THREE.ExtrudeGeometry(rotorShape, { depth: 0.0006, bevelEnabled: true, bevelThickness: 0.00015, bevelSize: 0.00015, bevelSegments: 2, curveSegments: 48 });
  // Map the rotor's texture across its own disc.
  const ruv = rotorGeo.attributes.uv, rp = rotorGeo.attributes.position;
  for (let i = 0; i < ruv.count; i++) ruv.setXY(i, rp.getX(i) / 0.0256 + 0.5, rp.getY(i) / 0.0256 + 0.5);
  const rotorMesh = mesh(rotorGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", map: stripes("#cfa65a", 9, { text: "AUTOMATIC  28,800 A/h  25 JEWELS" }), metalness: 1, roughness: 0.26 }));
  rotorMesh.rotation.x = -Math.PI / 2;
  const bearing = mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.0009, 32), new THREE.MeshStandardMaterial({ color: "#c9ccd0", metalness: 1, roughness: 0.2 }));
  bearing.position.y = 0.0004;
  rotor.add(rotorMesh, bearing);
  movement.add(rotor);
  const window_ = new THREE.Mesh(new THREE.CircleGeometry(0.0139, 64), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.03, transparent: true, opacity: 0.08, clearcoat: 1, envMapIntensity: 2, depthWrite: false }));
  window_.rotation.x = -Math.PI / 2; window_.position.y = 0.00005;
  back.add(window_);

  // Strap: brown leather, undone, the buckle side short and the holed side long.
  const leather = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: leatherTexture(), roughness: 0.62, sheen: 0.4, sheenColor: new THREE.Color("#6b4a33") });
  const straps = [];
  const strapAt = (sz, length, tipped) => {
    const s = mesh(strapGeometry(length, 0.02, 0.016, tipped), leather);
    s.morphTargetInfluences = [1, 0];
    s.position.set(0, -0.0021, sz * (RC + 0.006));
    if (sz < 0) s.rotation.y = Math.PI;
    body.add(s);
    straps.push(s);
    return s;
  };
  const shortStrap = strapAt(-1, 0.07, false);
  strapAt(1, 0.105, true);
  // The buckle at the end of the short side.
  const buckleShape = new THREE.Shape();
  buckleShape.moveTo(-0.0105, 0); buckleShape.lineTo(0.0105, 0); buckleShape.lineTo(0.0105, 0.016); buckleShape.lineTo(-0.0105, 0.016); buckleShape.closePath();
  buckleShape.holes.push(new THREE.Path().moveTo(-0.0085, 0.0018).lineTo(0.0085, 0.0018).lineTo(0.0085, 0.0142).lineTo(-0.0085, 0.0142).closePath());
  const buckle = mesh(new THREE.ExtrudeGeometry(buckleShape, { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 2 }), steel);
  buckle.rotation.x = Math.PI / 2;
  buckle.position.set(0, 0.0004, 0.068);
  shortStrap.add(buckle);

  // ------------------------------------------------------------ motion
  let charge = 1, flipped = false, flipK = 0, rotorV = 0, rotorA = 0, turning = false;
  let lastT = performance.now();
  const update = (now, light) => {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    // Lume: charges in light, then fades fast and settles to a long dim glow in the dark.
    const lit = light.lamp * 0.65 + light.bar * 0.35;
    charge = lit > 0.3 ? Math.min(1, charge + dt * 0.5) : Math.max(0.22, charge - dt * charge * 0.035);
    const dark = clamp(1 - lit * 1.1);
    for (const m of lumeMats) m.emissiveIntensity = (0.03 + dark * charge * 2.4);
    // Time: hours and minutes glide; seconds step at 8 beats a second.
    const d = new Date();
    const ms = d.getSeconds() * 1000 + d.getMilliseconds();
    const beats = motion.reduce ? Math.floor(ms / 1000) * 8 : Math.floor(ms / 125);
    const s = beats / 8;
    const m = d.getMinutes() + ms / 60000;
    const h = (d.getHours() % 12) + m / 60;
    secondHand.rotation.y = -(s / 60) * Math.PI * 2;
    minuteHand.rotation.y = -(m / 60) * Math.PI * 2;
    hourHand.rotation.y = -(h / 12) * Math.PI * 2;
    if (d.getSeconds() === 0) dialTex.date();
    // The balance swings at 4 Hz through about 270 degrees; the hairspring breathes with it.
    if (flipK > 0.01 && !motion.reduce) {
      const a = Math.sin(now / 1000 * Math.PI * 2 * 4) * 4.4;
      balance.rotation.y = a;
      spring.scale.setScalar(1 + Math.sin(now / 1000 * Math.PI * 2 * 4) * 0.05);
      // The rotor coasts on its bearing and settles where gravity pulls it.
      const tilt = Math.sin(body.rotation.z);
      rotorV += (-Math.sin(rotorA) * 30 * Math.abs(tilt) - rotorV * 1.4) * dt;
      rotorA += rotorV * dt;
      rotor.rotation.y = rotorA;
    }
    for (const st of straps) st.morphTargetInfluences = [1 - flipK, flipK];
    buckle.position.y = lerp(-0.0023, 0.0078, flipK);
  };

  async function turnOver() {
    if (turning) return;
    turning = true;
    flipped = !flipped;
    const from = flipped ? 0 : 1, to = flipped ? 1 : 0;
    // Turning it over spins the rotor: it's a weight on a bearing.
    rotorV += (flipped ? 1 : -1) * (9 + Math.random() * 4);
    const restUp = REST, restDown = 0.0065; // dial-up and dial-down centre heights
    await tween(1100, (k) => {
      flipK = lerp(from, to, k);
      body.rotation.z = flipK * Math.PI;
      body.position.y = lerp(restUp, restDown, flipK) + Math.sin(k * Math.PI) * 0.03;
    }, "inOut");
    turning = false;
    return flipped;
  }

  const item = {
    root,
    label: "Automatic watch",
    sub: "Take a closer look",
    view: { offset: new THREE.Vector3(0, 0.105, 0.075), target: new THREE.Vector3(0, 0.006, 0) },
    caption: () => (flipped
      ? "The movement, through the caseback. The balance swings eight times a second; the rotor winds the spring when you move."
      : "It keeps your time and today’s date. Turn the lights down and the hands glow."),
    actions: () => [{ label: flipped ? "Turn it back" : "Turn it over", run: turnOver }],
    press: turnOver,
    reset: async () => { if (flipped) await turnOver(); },
    update,
  };
  return item;
}
