// The window off to the right, which the moonlight (and by day the sun, room/sun.js) comes in
// through: Boston's sky, right now.
//
// You never see the window, only its light. The moonlight carries a picture of the window (a
// "cookie": its panes and glazing bars) that it projects onto the desk and the wall. When it's
// raining in Boston, drops bead on the glass and run down it, and their shadows run down the
// wall; when it snows, snow banks up on the sill and flakes drift past; clouds and fog dim the
// light and soften its edges, and warm it toward the city's glow; in a thunderstorm, now and
// then, lightning. The moon's brightness follows its real phase.
//
// The weather is Open-Meteo's current conditions for Boston (no key, fetched after the desk is
// up); the moon's phase is worked out here.

import * as THREE from "three";

const BOSTON = "https://api.open-meteo.com/v1/forecast?latitude=42.36&longitude=-71.06&current=temperature_2m,weather_code,cloud_cover&temperature_unit=fahrenheit&timezone=America%2FNew_York";

// ------------------------------------------------------------ the moon
const SYNODIC = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a known new moon
const PHASES = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
export function moonPhase(date = new Date()) {
  const age = ((((date - NEW_MOON) / 864e5) % SYNODIC) + SYNODIC) % SYNODIC;
  const lit = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  return { age, lit, waxing: age < SYNODIC / 2, name: PHASES[Math.round((age / SYNODIC) * 8) % 8] };
}

// A small moon in its phase: the lit half, then the terminator as an ellipse that either eats
// into it (a crescent) or adds to it (gibbous).
export function drawMoon(g, cx, cy, r, moon, lit = "#f4f1e6", dark = "rgba(255,255,255,0.16)") {
  const k = Math.cos((2 * Math.PI * moon.age) / SYNODIC); // 1 new, 0 quarter, −1 full
  g.save();
  g.fillStyle = dark;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = lit;
  g.beginPath();
  g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !moon.waxing); // the right half when waxing
  g.fill();
  g.fillStyle = k > 0 ? dark : lit;
  g.beginPath(); g.ellipse(cx, cy, r * Math.abs(k), r, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ------------------------------------------------------------- the sky
// WMO weather codes, as Open-Meteo reports them, to what the window does and what to call it.
function kindOf(code) {
  if (code <= 1) return ["clear", 0, code === 0 ? "Clear" : "Mostly clear"];
  if (code === 2) return ["cloudy", 0.4, "Partly cloudy"];
  if (code === 3) return ["cloudy", 1, "Overcast"];
  if (code === 45 || code === 48) return ["fog", 1, "Fog"];
  if (code >= 51 && code <= 57) return ["rain", 0.3 + (code % 10) * 0.05, code >= 56 ? "Freezing drizzle" : "Drizzle"];
  if (code >= 61 && code <= 67) return ["rain", { 61: 0.5, 63: 0.75, 65: 1 }[code] ?? 0.7, { 61: "Light rain", 63: "Rain", 65: "Heavy rain" }[code] ?? "Freezing rain"];
  if (code >= 80 && code <= 82) return ["rain", 0.55 + (code - 80) * 0.22, code === 82 ? "Heavy showers" : "Showers"];
  if (code >= 71 && code <= 77) return ["snow", { 71: 0.4, 73: 0.7, 75: 1 }[code] ?? 0.4, { 71: "Light snow", 73: "Snow", 75: "Heavy snow" }[code] ?? "Snow grains"];
  if (code === 85 || code === 86) return ["snow", code === 86 ? 1 : 0.6, "Snow showers"];
  if (code >= 95) return ["storm", 1, code === 95 ? "Thunderstorms" : "Thunderstorms and hail"];
  return ["cloudy", 0.6, "Cloudy"];
}

export async function bostonSky() {
  try {
    const res = await fetch(BOSTON);
    if (!res.ok) return null;
    const { current } = await res.json();
    if (typeof current?.weather_code !== "number" || typeof current.temperature_2m !== "number") return null;
    const [kind, strength, text] = kindOf(current.weather_code);
    return { kind, strength, text, temp: Math.round(current.temperature_2m), cloud: current.cloud_cover ?? 0 };
  } catch {
    return null;
  }
}

// One line for the menu bar and a sentence for its tooltip.
// By day the menu bar shows the sun, and the moon's phase stays out of it.
export function skyLine(sky, moon, sunUp = false) {
  return sky ? `${sky.temp}° ${sky.text}` : sunUp ? "Daytime" : moon.name;
}
export function skySentence(sky, moon, sunUp = false) {
  const m = sunUp ? "" : ` ${moon.name}, ${Math.round(moon.lit * 100)}% lit.`;
  return sky ? `Boston right now: ${sky.text.toLowerCase()}, ${sky.temp}°F.${m}` : sunUp ? "The sun is up in Boston." : `The moon tonight:${m}`;
}

// The sun, for the menu bar by day: a warm disc with short rays.
export function drawSun(g, cx, cy, r, colour = "#ffd27a") {
  g.save();
  g.fillStyle = colour; g.strokeStyle = colour; g.lineWidth = Math.max(1, r * 0.22); g.lineCap = "round";
  g.beginPath(); g.arc(cx, cy, r * 0.55, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    g.beginPath(); g.moveTo(cx + c * r * 0.78, cy + sn * r * 0.78); g.lineTo(cx + c * r, cy + sn * r); g.stroke();
  }
  g.restore();
}

// ----------------------------------------------------- the window's light
const S = 256; // the cookie, in pixels
const PANE = 205; // panes are a little under white, so light focused through a drop can be brighter
const FRAME = { x0: S * 0.2, x1: S * 0.8, y0: S * 0.2, y1: S * 0.8, bar: S * 0.024 };
const MOONLIGHT = new THREE.Color("#8ea4d8"), CITY_GLOW = new THREE.Color("#c39e80");

export function createWindowLight(base) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d");
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { x0, x1, y0, y1, bar } = FRAME;
  const mx = (x0 + x1) / 2, my = y0 + (y1 - y0) * 0.42;
  const panes = [[x0, y0, mx - bar / 2, my - bar / 2], [mx + bar / 2, y0, x1, my - bar / 2], [x0, my + bar / 2, mx - bar / 2, y1], [mx + bar / 2, my + bar / 2, x1, y1]];
  const inPane = (x, y) => panes.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);
  const rnd = (a, b) => a + Math.random() * (b - a);

  let sky = { kind: "clear", strength: 0, cloud: 0 };
  let moon = moonPhase();
  let beads = [], runners = [], flakes = [];
  let flash = 0, nextFlash = 0, lastDraw = -1e9;

  let version = 0;
  function setSky(next) {
    sky = next || sky;
    version++;
    moon = moonPhase();
    const rain = sky.kind === "rain" || sky.kind === "storm" ? sky.strength : 0;
    beads = Array.from({ length: Math.round(200 * rain) }, () => ({ x: rnd(x0, x1), y: rnd(y0, y1), r: rnd(0.5, 1.5) }));
    runners = Array.from({ length: Math.round(12 * rain) }, () => ({ x: rnd(x0, x1), y: rnd(y0 - 40, y1), r: rnd(1.1, 1.9), v: 0 }));
    flakes = sky.kind === "snow" ? Array.from({ length: Math.round(70 * sky.strength) }, () => ({ x: rnd(0, S), y: rnd(0, S), r: rnd(1.2, 2.8), v: rnd(0.15, 0.4), ph: rnd(0, 6) })) : [];
    draw(0);
    lastDraw = -1e9;
  }

  function draw(now) {
    g.globalCompositeOperation = "source-over";
    g.filter = "none";
    g.fillStyle = "#000";
    g.fillRect(0, 0, S, S);
    // Clouds and fog blur the moon's hard edges.
    const soft = sky.kind === "fog" ? 6 : sky.kind === "clear" ? 0.6 : 1 + (sky.cloud / 100) * 2.5;
    g.filter = `blur(${soft}px)`;
    g.fillStyle = `rgb(${PANE},${PANE},${PANE})`;
    for (const [a, b, c, d] of panes) g.fillRect(a, b, c - a, d - b);
    // Snow on the sill outside, banked against the bottom of the lower panes.
    if (sky.kind === "snow") {
      const depth = 6 + sky.strength * 10;
      g.fillStyle = "#000";
      g.beginPath(); g.moveTo(x0 - 4, y1 + 4);
      for (let x = x0 - 4; x <= x1 + 4; x += 6) g.lineTo(x, y1 - depth + Math.sin(x * 0.11) * 2.5 + Math.sin(x * 0.037) * 3);
      g.lineTo(x1 + 4, y1 + 4); g.closePath(); g.fill();
    }
    g.filter = "none";
    // Raindrops on the glass: each throws a dark ring with a bright point where it focuses the light.
    const drop = (x, y, r) => {
      if (!inPane(x, y)) return;
      const grad = g.createRadialGradient(x + r * 0.25, y + r * 0.35, 0, x, y, r * 1.5);
      grad.addColorStop(0, "rgba(255,255,255,0.9)"); grad.addColorStop(0.14, "rgba(255,255,255,0.2)");
      grad.addColorStop(0.24, "rgba(0,0,0,0.62)"); grad.addColorStop(0.75, "rgba(0,0,0,0.4)"); grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r * 1.6, 0, Math.PI * 2); g.fill();
    };
    for (const b of beads) drop(b.x, b.y, b.r);
    for (const d of runners) {
      g.strokeStyle = "rgba(0,0,0,0.28)"; g.lineWidth = d.r * 0.7;
      g.beginPath(); g.moveTo(d.x, Math.max(y0, d.y - 26)); g.lineTo(d.x, d.y); g.stroke();
      drop(d.x, d.y, d.r);
    }
    // Snowflakes falling past, between the moon and the glass.
    for (const f of flakes) {
      g.fillStyle = "rgba(0,0,0,0.6)";
      g.beginPath(); g.arc(f.x + Math.sin(now * 0.0012 + f.ph) * 4, f.y, f.r, 0, Math.PI * 2); g.fill();
    }
    map.needsUpdate = true;
  }

  const animated = () => runners.length > 0 || flakes.length > 0;
  function step(dt) {
    for (const d of runners) {
      // A drop sits, then lets go, speeds up, and soaks up the beads it runs through.
      d.v = Math.min(3, d.v + (Math.random() < 0.04 ? 0.6 : 0.02));
      d.y += d.v * dt * 0.06;
      d.v *= 0.97;
      beads = beads.filter((b) => !(Math.abs(b.x - d.x) < d.r + b.r && b.y > d.y - 4 && b.y < d.y + 2));
      if (d.y > y1 + 6) Object.assign(d, { x: rnd(x0, x1), y: rnd(y0 - 30, y0 + 20), v: 0 });
    }
    if (runners.length && beads.length < 200 * sky.strength && Math.random() < 0.4) beads.push({ x: rnd(x0, x1), y: rnd(y0, y1), r: rnd(0.5, 1.5) });
    for (const f of flakes) { f.y += f.v * dt * 0.06; if (f.y > S) { f.y = -4; f.x = rnd(0, S); } }
  }

  // Brightness and colour of the light through the window, given the sky and the moon.
  const colour = new THREE.Color();
  const coverOf = () => (sky.kind === "fog" ? 1 : sky.kind === "clear" ? 0 : Math.max(sky.cloud / 100, sky.kind === "cloudy" ? 0.4 : 0.8));
  function light(now, reduce) {
    const cover = coverOf();
    const moonlit = 0.45 + 0.55 * moon.lit;
    // Under cloud the light is the city's glow off the clouds, and snow makes a city night bright.
    const glow = sky.kind === "snow" ? 1.1 : 0.55;
    let k = (moonlit * (1 - cover) + glow * cover) / Math.pow(PANE / 255, 2.2);
    if (sky.kind === "storm" && !reduce) {
      if (now > nextFlash) { flash = 1; nextFlash = now + rnd(6000, 18000); }
      flash *= 0.86;
      k += flash * 6;
    }
    colour.copy(MOONLIGHT).lerp(CITY_GLOW, cover * 0.7).lerp(new THREE.Color("#ffffff"), flash);
    return { intensity: base * k, colour };
  }

  setSky(null);
  return {
    map,
    setSky,
    get moon() { return moon; },
    // How much of the sky is cloud, 0 to 1, for the daylight (room/sun.js), and a count that
    // changes whenever the weather does.
    get cover() { return coverOf(); },
    get version() { return version; },
    update(now, reduce) {
      if (animated() && !reduce && now - lastDraw > 45) {
        step(Math.min(100, now - lastDraw));
        draw(now);
        lastDraw = now;
      }
      return light(now, reduce);
    },
  };
}
