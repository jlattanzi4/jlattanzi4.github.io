// How the desk is lit and photographed. Every light has a source you can see: the desk lamp,
// the light bar on the monitor, the screen itself, and an LED strip behind the monitor that
// washes the wall. Between them the room falls off into the dark, the way it does at night.
//
// The image is rendered in linear HDR, at the screen's full resolution on a Retina display
// (4x MSAA below that). Bloom picks up only what emits light (the
// bulb, the light bar's strip, lume, the macro pad's OLED), then AgX tone mapping, a gentle
// vignette and film grain, which also breaks up banding in the dark gradients. (Screen-space
// ambient occlusion was tried and cut: the shadow maps already ground things, and it halved
// the frame rate for a difference you had to squint to see.)

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { HorizontalBlurShader } from "three/addons/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/addons/shaders/VerticalBlurShader.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { TOP, canvasTexture, rng, tweening, takeMoved, moved } from "./kit.js";
import { sunPosition, daylight } from "./sun.js";
import { createWindowLight } from "./window.js";

const LAMP = { colour: "#ffad66", intensity: 0.9 };    // about 2700 K
const BAR = { colour: "#ffe3c4", intensity: 0.85 };     // about 4000 K
const SCREEN = { colour: "#c7d8ff", intensity: 2.2 };   // a cool, dim display
const BIAS = { colour: "#ff9a52", intensity: 26 };      // warm LED strip on the wall
const MOON = { colour: "#8ea4d8", intensity: 2.4 };    // through a window off to the right

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, grain: { value: 0.022 }, vignette: { value: 0.42 }, fringe: { value: 0.006 }, lift: { value: 0.014 } },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float time; uniform float grain; uniform float vignette; uniform float fringe; uniform float lift;
    varying vec2 vUv;
    float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    void main() {
      // A real lens fringes a little toward the corners, and a real sensor never quite reaches black.
      vec2 o = (vUv - 0.5) * dot(vUv - 0.5, vUv - 0.5) * fringe;
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + o).r;
      c.b = texture2D(tDiffuse, vUv - o).b;
      c.rgb = mix(vec3(lift, lift * 1.05, lift * 1.2), vec3(1.0), c.rgb);
      vec2 d = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
      c.rgb *= 1.0 - vignette * smoothstep(0.3, 1.1, length(d));
      c.rgb += (hash(vec3(gl_FragCoord.xy, time)) - 0.5) * grain;
      gl_FragColor = c;
    }`,
};

// The light bar's beam: wide across the desk, shallow front to back, soft at the edges.
const barCookie = () => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
  g.save(); g.translate(w / 2, h / 2); g.scale(1, 0.62);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  grad.addColorStop(0, "#fff"); grad.addColorStop(0.45, "#e6e6e6"); grad.addColorStop(0.8, "#7a7a7a"); grad.addColorStop(1, "#000");
  g.fillStyle = grad; g.beginPath(); g.arc(0, 0, w / 2, 0, 7); g.fill();
  g.restore();
});

// Every combination of material features is its own shader program, and each one takes a
// moment to compile (about 0.15 s on a fast laptop, much longer on a slow one) before the
// desk can appear. A plain white texture changes nothing in the picture, so materials that
// differ only in which of these maps they have all get the same set, and share one program.
const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;
function shareShaders(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m.isMeshStandardMaterial || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) continue;
      m.map ??= WHITE;
      m.emissiveMap ??= WHITE;
      m.roughnessMap ??= WHITE;
      m.needsUpdate = true;
    }
  });
}

export function quality() {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(innerWidth, innerHeight) < 600;
  // A Retina screen gets every pixel, so the words on the monitor and the sticky notes are
  // crisp. If the first seconds show the GPU can't keep up, main.js turns off MSAA, then steps
  // down to 1.5x, then 1x.
  // At 2x the pixels are small enough that 4x MSAA buys nothing you can see and costs half the
  // frame rate, so it's only used below 2x (see samplesAt).
  return {
    pixelRatio: Math.min(devicePixelRatio, 2),
    shadow: coarse || small ? 1024 : 2048,
    samples: 4,
  };
}

export function createLook(renderer, scene, camera, items, tier, clock = () => new Date()) {
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false; // redrawn only when something moved (render(), below)
  renderer.shadowMap.needsUpdate = true;
  // Plain PCF, so each light can have its own softness: the lamp and the bar are big, soft sources.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene.background = new THREE.Color("#050505");
  RectAreaLightUniformsLib.init();

  // ---- the lights
  const night = new THREE.HemisphereLight("#2c3650", "#120c08", 0.45);
  scene.add(night);
  // Moonlight from a window off to the right: cool, low, and long-shadowed, opposite the warm lamp.
  // It carries a picture of the window (room/window.js), which is Boston's sky right now. It's a
  // spotlight far enough out that its rays are nearly parallel, the way the moon's are; the
  // window fills the middle of its beam, and no light falls outside the window.
  const sky = createWindowLight(MOON.intensity);
  const moon = new THREE.SpotLight(MOON.colour, MOON.intensity, 0, Math.atan(0.26), 0, 0);
  moon.target.position.set(0.42, 1.0, -0.86);
  moon.position.copy(moon.target.position).addScaledVector(new THREE.Vector3(1.1, 0.75, 1.5).normalize(), 3.4);
  moon.map = sky.map;
  moon.castShadow = true;
  moon.shadow.mapSize.set(tier.shadow, tier.shadow);
  moon.shadow.camera.near = 1.5; moon.shadow.camera.far = 4.5;
  moon.shadow.bias = -0.0003; moon.shadow.normalBias = 0.01; moon.shadow.radius = 2.5;
  scene.add(moon, moon.target);

  const screenGlow = new THREE.RectAreaLight(SCREEN.colour, SCREEN.intensity, 0.62, 0.35);
  screenGlow.position.set(0, 1.08, -0.588);
  screenGlow.lookAt(0, 1.0, 1);
  const bias = new THREE.RectAreaLight(BIAS.colour, BIAS.intensity, 0.36, 0.14);
  bias.position.set(0, 1.1, -0.64);
  bias.lookAt(0, 1.1, -2);
  scene.add(screenGlow, bias);

  const lampItem = items.lamp;
  lampItem.root.updateMatrixWorld(true);
  const lamp = new THREE.SpotLight(LAMP.colour, LAMP.intensity, 0, 0.95, 0.65, 2);
  lampItem.bulb.getWorldPosition(lamp.position);
  lamp.position.y -= 0.012;
  lamp.target.position.set(lamp.position.x + 0.07, TOP, lamp.position.z + 0.07);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(tier.shadow, tier.shadow);
  lamp.shadow.camera.near = 0.03; lamp.shadow.camera.far = 2;
  lamp.shadow.bias = -0.0002; lamp.shadow.normalBias = 0.006; lamp.shadow.radius = 4;
  scene.add(lamp, lamp.target);

  const bar = new THREE.SpotLight(BAR.colour, BAR.intensity, 0, 0.82, 0.4, 2);
  bar.position.set(0, 1.272, -0.586);
  bar.target.position.set(0, TOP, -0.2);
  bar.map = barCookie();
  bar.castShadow = true;
  bar.shadow.mapSize.set(tier.shadow, tier.shadow);
  bar.shadow.camera.near = 0.05; bar.shadow.camera.far = 2;
  bar.shadow.bias = -0.0002; bar.shadow.normalBias = 0.005; bar.shadow.radius = 5;
  scene.add(bar, bar.target);

  // ---- dust in the lamp's beam
  const N = 80, r = rng(9);
  const dustPos = new Float32Array(N * 3), dustCol = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) seeds.push([r(), r(), r(), r()]);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("color", new THREE.BufferAttribute(dustCol, 3));
  const mote = canvasTexture(32, 32, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, w, w);
  });
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.0012, map: mote, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  scene.add(dust);
  const beamAxis = new THREE.Vector3().subVectors(lamp.target.position, lamp.position).normalize();
  const tmp = new THREE.Vector3();

  // ---- reflections: a light probe that photographs the lit desk from above the keyboard
  const pmrem = new THREE.PMREMGenerator(renderer);
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const probe = new THREE.CubeCamera(0.02, 10, cubeRT);
  probe.position.set(0.05, 0.95, -0.32);
  scene.add(probe);
  // Start from a blank map of the same size, so every material compiles once, with
  // reflections, and swapping in the real capture later doesn't recompile anything.
  let envRT = pmrem.fromCubemap(cubeRT.texture);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;
  function photograph() {
    dust.visible = false;
    probe.update(renderer, scene);
    dust.visible = true;
    const next = pmrem.fromCubemap(cubeRT.texture);
    scene.environment = next.texture;
    envRT.dispose();
    envRT = next;
  }

  // ---- contact shadows: a soft darkening where things meet the desk, like ambient occlusion
  // for one surface. A camera under the desk looks up, draws everything near the desk darker
  // the closer it is, the result is blurred, and laid over the desk as a shadow.
  const contact = (() => {
    const W = 1.8, D = 1.15, RES = 512, range = 0.03;
    const cam = new THREE.OrthographicCamera(-W / 2, W / 2, D / 2, -D / 2, 0, range + 0.004);
    cam.position.set(0, TOP - 0.001, -0.275);
    cam.up.set(0, 0, 1);
    cam.lookAt(0, TOP + 1, -0.275);
    cam.layers.set(2);
    const size = [RES, Math.round(RES * D / W)];
    const rtA = new THREE.WebGLRenderTarget(...size), rtB = new THREE.WebGLRenderTarget(...size);
    const nearness = new THREE.ShaderMaterial({
      uniforms: { base: { value: TOP }, range: { value: range } },
      vertexShader: `varying float vH; void main() {
        vec4 wp = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp; vH = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform float base; uniform float range; varying float vH;
        void main() { float k = clamp(1.0 - (vH - base) / range, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, k * k); }`,
      side: THREE.DoubleSide,
    });
    const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader), vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    const quad = new FullScreenQuad();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ map: rtA.texture, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.scale.y = -1; // the camera looked up, so its image is mirrored front to back
    plane.position.set(0, TOP + 0.0034, -0.275);
    plane.renderOrder = -1;
    scene.add(plane);
    scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && !o.userData.noContact && o !== plane && !o.material?.transparent) o.layers.enable(2); });
    const blur = (amount) => {
      hBlur.uniforms.h.value = amount / size[0]; vBlur.uniforms.v.value = amount / size[1];
      quad.material = hBlur; hBlur.uniforms.tDiffuse.value = rtA.texture; renderer.setRenderTarget(rtB); quad.render(renderer);
      quad.material = vBlur; vBlur.uniforms.tDiffuse.value = rtB.texture; renderer.setRenderTarget(rtA); quad.render(renderer);
    };
    return () => {
      const clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha(), bg = scene.background;
      const shadows = renderer.shadowMap.autoUpdate;
      scene.overrideMaterial = nearness; scene.background = null; renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rtA); renderer.setClearColor(0x000000, 0); renderer.clear();
      renderer.render(scene, cam);
      scene.overrideMaterial = null; scene.background = bg; renderer.shadowMap.autoUpdate = shadows;
      blur(1.4); blur(2.6);
      renderer.setRenderTarget(null); renderer.setClearColor(clear, alpha);
    };
  })();
  // Not on the first frame, which already has a lot to compile.
  let contactFrames = 0;
  setTimeout(() => { contactFrames = 2; }, 120);

  // ---- the camera's side: post-processing
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // Once the desk has run too slow, it never antialiases again (lighten(), below).
  let lean = false;
  const samplesAt = (pixelRatio) => (lean || pixelRatio >= 2 ? 0 : tier.samples);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: samplesAt(renderer.getPixelRatio()) });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.4, 0.55, 2.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  // ---- switching lights
  const state = { lamp: 1, bar: 1 };
  const strip = items.lightbar.strip;
  function apply() {
    lamp.intensity = LAMP.intensity * state.lamp;
    lampItem.bulb.material.emissiveIntensity = 60 * state.lamp;
    lampItem.inner.material.emissiveIntensity = 1.6 * state.lamp;
    bar.intensity = BAR.intensity * state.bar;
    strip.emissiveIntensity = 6 * state.bar;
  }
  apply();

  // ---- Boston's daylight (room/sun.js): the window's light, the fill, the exposure, the LED
  // strip and the bloom follow the sun. Worked out once a minute, and as soon as new weather
  // comes in; the light only moves a little in a minute, so there's no need to ease it.
  const ACROSS = new THREE.Vector3(1.1, 0, 1.5).normalize(); // the window's direction, level
  let lit = null, litAt = -Infinity, litWeather = -1, litAngle = null, shot = null;
  const windowColour = new THREE.Color(), sunColour = new THREE.Color();
  function readDaylight(now) {
    lit = daylight(sunPosition(clock()).elevation, sky.cover);
    litAt = now; litWeather = sky.version;
    night.color.setRGB(...lit.fillSky); night.groundColor.setRGB(...lit.fillGround); night.intensity = lit.fill;
    renderer.toneMappingExposure = lit.exposure;
    bias.intensity = lit.bias;
    bloom.threshold = lit.bloom;
    sunColour.setRGB(...lit.windowColour);
    if (litAngle === null || Math.abs(lit.angle - litAngle) > 0.05) {
      const a = lit.angle * Math.PI / 180;
      moon.position.copy(moon.target.position).addScaledVector(ACROSS.clone().multiplyScalar(Math.cos(a)).setY(Math.sin(a)), 3.4);
      litAngle = lit.angle;
      moved(); // the shadows fall a new way
    }
    // Reflections are a photograph of the lit desk: retake it when the light has changed enough.
    if (shot && (Math.abs(shot.exposure - lit.exposure) > 0.03 || Math.abs(shot.fill - lit.fill) > 0.08 || Math.abs(shot.window - lit.window) > 3)) captureLight();
  }
  function captureLight() {
    photograph();
    shot = { exposure: lit.exposure, fill: lit.fill, window: lit.window };
  }
  readDaylight(-Infinity);

  let time = 0;
  return {
    composer,
    state,
    apply,
    captureLight,
    get daylight() { return lit; },
    sky,
    // Compile every material for the buffer the desk is actually drawn into. A shader drawn to
    // the screen is a different program from one drawn to a buffer (tone mapping, colour space),
    // so compiling against the screen would build each one for nothing and then again on the
    // first frame.
    compile() {
      shareShaders(scene);
      const was = renderer.getRenderTarget();
      renderer.setRenderTarget(composer.readBuffer);
      const ready = renderer.compileAsync(scene, camera); // creates every program before it returns
      renderer.setRenderTarget(was);
      return ready;
    },
    get msaa() { return composer.renderTarget1.samples > 0; },
    // For a GPU that can't keep up. 4x MSAA costs more than a step down in resolution saves (at
    // 1.5x it stores four samples a pixel, 2.25 times what 2x stores without it), so it goes
    // first, and for good.
    lighten() { lean = true; },
    setSize(w, h, pixelRatio) {
      const samples = samplesAt(pixelRatio);
      if (composer.renderTarget1.samples !== samples) {
        for (const rt of [composer.renderTarget1, composer.renderTarget2]) { rt.samples = samples; rt.dispose(); }
      }
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      grade.uniforms.resolution.value.set(w, h);
    },
    render(now, reduce) {
      // Dust drifts slowly through the cone and only shows where the lamp catches it.
      if (state.lamp > 0.01) {
        for (let i = 0; i < N; i++) {
          const [a, b, c, d] = seeds[i];
          const t = now * 0.00004 * (0.5 + d);
          const along = 0.05 + ((a + (reduce ? 0 : t * 0.4)) % 1) * 0.36;
          const ang = b * Math.PI * 2 + (reduce ? 0 : Math.sin(t * 3 + c * 9) * 0.6);
          const rad = Math.sqrt(c) * along * Math.tan(0.62);
          tmp.copy(lamp.position).addScaledVector(beamAxis, along);
          const px = tmp.x + Math.cos(ang) * rad, py = tmp.y + Math.sin(ang) * rad * 0.6, pz = tmp.z + Math.sin(ang) * rad;
          dustPos[i * 3] = px; dustPos[i * 3 + 1] = Math.max(TOP + 0.02, py); dustPos[i * 3 + 2] = pz;
          const twinkle = 0.5 + 0.5 * Math.sin(now * 0.002 * (0.5 + d) + a * 20);
          const fade = Math.sin((along - 0.05) / 0.36 * Math.PI);
          const k = state.lamp * (0.2 + twinkle * 0.8) * fade * 0.32;
          dustCol[i * 3] = k; dustCol[i * 3 + 1] = k * 0.8; dustCol[i * 3 + 2] = k * 0.55;
        }
        dustGeo.attributes.position.needsUpdate = true;
        dustGeo.attributes.color.needsUpdate = true;
      }
      dust.visible = state.lamp > 0.01;
      const through = sky.update(now, reduce);
      if (now - litAt > 60000 || sky.version !== litWeather) readDaylight(now);
      // Through the window: the moon's share, and the sun's (or the dusk sky's) on top.
      const moonK = through.intensity * lit.moon, sunK = lit.window;
      moon.intensity = moonK + sunK;
      moon.color.copy(through.colour).multiplyScalar(moonK).add(windowColour.copy(sunColour).multiplyScalar(sunK)).multiplyScalar(1 / Math.max(1e-6, moonK + sunK));
      time = (time + 1) % 997;
      grade.uniforms.time.value = reduce ? 0 : time;
      // Contact shadows only change when something moves.
      if (tweening()) contactFrames = 2;
      if (contactFrames > 0) { contact(); contactFrames--; }
      if (takeMoved()) renderer.shadowMap.needsUpdate = true;
      composer.render();
    },
  };
}
