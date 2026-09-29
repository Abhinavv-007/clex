/* ==========================================================================
   Clex — the stream

   The hero's backdrop: a river of light made of file chunks (ink on the
   bone stage in light mode). Tens of thousands of points flow left to right
   along a ribbon that twists in 3D — gold dust, a few pale motes, and
   brighter jade packets, drawn as little rounded chunks, riding through
   faster. The ribbon narrows as it passes behind the headline and fans out
   at the edges. It pours in from the left when the page opens, a wave of
   light runs through it when the headline's word is written, the pointer
   parts and swirls it, and scrolling draws it down toward the workspace.

   Every position is computed on the GPU from time, so the CPU does nothing
   per frame but set four uniforms. It pauses off screen and in background
   tabs, renders one still frame under reduced motion, and falls back to the
   2D circuit field where WebGL is unavailable.
   ========================================================================== */

import { reducedMotion } from './motion.js';

const VERT = `
attribute vec4 a_p;      // seed, lane, speed, size
attribute float a_kind;  // 0 gold dust, 1 jade packet, 2 pale mote, 3 bright packet, 4 bokeh
uniform float u_time;
uniform float u_aspect;
uniform float u_scroll;
uniform float u_dpr;
uniform vec2 u_pointer;
uniform float u_pointerOn;
uniform float u_center;
uniform float u_gain;
uniform float u_light;   // 1 on the bone stage: inked particles, not light
uniform float u_intro;   // 0..1 as the river first pours in from the left
uniform float u_wave;    // x of a wave of light running through the river
varying vec4 v_color;
varying float v_glow;

void main() {
  float t = fract(a_p.x + u_time * a_p.z);
  float span = 1.18 * u_aspect;
  float x = mix(-span, span, t);
  float xn = x / u_aspect;                       // -1.18 .. 1.18
  float lane = a_p.y * 2.0 - 1.0;

  // The ribbon's centre line: two slow waves.
  float wave = sin(xn * 1.6 + u_time * 0.32) * 0.13 + sin(xn * 3.4 - u_time * 0.19) * 0.04;
  // Narrow behind the headline, wide at the edges.
  float width = 0.1 + 0.34 * smoothstep(0.05, 1.15, abs(xn));
  // Each lane winds around the ribbon's axis — that winding is the depth.
  float ang = lane * 3.14159 + xn * 2.2 + u_time * 0.28;
  float jitter = (fract(a_p.x * 91.7) - 0.5) * 0.05;
  float y = wave + sin(ang) * width + jitter + u_center - u_scroll * 0.55;
  float z = cos(ang) * width;

  float persp = 1.0 / (1.35 - z * 1.1);
  vec2 pos = vec2(x, y) * persp;

  // The pointer parts the stream, swirls it and lights what it touches.
  vec2 d = pos - u_pointer;
  float near = exp(-dot(d, d) * 14.0) * u_pointerOn;
  vec2 away = normalize(d + 1e-4);
  pos += (away * 0.07 + vec2(-away.y, away.x) * 0.06) * near;

  // A wave of light runs through when the headline's word is written.
  float crest = exp(-pow((xn - u_wave) * 5.5, 2.0));

  gl_Position = vec4(pos.x / u_aspect, pos.y, 0.0, 1.0);

  float depth = clamp(z / max(width, 0.001) * 0.5 + 0.5, 0.0, 1.0);
  float edge = smoothstep(1.18, 0.78, abs(xn));
  float chunk = a_kind > 2.5 && a_kind < 3.5 ? mix(1.0, 0.72, u_light) : 1.0;
  float size = a_p.w * persp * u_dpr * chunk * (1.0 + near * 1.6 + crest * 1.1);
  gl_PointSize = size;

  vec3 gold = mix(vec3(0.86, 0.71, 0.45), vec3(0.62, 0.47, 0.2), u_light);
  vec3 jade = mix(vec3(0.55, 0.82, 0.66), vec3(0.16, 0.44, 0.31), u_light);
  vec3 bone = mix(vec3(0.95, 0.93, 0.89), vec3(0.42, 0.39, 0.34), u_light);
  vec3 c = a_kind < 0.5 ? gold : (a_kind < 1.5 ? jade : (a_kind < 2.5 ? bone : (a_kind < 3.5 ? mix(jade, bone, 0.35 * (1.0 - u_light)) : mix(gold, jade, fract(a_p.x * 7.3)))));
  float a = a_kind < 0.5 ? 0.85 : (a_kind < 1.5 ? 1.0 : (a_kind < 2.5 ? 0.55 : (a_kind < 3.5 ? mix(1.0, 0.7, u_light) : 0.07)));
  a *= mix(0.3, 1.0, depth) * edge * u_gain * mix(1.0, 0.72, u_light);
  // Pouring in: nothing right of the front yet, and the front itself bright.
  float front = mix(-1.4, 1.4, u_intro);
  float poured = smoothstep(front + 0.04, front - 0.18, xn);
  float lip = exp(-pow((xn - front) * 9.0, 2.0)) * (1.0 - u_intro);
  a *= poured;
  vec3 lit = c + (near + crest * 0.8 + lip) * mix(0.35, -0.1, u_light);
  v_color = vec4(lit, a * (1.0 + near * 1.4 + crest * 0.9 + lip * 1.5));
  v_glow = a_kind > 2.5 && a_kind < 3.5 ? 1.0 : (a_kind > 3.5 ? -1.0 : 0.0);
}
`;

const FRAG = `
precision mediump float;
varying vec4 v_color;
varying float v_glow;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p);
  float core = smoothstep(0.5, 0.0, r);
  float soft;
  if (v_glow > 0.5) {
    // Packets are file chunks: a small rounded square in a soft halo.
    vec2 q = abs(p) - vec2(0.13);
    float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.05;
    soft = smoothstep(0.03, -0.02, box) + pow(core, 2.4) * 0.55;
  } else if (v_glow < -0.5) {
    // Bokeh: a flat soft disc.
    soft = smoothstep(0.5, 0.3, r);
  } else {
    soft = pow(core, 1.4);
  }
  gl_FragColor = vec4(v_color.rgb, v_color.a * min(1.0, soft));
}
`;

export function initStream() {
  const canvas = document.querySelector('canvas[data-stream]');
  if (!(canvas instanceof HTMLCanvasElement)) return false;

  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return false;

  const program = link(gl, VERT, FRAG);
  if (!program) return false;

  const still = reducedMotion();
  const soft = canvas.dataset.stream === 'soft';
  const small = window.matchMedia('(max-width: 700px)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  // Page heads carry a quieter river than the landing hero.
  const COUNT = Math.round((small ? 6000 : cores <= 4 ? 11000 : 18000) * (soft ? 0.55 : 1));

  // Attributes: seed, lane, speed, size | kind
  const data = new Float32Array(COUNT * 4);
  const kinds = new Float32Array(COUNT);
  const rand = mulberry(7);
  for (let i = 0; i < COUNT; i += 1) {
    const r = rand();
    const kind = r < 0.006 ? 4 : r < 0.02 ? 3 : r < 0.17 ? 1 : r < 0.42 ? 2 : 0;
    // Lanes cluster toward the ribbon's core for a denser centre.
    const lane = 0.5 + (rand() - 0.5) * (rand() < 0.7 ? 0.55 : 1);
    data[i * 4] = rand();
    data[i * 4 + 1] = lane;
    data[i * 4 + 2] = kind === 4 ? 0.01 + rand() * 0.012 : kind === 3 ? 0.07 + rand() * 0.04 : kind === 1 ? 0.035 + rand() * 0.03 : 0.018 + rand() * 0.025;
    data[i * 4 + 3] = kind === 4 ? 24 + rand() * 34 : kind === 3 ? 10 + rand() * 6 : kind === 1 ? 3 + rand() * 2.4 : kind === 2 ? 1.4 + rand() * 1.4 : 1.8 + rand() * 2.2;
    kinds[i] = kind;
  }

  gl.useProgram(program);
  bind(gl, program, 'a_p', data, 4);
  bind(gl, program, 'a_kind', kinds, 1);

  const u = {
    time: gl.getUniformLocation(program, 'u_time'),
    aspect: gl.getUniformLocation(program, 'u_aspect'),
    scroll: gl.getUniformLocation(program, 'u_scroll'),
    dpr: gl.getUniformLocation(program, 'u_dpr'),
    pointer: gl.getUniformLocation(program, 'u_pointer'),
    pointerOn: gl.getUniformLocation(program, 'u_pointerOn'),
    center: gl.getUniformLocation(program, 'u_center'),
    gain: gl.getUniformLocation(program, 'u_gain'),
    light: gl.getUniformLocation(program, 'u_light'),
    intro: gl.getUniformLocation(program, 'u_intro'),
    wave: gl.getUniformLocation(program, 'u_wave'),
  };

  // Light adds up on charcoal; on bone the particles are ink and must not.
  let light = 0;
  const readTone = () => {
    light = document.documentElement.dataset.theme === 'dark' ? 0 : 1;
    gl.blendFunc(gl.SRC_ALPHA, light ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
  };
  gl.enable(gl.BLEND);
  readTone();
  gl.clearColor(0, 0, 0, 0);

  let W = 0;
  let H = 0;
  let dpr = 1;
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = Math.max(1, Math.round(box.width * dpr));
    H = Math.max(1, Math.round(box.height * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    gl.viewport(0, 0, W, H);
  };

  const pointer = { x: 9, y: 9, on: 0, target: 0 };
  let scroll = 0;
  let running = false;
  let visible = true;
  let raf = 0;
  const t0 = performance.now() - 14000; // start mid-flow, not from an empty river
  // The river pours in from the left on arrival, once.
  const born = performance.now();
  const INTRO_MS = soft ? 1400 : 2300;
  // And a wave of light runs through it when the headline's word is written.
  let waveAt = -1;

  const draw = (now) => {
    const t = still ? 20 : (now - t0) / 1000;
    pointer.on += (pointer.target - pointer.on) * 0.08;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.time, t);
    gl.uniform1f(u.aspect, W / H);
    gl.uniform1f(u.scroll, scroll);
    gl.uniform1f(u.dpr, dpr);
    gl.uniform2f(u.pointer, pointer.x, pointer.y);
    gl.uniform1f(u.pointerOn, pointer.on);
    gl.uniform1f(u.center, soft ? -0.42 : -0.16);
    gl.uniform1f(u.gain, soft ? 0.8 : 1);
    gl.uniform1f(u.light, light);
    const intro = still ? 1 : Math.min(1, (now - born) / INTRO_MS);
    gl.uniform1f(u.intro, 1 - Math.pow(1 - intro, 3));
    const wt = waveAt < 0 ? 9 : (now - waveAt) / 1000;
    gl.uniform1f(u.wave, wt < 3 ? -1.5 + wt * 1.25 : 9);
    gl.drawArrays(gl.POINTS, 0, COUNT);
  };

  const loop = (now) => {
    raf = 0;
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  };

  const sync = () => {
    const next = visible && !document.hidden && !still;
    if (next === running) return;
    running = next;
    if (running && !raf) raf = requestAnimationFrame(loop);
  };

  resize();
  draw(performance.now());
  canvas.classList.add('is-live');

  new ResizeObserver(() => {
    resize();
    if (!running) draw(performance.now());
  }).observe(canvas);
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    sync();
  }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('clex:theme', () => {
    readTone();
    if (!running) draw(performance.now());
  });

  const host = canvas.closest('section') || canvas;
  host.addEventListener('clex:ink-written', () => {
    waveAt = performance.now();
    sync();
  });
  if (window.matchMedia('(hover: hover)').matches) {
    host.addEventListener('pointermove', (event) => {
      const box = canvas.getBoundingClientRect();
      const aspect = box.width / box.height;
      pointer.x = ((event.clientX - box.left) / box.width * 2 - 1) * aspect;
      pointer.y = -((event.clientY - box.top) / box.height * 2 - 1);
      pointer.target = 1;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { pointer.target = 0; });
  }

  window.addEventListener('scroll', () => {
    const box = host.getBoundingClientRect();
    scroll = Math.min(1, Math.max(0, -box.top / Math.max(1, box.height)));
    if (!running) draw(performance.now());
  }, { passive: true });

  sync();
  return true;
}

/** @param {WebGLRenderingContext} gl */
function link(gl, vs, fs) {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('stream shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const v = compile(gl.VERTEX_SHADER, vs);
  const f = compile(gl.FRAGMENT_SHADER, fs);
  const p = gl.createProgram();
  if (!v || !f || !p) return null;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

/** @param {WebGLRenderingContext} gl */
function bind(gl, program, name, array, size) {
  const loc = gl.getAttribLocation(program, name);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
