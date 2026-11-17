// Shared tools for building the desk: tweens, canvas textures, materials, and shape helpers.
// Everything is at real-world size, in metres. The desk top is at y = TOP.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const TOP = 0.75;

// ------------------------------------------------------------- tweens
const tweens = new Set();
export const motion = { reduce: false };
export const ease = {
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
export const tweening = () => tweens.size > 0;
export function stepTweens(now) {
  for (const t of tweens) {
    // A frame's timestamp can come from just before the tween started; never go below 0.
    const p = Math.min(1, Math.max(0, (now - t.start) / t.duration));
    t.onUpdate(t.curve(p));
    if (p >= 1) { tweens.delete(t); t.done(); }
  }
}
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// --------------------------------------------------------------- data
// A JSON file from this site, or null: the desk does without anything that doesn't load.
export async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------- textures
export function canvasTexture(w, h, draw, { repeat, color = true } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat); }
  return tex;
}

export function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function wrapText(ctx, text, x, y, width, lineHeight, each) {
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

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// The average colour of an image, a little deepened: what a book's spine looks like next to its cover.
export function averageColor(img) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0, gr = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return new THREE.Color(r / n / 255, gr / n / 255, b / n / 255).convertSRGBToLinear();
}

// ------------------------------------------------------------ materials
export const M = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
export const P = (color, roughness, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.6, clearcoatRoughness: 0.25, ...extra });

// ------------------------------------------------------------ geometry
export const box = (w, h, d, r = 0.002, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2));
export function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
export function at(obj, x, y, z, ry = 0) { obj.position.set(x, y, z); obj.rotation.y = ry; return obj; }
