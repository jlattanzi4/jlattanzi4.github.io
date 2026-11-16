// How the desk is lit and photographed. Every light has a source you can see: the desk lamp,
// the light bar on the monitor, the screen itself, and an LED strip behind the monitor that
// washes the wall. Between them the room falls off into the dark, the way it does at night.
//
// The image is rendered in linear HDR with 4x MSAA. Bloom picks up only what emits light (the
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
import { TOP, canvasTexture, rng } from "./kit.js";

const LAMP = { colour: "#ffad66", intensity: 0.9 };    // about 2700 K
const BAR = { colour: "#ffe3c4", intensity: 0.85 };     // about 4000 K
const SCREEN = { colour: "#c7d8ff", intensity: 2.2 };   // a cool, dim display
const BIAS = { colour: "#ff9a52", intensity: 26 };      // warm LED strip on the wall
const MOON = { colour: "#8ea4d8", intensity: 1.1 };    // through a window off to the right

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, grain: { value: 0.022 }, vignette: { value: 0.42 } },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float time; uniform float grain; uniform float vignette;
    varying vec2 vUv;
    float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
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

export function quality() {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(innerWidth, innerHeight) < 600;
  // Past 1.5x the post-processing costs far more than it shows: grain and MSAA hide the rest.
  return {
    pixelRatio: Math.min(devicePixelRatio, 1.5),
    shadow: coarse || small ? 1024 : 2048,
    samples: 4,
  };
}

export function createLook(renderer, scene, camera, items, tier) {
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = new THREE.Color("#050505");
  RectAreaLightUniformsLib.init();

  // ---- the lights
  const night = new THREE.HemisphereLight("#2c3650", "#120c08", 0.45);
  scene.add(night);
  // Moonlight from a window off to the right: cool, low, and long-shadowed, opposite the warm lamp.
  const moon = new THREE.DirectionalLight(MOON.colour, MOON.intensity);
  moon.position.set(1.6, 1.5, 0.1);
  moon.target.position.set(0.3, TOP, -0.4);
  moon.castShadow = true;
  moon.shadow.mapSize.set(tier.shadow, tier.shadow);
  Object.assign(moon.shadow.camera, { left: -0.9, right: 0.9, top: 0.7, bottom: -0.7, near: 0.5, far: 3.5 });
  moon.shadow.bias = -0.0003; moon.shadow.normalBias = 0.01;
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
  lamp.shadow.bias = -0.0002; lamp.shadow.normalBias = 0.006;
  scene.add(lamp, lamp.target);

  const bar = new THREE.SpotLight(BAR.colour, BAR.intensity, 0, 0.82, 0.4, 2);
  bar.position.set(0, 1.272, -0.586);
  bar.target.position.set(0, TOP, -0.2);
  bar.map = barCookie();
  bar.castShadow = true;
  bar.shadow.mapSize.set(tier.shadow, tier.shadow);
  bar.shadow.camera.near = 0.05; bar.shadow.camera.far = 2;
  bar.shadow.bias = -0.0002; bar.shadow.normalBias = 0.005;
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
  let envRT = null;
  function captureLight() {
    scene.environment = null;
    dust.visible = false;
    probe.update(renderer, scene);
    dust.visible = true;
    const next = pmrem.fromCubemap(cubeRT.texture);
    scene.environment = next.texture;
    scene.environmentIntensity = 0.55;
    envRT?.dispose();
    envRT = next;
  }

  // ---- the camera's side: post-processing
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: tier.samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.45, 0.55, 1.8);
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
    strip.emissiveIntensity = 14 * state.bar;
  }
  apply();

  let time = 0;
  return {
    composer,
    state,
    apply,
    captureLight,
    setSize(w, h, pixelRatio) {
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
      time = (time + 1) % 997;
      grade.uniforms.time.value = reduce ? 0 : time;
      composer.render();
    },
  };
}
