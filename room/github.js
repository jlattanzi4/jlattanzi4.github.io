// A framed print on the wall: a year of my GitHub contributions, drawn from data/github.json
// (refreshed weekly). It's the way to GitHub from the desk.

import * as THREE from "three";
import { canvasTexture, mesh, box, M } from "./kit.js";

export async function loadGithub() {
  try {
    const res = await fetch("data/github.json", { cache: "no-cache" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// GitHub's dark-mode greens, from no contributions to the busiest quartile: in a dark room
// a dark print with lit-up squares reads; a white one looked like an empty spreadsheet.
const GREENS = ["#1b222c", "#0e4429", "#006d32", "#26a641", "#39d353"];
const INK = "#8b949e";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function printTexture(graph) {
  return canvasTexture(2048, 900, (g, w, h) => {
    g.fillStyle = "#0d1117"; g.fillRect(0, 0, w, h);
    const cell = 30, gap = 6, step = cell + gap;
    const weeks = 52, left = (w - weeks * step + gap) / 2 + 40, top = 210;
    g.fillStyle = INK; g.font = "500 26px 'Instrument Sans', sans-serif"; g.textBaseline = "middle";
    // Weekday labels on alternate rows, as GitHub shows them.
    [["Mon", 1], ["Wed", 3], ["Fri", 5]].forEach(([d, r]) => { g.textAlign = "right"; g.fillText(d, left - 18, top + r * step + cell / 2); });
    const start = graph ? new Date(`${graph.start}T12:00:00Z`) : new Date();
    let lastMonth = -1;
    for (let wk = 0; wk < weeks; wk++) {
      for (let d = 0; d < 7; d++) {
        const level = graph ? Number(graph.levels[wk * 7 + d] || 0) : 0;
        g.fillStyle = GREENS[level];
        const x = left + wk * step, y = top + d * step;
        g.beginPath(); g.roundRect(x, y, cell, cell, 6); g.fill();
      }
      // A month label over the first week that starts in it.
      const day = new Date(start.getTime() + wk * 7 * 864e5);
      if (day.getUTCMonth() !== lastMonth && day.getUTCDate() <= 7 && wk < weeks - 2) {
        lastMonth = day.getUTCMonth();
        g.fillStyle = INK; g.textAlign = "left";
        g.fillText(MONTHS[lastMonth], left + wk * step, top - 30);
      }
    }
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "#e6edf3"; g.font = "600 52px 'Source Serif 4', serif";
    g.fillText("A year of commits", left, 112);
    g.textAlign = "right"; g.fillStyle = INK; g.font = "400 30px 'Source Serif 4', serif";
    if (graph) {
      const fmt = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      g.fillText(`${graph.total.toLocaleString("en-US")} contributions, ${fmt(graph.start)} to ${fmt(graph.end)}`, left + weeks * step - gap, 112);
    }
    // The legend and the address, small, under the graph.
    const ly = top + 7 * step + 64;
    g.textAlign = "left"; g.font = "500 26px 'Instrument Sans', sans-serif"; g.fillStyle = INK;
    g.fillText("github.com/jlattanzi4", left, ly);
    g.textAlign = "right";
    const lx = left + weeks * step - gap;
    for (let i = 4; i >= 0; i--) { g.fillStyle = GREENS[i]; g.beginPath(); g.roundRect(lx - (5 - i) * (cell + 6), ly - cell + 4, cell, cell, 6); g.fill(); }
    g.fillStyle = INK;
    g.fillText("Less", lx - 5 * (cell + 6) - 12, ly);
  });
}

export function buildGithubPrint(scene, graph, { x, y, z }) {
  const W = 0.44, H = 0.22;
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.z = -0.004;
  scene.add(root);
  root.add(mesh(box(W, H, 0.02, 0.003), M("#141416", 0.5)));
  const matBoard = mesh(new THREE.PlaneGeometry(W - 0.03, H - 0.03), M("#efede7", 0.95), { cast: false });
  matBoard.position.z = 0.0105;
  // The squares glow a touch, like a screen print under glass catching the room's light.
  const map = printTexture(graph);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36 * 900 / 2048), M("#ffffff", 0.9, 0, { map, emissive: "#ffffff", emissiveMap: map, emissiveIntensity: 0.18 }));
  art.position.z = 0.011;
  // Glazing: a faint reflection across the glass.
  const glazing = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, H - 0.03), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.04, transparent: true, opacity: 0.08, clearcoat: 1 }));
  glazing.position.z = 0.0125;
  root.add(matBoard, art, glazing);
  const total = graph ? `${graph.total.toLocaleString("en-US")} contributions in the past year. ` : "";
  return { root, label: "GitHub", sub: `${total}Open my profile`, href: graph?.profile || "https://github.com/jlattanzi4" };
}
