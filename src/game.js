(() => {
'use strict';

// ---------- basics ----------
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cv = $('#cv'), ctx = cv.getContext('2d');
const N = 8;
const rand = n => Math.floor(Math.random() * n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = t => { const c = 1.7; t = clamp(t, 0, 1) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const yesterday = () => { const d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const fmt = n => Math.floor(n).toLocaleString('en-US');

const COLORS = [
  { a: '#FFC2D9', b: '#FF7AA8', d: '#D9578A' }, // strawberry
  { a: '#FFD9AE', b: '#FFA65C', d: '#DD7E33' }, // peach
  { a: '#FFF3B0', b: '#FFD84D', d: '#D9AE1F' }, // lemon
  { a: '#C2F7DD', b: '#5FD9A0', d: '#33A874' }, // matcha
  { a: '#C7EAFF', b: '#5DB8F5', d: '#3994D6' }, // soda
  { a: '#E2D4FF', b: '#A585F5', d: '#7A58D6' }, // taro
  { a: '#FFCBC5', b: '#FF6F6F', d: '#D94B4B' }, // cherry
];

const SKINS = [
  { id: 'mochi', name: 'Mochi', rarity: 'Common' },
  { id: 'kitty', name: 'Kitty', rarity: 'Common' },
  { id: 'bear', name: 'Teddy', rarity: 'Common' },
  { id: 'bunny', name: 'Bunbun', rarity: 'Rare' },
  { id: 'chick', name: 'Chirp', rarity: 'Rare' },
  { id: 'frog', name: 'Froggy', rarity: 'Rare' },
  { id: 'panda', name: 'Panpan', rarity: 'Epic' },
  { id: 'alien', name: 'Blip', rarity: 'Epic' },
];
const RARITY_W = { Common: 5, Rare: 2.5, Epic: 1 };
const CAPSULE_COST = 150;
const BOOST_COST = { hammer: 40, bomb: 80, swap: 30 };
const CONTINUE_COST = 100;
const DAILY = [30, 40, 50, 60, 80, 100, 200];
const GAME_VERSION = __VERSION__;

// ---------- shapes ----------
const BASE = [
  [[[0,0]], 2.5],
  [[[0,0],[1,0]], 4],
  [[[0,0],[1,0],[2,0]], 4],
  [[[0,0],[1,0],[2,0],[3,0]], 3],
  [[[0,0],[1,0],[2,0],[3,0],[4,0]], 1.6],
  [[[0,0],[1,0],[0,1],[1,1]], 5],
  [[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]], 1.3],
  [[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], 2],
  [[[0,0],[1,0],[0,1]], 4],
  [[[0,0],[0,1],[0,2],[1,2]], 3],
  [[[1,0],[1,1],[1,2],[0,2]], 3],
  [[[0,0],[1,0],[2,0],[1,1]], 3],
  [[[1,0],[2,0],[0,1],[1,1]], 2],
  [[[0,0],[1,0],[1,1],[2,1]], 2],
  [[[0,0],[0,1],[0,2],[1,2],[2,2]], 1.6],
  [[[0,0],[1,1]], 1],
];
function norm(cells) {
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
const rot = cells => norm(cells.map(([x, y]) => [-y, x]));
const SHAPES = [];
for (const [cells, w] of BASE) {
  const seen = new Set(); let c = norm(cells); const rots = [];
  for (let i = 0; i < 4; i++) { const k = JSON.stringify(c); if (!seen.has(k)) { seen.add(k); rots.push(c); } c = rot(c); }
  for (const r of rots) SHAPES.push({
    cells: r, w: w / rots.length * Math.min(rots.length, 2),
    gw: Math.max(...r.map(p => p[0])) + 1, gh: Math.max(...r.map(p => p[1])) + 1,
  });
}

// ---------- persistence ----------
const SAVE_KEY = 'mochipop_v1';
const DEFAULT = () => ({
  best: 0, coins: 120, level: 1, xp: 0,
  power: { hammer: 2, bomb: 1, swap: 2 },
  skins: ['mochi'], skin: 'mochi',
  settings: { sound: true, music: true, vib: true },
  daily: { last: '', streak: 0 },
  missions: null, tutorialDone: false, run: null, games: 0, capsulesOpened: 0,
});
let S = DEFAULT();
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) S = Object.assign(DEFAULT(), JSON.parse(raw)); } catch (e) {}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

// ---------- audio ----------
let AC = null, master = null, musicTimer = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
    startMusic();
  } catch (e) { AC = null; }
}
function tone(freq, dur = 0.12, type = 'sine', vol = 0.25, slide = 0, delay = 0) {
  if (!AC || !S.settings.sound) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  pick() { tone(660, 0.06, 'sine', 0.15, 880); },
  place() { tone(420, 0.1, 'sine', 0.3, 200); tone(900, 0.05, 'triangle', 0.08, 0, 0.01); },
  bad() { tone(220, 0.12, 'square', 0.06, 160); },
  clear(lines, combo) {
    const base = 523.25 * Math.pow(2, Math.min(combo, 10) / 12);
    const steps = [0, 4, 7, 12, 16, 19];
    for (let i = 0; i < Math.min(3 + lines, 6); i++) tone(base * Math.pow(2, steps[i] / 12), 0.18, 'triangle', 0.22, 0, i * 0.06);
  },
  coin() { tone(988, 0.07, 'square', 0.06); tone(1319, 0.12, 'square', 0.06, 0, 0.07); },
  fever() { tone(300, 0.6, 'sawtooth', 0.08, 1200); for (let i = 0; i < 5; i++) tone(700 + i * 150, 0.12, 'triangle', 0.15, 0, 0.1 + i * 0.07); },
  over() { [523, 440, 349, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.2, 0, i * 0.15)); },
  tap() { tone(800, 0.04, 'sine', 0.1); },
  boom() { tone(160, 0.4, 'sawtooth', 0.2, 40); tone(90, 0.5, 'sine', 0.3, 30); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', 0.2, 0, i * 0.08)); },
};
function startMusic() {
  if (musicTimer || !AC) return;
  const prog = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
  const mel = [0, 2, 4, 7, 9, 7, 4, 2];
  let step = 0;
  musicTimer = setInterval(() => {
    if (!S.settings.music || document.hidden) return;
    const chord = prog[Math.floor(step / 8) % 4];
    if (step % 4 === 0) tone(chord[0] / 2, 0.9, 'sine', 0.07);
    if (step % 2 === 0) tone(chord[(step / 2) % 3] * 2, 0.25, 'triangle', 0.025);
    if (Math.random() < 0.45) { const n = mel[rand(mel.length)]; tone(chord[0] * 2 * Math.pow(2, n / 12), 0.3, 'sine', 0.03); }
    step++;
  }, 260);
}
function vib(p) {
  if (!S.settings.vib) return;
  try {
    if (window.Android && window.Android.vibrate) window.Android.vibrate(Array.isArray(p) ? p[0] + (p[2] || 0) : p);
    else if (navigator.vibrate) navigator.vibrate(p);
  } catch (e) {}
}

// ---------- mochi sprite renderer ----------
const spriteCache = new Map();
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawMochi(c, s, ci, skin, face, star) {
  const col = COLORS[ci];
  const eared = skin !== 'mochi';
  const top = eared ? s * 0.17 : s * 0.06;
  const bx = s * 0.06, bw = s * 0.88, bh = s * 0.94 - top;
  c.lineWidth = s * 0.05; c.strokeStyle = col.d; c.lineJoin = 'round';
  const fillEar = (f) => { c.fillStyle = f; c.fill(); c.stroke(); };
  // ears / accessories behind body
  if (skin === 'kitty') {
    for (const sx of [0.22, 0.78]) { c.beginPath(); c.moveTo(s * (sx - 0.15), s * 0.36); c.lineTo(s * (sx + (sx < .5 ? -0.04 : 0.04)), s * 0.04); c.lineTo(s * (sx + 0.15), s * 0.3); c.closePath(); fillEar(col.b); }
  } else if (skin === 'bear' || skin === 'panda') {
    for (const sx of [0.22, 0.78]) { c.beginPath(); c.arc(s * sx, s * 0.2, s * 0.13, 0, 7); fillEar(skin === 'panda' ? '#4a3d55' : col.b); }
  } else if (skin === 'bunny') {
    for (const sx of [0.32, 0.68]) { c.beginPath(); c.ellipse(s * sx, s * 0.17, s * 0.09, s * 0.17, sx < .5 ? -0.25 : 0.25, 0, 7); fillEar(col.b); }
  } else if (skin === 'frog') {
    for (const sx of [0.28, 0.72]) { c.beginPath(); c.arc(s * sx, s * 0.25, s * 0.15, 0, 7); fillEar(col.b); }
  } else if (skin === 'alien') {
    c.beginPath(); c.moveTo(s * 0.5, s * 0.2); c.lineTo(s * 0.5, s * 0.06); c.stroke();
    c.beginPath(); c.arc(s * 0.5, s * 0.07, s * 0.06, 0, 7); fillEar('#fff3a0');
  } else if (skin === 'chick') {
    c.beginPath(); c.moveTo(s * 0.42, s * 0.22); c.quadraticCurveTo(s * 0.4, s * 0.02, s * 0.52, s * 0.06); c.moveTo(s * 0.52, s * 0.22); c.quadraticCurveTo(s * 0.6, s * 0.04, s * 0.66, s * 0.12); c.stroke();
  }
  // body
  rr(c, bx, top, bw, bh, s * 0.3);
  const g = c.createLinearGradient(0, top, 0, top + bh); g.addColorStop(0, col.a); g.addColorStop(0.55, col.b); g.addColorStop(1, col.d);
  c.fillStyle = g; c.fill(); c.stroke();
  // inner ears on top of body edge
  if (skin === 'kitty' || skin === 'bunny' || skin === 'bear') {
    c.fillStyle = 'rgba(255,255,255,.45)';
    if (skin === 'bunny') for (const sx of [0.32, 0.68]) { c.beginPath(); c.ellipse(s * sx, s * 0.15, s * 0.04, s * 0.1, sx < .5 ? -0.25 : 0.25, 0, 7); c.fill(); }
    if (skin === 'bear') for (const sx of [0.22, 0.78]) { c.beginPath(); c.arc(s * sx, s * 0.2, s * 0.06, 0, 7); c.fill(); }
    if (skin === 'kitty') for (const sx of [0.22, 0.78]) { c.beginPath(); c.moveTo(s * (sx - 0.07), s * 0.28); c.lineTo(s * (sx + (sx < .5 ? -0.03 : 0.03)), s * 0.12); c.lineTo(s * (sx + 0.08), s * 0.26); c.closePath(); c.fill(); }
  }
  // gloss
  c.fillStyle = 'rgba(255,255,255,.75)';
  c.beginPath(); c.ellipse(s * 0.3, top + bh * 0.2, s * 0.13, s * 0.07, -0.5, 0, 7); c.fill();
  c.beginPath(); c.arc(s * 0.5, top + bh * 0.13, s * 0.03, 0, 7); c.fill();
  // face
  const ey = skin === 'frog' ? s * 0.26 : top + bh * 0.5;
  const ex = skin === 'frog' ? [0.28, 0.72] : [0.34, 0.66];
  if (skin === 'frog') for (const sx of ex) { c.fillStyle = '#fff'; c.beginPath(); c.arc(s * sx, ey, s * 0.09, 0, 7); c.fill(); }
  if (skin === 'panda') { c.fillStyle = '#4a3d55'; for (const sx of ex) { c.beginPath(); c.ellipse(s * sx, ey + s * 0.01, s * 0.09, s * 0.11, sx < .5 ? 0.5 : -0.5, 0, 7); c.fill(); } }
  const ink = skin === 'panda' ? '#fff' : '#4a2f4f';
  c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = s * 0.045; c.lineCap = 'round';
  for (const sx of ex) {
    const x = s * sx;
    if (face === 1) { c.beginPath(); c.moveTo(x - s * 0.05, ey); c.lineTo(x + s * 0.05, ey); c.stroke(); }
    else if (face === 2) { c.beginPath(); c.arc(x, ey + s * 0.02, s * 0.05, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    else {
      c.beginPath(); c.ellipse(x, ey, s * 0.05, s * 0.065, 0, 0, 7); c.fill();
      c.fillStyle = skin === 'panda' ? '#4a3d55' : '#fff'; c.beginPath(); c.arc(x + s * 0.018, ey - s * 0.022, s * 0.018, 0, 7); c.fill(); c.fillStyle = ink;
    }
  }
  if (skin === 'alien') { c.beginPath(); c.ellipse(s * 0.5, ey - s * 0.12, s * 0.035, s * 0.045, 0, 0, 7); c.fillStyle = '#4a2f4f'; c.fill(); }
  // blush
  c.fillStyle = 'rgba(255,90,140,.35)';
  for (const sx of [0.22, 0.78]) { c.beginPath(); c.ellipse(s * sx, ey + s * 0.1, s * 0.07, s * 0.04, 0, 0, 7); c.fill(); }
  // mouth
  const my = ey + s * 0.1;
  c.strokeStyle = '#4a2f4f'; c.lineWidth = s * 0.035;
  if (skin === 'chick') { c.fillStyle = '#ff9a3d'; c.beginPath(); c.moveTo(s * 0.44, my - s * 0.02); c.lineTo(s * 0.56, my - s * 0.02); c.lineTo(s * 0.5, my + s * 0.06); c.closePath(); c.fill(); }
  else if (face === 2) { c.fillStyle = '#c2405e'; c.beginPath(); c.arc(s * 0.5, my - s * 0.01, s * 0.065, 0, Math.PI); c.closePath(); c.fill(); }
  else if (skin === 'kitty' || skin === 'bunny') { c.beginPath(); c.arc(s * 0.455, my - s * 0.01, s * 0.045, 0.2, Math.PI - 0.2); c.arc(s * 0.545, my - s * 0.01, s * 0.045, 0.2, Math.PI - 0.2); c.stroke(); }
  else { c.beginPath(); c.arc(s * 0.5, my - s * 0.03, s * 0.05, 0.3, Math.PI - 0.3); c.stroke(); }
  if (star) drawStar(c, s * 0.8, top + s * 0.08, s * 0.14, '#fff36b', '#e0a800');
}
function drawStar(c, x, y, r, fill, stroke) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.lineWidth = r * 0.25; c.strokeStyle = stroke; c.stroke(); }
}
function sprite(ci, skin, face, star) {
  const px = Math.max(16, Math.ceil(L.cell * DPR));
  const key = px + '|' + ci + '|' + skin + '|' + face + '|' + (star ? 1 : 0);
  let sp = spriteCache.get(key);
  if (!sp) {
    sp = document.createElement('canvas'); sp.width = sp.height = px;
    drawMochi(sp.getContext('2d'), px, ci, skin, face, star);
    spriteCache.set(key, sp);
  }
  return sp;
}

// ---------- layout ----------
let DPR = 1, VW = 0, VH = 0;
const L = { cell: 40, bx: 0, by: 0, bs: 320, trayY: 0, trayH: 0, slots: [], trayScale: 0.5 };
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  const top = 118, bottom = 92;
  const avail = VH - top - bottom;
  L.bs = Math.floor(Math.min(VW - 34, 520, avail * 0.66));
  L.cell = L.bs / N;
  L.bx = (VW - L.bs) / 2;
  L.trayH = Math.min(avail - L.bs - 14, L.cell * 3.6);
  const slack = avail - L.bs - L.trayH;
  L.by = top + Math.max(0, slack * 0.35);
  L.trayY = L.by + L.bs + Math.max(10, slack * 0.3);
  L.trayScale = clamp(Math.min((L.trayH - 8) / (3.4 * L.cell), (VW / 3 - 12) / (3.4 * L.cell)), 0.32, 0.66);
  L.slots = [0, 1, 2].map(i => ({ x: VW * (i * 2 + 1) / 6, y: L.trayY + L.trayH / 2 }));
  spriteCache.clear();
}
window.addEventListener('resize', resize);

// ---------- game state ----------
let G = null; // current run
let screen = 'home';
function newRun() {
  return {
    grid: Array.from({ length: N }, () => Array(N).fill(null)),
    pieces: [], score: 0, shown: 0, combo: 0, comboLife: 0,
    fever: 0, feverTurns: 0, coinsRun: 0, continued: false, over: false,
    stats: { lines: 0, pieces: 0, sweet: 0, stars: 0, fevers: 0, maxCombo: 0 },
  };
}
function makePiece(shape) {
  const ci = rand(COLORS.length);
  return { shape, ci, star: Math.random() < 0.13 ? rand(shape.cells.length) : -1, anim: 0 };
}
function pickShape(score) {
  const hard = clamp(score / 9000, 0, 1);
  let tot = 0; const ws = SHAPES.map(s => { let w = s.w; const n = s.cells.length; if (n >= 5) w *= 1 + hard * 0.9; if (n <= 2) w *= 1 - hard * 0.5; tot += w; return w; });
  let r = Math.random() * tot;
  for (let i = 0; i < SHAPES.length; i++) { r -= ws[i]; if (r <= 0) return SHAPES[i]; }
  return SHAPES[0];
}
function canPlace(grid, shape, gx, gy) {
  for (const [x, y] of shape.cells) { const X = gx + x, Y = gy + y; if (X < 0 || Y < 0 || X >= N || Y >= N || grid[Y][X]) return false; }
  return true;
}
function fitsAnywhere(grid, shape) {
  for (let y = 0; y <= N - shape.gh; y++) for (let x = 0; x <= N - shape.gw; x++) if (canPlace(grid, shape, x, y)) return true;
  return false;
}
function linesFor(grid, shape, gx, gy) {
  const filled = (X, Y) => grid[Y][X] || shape.cells.some(([x, y]) => gx + x === X && gy + y === Y);
  const rows = [], cols = [];
  for (let i = 0; i < N; i++) {
    let r = true, c = true;
    for (let j = 0; j < N; j++) { if (!filled(j, i)) r = false; if (!filled(i, j)) c = false; }
    if (r) rows.push(i); if (c) cols.push(i);
  }
  return { rows, cols };
}
function helperShape(grid) {
  const order = SHAPES.filter(s => s.cells.length <= 5).sort(() => Math.random() - 0.5);
  for (const s of order) for (let y = 0; y <= N - s.gh; y++) for (let x = 0; x <= N - s.gw; x++)
    if (canPlace(grid, s, x, y)) { const l = linesFor(grid, s, x, y); if (l.rows.length + l.cols.length) return s; }
  return null;
}
function genTray() {
  for (let a = 0; a < 40; a++) {
    const t = [0, 1, 2].map(() => makePiece(pickShape(G.score)));
    if (Math.random() < 0.38) { const h = helperShape(G.grid); if (h) t[rand(3)] = makePiece(h); }
    if (t.some(p => fitsAnywhere(G.grid, p.shape))) { G.pieces = t; return; }
  }
  G.pieces = [0, 1, 2].map(() => makePiece(SHAPES[0]));
}
function anyMove() { return G.pieces.some(p => p && fitsAnywhere(G.grid, p.shape)); }

// ---------- effects ----------
const parts = [], floats = [], clearing = [], rings = [];
let shake = 0, flash = 0, T = 0;
function burst(x, y, ci, n = 7) {
  const col = COLORS[ci];
  for (let i = 0; i < n && parts.length < 500; i++) {
    const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 260;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.6 + Math.random() * 0.5, t: 0,
      r: L.cell * (0.06 + Math.random() * 0.08), col: Math.random() < 0.5 ? col.b : col.a, kind: Math.random() < 0.25 ? 'star' : Math.random() < 0.1 ? 'heart' : 'dot', rot: Math.random() * 6 });
  }
}
function confetti(n = 80) {
  for (let i = 0; i < n; i++) {
    const c = COLORS[rand(COLORS.length)];
    parts.push({ x: Math.random() * VW, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 120, vy: 100 + Math.random() * 200, life: 2.5, t: 0, r: 5 + Math.random() * 5, col: c.b, kind: 'conf', rot: Math.random() * 6, grav: 0.25 });
  }
}
function floatText(text, x, y, color = '#fff', size = 34, stroke = '#e86fa0') {
  floats.push({ text, x, y, t: 0, color, size, stroke });
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1600); }

// ---------- placing & clearing ----------
const PRAISE = ['', 'Nice!', 'Sweet!', 'Yummy!', 'Delicious!', 'Mochi-licious!'];
function place(pi, gx, gy) {
  const p = G.pieces[pi], now = T;
  p.shape.cells.forEach(([x, y], i) => { G.grid[gy + y][gx + x] = { ci: p.ci, star: i === p.star, pt: now + i * 0.025 }; });
  G.pieces[pi] = null;
  G.score += p.shape.cells.length;
  G.stats.pieces++; mission('pieces', 1);
  SFX.place(); vib(12);
  const { rows, cols } = linesFor(G.grid, { cells: [] }, 0, 0);
  let justFever = false;
  const lines = rows.length + cols.length;
  const cx = L.bx + (gx + p.shape.gw / 2) * L.cell, cy = L.by + (gy + p.shape.gh / 2) * L.cell;
  if (lines) {
    G.combo = G.comboLife > 0 ? G.combo + 1 : 1; G.comboLife = 3;
    G.stats.maxCombo = Math.max(G.stats.maxCombo, G.combo); missionMax('combo', G.combo);
    const set = new Map();
    let sweet = 0;
    for (const r of rows) { const c0 = G.grid[r][0].ci; if (G.grid[r].every(c => c.ci === c0)) sweet++; for (let x = 0; x < N; x++) set.set(x + ',' + r, [x, r]); }
    for (const c of cols) { const c0 = G.grid[0][c].ci; if (G.grid.every(row => row[c].ci === c0)) sweet++; for (let y = 0; y < N; y++) set.set(c + ',' + y, [c, y]); }
    let stars = 0;
    for (const [x, y] of set.values()) {
      const cell = G.grid[y][x];
      const d = Math.hypot(L.bx + (x + .5) * L.cell - cx, L.by + (y + .5) * L.cell - cy) / L.cell;
      clearing.push({ x, y, ci: cell.ci, star: cell.star, t: -d * 0.035, done: false });
      if (cell.star) stars++;
      G.grid[y][x] = null;
    }
    const base = [0, 100, 300, 600, 1000, 1500, 2100][Math.min(lines, 6)];
    const mult = (1 + (G.combo - 1) * 0.5) * (G.feverTurns > 0 ? 2 : 1);
    let pts = Math.round(base * mult) + sweet * 250;
    const perfect = G.grid.every(r => r.every(c => !c));
    if (perfect) pts += 2000;
    G.score += pts;
    const coins = (lines + stars * 5 + sweet * 3 + (perfect ? 25 : 0)) * (G.feverTurns > 0 ? 2 : 1);
    G.coinsRun += coins;
    G.stats.lines += lines; mission('lines', lines);
    G.stats.sweet += sweet; mission('sweet', sweet);
    G.stats.stars += stars; mission('stars', stars);
    // feedback
    SFX.clear(lines, G.combo); if (stars) setTimeout(SFX.coin, 150);
    vib(lines > 1 ? [20, 30, 30] : 25);
    shake = Math.min(18, 4 + lines * 3 + G.combo);
    flash = Math.min(0.5, 0.12 * lines);
    rings.push({ x: cx, y: cy, t: 0, ci: p.ci });
    floatText('+' + fmt(pts), cx, cy, '#fff', 30 + lines * 3);
    const word = perfect ? 'PERFECT!' : PRAISE[Math.min(lines, 5)];
    floatText(word, VW / 2, L.by + L.bs * 0.38, '#fff', 44 + Math.min(lines, 4) * 6, perfect ? '#7a58d6' : '#ff6f9f');
    if (G.combo >= 2) floatText('Combo x' + G.combo, VW / 2, L.by + L.bs * 0.55, '#fff6a8', 34, '#e08a00');
    if (sweet) floatText(sweet > 1 ? 'Sweet Line x' + sweet + '!' : 'Sweet Line!', VW / 2, L.by + L.bs * 0.7, '#fff', 30, '#33a874');
    if (perfect) { confetti(120); SFX.win(); }
    // fever
    if (G.feverTurns <= 0) {
      G.fever += lines * 14 + (G.combo - 1) * 6 + sweet * 15;
      if (G.fever >= 100) {
        G.fever = 0; G.feverTurns = 8; justFever = true; G.stats.fevers++; mission('fevers', 1);
        SFX.fever(); confetti(60); vib([40, 40, 80]);
        floatText('FEVER TIME!', VW / 2, L.by - 10, '#fff', 46, '#ff5d7a');
      }
    }
  } else {
    if (G.comboLife > 0 && --G.comboLife === 0) G.combo = 0;
  }
  if (G.feverTurns > 0 && !justFever) G.feverTurns--;
  if (G.pieces.every(x => !x)) { genTray(); G.pieces.forEach(pp => pp.anim = -0.15); }
  bumpScore();
  saveRun();
  checkStuck();
}
function checkStuck() {
  if (!G || G.over) return;
  if (anyMove()) { $('#stuck').classList.add('hidden'); return; }
  const boosts = S.power.hammer + S.power.bomb + S.power.swap;
  const canBuy = S.coins >= Math.min(BOOST_COST.hammer, BOOST_COST.swap);
  if (boosts > 0 || canBuy) { $('#stuck').classList.remove('hidden'); SFX.bad(); }
  else setTimeout(gameOver, 700);
}
function smash(cells, big) {
  let any = false;
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= N || y >= N) continue;
    const c = G.grid[y][x]; if (!c) continue;
    any = true;
    clearing.push({ x, y, ci: c.ci, star: c.star, t: -Math.hypot(x - cells[0][0], y - cells[0][1]) * 0.04, done: false });
    if (c.star) { G.coinsRun += 5; }
    G.grid[y][x] = null; G.score += 10;
  }
  if (any) { shake = big ? 16 : 8; big ? SFX.boom() : SFX.place(); vib(big ? [30, 30, 60] : 25); bumpScore(); saveRun(); }
  return any;
}

// ---------- missions ----------
const MISSION_POOL = [
  { id: 'lines', icon: '🧹', text: n => `Clear ${n} lines`, t: [15, 25, 40], r: 60 },
  { id: 'combo', icon: '🔥', text: n => `Reach a x${n} combo`, t: [3, 4, 6], r: 70, max: true },
  { id: 'score', icon: '⭐', text: n => `Score ${fmt(n)} in one game`, t: [2000, 4000, 8000], r: 80, max: true },
  { id: 'sweet', icon: '🍬', text: n => `Make ${n} Sweet Line${n > 1 ? 's' : ''}`, t: [1, 2, 4], r: 70 },
  { id: 'pieces', icon: '🧩', text: n => `Place ${n} pieces`, t: [60, 100, 160], r: 50 },
  { id: 'stars', icon: '🌟', text: n => `Pop ${n} star mochis`, t: [3, 6, 10], r: 60 },
  { id: 'fevers', icon: '🌈', text: n => `Trigger Fever ${n} time${n > 1 ? 's' : ''}`, t: [1, 2, 4], r: 80 },
];
function ensureMissions() {
  if (S.missions && S.missions.date === today()) return;
  const pool = MISSION_POOL.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  const tier = Math.min(2, Math.floor((S.level - 1) / 4));
  S.missions = { date: today(), list: pool.map(m => ({ id: m.id, target: m.t[tier], prog: 0, claimed: false, reward: m.r + tier * 20 })) };
  save();
}
function mission(id, n) {
  if (!n || !S.missions) return;
  for (const m of S.missions.list) if (m.id === id && !m.claimed) {
    const was = m.prog >= m.target; m.prog = Math.min(m.target, m.prog + n);
    if (!was && m.prog >= m.target) toast('Mission complete! 🎉');
  }
}
function missionMax(id, v) {
  if (!S.missions) return;
  for (const m of S.missions.list) if (m.id === id && !m.claimed) {
    const was = m.prog >= m.target; m.prog = Math.min(m.target, Math.max(m.prog, v));
    if (!was && m.prog >= m.target) toast('Mission complete! 🎉');
  }
}

// ---------- input ----------
let drag = null; // {pi, x, y, ox, oy, gx, gy, valid, scale}
let tool = null;
function slotHit(x, y) {
  let best = -1, bd = 1e9;
  L.slots.forEach((s, i) => { if (!G.pieces[i]) return; const d = Math.hypot(x - s.x, y - s.y); if (d < bd) { bd = d; best = i; } });
  return bd < Math.max(VW / 6, L.cell * 1.6) && y > L.trayY - L.cell * 0.6 ? best : -1;
}
function boardCell(x, y) { const gx = Math.floor((x - L.bx) / L.cell), gy = Math.floor((y - L.by) / L.cell); return gx >= 0 && gy >= 0 && gx < N && gy < N ? [gx, gy] : null; }
function updateDragTarget() {
  const p = G.pieces[drag.pi];
  const tlx = drag.x - p.shape.gw * L.cell / 2, tly = drag.y + drag.oy - p.shape.gh * L.cell / 2;
  const gx = Math.round((tlx - L.bx) / L.cell), gy = Math.round((tly - L.by) / L.cell);
  drag.gx = gx; drag.gy = gy; drag.valid = canPlace(G.grid, p.shape, gx, gy);
  drag.lines = drag.valid ? linesFor(G.grid, p.shape, gx, gy) : null;
}
cv.addEventListener('pointerdown', e => {
  initAudio();
  if (screen !== 'game' || !G || G.over || !$('#modal').classList.contains('hidden')) return;
  const x = e.clientX, y = e.clientY;
  if (tool) {
    const c = boardCell(x, y);
    if (c) {
      const area = [c]; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) area.push([c[0] + dx, c[1] + dy]);
      const ok = tool === 'hammer' ? smash([c]) : smash(area, true);
      if (ok) { S.power[tool]--; if (tool === 'bomb') rings.push({ x: L.bx + (c[0] + .5) * L.cell, y: L.by + (c[1] + .5) * L.cell, t: 0, ci: 6, big: true }); setTool(null); save(); checkStuck(); }
      else toast('Tap a mochi!');
    } else setTool(null);
    return;
  }
  const pi = slotHit(x, y);
  if (pi < 0) return;
  cv.setPointerCapture(e.pointerId);
  const touch = e.pointerType !== 'mouse';
  drag = { pi, x, y, oy: touch ? -L.cell * 1.9 : -L.cell * 0.4, scale: L.trayScale, valid: false };
  updateDragTarget();
  SFX.pick(); vib(6);
  hideHint();
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.x = e.clientX; drag.y = e.clientY;
  const pg = drag.gx, pgy = drag.gy;
  updateDragTarget();
  if (drag.valid && (pg !== drag.gx || pgy !== drag.gy)) vib(3);
});
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.valid) {
    place(d.pi, d.gx, d.gy);
    if (!S.tutorialDone) { S.tutorialDone = true; save(); }
  } else { G.pieces[d.pi].back = { x: d.x, y: d.y + d.oy, t: 0 }; if (d.y < L.trayY - L.cell) SFX.bad(); }
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);

function setTool(t) {
  tool = t;
  $$('.boost').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  const h = $('#toolHint');
  if (t) { h.textContent = t === 'hammer' ? 'Tap a mochi to bonk it 🔨' : 'Tap where to drop the bomb 💣'; h.classList.remove('hidden'); $('#stuck').classList.add('hidden'); }
  else { h.classList.add('hidden'); if (G && !G.over) checkStuck(); }
}
$$('.boost').forEach(b => b.addEventListener('click', () => {
  initAudio(); SFX.tap();
  const t = b.dataset.tool;
  if (!G || G.over) return;
  if (tool === t) return setTool(null);
  if (S.power[t] <= 0) {
    if (S.coins >= BOOST_COST[t]) { S.coins -= BOOST_COST[t]; S.power[t]++; SFX.coin(); toast(`Bought ${t} for ${BOOST_COST[t]} coins`); }
    else { toast(`Need ${BOOST_COST[t]} coins`); return; }
  }
  if (t === 'swap') {
    S.power.swap--; genTray(); G.pieces.forEach(p => p.anim = -0.1); SFX.fever(); save(); saveRun(); setTool(null);
  } else setTool(t);
  updateHud();
}));
$('#btnGiveUp').addEventListener('click', () => { $('#stuck').classList.add('hidden'); gameOver(); });

// tutorial hand
let hintT = 0, hintOn = false;
function hideHint() { hintOn = false; }

// ---------- HUD ----------
let lastHud = '';
function updateHud() {
  if (!G) return;
  const k = [Math.floor(G.shown), S.best, S.coins + G.coinsRun, S.power.hammer, S.power.bomb, S.power.swap].join('|');
  if (k === lastHud) return; lastHud = k;
  $('#score').textContent = fmt(G.shown);
  $('#best').textContent = '👑 ' + fmt(Math.max(S.best, G.score));
  $('#coinsHud').textContent = fmt(S.coins + G.coinsRun);
  $$('.boost').forEach(b => {
    const t = b.dataset.tool, n = S.power[t], badge = b.querySelector('b');
    badge.textContent = n > 0 ? n : '+'; badge.classList.toggle('buy', n <= 0);
  });
}
function bumpScore() { const s = $('#score'); s.classList.add('bump'); setTimeout(() => s.classList.remove('bump'), 110); }

// ---------- render ----------
const bubbles = Array.from({ length: 18 }, () => ({ x: Math.random(), y: Math.random(), r: 8 + Math.random() * 30, s: 0.01 + Math.random() * 0.03, h: rand(7) }));
const homeMochis = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: 0, vy: 0, ph: Math.random() * 6, ci: i, sk: i }));
function drawBg(dt) {
  const fever = G && G.feverTurns > 0 && screen === 'game';
  let g = ctx.createLinearGradient(0, 0, 0, VH);
  if (fever) { const h = (T * 60) % 360; g.addColorStop(0, `hsl(${h},100%,88%)`); g.addColorStop(1, `hsl(${(h + 80) % 360},100%,88%)`); }
  else { g.addColorStop(0, '#ffe0ef'); g.addColorStop(1, '#e2efff'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // polka dots
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  const sp = 46;
  for (let y = -sp + (T * 8) % sp; y < VH + sp; y += sp) for (let x = 0, i = 0; x < VW + sp; x += sp, i++) { ctx.beginPath(); ctx.arc(x + ((Math.floor(y / sp) % 2) ? sp / 2 : 0), y, 4, 0, 7); ctx.fill(); }
  for (const b of bubbles) {
    b.y -= b.s * dt; if (b.y < -0.1) { b.y = 1.1; b.x = Math.random(); }
    ctx.fillStyle = COLORS[b.h].a + '66';
    ctx.beginPath(); ctx.arc(b.x * VW + Math.sin(T + b.r) * 12, b.y * VH, b.r, 0, 7); ctx.fill();
  }
}
function drawHome(dt) {
  const s = Math.min(VW / 7.5, 70);
  homeMochis.forEach((m, i) => {
    m.ph += dt * 2.2;
    const x = VW * (i + 0.5) / homeMochis.length - s / 2;
    const base = VH * 0.62;
    const hop = Math.max(0, Math.sin(m.ph + i * 0.7));
    const y = base - hop * s * 0.9;
    const sq = hop < 0.08 ? 0.85 : 1;
    const sk = S.skins.includes(SKINS[m.sk].id) ? SKINS[m.sk].id : 'mochi';
    const sp = sprite(m.ci, sk, hop > 0.6 ? 2 : (Math.sin(T * 3 + i) > 0.97 ? 1 : 0), false);
    ctx.save(); ctx.translate(x + s / 2, y + s); ctx.scale(1 / sq, sq);
    ctx.fillStyle = 'rgba(160,80,130,.12)'; ctx.beginPath(); ctx.ellipse(0, (base - y) / sq + 2, s * 0.35 * (1 - hop * 0.4), 5, 0, 0, 7); ctx.fill();
    ctx.drawImage(sp, -s / 2, -s, s, s); ctx.restore();
  });
}
function drawBoard(dt) {
  const fever = G.feverTurns > 0;
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  shake = Math.max(0, shake - dt * 40);
  ctx.save(); ctx.translate(sx, sy);
  const pad = L.cell * 0.18;
  // board frame
  rr(ctx, L.bx - pad, L.by - pad, L.bs + pad * 2, L.bs + pad * 2, L.cell * 0.45);
  ctx.fillStyle = '#ffffffcc'; ctx.fill();
  ctx.lineWidth = fever ? 6 : 4;
  ctx.strokeStyle = fever ? `hsl(${(T * 240) % 360},90%,65%)` : '#f6c6dc'; ctx.stroke();
  // fever / combo bar
  const barY = L.by - pad - 18, barW = L.bs * 0.62, barX = VW / 2 - barW / 2;
  rr(ctx, barX, barY, barW, 10, 5); ctx.fillStyle = '#f6dbe8'; ctx.fill();
  const fv = fever ? G.feverTurns / 8 : G.fever / 100;
  if (fv > 0) { rr(ctx, barX, barY, Math.max(10, barW * Math.min(1, fv)), 10, 5); const fg = ctx.createLinearGradient(barX, 0, barX + barW, 0); fg.addColorStop(0, '#ffb86b'); fg.addColorStop(0.5, '#ff7aa8'); fg.addColorStop(1, '#a585f5'); ctx.fillStyle = fg; ctx.fill(); }
  ctx.font = '700 13px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#8a6a8d';
  ctx.fillText(fever ? `🌈 FEVER x2 · ${G.feverTurns} moves` : (G.combo >= 2 ? `🔥 Combo x${G.combo}  ·  Fever` : 'Fever'), VW / 2, barY - 10);
  // slots
  const hl = new Set();
  if (drag && drag.valid && drag.lines) { for (const r of drag.lines.rows) for (let x = 0; x < N; x++) hl.add(x + ',' + r); for (const c of drag.lines.cols) for (let y = 0; y < N; y++) hl.add(c + ',' + y); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    rr(ctx, L.bx + x * L.cell + 2, L.by + y * L.cell + 2, L.cell - 4, L.cell - 4, L.cell * 0.28);
    ctx.fillStyle = hl.has(x + ',' + y) ? '#fff3b0' : ((x + y) % 2 ? '#fbe6f0' : '#f8dfeb'); ctx.fill();
  }
  // ghost
  const dp = drag && G.pieces[drag.pi];
  if (dp && drag.valid) {
    ctx.globalAlpha = 0.35 + 0.1 * Math.sin(T * 10);
    for (const [x, y] of dp.shape.cells) ctx.drawImage(sprite(dp.ci, S.skin, 0, false), L.bx + (drag.gx + x) * L.cell, L.by + (drag.gy + y) * L.cell, L.cell, L.cell);
    ctx.globalAlpha = 1;
  }
  // cells
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = G.grid[y][x]; if (!c) continue;
    const h = (x * 7 + y * 13) % 10;
    const lit = hl.has(x + ',' + y);
    const face = lit || fever ? 2 : (((T + h * 0.73) % 4.2) < 0.13 ? 1 : 0);
    const age = T - c.pt;
    let sc = age < 0 ? 0 : (age < 0.3 ? easeOutBack(age / 0.3) : 1);
    const breathe = 1 + Math.sin(T * 2.4 + h) * 0.018;
    const bounce = lit ? Math.abs(Math.sin(T * 12 + x * 0.5)) * 0.08 : 0;
    const cx = L.bx + (x + 0.5) * L.cell, cy = L.by + (y + 1) * L.cell;
    const w = L.cell * sc * (2 - breathe), hgt = L.cell * sc * (breathe + bounce);
    ctx.drawImage(sprite(c.ci, S.skin, face, c.star), cx - w / 2, cy - hgt, w, hgt);
  }
  // clearing
  for (let i = clearing.length - 1; i >= 0; i--) {
    const c = clearing[i]; c.t += dt;
    if (c.t < 0) { ctx.drawImage(sprite(c.ci, S.skin, 2, c.star), L.bx + c.x * L.cell, L.by + c.y * L.cell, L.cell, L.cell); continue; }
    const k = c.t / 0.28;
    const cx = L.bx + (c.x + 0.5) * L.cell, cy = L.by + (c.y + 0.5) * L.cell;
    if (!c.done) { c.done = true; burst(cx, cy, c.ci, c.star ? 14 : 6); if (c.star) floatText('+5', cx, cy, '#fff36b', 22, '#e0a800'); }
    if (k >= 1) { clearing.splice(i, 1); continue; }
    const s = L.cell * (k < 0.35 ? 1 + k * 0.8 : (1.28 * (1 - (k - 0.35) / 0.65)));
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * 0.6); ctx.globalAlpha = 1 - k * 0.5;
    ctx.drawImage(sprite(c.ci, S.skin, 2, c.star), -s / 2, -s / 2, s, s); ctx.restore(); ctx.globalAlpha = 1;
  }
  // rings
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt; const k = r.t / 0.5; if (k >= 1) { rings.splice(i, 1); continue; }
    ctx.beginPath(); ctx.arc(r.x, r.y, L.cell * (0.5 + k * (r.big ? 4 : 3)), 0, 7);
    ctx.lineWidth = 8 * (1 - k); ctx.strokeStyle = COLORS[r.ci].b; ctx.globalAlpha = 1 - k; ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; rr(ctx, L.bx - pad, L.by - pad, L.bs + pad * 2, L.bs + pad * 2, L.cell * 0.45); ctx.fill(); flash = Math.max(0, flash - dt * 1.5); }
  ctx.restore();
}
function drawPiece(p, cx, cy, scale, alpha = 1) {
  const s = L.cell * scale;
  const ox = cx - p.shape.gw * s / 2, oy = cy - p.shape.gh * s / 2;
  ctx.globalAlpha = alpha;
  p.shape.cells.forEach(([x, y], i) => ctx.drawImage(sprite(p.ci, S.skin, 0, i === p.star), ox + x * s, oy + y * s, s, s));
  ctx.globalAlpha = 1;
}
function drawTray(dt) {
  G.pieces.forEach((p, i) => {
    if (!p || (drag && drag.pi === i)) return;
    const sl = L.slots[i];
    p.anim = Math.min(1, (p.anim || 0) + dt * 3.5);
    const fitScale = Math.min(L.trayScale, (VW / 3 - 8) / (p.shape.gw * L.cell), (L.trayH - 4) / (p.shape.gh * L.cell));
    let sc = fitScale * (p.anim < 0 ? 0 : easeOutBack(p.anim));
    let x = sl.x, y = sl.y;
    if (p.back) { p.back.t += dt * 5; const k = Math.min(1, p.back.t); x = lerp(p.back.x, sl.x, k); y = lerp(p.back.y, sl.y, k); sc = lerp(1, fitScale, k); if (k >= 1) p.back = null; }
    const fits = fitsAnywhere(G.grid, p.shape);
    y += Math.sin(T * 3 + i) * 2;
    drawPiece(p, x, y, sc, fits ? 1 : 0.35);
  });
  if (drag) {
    const p = G.pieces[drag.pi];
    drag.scale = lerp(drag.scale, 1, Math.min(1, dt * 18));
    const wob = Math.sin(T * 16) * 0.02;
    ctx.save(); ctx.translate(drag.x, drag.y + drag.oy); ctx.rotate(drag.valid ? 0 : wob);
    ctx.shadowColor = 'rgba(160,60,120,.25)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 10;
    drawPiece(p, 0, 0, drag.scale * 1.04);
    ctx.restore(); ctx.shadowColor = 'transparent';
  }
  // tutorial hand
  if (!S.tutorialDone && !drag) {
    const i = G.pieces.findIndex(p => p && fitsAnywhere(G.grid, p.shape)); if (i < 0) return;
    hintT = (hintT + dt * 0.6) % 1;
    const k = clamp(hintT * 1.4, 0, 1), e = k * k * (3 - 2 * k);
    const x = lerp(L.slots[i].x, VW / 2, e), y = lerp(L.slots[i].y, L.by + L.bs / 2, e);
    ctx.globalAlpha = hintT > 0.85 ? (1 - hintT) / 0.15 : 1;
    ctx.font = `${Math.round(L.cell * 1.1)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('👆', x + 8, y);
    ctx.globalAlpha = 1;
    ctx.font = '700 18px Fredoka, sans-serif'; ctx.fillStyle = '#8a6a8d'; ctx.textBaseline = 'middle';
    ctx.fillText('Drag a mochi block onto the board!', VW / 2, L.by + L.bs + (L.trayY - L.by - L.bs) / 2 + 2);
  }
}
function drawFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; if (p.t > p.life) { parts.splice(i, 1); continue; }
    p.vy += 900 * dt * (p.grav || 1); p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 6;
    const a = 1 - p.t / p.life; ctx.globalAlpha = a;
    if (p.kind === 'star') drawStar(ctx, p.x, p.y, p.r * 1.6, p.col);
    else if (p.kind === 'heart') { ctx.fillStyle = '#ff7aa8'; ctx.font = `${p.r * 4}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('♥', p.x, p.y); }
    else if (p.kind === 'conf') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
    else { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt; if (f.t > 1.1) { floats.splice(i, 1); continue; }
    const sc = f.t < 0.2 ? easeOutBack(f.t / 0.2) : 1;
    ctx.globalAlpha = f.t > 0.8 ? (1.1 - f.t) / 0.3 : 1;
    ctx.save(); ctx.translate(f.x, f.y - f.t * 40); ctx.scale(sc, sc);
    ctx.font = `700 ${f.size}px Fredoka, sans-serif`;
    ctx.lineWidth = f.size * 0.22; ctx.strokeStyle = f.stroke; ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBg(dt);
  if (screen === 'home') drawHome(dt);
  if (screen === 'game' && G) {
    drawBoard(dt); drawTray(dt);
    G.shown = G.shown < G.score ? Math.min(G.score, G.shown + Math.max(1, (G.score - G.shown) * dt * 8)) : G.score;
    updateHud();
  }
  drawFx(dt);
  requestAnimationFrame(frame);
}

// ---------- screens & modals ----------
function show(id) {
  screen = id;
  $('#home').classList.toggle('hidden', id !== 'home');
  $('#hud').classList.toggle('hidden', id !== 'game');
  $('#boosters').classList.toggle('hidden', id !== 'game');
  if (id !== 'game') { $('#stuck').classList.add('hidden'); $('#toolHint').classList.add('hidden'); tool = null; }
  if (id === 'home') refreshHome();
}
function modal(html, mount) {
  $('#card').innerHTML = html; $('#modal').classList.remove('hidden');
  $$('#card [data-close]').forEach(b => b.addEventListener('click', () => { SFX.tap(); closeModal(); }));
  if (mount) mount($('#card'));
}
function closeModal() { $('#modal').classList.add('hidden'); if (screen === 'home') refreshHome(); }
function refreshHome() {
  $('#coinsHome').textContent = fmt(S.coins);
  $('#bestHome').textContent = fmt(S.best);
  $('#lvl').textContent = S.level;
  $('#xp').style.width = Math.round(100 * S.xp / xpNeed()) + '%';
  $('#btnPlay').innerHTML = S.run ? 'CONTINUE<small>score ' + fmt(S.run.score) + '</small>' : 'PLAY';
  ensureMissions();
  $('#missDot').classList.toggle('hidden', !S.missions.list.some(m => m.prog >= m.target && !m.claimed));
  $('#capDot').classList.toggle('hidden', S.coins < CAPSULE_COST || S.skins.length >= SKINS.length);
}
const xpNeed = () => 100 + (S.level - 1) * 60;

function startGame() {
  initAudio(); SFX.tap();
  if (S.run) { G = Object.assign(newRun(), S.run); G.shown = G.score; G.pieces = G.pieces.map(p => p && Object.assign(p, { shape: SHAPES[p.si] || SHAPES[0], anim: 0 })); }
  else { G = newRun(); genTray(); G.pieces.forEach(p => p.anim = -0.2); }
  lastHud = ''; clearing.length = 0;
  show('game'); updateHud(); checkStuck();
}
function saveRun() {
  if (!G || G.over) return;
  S.run = { grid: G.grid.map(r => r.map(c => c && { ci: c.ci, star: c.star, pt: -9 })), pieces: G.pieces.map(p => p && { si: SHAPES.indexOf(p.shape), ci: p.ci, star: p.star }),
    score: G.score, combo: G.combo, comboLife: G.comboLife, fever: G.fever, feverTurns: G.feverTurns, coinsRun: G.coinsRun, continued: G.continued, stats: G.stats };
  save();
}
function gameOver() {
  if (!G || G.over) return;
  G.over = true; drag = null; setTool(null);
  SFX.over(); vib([60, 40, 60]);
  $('#stuck').classList.add('hidden');
  setTimeout(() => {
    const newBest = G.score > S.best;
    const canContinue = !G.continued && S.coins + G.coinsRun >= CONTINUE_COST;
    modal(`<h2>Out of room!</h2>
      <div class="bigscore">${fmt(G.score)}</div>
      ${newBest ? '<div class="newbest">👑 NEW BEST!</div>' : `<p>Best ${fmt(S.best)}</p>`}
      <div class="reward"><i class="coin lg"></i> +${fmt(G.coinsRun + Math.floor(G.score / 250))}</div>
      ${!G.continued ? `<button class="btn gold" id="mCont" ${canContinue ? '' : 'disabled'}>💥 Clear space &amp; continue · ${CONTINUE_COST}</button>` : ''}
      <button class="btn green" id="mAgain">Play again</button>
      <button class="btn ghost" id="mHome">Home</button>`, card => {
      card.querySelector('#mAgain').onclick = () => { finishRun(); closeModal(); startGame(); };
      card.querySelector('#mHome').onclick = () => { finishRun(); closeModal(); show('home'); };
      const c = card.querySelector('#mCont');
      if (c) c.onclick = () => {
        if (!canContinue) return;
        if (G.coinsRun >= CONTINUE_COST) G.coinsRun -= CONTINUE_COST; else { S.coins -= CONTINUE_COST - G.coinsRun; G.coinsRun = 0; }
        G.over = false; G.continued = true; closeModal();
        const cells = []; for (let y = 2; y < 6; y++) for (let x = 0; x < N; x++) cells.push([x, y]);
        const keep = G.score; smash(cells, true); G.score = keep; G.pieces = [0, 1, 2].map(() => makePiece(pickShape(0)));
        G.pieces.forEach(p => p.anim = -0.2); updateHud(); saveRun();
      };
    });
    if (newBest) { confetti(100); SFX.win(); }
  }, 650);
}
function finishRun() {
  const earned = G.coinsRun + Math.floor(G.score / 250);
  S.coins += earned;
  if (G.score > S.best) S.best = G.score;
  missionMax('score', G.score);
  S.games++;
  S.xp += Math.max(10, Math.floor(G.score / 25));
  let ups = 0;
  while (S.xp >= xpNeed()) { S.xp -= xpNeed(); S.level++; ups++; S.coins += 50; S.power.hammer++; S.power.bomb++; S.power.swap++; }
  S.run = null; save();
  if (ups) setTimeout(() => { modal(`<h2>Level up!</h2><div class="bigscore">Lv ${S.level}</div><p>You got</p><div class="reward"><i class="coin lg"></i> +${50 * ups} &nbsp; 🔨💣🔄 +${ups}</div><button class="btn" data-close>Yay!</button>`); confetti(80); SFX.win(); }, 300);
}

function dailyCheck() {
  const t = today();
  if (S.daily.last === t) return;
  const streak = S.daily.last === yesterday() ? (S.daily.streak % 7) + 1 : 1;
  const amt = DAILY[streak - 1];
  modal(`<h2>Daily treat!</h2><p>Come back every day for bigger gifts</p>
    <div class="days">${DAILY.map((v, i) => `<div class="day ${i + 1 < streak ? 'done' : ''} ${i + 1 === streak ? 'today' : ''} ${i === 6 ? 'd7' : ''}">Day ${i + 1}<b>${i === 6 ? '🎁 ' : ''}${v}</b><i class="coin"></i></div>`).join('')}</div>
    <button class="btn gold" id="mClaim">Claim ${amt} coins</button>`, card => {
    card.querySelector('#mClaim').onclick = () => {
      S.daily = { last: t, streak }; S.coins += amt; if (streak === 7) { S.power.bomb++; S.power.hammer++; }
      save(); SFX.coin(); confetti(50); closeModal();
    };
  });
}
function openMissions() {
  ensureMissions(); SFX.tap();
  const html = S.missions.list.map((m, i) => {
    const def = MISSION_POOL.find(d => d.id === m.id), done = m.prog >= m.target;
    return `<div class="mission"><div class="ic">${def.icon}</div><div class="tx">${def.text(m.target)}<div class="prog"><i style="width:${100 * m.prog / m.target}%"></i></div></div>
      ${m.claimed ? '✅' : done ? `<button class="btn sm gold" data-i="${i}">+${m.reward}</button>` : `<small>${fmt(m.prog)}/${fmt(m.target)}</small>`}</div>`;
  }).join('');
  modal(`<h2>Daily missions</h2><p>New missions every day</p>${html}<button class="btn ghost" data-close>Close</button>`, card => {
    card.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const m = S.missions.list[+b.dataset.i]; m.claimed = true; S.coins += m.reward; save(); SFX.coin(); confetti(30); openMissions(); });
  });
}
function skinThumb(id, canvas, ci) {
  const s = canvas.width = canvas.height = 96;
  drawMochi(canvas.getContext('2d'), s, ci, id, 0, false);
}
function openCollection() {
  SFX.tap();
  const all = S.skins.length >= SKINS.length;
  modal(`<h2>Capsule Machine</h2><p>Collect cute mochi friends! Tap one you own to use it.</p>
    <svg class="capsule" id="cap" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#ffd6e8" stroke="#d9578a" stroke-width="4"/><path d="M6 50a44 44 0 0 0 88 0z" fill="#a585f5" stroke="#7a58d6" stroke-width="4"/><circle cx="50" cy="50" r="10" fill="#fff" stroke="#7a58d6" stroke-width="4"/><ellipse cx="32" cy="28" rx="10" ry="6" fill="#fff" opacity=".7" transform="rotate(-30 32 28)"/></svg>
    <button class="btn gold" id="mRoll" ${S.coins >= CAPSULE_COST ? '' : 'disabled'}>${all ? 'Roll for coins' : 'Open capsule'} · ${CAPSULE_COST} <i class="coin"></i></button>
    <div class="grid">${SKINS.map((k, i) => `<div class="skin ${S.skins.includes(k.id) ? '' : 'locked'} ${S.skin === k.id ? 'sel' : ''}" data-id="${k.id}"><canvas></canvas>${S.skins.includes(k.id) ? k.name : '???'}<em>${k.rarity}</em></div>`).join('')}</div>
    <p style="margin-top:10px">You have <b>${fmt(S.coins)}</b> coins</p>
    <button class="btn ghost" data-close>Close</button>`, card => {
    card.querySelectorAll('.skin').forEach((el, i) => {
      skinThumb(el.dataset.id, el.querySelector('canvas'), i % COLORS.length);
      el.onclick = () => { if (!S.skins.includes(el.dataset.id)) { toast('Open capsules to unlock!'); return; } S.skin = el.dataset.id; save(); SFX.tap(); openCollection(); };
    });
    card.querySelector('#mRoll').onclick = () => {
      if (S.coins < CAPSULE_COST) return;
      S.coins -= CAPSULE_COST; S.capsulesOpened++; save();
      const cap = card.querySelector('#cap'); cap.classList.add('shake'); SFX.tap();
      card.querySelector('#mRoll').disabled = true;
      setTimeout(() => {
        let tot = 0; SKINS.forEach(k => tot += RARITY_W[k.rarity]);
        let r = Math.random() * tot, got = SKINS[0];
        for (const k of SKINS) { r -= RARITY_W[k.rarity]; if (r <= 0) { got = k; break; } }
        const dupe = S.skins.includes(got.id);
        if (dupe) S.coins += 60; else { S.skins.push(got.id); S.skin = got.id; }
        save(); SFX.win(); confetti(90);
        modal(`<h2>${dupe ? 'Again!' : 'New friend!'}</h2><canvas id="gotCv" style="width:150px;height:150px"></canvas>
          <div class="bigscore" style="font-size:36px">${got.name}</div><p>${got.rarity}${dupe ? ' · duplicate, +60 coins back' : ' · now equipped!'}</p>
          <button class="btn" id="mMore">Yay!</button>`, c2 => {
          const g = c2.querySelector('#gotCv'); g.width = g.height = 200; drawMochi(g.getContext('2d'), 200, rand(COLORS.length), got.id, 2, false);
          c2.querySelector('#mMore').onclick = openCollection;
        });
      }, 1050);
    };
  });
}
function openSettings() {
  SFX.tap();
  const row = (k, label) => `<div class="setrow">${label}<button class="sw ${S.settings[k] ? 'on' : ''}" data-k="${k}"></button></div>`;
  modal(`<h2>Settings</h2>${row('sound', '🔊 Sound')}${row('music', '🎵 Music')}${row('vib', '📳 Vibration')}
    <p style="margin-top:12px">Games played: ${S.games} · Capsules: ${S.capsulesOpened}</p>
    <p style="font-size:13px">Version ${GAME_VERSION}</p>
    <button class="btn ghost" data-close>Close</button>`, card => {
    card.querySelectorAll('.sw').forEach(b => b.onclick = () => { S.settings[b.dataset.k] = !S.settings[b.dataset.k]; b.classList.toggle('on'); save(); SFX.tap(); });
  });
}
function openPause() {
  SFX.tap(); setTool(null);
  modal(`<h2>Paused</h2><p>Your board is saved. Come back anytime!</p>
    <button class="btn green" data-close>Resume</button>
    <button class="btn blue" id="mSet">Settings</button>
    <button class="btn ghost" id="mHome">Home</button>`, card => {
    card.querySelector('#mHome').onclick = () => { saveRun(); closeModal(); show('home'); };
    card.querySelector('#mSet').onclick = openSettings;
  });
}

$('#btnPlay').addEventListener('click', startGame);
$('#btnMissions').addEventListener('click', () => { initAudio(); openMissions(); });
$('#btnCollection').addEventListener('click', () => { initAudio(); openCollection(); });
$('#btnSettings').addEventListener('click', () => { initAudio(); openSettings(); });
$('#btnPause').addEventListener('click', openPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveRun(); if (AC) AC.suspend(); } else if (AC) AC.resume(); });
document.addEventListener('contextmenu', e => e.preventDefault());

// Android back button (called by the native wrapper)
window.__back = () => {
  if (!$('#modal').classList.contains('hidden')) { if (G && G.over) return; closeModal(); }
  else if (tool) setTool(null);
  else if (screen === 'game') openPause();
  else if (window.Android && window.Android.exit) window.Android.exit();
};

// Over-the-air update downloaded by the Android app: reload right away if the player is on the
// home screen, otherwise as soon as they get back there. Progress is saved, so nothing is lost.
let otaPending = false;
function applyOta() {
  if (otaPending && screen === 'home' && $('#modal').classList.contains('hidden') && window.Android && window.Android.reload) {
    otaPending = false; window.Android.reload();
  }
}
window.__otaReady = v => { otaPending = true; toast('New update ready! ✨'); setTimeout(applyOta, 1200); };
setInterval(applyOta, 2000);

// test hook
window.__mochi = { get G() { return G; }, get S() { return S; }, place, canPlace, fitsAnywhere, startGame, gameOver, drawMochi, L };

resize();
ensureMissions();
show('home');
setTimeout(dailyCheck, 400);
requestAnimationFrame(frame);
})();
