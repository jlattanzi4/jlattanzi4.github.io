// A three-key macro pad for working with an AI agent: Accept, Continue, Reject, and a knob
// for how hard it should think. A small OLED answers. The Accept key is worn shiny.

import * as THREE from "three";
import { tween, canvasTexture, mesh, box } from "./kit.js";

const KEYS = [
  { id: "accept", label: "Accept", cap: "#5f7f63", ink: "#e7efe2", worn: true, glow: "#7dffa0", says: ["accepted", "tests pass. shipping it"] },
  { id: "continue", label: "Continue", cap: "#e8e3d6", ink: "#2a2a28", glow: "#ffe2b0", says: ["continuing", "still going"] },
  { id: "reject", label: "Reject", cap: "#2b2c2f", ink: "#c9c6bf", glow: "#ff8a7a", says: ["rejected", "trying another way"] },
];
const EFFORT = ["low", "medium", "high", "max"];

function legend(label, cap, ink, worn) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = cap; g.fillRect(0, 0, w, h);
    // A dished top reads as a soft vignette.
    const grad = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, "rgba(255,255,255,0.06)"); grad.addColorStop(1, "rgba(0,0,0,0.14)");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = ink; g.globalAlpha = worn ? 0.8 : 1;
    g.font = `600 ${label.length > 6 ? 40 : 46}px 'Instrument Sans', sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(label, w / 2, h / 2 + 2);
    if (worn) {
      // Thumb-polished in the middle: the legend fades where it's pressed most.
      g.globalAlpha = 1;
      const wear = g.createRadialGradient(w * 0.52, h * 0.55, 6, w * 0.52, h * 0.55, 70);
      wear.addColorStop(0, cap); wear.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = wear; g.globalAlpha = 0.45; g.fillRect(0, 0, w, h);
    }
  });
}

function topPlate() {
  return canvasTexture(1024, 600, (g, w, h) => {
    g.fillStyle = "#2c2e32"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    // The knob's scale, at the right.
    const cx = w * (0.5 + 0.032 / 0.09), cy = h * 0.5;
    g.strokeStyle = "rgba(220, 216, 206, 0.7)"; g.fillStyle = "rgba(220, 216, 206, 0.75)";
    g.lineWidth = 4; g.font = "500 30px 'Instrument Sans', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    EFFORT.forEach((_, i) => {
      const ang = -Math.PI / 2 - Math.PI * 0.42 + (i / 3) * Math.PI * 0.84;
      g.beginPath(); g.moveTo(cx + Math.cos(ang) * 128, cy + Math.sin(ang) * 128); g.lineTo(cx + Math.cos(ang) * 146, cy + Math.sin(ang) * 146); g.stroke();
    });
    g.fillText("effort", cx, cy + 172);
  });
}

export function buildMacropad(scene, { x, y, z, ry }) {
  const root = new THREE.Group();
  root.position.set(x, y, z); root.rotation.y = ry;
  scene.add(root);
  const pad = new THREE.Group();
  pad.rotation.x = 0.06; // a slight wedge toward the chair
  root.add(pad);

  const BW = 0.09, BH = 0.014, BD = 0.05;
  const shell = new THREE.MeshStandardMaterial({ color: "#2e3034", metalness: 0.75, roughness: 0.42 });
  const body = mesh(box(BW, BH, BD, 0.004, 3), [shell, shell, new THREE.MeshStandardMaterial({ map: topPlate(), metalness: 0.75, roughness: 0.42 }), shell, shell, shell]);
  body.position.y = BH / 2;
  pad.add(body);
  // The switch plate glows faintly between the keys.
  const plateGlow = new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffd9a8", emissiveIntensity: 0.3 });
  const plate = mesh(new THREE.PlaneGeometry(0.0575, 0.0168), plateGlow, { cast: false });
  plate.rotation.x = -Math.PI / 2; plate.position.set(-0.0115, BH + 0.0003, 0.007);
  pad.add(plate);

  // OLED behind the keys.
  const oled = document.createElement("canvas");
  oled.width = 512; oled.height = 112;
  const og = oled.getContext("2d");
  const oledTex = new THREE.CanvasTexture(oled);
  oledTex.colorSpace = THREE.SRGBColorSpace;
  const bezel = mesh(box(0.054, 0.0012, 0.0135, 0.001), new THREE.MeshPhysicalMaterial({ color: "#050506", roughness: 0.1, clearcoat: 1 }), { cast: false });
  bezel.position.set(-0.012, BH + 0.0005, -0.0135);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.0105), new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: oledTex, emissiveIntensity: 2.2 }));
  screen.rotation.x = -Math.PI / 2; screen.position.set(-0.012, BH + 0.00115, -0.0135);
  pad.add(bezel, screen);

  // Keys.
  const keys = KEYS.map((k, i) => {
    const holder = new THREE.Group();
    holder.position.set(-0.031 + i * 0.0195, BH, 0.007);
    const capMat = new THREE.MeshPhysicalMaterial({ color: k.cap, roughness: k.worn ? 0.22 : 0.55, clearcoat: k.worn ? 0.8 : 0.1, clearcoatRoughness: 0.15 });
    const cap = mesh(box(0.0172, 0.0085, 0.0172, 0.0022, 3), [capMat, capMat, new THREE.MeshPhysicalMaterial({ map: legend(k.label, k.cap, k.ink, k.worn), roughness: k.worn ? 0.2 : 0.55, clearcoat: k.worn ? 0.9 : 0.1 }), capMat, capMat, capMat]);
    cap.position.y = 0.0058;
    cap.scale.set(1, 1, 1);
    cap.userData.key = k.id;
    holder.add(cap);
    pad.add(holder);
    return { ...k, holder, cap };
  });

  // The knob: knurled aluminium with an indicator line.
  const knobGeo = new THREE.CylinderGeometry(0.0092, 0.0098, 0.012, 96, 1);
  const kp = knobGeo.attributes.position;
  for (let i = 0; i < kp.count; i++) {
    const a = Math.atan2(kp.getZ(i), kp.getX(i));
    const r0 = Math.hypot(kp.getX(i), kp.getZ(i));
    if (r0 < 0.001) continue;
    const s = Math.round((a / (Math.PI * 2)) * 96) % 2 ? 1 : 0.965;
    kp.setX(i, kp.getX(i) * s); kp.setZ(i, kp.getZ(i) * s);
  }
  knobGeo.computeVertexNormals();
  const knob = new THREE.Group();
  knob.position.set(0.032, BH + 0.006, 0);
  const knobMesh = mesh(knobGeo, new THREE.MeshStandardMaterial({ color: "#cfd2d5", metalness: 1, roughness: 0.3 }));
  knobMesh.userData.key = "knob";
  const line = mesh(new THREE.BoxGeometry(0.0012, 0.0003, 0.006), new THREE.MeshStandardMaterial({ color: "#1a1a1a" }), { cast: false });
  line.position.set(0, 0.0061, -0.0045);
  line.userData.key = "knob";
  knob.add(knobMesh, line);
  pad.add(knob);

  // ------------------------------------------------------------ the OLED
  let effort = 2, msg = ["ready", "effort: high"], busyUntil = 0, spinning = false;
  const frames = ["-", "\\", "|", "/"];
  let lastDraw = 0;
  const draw = (now) => {
    og.fillStyle = "#000"; og.fillRect(0, 0, 512, 112);
    og.fillStyle = "#cfefff";
    og.font = "600 40px ui-monospace, 'SF Mono', Menlo, monospace";
    og.textBaseline = "middle";
    const head = spinning ? `${frames[Math.floor(now / 110) % frames.length]} ${msg[0]}` : msg[0];
    og.fillText(head, 16, 34);
    og.fillStyle = "#7fa7bd";
    og.font = "500 30px ui-monospace, 'SF Mono', Menlo, monospace";
    const blink = Math.floor(now / 530) % 2 ? "_" : " ";
    og.fillText(msg[1] + (spinning ? "" : blink), 16, 82);
    oledTex.needsUpdate = true;
  };
  draw(0);

  const setKnob = (i) => {
    const ang = -Math.PI * 0.42 + (i / 3) * Math.PI * 0.84;
    return ang;
  };
  knob.rotation.y = -setKnob(effort);

  async function press(id) {
    if (id === "knob") {
      effort = (effort + 1) % 4;
      const from = knob.rotation.y, to = -setKnob(effort);
      msg = [`effort: ${EFFORT[effort]}`, effort === 3 ? "thinking as hard as it can" : effort === 0 ? "quick answers" : "ok"];
      spinning = false;
      await tween(260, (k) => { knob.rotation.y = from + (to - from) * k; }, "out");
      return;
    }
    const k = keys.find((key) => key.id === id);
    if (!k) return;
    plateGlow.emissive.set(k.glow);
    plateGlow.emissiveIntensity = 2.5;
    await tween(90, (t) => { k.cap.position.y = 0.0058 - t * 0.0028; }, "out");
    tween(160, (t) => { k.cap.position.y = 0.0058 - (1 - t) * 0.0028; }, "out");
    if (id === "continue") {
      spinning = true; msg = [k.says[0], k.says[1]];
      busyUntil = performance.now() + (1200 + effort * 900);
    } else {
      spinning = false; msg = [`${id === "accept" ? "✓" : "✗"} ${k.says[0]}`, k.says[1]];
    }
  }

  const update = (now) => {
    if (spinning && now > busyUntil) { spinning = false; msg = ["✓ done", effort === 3 ? "worth the wait" : "your turn"]; }
    plateGlow.emissiveIntensity += (0.3 - plateGlow.emissiveIntensity) * 0.04;
    if (plateGlow.emissiveIntensity < 0.35) plateGlow.emissive.set("#ffd9a8");
    if (now - lastDraw > 80) { lastDraw = now; draw(now); }
  };

  return {
    root,
    label: "Macro pad",
    sub: "Accept, continue, reject",
    view: { offset: new THREE.Vector3(0, 0.13, 0.11), target: new THREE.Vector3(0, 0.008, 0) },
    caption: () => "For working with an agent. Guess which key gets the most use.",
    actions: () => [
      ...KEYS.map((k) => ({ label: k.label, run: () => press(k.id) })),
      { label: "Turn the effort knob", run: () => press("knob") },
    ],
    press: (obj) => press(obj?.userData?.key || "accept"),
    update,
  };
}
