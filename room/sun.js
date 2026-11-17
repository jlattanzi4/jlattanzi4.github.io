// The sun over Boston, and how the room is lit by it. No imports, so the tests run it in Node.
//
// The desk is lit the way Boston is right now. Through the window comes the moon at night, the
// sky's blue at dusk and dawn, a low warm sun at golden hour and white sun by day; the fill
// light, the exposure, the LED strip and the bloom follow, and the lamp starts off in daylight.
// The four looks are keyframes by the sun's elevation, blended between, so the room drifts from
// one to the next over the day. Cloud dims and greys the sun (room/window.js softens its edges
// and puts the rain and snow on the glass).

export const BOSTON = { lat: 42.3601, lon: -71.0589 };
const RAD = Math.PI / 180;

// Where the sun is in Boston's sky at `date`: its elevation above the horizon and its azimuth
// clockwise from north, in degrees. NOAA's approximation, without refraction: well under a
// tenth of a degree off for this century.
export function sunPosition(date, { lat, lon } = BOSTON) {
  const T = (date.getTime() / 864e5 + 2440587.5 - 2451545) / 36525; // Julian centuries since J2000
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360; // mean longitude
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);           // mean anomaly
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);      // orbit's eccentricity
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD); // apparent longitude
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eqTime = (4 / RAD) * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
    - 0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD)); // minutes
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const hourAngle = (((utcMinutes + eqTime + 4 * lon) % 1440 + 1440) % 1440) / 4 - 180;
  const cosZenith = Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(hourAngle * RAD);
  const elevation = 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) / RAD;
  const azimuth = Math.atan2(Math.sin(hourAngle * RAD), Math.cos(hourAngle * RAD) * Math.sin(lat * RAD) - Math.tan(decl) * Math.cos(lat * RAD)) / RAD + 180;
  return { elevation, azimuth: (azimuth + 360) % 360 };
}

// ------------------------------------------------------------- the four looks
// By the sun's elevation in degrees. `window` is the intensity of the light through the window,
// on top of the moon's share (the moon itself comes from window.js); `fill` is the room's soft
// light, from the sky and bounced off the floor.
const LOOKS = [
  { at: -12, window: 0, windowColour: "#8ea4d8", fillSky: "#2c3650", fillGround: "#120c08", fill: 0.45, exposure: 1.45, bias: 26, bloom: 2.2 }, // night
  { at: -4, window: 4, windowColour: "#7d9be0", fillSky: "#3e5ea8", fillGround: "#1a1a24", fill: 1.0, exposure: 1.35, bias: 26, bloom: 2.2 },  // blue hour
  { at: 4, window: 45, windowColour: "#ffa860", fillSky: "#e9a978", fillGround: "#3a281c", fill: 1.1, exposure: 1.15, bias: 10, bloom: 3 },    // golden hour
  { at: 25, window: 55, windowColour: "#fff2df", fillSky: "#c4d6f5", fillGround: "#7a6650", fill: 3.2, exposure: 0.9, bias: 4, bloom: 6 },     // day
];
const OVERCAST = { window: "#dfe3e8", fillSky: "#c9ced6", fillGround: "#6a6560" };
// The moonlight's elevation through the window, in degrees: the direction it always had,
// (1.1, 0.75, 1.5), so the night is exactly as it was.
const MOON_ANGLE = Math.atan2(0.75, Math.hypot(1.1, 1.5)) / RAD;

// sRGB hex to linear RGB, the space the lights work in.
const linear = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const mix = (a, b, t) => a + (b - a) * t;
const mixRGB = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// How the room is lit with the sun at `elevation` degrees under `cover` (0 clear to 1
// overcast), as numbers for room/look.js. `moon` is how much of the window's light is still the
// moon's; `window` is added to it.
export function daylight(elevation, cover = 0) {
  const i = LOOKS.findIndex((k) => k.at > elevation);
  const [a, b] = i === -1 ? [LOOKS.at(-1), LOOKS.at(-1)] : i === 0 ? [LOOKS[0], LOOKS[0]] : [LOOKS[i - 1], LOOKS[i]];
  const t = a === b ? 0 : smooth(a.at, b.at, elevation);
  const sunUp = smooth(-2, 6, elevation), day = smooth(-6, 10, elevation);
  const grey = cover * sunUp;
  return {
    moon: 1 - smooth(-12, -4, elevation),
    window: mix(a.window, b.window, t) * (1 - 0.85 * grey),
    windowColour: mixRGB(mixRGB(linear(a.windowColour), linear(b.windowColour), t), linear(OVERCAST.window), grey * 0.8),
    // The sun's angle through the window: the moon's at night, then the sun's own height,
    // kept between 14° and 52° so its patch stays on the wall and the desk.
    angle: mix(Math.max(14, Math.min(52, elevation)), MOON_ANGLE, 1 - smooth(-12, -4, elevation)),
    fillSky: mixRGB(mixRGB(linear(a.fillSky), linear(b.fillSky), t), linear(OVERCAST.fillSky), cover * day * 0.8),
    fillGround: mixRGB(mixRGB(linear(a.fillGround), linear(b.fillGround), t), linear(OVERCAST.fillGround), cover * day * 0.6),
    fill: mix(a.fill, b.fill, t) * (1 - 0.2 * cover * day),
    exposure: mix(a.exposure, b.exposure, t) + 0.15 * cover * day,
    bias: mix(a.bias, b.bias, t),
    bloom: mix(a.bloom, b.bloom, t),
    // The lamp comes on at dusk, or on a dark, rainy afternoon; the light bar stays on until the
    // sun is well up.
    lamp: elevation < 3 || (cover >= 0.8 && elevation < 15),
    bar: elevation < 18,
  };
}

// ------------------------------------------------------------- the clock
// What time it is for the light: the real time, or a preview from the URL. `?at=17:30` is
// 5:30 pm in Boston today; `?at=` with a full date and time is that moment.
export function bostonClock(search = "", now = () => new Date()) {
  const at = new URLSearchParams(search).get("at");
  if (!at) return now;
  const hm = /^(\d{1,2}):(\d{2})$/.exec(at);
  if (hm) {
    const today = now();
    const [y, m, d] = wallClock(today);
    // Boston's offset from UTC that day, found by reading a guess back on Boston's clock.
    const guess = Date.UTC(y, m - 1, d, +hm[1], +hm[2]);
    const [, , , gh, gm] = wallClock(new Date(guess));
    const offset = ((gh * 60 + gm - (+hm[1] * 60 + +hm[2])) + 1440 + 720) % 1440 - 720;
    const fixed = new Date(guess - offset * 6e4);
    return () => fixed;
  }
  const t = Date.parse(at);
  if (Number.isNaN(t)) return now;
  const fixed = new Date(t);
  return () => fixed;
}
const BOSTON_CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
function wallClock(date) {
  const p = Object.fromEntries(BOSTON_CLOCK.formatToParts(date).map((x) => [x.type, x.value]));
  return [+p.year, +p.month, +p.day, +p.hour, +p.minute];
}
