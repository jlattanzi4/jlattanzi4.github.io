// A snow globe: a mountain with a chairlift that runs, in water under glass. Shake it and
// the snow lifts off the slopes, swirls, and takes about ten seconds to settle again.

import * as THREE from "three";
import { tween, motion, canvasTexture, rng, mesh, clamp } from "./kit.js";

const R = 0.047;         // the glass ball
const RIN = R - 0.0035;  // inside the glass
const CY = 0.064;        // the ball's centre above the desk
const GROUND = 0.0405;   // the snowy ground inside, just above the base
const FLOOR_R = 0.0352;  // the glass's inside radius at the ground
const PEAK = { x: -0.005, z: -0.006, h: 0.05, r: 0.036 };

// Height of the mountain above the ground at (x, z), relative to the ball's axis.
function height(x, z) {
  const d = Math.hypot(x - PEAK.x, z - PEAK.z);
  const main = Math.pow(Math.max(0, 1 - d / PEAK.r), 1.35) * PEAK.h;
  const d2 = Math.hypot(x - 0.017, z + 0.004);
  const shoulder = Math.pow(Math.max(0, 1 - d2 / 0.02), 1.6) * 0.018;
  // Ridges and gullies running down from the summit, sharper higher up.
  const a = Math.atan2(z - PEAK.z, x - PEAK.x);
  const ridges = (Math.sin(a * 7 + d * 120) * 0.6 + Math.sin(a * 13 - d * 260) * 0.4) * 0.0032 * Math.min(1, main / 0.012)
    + (Math.sin(x * 260 + z * 90) * 0.5 + Math.sin(z * 310 - x * 70) * 0.5) * 0.0012;
  const rim = clamp((FLOOR_R - 0.001 - Math.hypot(x, z)) / 0.007);
  return Math.max(0, main + shoulder + ridges) * rim + 0.0012 * rim;
}

export function buildGlobe(scene, { x, y, z, ry }) {
  const root = new THREE.Group();
  root.position.set(x, y, z); root.rotation.y = ry;
  scene.add(root);
  const shaker = new THREE.Group();
  root.add(shaker);

  // A turned walnut base with a brass plaque.
  const base = mesh(new THREE.LatheGeometry([[0, 0], [0.046, 0], [0.047, 0.004], [0.045, 0.016], [0.0425, 0.033], [0.041, 0.04], [0, 0.04]].map(([a, b]) => new THREE.Vector2(a, b)), 64),
    new THREE.MeshPhysicalMaterial({ color: "#3b2416", roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  shaker.add(base);
  const plaqueTex = canvasTexture(512, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#d8b56a"); grad.addColorStop(0.5, "#b8914a"); grad.addColorStop(1, "#d2ad62");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(50, 32, 8, 0.85)"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "600 54px 'Source Serif 4', serif";
    g.fillText("First chair", w / 2, h / 2 + 4);
  });
  // A band of the base's taper, a hair proud of the wood.
  const plaque = mesh(new THREE.CylinderGeometry(0.0437, 0.04515, 0.01, 48, 1, true, -0.55, 1.1), new THREE.MeshStandardMaterial({ color: "#ffffff", map: plaqueTex, metalness: 0.55, roughness: 0.35 }), { cast: false });
  plaque.position.y = 0.0215;
  shaker.add(plaque);

  // Inside: a mountain on a snowy ground, rock where it's steep.
  const geo = new THREE.RingGeometry(0.0004, FLOOR_R, 96, 40);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), pz = -pos.getY(i);
    pos.setXYZ(i, px, GROUND + height(px, pz), pz);
  }
  geo.computeVertexNormals();
  const colours = [];
  const snow = new THREE.Color("#f3f6fa"), rock = new THREE.Color("#4a4642"), rockN = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const steep = 1 - rockN.getY(i);
    const k = THREE.MathUtils.smoothstep(steep, 0.2, 0.42);
    const c = snow.clone().lerp(rock, k * 0.85);
    colours.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  const land = mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  shaker.add(land);

  // Pines below the tree line.
  const r = rng(61);
  const pine = new THREE.MeshStandardMaterial({ color: "#1d3a26", roughness: 0.85 });
  let placed = 0;
  while (placed < 16) {
    const a = r() * Math.PI * 2, d = 0.012 + r() * 0.019;
    const tx = Math.cos(a) * d, tz = Math.sin(a) * d;
    const h0 = height(tx, tz);
    if (h0 > 0.012 || (tx > 0.012 && tz > 0.0 && tz < 0.02)) continue; // keep the lift line clear
    const s = 0.75 + r() * 0.6;
    const tree = mesh(new THREE.ConeGeometry(0.0034 * s, 0.013 * s, 7), pine);
    tree.position.set(tx, GROUND + h0 + 0.0062 * s, tz);
    shaker.add(tree);
    placed++;
  }

  // A chairlift: a cable loop on three towers, chairs going up one side and down the other.
  const bottom = new THREE.Vector3(0.027, 0, 0.012), top = new THREE.Vector3(0.001, 0, -0.005);
  bottom.y = GROUND + height(bottom.x, bottom.z) + 0.0075;
  top.y = GROUND + height(top.x, top.z) + 0.0062;
  const across = new THREE.Vector3().subVectors(top, bottom).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.0016);
  const metal = new THREE.MeshStandardMaterial({ color: "#2a2b2e", metalness: 0.6, roughness: 0.5 });
  for (const t of [0, 0.5, 1]) {
    const p = bottom.clone().lerp(top, t);
    const g0 = GROUND + height(p.x, p.z);
    const pole = mesh(new THREE.CylinderGeometry(0.00035, 0.00045, p.y - g0, 6), metal);
    pole.position.set(p.x, (p.y + g0) / 2, p.z);
    const arm = mesh(new THREE.BoxGeometry(0.0042, 0.0004, 0.0004), metal);
    arm.position.copy(p); arm.lookAt(p.clone().add(across)); arm.rotateY(Math.PI / 2);
    shaker.add(pole, arm);
  }
  const lineUp = [bottom.clone().add(across), top.clone().add(across)];
  const lineDown = [top.clone().sub(across), bottom.clone().sub(across)];
  const cable = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([...lineUp, ...lineDown]), new THREE.LineBasicMaterial({ color: "#222" }));
  shaker.add(cable);
  const chairs = [];
  const chairMat = new THREE.MeshStandardMaterial({ color: "#b8141c", roughness: 0.5 });
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Group();
    const seat = mesh(new THREE.BoxGeometry(0.0022, 0.0006, 0.0014), chairMat, { cast: false });
    seat.position.y = -0.0026;
    const hanger = mesh(new THREE.BoxGeometry(0.0002, 0.0026, 0.0002), metal, { cast: false });
    hanger.position.y = -0.0013;
    c.add(seat, hanger);
    c.userData.phase = i / 10;
    shaker.add(c);
    chairs.push(c);
  }
  const placeChairs = (t) => {
    for (const c of chairs) {
      const u = (c.userData.phase + t) % 1;
      const [a, b] = u < 0.5 ? lineUp : lineDown;
      c.position.copy(a).lerp(b, (u % 0.5) * 2);
    }
  };

  // Snow: points that drift down through the water and settle where they land.
  const N = 520;
  const p = new Float32Array(N * 3), v = new Float32Array(N * 3), settled = new Uint8Array(N);
  const groundAt = (px, pz) => GROUND + height(px, pz) + 0.0005;
  const sprinkle = (i, floating) => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (FLOOR_R - 0.002);
    const px = Math.cos(a) * d, pz = Math.sin(a) * d;
    p[i * 3] = px; p[i * 3 + 2] = pz;
    if (floating) { p[i * 3 + 1] = groundAt(px, pz) + r() * (CY + RIN * 0.8 - groundAt(px, pz)); settled[i] = 0; }
    else { p[i * 3 + 1] = groundAt(px, pz); settled[i] = 1; }
  };
  // It was shaken a little while ago: some snow is still coming down when you sit down.
  for (let i = 0; i < N; i++) sprinkle(i, r() < 0.35);
  const flakeTex = canvasTexture(32, 32, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.6, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, w, w);
  });
  const flakesGeo = new THREE.BufferGeometry();
  flakesGeo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const flakes = new THREE.Points(flakesGeo, new THREE.PointsMaterial({ color: "#ffffff", size: 0.0012, map: flakeTex, alphaTest: 0.5, sizeAttenuation: true }));
  flakes.frustumCulled = false;
  shaker.add(flakes);

  // The glass.
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(R, 72, 48, 0, Math.PI * 2, 0, Math.PI * 0.71),
    // Clear glass: reflections and a faint tint, no refraction, so the scene inside stays sharp.
    new THREE.MeshPhysicalMaterial({ color: "#dfeaf2", roughness: 0.03, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2, depthWrite: false }),
  );
  glass.position.y = CY;
  shaker.add(glass);

  let last = performance.now(), active = 1;
  const update = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    placeChairs((now / 1000) * 0.012);
    if (!active) return;
    let moving = 0;
    const drag = Math.exp(-dt * 2.4);
    for (let i = 0; i < N; i++) {
      if (settled[i]) continue;
      moving++;
      const j = i * 3;
      v[j] *= drag; v[j + 1] = v[j + 1] * drag - 0.011 * dt; v[j + 2] *= drag;
      // A slow swirl around the axis, fading with the rest of the motion.
      const swirl = 0.6 * dt;
      const vx = v[j], vz = v[j + 2];
      v[j] = vx - p[j + 2] * swirl * Math.hypot(vx, vz) * 40; v[j + 2] = vz + p[j] * swirl * Math.hypot(vx, vz) * 40;
      p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      // Stay inside the glass.
      const dx = p[j], dy = p[j + 1] - CY, dz = p[j + 2], d = Math.hypot(dx, dy, dz);
      if (d > RIN - 0.001) { const k = (RIN - 0.001) / d; p[j] = dx * k; p[j + 1] = CY + dy * k; p[j + 2] = dz * k; v[j] *= -0.3; v[j + 1] *= -0.3; v[j + 2] *= -0.3; }
      const gnd = groundAt(p[j], p[j + 2]);
      if (p[j + 1] <= gnd) { p[j + 1] = gnd; if (v[j + 1] < 0.01) { settled[i] = 1; v[j] = v[j + 1] = v[j + 2] = 0; } }
    }
    flakesGeo.attributes.position.needsUpdate = true;
    if (!moving) active = 0;
  };

  async function shake() {
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      if (motion.reduce) { sprinkle(i, false); continue; }
      const lift = settled[i] || r() < 0.7;
      if (!lift) continue;
      settled[i] = 0;
      const a = Math.atan2(p[j + 2], p[j]);
      v[j] = (r() - 0.5) * 0.06 - Math.sin(a) * 0.05;
      v[j + 1] = 0.05 + r() * 0.09;
      v[j + 2] = (r() - 0.5) * 0.06 + Math.cos(a) * 0.05;
    }
    active = 1;
    flakesGeo.attributes.position.needsUpdate = true;
    await tween(800, (k) => {
      const f = Math.sin(k * Math.PI * 5) * (1 - k);
      shaker.rotation.z = f * 0.14; shaker.rotation.x = f * 0.06;
      shaker.position.y = Math.abs(f) * 0.012;
    }, "linear");
  }

  return {
    root,
    label: "Snow globe",
    sub: "Give it a shake",
    view: { offset: new THREE.Vector3(0, 0.1, 0.2), target: new THREE.Vector3(0, 0.062, 0) },
    caption: () => "The lift runs all year in here. Shake it again.",
    actions: () => [{ label: "Shake it", run: shake }],
    press: shake,
    onInspect: shake,
    update,
  };
}
