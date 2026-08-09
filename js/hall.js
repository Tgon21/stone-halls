/* ─────────────────────────────────────────────────────────────
   The walk.  Builds a hall out of transformed DOM planes and
   flies a camera through it.  Everything is in centimetres;
   the camera's eye sits at world y = 0.
   ───────────────────────────────────────────────────────────── */
import { uri, wallBay, ceilBay, floorBay, rose } from './textures.js';
import { openPlaque, plaqueIsOpen, closePlaque } from './plaque.js';
import { ambience } from './ambience.js';

const W        = 800;      // corridor width
const HALF     = W / 2;
const FLOOR_Y  = 172;      // floor is 1.72 m below the eye
const CEIL_Y   = -640;
const H        = FLOOR_Y - CEIL_Y;
const BAY      = 640;      // spacing between bays
const FIRST_Z  = -900;     // first work
const ENTRY_Z  = 620;      // where you stand when the curtain lifts
const EYE_PAD  = 120;      // how close you may get to a wall

const $  = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;

/* ── state ─────────────────────────────────────────────────── */
const cam = { x: 0, y: 0, z: ENTRY_Z, yaw: 0, pitch: 0, bob: 0 };
const glide = { on: false, t: 0, dur: 1, from: null, to: null, then: null };
const keys  = new Set();
let hall, works = [], frames = [], endZ = 0, tour = false, dragging = false;
let world, viewport;

/* ── build ─────────────────────────────────────────────────── */
function el(cls, parent, style) {
  const d = document.createElement('div');
  d.className = cls;
  if (style) Object.assign(d.style, style);
  (parent || world).appendChild(d);
  return d;
}

/** place an element in world space, centred on (x,y,z), turned by yaw/pitch.
    Centring uses margins so it stays put no matter how the plane is rotated. */
function put(node, x, y, z, ry = 0, rx = 0) {
  const cs = getComputedStyle(node);
  node.style.marginLeft = `${-parseFloat(cs.width) / 2}px`;
  node.style.marginTop = `${-parseFloat(cs.height) / 2}px`;
  node.style.transform =
    `translate3d(${x}px,${y}px,${z}px) rotateY(${ry}deg) rotateX(${rx}deg)`;
}

function buildShell(hue, bays) {
  const wallURI  = uri(wallBay(BAY, H, hue));
  const ceilURI  = uri(ceilBay(W, BAY, hue));
  const floorURI = uri(floorBay(W, BAY, hue));
  const midY = (FLOOR_Y + CEIL_Y) / 2;

  for (let i = 0; i < bays; i++) {
    const z = ENTRY_Z + 200 - i * BAY - BAY / 2;

    // side walls: face normal must point into the corridor
    for (const s of [-1, 1]) {
      const w = el('plane plane--wall', world,
        { width: BAY + 'px', height: H + 'px', backgroundImage: wallURI });
      put(w, s * HALF, midY, z, -s * 90);
      el('plane__falloff', w);
    }
    const f = el('plane plane--floor', world,
      { width: W + 'px', height: BAY + 'px', backgroundImage: floorURI });
    put(f, 0, FLOOR_Y, z, 0, 90);

    const c = el('plane plane--ceil', world,
      { width: W + 'px', height: BAY + 'px', backgroundImage: ceilURI });
    put(c, 0, CEIL_Y, z, 0, -90);
  }
}

function makeFrame(work, img, side, z, w, h, minor) {
  const node = el('frame' + (minor ? ' frame--minor' : ''), world,
    { width: w + 'px', height: h + 'px' });
  node.dataset.work = work.id;
  node.innerHTML = `
    <div class="frame__inner" style="width:100%;height:100%">
      <img src="${img ? img.thumb : ''}" alt="${(img && img.alt) || work.name}" loading="lazy" decoding="async">
      <div class="frame__light"></div>
      <div class="frame__glass"></div>
    </div>
    <div class="frame__fog"></div>
    <div class="frame__plaque">
      <b>${minor ? (img && img.short) || 'Interior' : work.name}</b>
      <i>${minor ? work.name : work.dates}</i>
    </div>`;
  put(node, side * (HALF - 4), minor ? -150 : -120, z, -side * 90);
  node._z = z; node._x = side * HALF; node._side = side; node._work = work;
  frames.push(node);
  return node;
}

function buildWorks() {
  works.forEach((wk, k) => {
    const side = k % 2 === 0 ? -1 : 1;
    const z = FIRST_Z - k * BAY;
    const ext = pick(wk, 'exterior', 0);
    const int = pick(wk, 'interior', 0);
    const det = pick(wk, 'detail', 0) || pick(wk, 'exterior', 1);

    makeFrame(wk, ext, side, z, 330, 410, false);
    if (int) makeFrame(wk, int, -side, z + 30, 250, 310, true);
    if (det) makeFrame(wk, det, side, z - BAY * 0.46, 168, 210, true);

    for (const s of [-1, 1]) {
      const sc = el('sconce', world);
      put(sc, s * (HALF - 16), -300, z + BAY / 2, -s * 90);
      el('sconce__glow', sc);
    }
  });
}

function buildEnd(hue) {
  endZ = FIRST_Z - (works.length - 1) * BAY - BAY * 1.15;
  const wall = el('plane plane--wall', world,
    { width: W + 'px', height: H + 'px', backgroundImage: uri(wallBay(W, H, hue)) });
  put(wall, 0, (FLOOR_Y + CEIL_Y) / 2, endZ);

  const end = el('endwall', world, { width: W + 'px', height: H + 'px' });
  put(end, 0, (FLOOR_Y + CEIL_Y) / 2, endZ + 6);
  end.innerHTML = `
    <div class="endwall__rose" style="width:380px;height:380px;margin-left:-190px;top:40px;
         background-image:${uri(rose(380, hue))};background-size:contain"></div>
    <div class="endwall__text" style="top:520px">
      <h2>“${hall.epigraph}”</h2>
      <p>${hall.era} · ${hall.years}</p>
    </div>`;

  const glow = el('sconce__glow', end);
  Object.assign(glow.style, { width: '900px', height: '900px', margin: '-450px 0 0 -450px', top: '230px' });
}

const pick = (wk, kind, n) => (wk.images || []).filter(i => i.kind === kind)[n] || null;

/* ── camera ────────────────────────────────────────────────── */
function applyCamera() {
  const y = cam.y + Math.sin(cam.bob) * 3.2;
  world.style.transform =
    `rotateX(${cam.pitch}deg) rotateY(${cam.yaw}deg) translate3d(${-cam.x}px,${-y}px,${-cam.z}px)`;
}

function fog() {
  for (const f of frames) {
    const dx = f._x - cam.x, dz = f._z - cam.z;
    const d = Math.hypot(dx, dz);
    f.style.setProperty('--f', clamp((d - 700) / 2900, 0, 0.93).toFixed(3));
    f.style.visibility = d > 6200 ? 'hidden' : '';
  }
}

function goTo(target, dur, then) {
  glide.on = true; glide.t = 0; glide.dur = dur;
  glide.from = { x: cam.x, z: cam.z, yaw: cam.yaw, pitch: cam.pitch };
  glide.to = target; glide.then = then || null;
}

function standBefore(frame) {
  const s = frame._side;
  return { x: clamp(frame._x - s * 330, -HALF + EYE_PAD, HALF - EYE_PAD),
           z: frame._z, yaw: s * 90, pitch: 0 };
}

/* ── loop ──────────────────────────────────────────────────── */
let last = performance.now();
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;

  if (glide.on) {
    glide.t = Math.min(glide.t + dt / glide.dur, 1);
    const e = glide.t < .5 ? 4 * glide.t ** 3 : 1 - Math.pow(-2 * glide.t + 2, 3) / 2;
    let dy = glide.to.yaw - glide.from.yaw;
    while (dy > 180) dy -= 360; while (dy < -180) dy += 360;
    cam.x = lerp(glide.from.x, glide.to.x, e);
    cam.z = lerp(glide.from.z, glide.to.z, e);
    cam.yaw = glide.from.yaw + dy * e;
    cam.pitch = lerp(glide.from.pitch, glide.to.pitch, e);
    if (glide.t >= 1) { glide.on = false; glide.then && glide.then(); }
  } else if (tour) {
    cam.z -= 62 * dt;
    const near = frames.reduce((b, f) =>
      Math.abs(f._z - cam.z) < Math.abs(b._z - cam.z) ? f : b, frames[0]);
    if (near) {
      const want = near._side * 62 * clamp(1 - Math.abs(near._z - cam.z) / 520, 0, 1);
      cam.yaw = lerp(cam.yaw, want, 1 - Math.pow(0.02, dt));
      cam.x = lerp(cam.x, -near._side * 40, 1 - Math.pow(0.06, dt));
    }
    cam.bob += dt * 3.1;
    if (cam.z < endZ + 700) { tour = false; $('#tour').classList.remove('on'); }
  } else if (!plaqueIsOpen()) {
    const run = keys.has('shift') ? 1.9 : 1;
    let f = 0, s = 0, t = 0;
    if (keys.has('w') || keys.has('arrowup')) f += 1;
    if (keys.has('s') || keys.has('arrowdown')) f -= 1;
    if (keys.has('a')) s -= 1;
    if (keys.has('d')) s += 1;
    if (keys.has('arrowleft')) t -= 1;
    if (keys.has('arrowright')) t += 1;
    if (touchDrive) f += touchDrive;

    cam.yaw += t * 86 * dt;
    if (f || s) {
      const sp = 300 * run * dt;
      const r = cam.yaw * Math.PI / 180;
      // forward = (sin yaw, -cos yaw), right = (cos yaw, sin yaw) in the xz plane
      cam.x += (Math.sin(r) * f + Math.cos(r) * s) * sp;
      cam.z += (-Math.cos(r) * f + Math.sin(r) * s) * sp;
      cam.bob += dt * 8.4 * run;
    } else {
      cam.bob = lerp(cam.bob, Math.round(cam.bob / Math.PI) * Math.PI, 1 - Math.pow(.05, dt));
    }
  }

  cam.x = clamp(cam.x, -HALF + EYE_PAD, HALF - EYE_PAD);
  cam.z = clamp(cam.z, endZ + 300, ENTRY_Z + 120);
  cam.pitch = clamp(cam.pitch, -34, 34);

  applyCamera(); fog(); updateRail();
  requestAnimationFrame(tick);
}

/* ── rail ──────────────────────────────────────────────────── */
let railDots = [];
function updateRail() {
  const p = clamp((ENTRY_Z - cam.z) / (ENTRY_Z - endZ - 300), 0, 1);
  const fill = $('#railFill'); if (fill) fill.style.height = (p * 100) + '%';
  const near = works.reduce((b, wk, i) =>
    Math.abs(FIRST_Z - i * BAY - cam.z) < Math.abs(FIRST_Z - b * BAY - cam.z) ? i : b, 0);
  railDots.forEach((d, i) => d.classList.toggle('on', i === near && Math.abs(FIRST_Z - near * BAY - cam.z) < BAY * .6));
}

/* ── input ─────────────────────────────────────────────────── */
let touchDrive = 0;
function wireInput() {
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape') return;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    keys.add(k === 'shift' ? 'shift' : k);
    if (k === 't') toggleTour();
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase() === 'shift' ? 'shift' : e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  let px = 0, py = 0, moved = 0;
  const down = e => {
    if (e.target.closest('.hud') || plaqueIsOpen()) return;
    dragging = true; moved = 0;
    px = e.clientX; py = e.clientY;
    viewport.classList.add('dragging');
  };
  const move = e => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    glide.on = false; tour && toggleTour();
    cam.yaw -= dx * 0.17;
    cam.pitch = clamp(cam.pitch - dy * 0.13, -34, 34);
  };
  const up = () => { dragging = false; viewport.classList.remove('dragging'); };
  viewport.addEventListener('pointerdown', down);
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  viewport.addEventListener('wheel', e => {
    if (plaqueIsOpen()) return;
    e.preventDefault();
    glide.on = false;
    const r = cam.yaw * Math.PI / 180, d = clamp(e.deltaY, -90, 90) * 1.5;
    cam.x += Math.sin(r) * d;          // scroll down walks forward
    cam.z -= Math.cos(r) * d;
  }, { passive: false });

  document.addEventListener('click', e => {
    const f = e.target.closest('.frame');
    if (!f || moved > 12 || plaqueIsOpen()) return;
    visit(f);
  });
  document.addEventListener('pointerover', e => {
    const f = e.target.closest('.frame');
    frames.forEach(x => x.classList.toggle('hot', x === f));
    viewport.classList.toggle('pointing', !!f);
  });

  for (const [id, dir] of [['padF', 1], ['padB', -1]]) {
    const p = document.getElementById(id);
    const on = e => { e.preventDefault(); touchDrive = dir; };
    const off = () => touchDrive = 0;
    p.addEventListener('pointerdown', on);
    p.addEventListener('pointerup', off);
    p.addEventListener('pointerleave', off);
    p.addEventListener('pointercancel', off);
  }
}

function visit(frame) {
  goTo(standBefore(frame), 0.85);
  openPlaque(frame._work, works, hall, next => {
    const t = frames.find(f => f._work.id === next.id && !f.classList.contains('frame--minor'));
    if (t) goTo(standBefore(t), 0.7);
  });
}

function toggleTour() {
  tour = !tour; glide.on = false;
  $('#tour').classList.toggle('on', tour);
  if (tour && cam.z < endZ + 800) cam.z = ENTRY_Z;
}

/* ── boot ──────────────────────────────────────────────────── */
async function boot() {
  viewport = $('#viewport'); world = $('#world');
  const id = new URLSearchParams(location.search).get('hall') || 'romanesque';

  const [tl, data] = await Promise.all([
    fetch('data/timeline.json').then(r => r.json()),
    fetch(`data/halls/${id}.json`).then(r => r.json()).catch(() => null),
  ]);
  hall = tl.halls.find(h => h.id === id) || tl.halls[0];
  if (!data) { location.replace('index.html'); return; }
  works = data.works;

  document.title = `${hall.title} — The Stone Halls`;
  $('#hallName').textContent = hall.title;
  $('#hallEra').textContent = `${hall.era} · ${hall.years}`;

  const halls = tl.halls;
  const idx = halls.findIndex(h => h.id === hall.id);
  const nxt = halls[idx + 1];
  const nextLink = $('#nextHall');
  if (nxt) { nextLink.href = `hall.html?hall=${nxt.id}`; nextLink.querySelector('span').textContent = nxt.title; }
  else nextLink.style.display = 'none';

  buildShell(hall.hue, works.length + 4);
  buildWorks();
  buildEnd(hall.hue);

  const rail = $('#rail');
  works.forEach((wk, i) => {
    const d = el('rail__dot', rail);
    d.style.top = ((i + .5) / works.length * 100) + '%';
    d.title = wk.name;
    d.addEventListener('click', () => {
      const t = frames.find(f => f._work.id === wk.id && !f.classList.contains('frame--minor'));
      goTo({ ...standBefore(t), x: 0, yaw: t._side * 42 }, 1.1);
    });
    railDots.push(d);
  });

  wireInput();
  $('#tour').addEventListener('click', toggleTour);
  $('#sound').addEventListener('click', e => e.currentTarget.classList.toggle('on', ambience.toggle()));
  if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');

  requestAnimationFrame(tick);
  requestAnimationFrame(() => $('#curtain').classList.add('lift'));

  // deep link straight to a work
  const w = new URLSearchParams(location.search).get('work');
  if (w) {
    const f = frames.find(x => x._work.id === w && !x.classList.contains('frame--minor'));
    if (f) { cam.z = f._z + 900; setTimeout(() => visit(f), 900); }
  }
}

boot();
