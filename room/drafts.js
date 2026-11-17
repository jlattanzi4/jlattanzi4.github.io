// Crumpled drafts by the keyboard: things I tried and cut, and why. Click one and it
// uncrumples into a flat sheet with its note; "Unfold another" crumples it back and opens
// the next.
//
// The paper is one sheet of geometry with two shapes: lying flat, and wrapped into a ball
// (the square folded over a sphere, octahedron-style, so it covers it once, then creased with
// a few ridges of noise). Unfolding is a blend from one to the other. The triangles don't
// share vertices, so each one is lit flat and the creases read as creases.

import * as THREE from "three";
import { canvasTexture, wrapText, rng, tween, motion, M } from "./kit.js";

const NOTES = [
  ["Ambient occlusion", "Halved the frame rate for a difference you had to squint to see."],
  ["AirPods, standing up", "Nobody stands their AirPods up."],
  ["Energy demand forecasting", "Its baseline was too weak to prove anything. Archived until it faces a real one."],
  ["A research assistant on Claude 3", "The models were retired. So was it."],
  ["This site, twice", "A tidy list, then cards on a desk. Both fine. Neither fun."],
];

const W = 0.15, H = 0.19, SX = 18, SY = 24, R = 0.026;

// A sheet from a notepad, in my handwriting, the title struck through.
function noteTexture([title, body]) {
  return canvasTexture(600, 760, (g, w, h) => {
    g.fillStyle = "#f6f3ea"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,130,190,0.35)"; g.lineWidth = 2;
    for (let y = 150; y < h; y += 52) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = "rgba(210,70,70,0.45)";
    g.beginPath(); g.moveTo(64, 0); g.lineTo(64, h); g.stroke();
    g.fillStyle = "#1d2a4a"; g.textBaseline = "alphabetic";
    g.font = "600 58px Caveat, cursive";
    const end = wrapText(g, title, 88, 130, 480, 56);
    const tw = Math.min(480, g.measureText(title).width);
    g.strokeStyle = "rgba(200,40,40,0.85)"; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(80, end - 76); g.quadraticCurveTo(80 + tw / 2, end - 88, 96 + tw, end - 80); g.stroke();
    g.font = "600 46px Caveat, cursive";
    wrapText(g, body, 88, end + 52, 470, 52);
  });
}
const blankTexture = () => noteTexture(["", ""]);

// Square to sphere: the octahedral wrap, then squashed a little and creased.
function crumpledPositions(base, seed) {
  const r = rng(seed);
  const ridges = Array.from({ length: 7 }, () => ({ d: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), f: 5 + r() * 6, ph: r() * 6, a: 0.03 + r() * 0.045 }));
  const uv = base.attributes.uv, out = new Float32Array(uv.count * 3), d = new THREE.Vector3();
  for (let i = 0; i < uv.count; i++) {
    let x = uv.getX(i) * 2 - 1, y = uv.getY(i) * 2 - 1;
    const z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0) { const ox = x; x = (1 - Math.abs(y)) * Math.sign(ox || 1); y = (1 - Math.abs(ox)) * Math.sign(y || 1); }
    d.set(x, z, y).normalize();
    let k = 1;
    for (const g of ridges) k += g.a * (Math.abs(Math.sin(d.dot(g.d) * g.f + g.ph)) - 0.5);
    out[i * 3] = d.x * R * k; out[i * 3 + 1] = (d.y * 0.85 + 0.85) * R * k; out[i * 3 + 2] = d.z * R * k;
  }
  return out;
}

export function buildDrafts(scene, { x, y, z, ry = 0 }) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = ry;
  scene.add(root);

  // The sheet, flat, its top toward the monitor. Opened, it's held up above the other drafts
  // and tipped toward you, the way you'd smooth one out to read it.
  const base = new THREE.PlaneGeometry(W, H, SX, SY).toNonIndexed();
  base.rotateX(-Math.PI / 2);
  const held = base.clone();
  held.rotateX(0.5);
  held.translate(0, 0.085, 0.015);
  // Smoothed out, it keeps its creases: a few ridges across it, a couple of millimetres deep.
  const flat = held.attributes.position.array.slice();
  {
    const r = rng(5), uv = held.attributes.uv, n = new THREE.Vector3(0, Math.cos(0.5), Math.sin(0.5));
    const ridges = Array.from({ length: 6 }, () => ({ a: r() * Math.PI, f: 9 + r() * 14, ph: r() * 6, h: 0.0006 + r() * 0.0008 }));
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      let w = 0;
      for (const g of ridges) w += g.h * (Math.abs(Math.sin((u * Math.cos(g.a) + v * Math.sin(g.a)) * g.f + g.ph)) - 0.5);
      flat[i * 3] += n.x * w; flat[i * 3 + 1] += n.y * w; flat[i * 3 + 2] += n.z * w;
    }
  }

  const paper = (map) => M("#ffffff", 0.85, 0, { map, side: THREE.DoubleSide });
  // Average the normals where corners of the sheet meet, k of the way: 0 is every facet lit
  // flat (sharp creases), 1 is smooth.
  const corners = new Map();
  for (let i = 0; i < base.attributes.uv.count; i++) {
    const key = `${base.attributes.uv.getX(i).toFixed(4)},${base.attributes.uv.getY(i).toFixed(4)}`;
    if (!corners.has(key)) corners.set(key, []);
    corners.get(key).push(i);
  }
  const avg = new THREE.Vector3(), one = new THREE.Vector3();
  function smooth(nor, k) {
    for (const group of corners.values()) {
      avg.set(0, 0, 0);
      for (const i of group) avg.add(one.fromBufferAttribute(nor, i));
      avg.normalize();
      for (const i of group) one.fromBufferAttribute(nor, i).lerp(avg, k).normalize().toArray(nor.array, i * 3);
    }
    nor.needsUpdate = true;
  }
  const blank = blankTexture();
  const spots = [[-0.02, 0.012, 0.3], [0.045, -0.01, 1.7], [0.0, -0.045, 3.1]];
  const balls = spots.map(([bx, bz, spin], i) => {
    const geo = base.clone();
    geo.setAttribute("position", new THREE.BufferAttribute(crumpledPositions(base, 11 + i * 7), 3));
    geo.computeVertexNormals();
    smooth(geo.attributes.normal, 0.55); // creased, but still paper
    const ball = new THREE.Mesh(geo, paper(blank));
    ball.castShadow = true; // not on itself: a crumpled ball in its own shadow looks like a rock
    ball.position.set(bx, 0, bz);
    ball.rotation.y = spin;
    root.add(ball);
    return ball;
  });

  const notes = NOTES.map(noteTexture);
  const sheetGeo = base.clone();
  const sheet = new THREE.Mesh(sheetGeo, paper(notes[0]));
  sheet.castShadow = true;
  sheet.visible = false;
  root.add(sheet);

  // Blend the sheet between a ball (in the ball's place) and smoothed out; the light smooths
  // over its creases as it opens.
  let from = null, at = 0;
  const pos = sheetGeo.attributes.position;
  const local = new THREE.Vector3();
  function shape(k) {
    const ball = balls[open];
    for (let i = 0; i < pos.count; i++) {
      local.fromArray(from, i * 3).applyEuler(ball.rotation).add(ball.position);
      const fx = flat[i * 3], fy = flat[i * 3 + 1], fz = flat[i * 3 + 2];
      pos.setXYZ(i, local.x + (fx - local.x) * k, local.y + (fy - local.y) * k + Math.sin(k * Math.PI) * 0.04, local.z + (fz - local.z) * k);
    }
    pos.needsUpdate = true;
    sheetGeo.computeVertexNormals();
    smooth(sheetGeo.attributes.normal, 0.55 + 0.45 * k);
    at = k;
  }

  let open = null, note = 0, ballNext = 0;
  async function unfold() {
    open = ballNext;
    from = balls[open].geometry.attributes.position.array;
    sheet.material.map = notes[note];
    balls[open].visible = false;
    sheet.visible = true;
    shape(0);
    await tween(motion.reduce ? 0 : 1000, (k) => shape(k), "inOut");
  }
  async function crumple(ms = 650) {
    if (open == null) return;
    const start = at;
    await tween(motion.reduce ? 0 : ms, (k) => shape(start * (1 - k)), "inOut");
    sheet.visible = false;
    balls[open].visible = true;
    open = null;
  }
  let busy = false;
  async function another() {
    if (busy) return;
    busy = true;
    try {
      await crumple();
      note = (note + 1) % notes.length;
      ballNext = (ballNext + 1) % balls.length;
      await unfold();
    } finally { busy = false; }
  }

  return {
    root,
    label: "Crumpled drafts",
    sub: "Things I tried and cut. Unfold one",
    view: { offset: new THREE.Vector3(0, 0.33, 0.2), target: new THREE.Vector3(0, 0.07, 0.01) },
    caption: () => `${NOTES[note][0]}: ${NOTES[note][1]}`,
    actions: () => [{ label: "Unfold another", run: another }],
    onInspect: () => { if (open == null) { busy = true; unfold().finally(() => { busy = false; }); } },
    // Leaving crumples it back, and the next visit opens the next one.
    reset: () => { crumple(400).then(() => { note = (note + 1) % notes.length; ballNext = (ballNext + 1) % balls.length; }); },
    press: () => another(),
  };
}
