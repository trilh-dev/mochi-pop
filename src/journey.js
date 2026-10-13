// ---------- Journey: hand-made levels with goals and a move limit ----------
// Inlined into game.js by build.mjs (shares its scope).
//
// Board legend (8 rows of 8): '.' empty   '0'-'6' a mochi of that colour   'j' jelly (empty)
//   'a'-'g' a mochi of colour 0-6 sitting on jelly   '#' sugar cube (2 hits)   '+' cracked cube (1 hit)
//   '*' a star mochi of a random level colour
// Goals: ['lines', n] clear n lines · ['color', ci, n] pop n mochis of a colour · ['jelly'] clear all jelly
//   ['stone'] break every sugar cube · ['stars', n] pop n star mochis · ['score', n] reach a score
const WORLDS = [
  { name: 'Strawberry Fields', icon: '🍓', ci: 0 },
  { name: 'Lemon Lagoon', icon: '🍋', ci: 2 },
  { name: 'Soda Sky', icon: '🫧', ci: 4 },
  { name: 'Taro Castle', icon: '🏰', ci: 5 },
];
const E = '........';
const LEVELS = [
  // World 1: learn each goal
  { m: 14, g: [['lines', 3]], c: [0, 1, 3, 4], b: [E, E, E, E, E, '0013.344', '11.34400', E] },
  { m: 16, g: [['color', 0, 14]], c: [0, 3, 4], b: [E, E, E, E, E, E, '0.00.00.', E] },
  { m: 16, g: [['jelly']], c: [0, 1, 4, 5], b: [E, E, E, '...jj...', '...jj...', E, E, E] },
  { m: 18, g: [['stars', 3]], c: [0, 2, 3, 4], s: 0.35, b: [E, E, E, E, E, E, E, E] },
  { m: 18, g: [['score', 1500]], c: [0, 1, 3, 5], b: [E, E, E, E, '1111.111', E, E, '33.33333'] },
  { m: 20, g: [['jelly']], c: [0, 3, 4, 5], b: [E, E, '..j.....', '...j....', '....j...', '.....j..', E, E] },
  { m: 18, g: [['stone']], c: [0, 1, 3, 4], b: [E, E, E, '...++...', E, E, '+......+', E] },
  { m: 20, g: [['lines', 6], ['color', 3, 12]], c: [0, 3, 4, 5], b: [E, E, E, E, E, '33.3.333', E, E] },
  { m: 26, g: [['jelly']], c: [0, 1, 4, 5], b: ['jjjjjjjj', 'j......j', 'j......j', E, E, 'j......j', 'j......j', 'jjjjjjjj'] },
  { m: 24, g: [['jelly'], ['stone']], c: [0, 1, 3, 4], b: [E, '.jj..jj.', '.j+..+j.', E, E, '.j+..+j.', '.jj..jj.', E] },
  // World 2: colours and sugar
  { m: 20, g: [['color', 2, 20]], c: [2, 3, 6], b: [E, E, E, '22....22', '22....22', E, E, E] },
  { m: 24, g: [['stone'], ['lines', 5]], c: [1, 2, 3, 4], b: [E, '+......+', E, '...##...', E, E, '+......+', E] },
  { m: 28, g: [['jelly']], c: [1, 2, 4, 5], b: [E, '..jjjj..', '.j....j.', '.j....j.', '.j....j.', '.j....j.', '..jjjj..', E] },
  { m: 22, g: [['stars', 5], ['color', 2, 10]], c: [2, 3, 4, 6], s: 0.3, b: [E, E, E, E, E, E, '2.2.2.2.', E] },
  { m: 22, g: [['score', 3000]], c: [1, 2, 3, 4, 6], b: [E, E, '44444.44', E, E, '33.33333', E, '2222222.'] },
  { m: 24, g: [['jelly'], ['color', 2, 12]], c: [2, 3, 5, 6], b: ['jj....jj', 'j......j', E, '..cccc..', '..cccc..', E, 'j......j', 'jj....jj'] },
  { m: 24, g: [['stone']], c: [1, 2, 3, 4], b: ['+.+.+.+.', E, E, E, E, E, E, '.+.+.+.+'] },
  { m: 24, g: [['lines', 10]], c: [1, 2, 3, 4, 6], b: [E, E, '3.3.3.3.', E, E, '.4.4.4.4', E, '.1.1.1.1'] },
  { m: 26, g: [['jelly'], ['stone']], c: [1, 2, 4, 5], b: ['jjj..jjj', 'j+j..j+j', 'jjj..jjj', E, E, 'jjj..jjj', 'j+j..j+j', 'jjj..jjj'] },
  { m: 30, g: [['jelly'], ['stars', 4], ['color', 2, 16]], c: [2, 3, 4, 6], s: 0.2, b: [E, '.jjjjjj.', '.j2..2j.', '.j.++.j.', '.j.++.j.', '.j2..2j.', '.jjjjjj.', E] },
  // World 3: tighter boards
  { m: 20, g: [['color', 4, 18]], c: [3, 4, 5, 6], b: ['4......4', '.4....4.', '..4..4..', E, E, '..4..4..', '.4....4.', '4......4'] },
  { m: 26, g: [['jelly']], c: [0, 3, 4, 5], b: ['jjjjjjjj', E, 'jjjjjjjj', E, E, 'jjjjjjjj', E, 'jjjjjjjj'] },
  { m: 26, g: [['stone'], ['lines', 8]], c: [0, 3, 4, 5], b: ['#......#', E, E, '...++...', '...++...', E, E, '#......#'] },
  { m: 22, g: [['score', 4500]], c: [0, 3, 4, 5, 6], b: ['3333.333', E, '55.55555', E, E, '444444.4', E, '6.666666'] },
  { m: 24, g: [['jelly'], ['color', 4, 14]], c: [3, 4, 5, 6], b: ['j.j.j.j.', '.j.j.j.j', 'j.j.j.j.', '.j.j.j.j', E, E, E, E] },
  { m: 26, g: [['stars', 6]], c: [3, 4, 5, 6], s: 0.3, b: ['55....55', '5......5', E, E, E, E, '5......5', '55....55'] },
  { m: 26, g: [['stone'], ['jelly']], c: [0, 3, 4, 5], b: ['.j.##.j.', 'jj.##.jj', E, '.+....+.', '.+....+.', E, 'jj.##.jj', '.j.##.j.'] },
  { m: 26, g: [['lines', 12], ['color', 5, 12]], c: [3, 4, 5, 6], b: [E, E, '5555.555', '.5555555', E, E, E, E] },
  { m: 28, g: [['jelly']], c: [0, 3, 4, 5], b: ['jjjjjjjj', 'j......j', 'j......j', 'j..ee..j', 'j..ee..j', 'j......j', 'j......j', 'jjjjjjjj'] },
  { m: 32, g: [['jelly'], ['stone'], ['color', 4, 16]], c: [3, 4, 5, 6], b: ['+jjjjjj+', 'j......j', 'j.4..4.j', 'j..++..j', 'j..++..j', 'j.4..4.j', 'j......j', '+jjjjjj+'] },
  // World 4: everything at once
  { m: 22, g: [['color', 5, 20], ['lines', 8]], c: [0, 2, 5, 6], b: ['55555.55', E, E, '.555.55.', E, E, E, '55.55555'] },
  { m: 30, g: [['jelly'], ['stone']], c: [0, 2, 4, 5], b: ['+.jjjj.+', '..jjjj..', 'jj+..+jj', 'jj.++.jj', 'jj.++.jj', 'jj+..+jj', '..jjjj..', '+.jjjj.+'] },
  { m: 26, g: [['score', 5000], ['stars', 4]], c: [0, 2, 4, 5, 6], s: 0.2, b: [E, '0000.000', E, '2.222222', E, '444.4444', E, '55555.55'] },
  { m: 28, g: [['jelly']], c: [0, 2, 5, 6], b: ['jjjjjjjj', 'jjjjjjjj', 'jj....jj', 'jj....jj', 'jj....jj', 'jj....jj', 'jjjjjjjj', 'jjjjjjjj'] },
  { m: 26, g: [['stone'], ['color', 6, 14]], c: [0, 2, 5, 6], b: ['+.+.+.+.', E, E, '66....66', '66....66', E, E, '.+.+.+.+'] },
  { m: 30, g: [['jelly'], ['lines', 12]], c: [0, 2, 4, 5, 6], b: ['jjjjjjjj', 'f.f.f.f.', E, 'jjjjjjjj', 'jjjjjjjj', E, '.f.f.f.f', 'jjjjjjjj'] },
  { m: 30, g: [['stars', 7], ['jelly']], c: [0, 2, 5, 6], s: 0.28, b: ['j......j', '.j....j.', '..j..j..', '...jj...', '...jj...', '..j..j..', '.j....j.', 'j......j'] },
  { m: 32, g: [['stone'], ['jelly'], ['color', 5, 12]], c: [0, 2, 5, 6], b: ['+.jjjj.+', '.jjjjjj.', 'jj5..5jj', 'jj.++.jj', 'jj.++.jj', 'jj5..5jj', '.jjjjjj.', '+.jjjj.+'] },
  { m: 28, g: [['score', 8000], ['lines', 14]], c: [0, 2, 4, 5, 6], b: ['0.000000', '22.22222', E, E, E, '5555.555', '66666.66', '000000.0'] },
  { m: 34, g: [['jelly'], ['stone'], ['stars', 5], ['color', 5, 18]], c: [0, 2, 5, 6], s: 0.2, b: ['+jjjjjj+', 'jj.ff.jj', 'j.+..+.j', 'jf.++.fj', 'jf.++.fj', 'j.+..+.j', 'jj.ff.jj', '+jjjjjj+'] },
];

function parseLevel(i) {
  const d = LEVELS[i];
  const cols = d.c;
  const grid = Array.from({ length: N }, () => Array(N).fill(null));
  const jelly = Array.from({ length: N }, () => Array(N).fill(false));
  d.b.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch >= '0' && ch <= '6') grid[y][x] = { ci: +ch, star: false, pt: -9 };
    else if (ch >= 'a' && ch <= 'g') { grid[y][x] = { ci: ch.charCodeAt(0) - 97, star: false, pt: -9 }; jelly[y][x] = true; }
    else if (ch === 'j') jelly[y][x] = true;
    else if (ch === '#' || ch === '+') grid[y][x] = { ci: -1, stone: ch === '#' ? 2 : 1, star: false, pt: -9 };
    else if (ch === '*') grid[y][x] = { ci: cols[rand(cols.length)], star: true, pt: -9 };
  }));
  const count = f => grid.flat().filter(f).length + 0;
  return {
    grid, jelly,
    lv: {
      n: i + 1, idx: i, moves: d.m, movesLeft: d.m, goals: d.g, cols, starChance: d.s ?? 0.1,
      hard: 1500 + i * 220, // feeds pickShape: bigger pieces as the journey goes on
      prog: { lines: 0, stars: 0, jelly: 0, stones: 0 },
      jellyTotal: jelly.flat().filter(Boolean).length, stoneTotal: count(c => c && c.stone),
      extra: false,
    },
  };
}
function goalLeft(g) {
  const lv = G.lv, p = lv.prog;
  switch (g[0]) {
    case 'lines': return Math.max(0, g[1] - p.lines);
    case 'color': return Math.max(0, g[2] - (p['c' + g[1]] || 0));
    case 'jelly': return G.jelly.flat().filter(Boolean).length;
    case 'stone': return G.grid.flat().filter(c => c && c.stone).length;
    case 'stars': return Math.max(0, g[1] - p.stars);
    case 'score': return Math.max(0, g[1] - G.score);
  }
  return 0;
}
function goalIcon(g) {
  if (g[0] === 'color') return `<img class="gdot" alt="" src="${sprite(g[1], 'mochi', 0, false).toDataURL()}">`;
  return { lines: '🧹', jelly: '<i class="gjelly"></i>', stone: '🧊', stars: '🌟', score: '⭐' }[g[0]];
}
function goalText(g) {
  switch (g[0]) {
    case 'lines': return `Clear ${g[1]} lines`;
    case 'color': return `Pop ${g[2]} ${['strawberry', 'peach', 'lemon', 'matcha', 'soda', 'taro', 'cherry'][g[1]]} mochis`;
    case 'jelly': return 'Clear all the jelly (pop a line over it)';
    case 'stone': return 'Break every sugar cube (pop lines through them)';
    case 'stars': return `Pop ${g[1]} star mochis`;
    case 'score': return `Score ${fmt(g[1])}`;
  }
}
const levelStars = lv => { const r = lv.movesLeft / lv.moves; return r >= 0.3 ? 3 : r >= 0.12 ? 2 : 1; };
const journeyNext = () => Math.min(LEVELS.length - 1, (S.journey || []).length);

// Effects for the new tiles.
function drawJelly(c, x, y, s) {
  // A wobbly translucent jelly layer: lighter than any mochi, with a bold outline and stripes.
  const w = 1 + Math.sin(T * 3 + x * 0.05 + y * 0.07) * 0.025;
  c.save(); c.translate(x + s / 2, y + s / 2); c.scale(w, 2 - w); c.translate(-s / 2, -s / 2);
  rr(c, 3, 3, s - 6, s - 6, s * 0.3);
  c.fillStyle = 'rgba(255,150,200,.30)'; c.fill();
  c.lineWidth = Math.max(2, s * 0.06); c.strokeStyle = 'rgba(232,80,150,.65)'; c.stroke();
  c.save(); c.clip();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = s * 0.08;
  for (let k = -1; k < 3; k++) { c.beginPath(); c.moveTo(k * s * 0.45, s); c.lineTo(k * s * 0.45 + s, 0); c.stroke(); }
  c.restore(); c.restore();
}
/** Jelly under a mochi: just the outline, drawn over it. */
function jellyRim(c, x, y, s) {
  rr(c, x + 2, y + 2, s - 4, s - 4, s * 0.3);
  c.lineWidth = Math.max(2, s * 0.07); c.strokeStyle = 'rgba(232,80,150,.7)'; c.setLineDash([s * 0.14, s * 0.08]); c.stroke(); c.setLineDash([]);
}
function drawStone(c, x, y, s, hp) {
  const p = s * 0.08;
  rr(c, x + p, y + p, s - p * 2, s - p * 2, s * 0.18);
  const g = c.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e9e2f5');
  c.fillStyle = g; c.fill(); c.lineWidth = Math.max(2, s * 0.05); c.strokeStyle = '#cbbfe0'; c.stroke();
  c.fillStyle = '#d8cdea';
  for (const [dx, dy] of [[0.3, 0.3], [0.62, 0.42], [0.42, 0.68], [0.7, 0.72]]) { c.beginPath(); c.arc(x + s * dx, y + s * dy, s * 0.04, 0, 7); c.fill(); }
  if (hp < 2) { c.strokeStyle = '#a996c7'; c.lineWidth = Math.max(1.5, s * 0.035); c.beginPath(); c.moveTo(x + s * 0.2, y + s * 0.25); c.lineTo(x + s * 0.45, y + s * 0.5); c.lineTo(x + s * 0.38, y + s * 0.62); c.lineTo(x + s * 0.7, y + s * 0.82); c.stroke(); }
}
function crackStone(x, y) {
  const c = G.grid[y][x], cx = L.bx + (x + 0.5) * L.cell, cy = L.by + (y + 0.5) * L.cell;
  burst(cx, cy, 5, 5);
  if (c.stone > 1) { c.stone--; return; }
  G.grid[y][x] = null;
  if (G.lv) G.lv.prog.stones++;
  floatText('Crunch!', cx, cy, '#fff', 20, '#7a58d6');
}
function jellyPop(x, y) { burst(L.bx + (x + 0.5) * L.cell, L.by + (y + 0.5) * L.cell, 0, 5); }

function startLevel(i) {
  initAudio(); SFX.tap(); closeModal();
  const { grid, jelly, lv } = parseLevel(i);
  G = newRun(); G.grid = grid; G.jelly = jelly; G.lv = lv;
  resize(); genTray(); G.pieces.forEach(p => p.anim = -0.2);
  lastHud = ''; clearing.length = 0;
  show('game'); updateHud(); checkStuck();
}
/** After each move: true if the level just ended (won, or out of moves). */
function levelCheck() {
  if (!G.lv || G.over) return false;
  if (G.lv.goals.every(g => !goalLeft(g))) { setTimeout(() => levelEnd(true), 450); G.over = true; return true; }
  if (G.lv.movesLeft <= 0) { setTimeout(() => levelEnd(false), 450); G.over = true; return true; }
  return false;
}
function levelEnd(won) {
  G.over = true; drag = null; setTool(null); $('#stuck').classList.add('hidden');
  const lv = G.lv;
  if (won) {
    const stars = levelStars(lv), prev = (S.journey || [])[lv.idx] || 0;
    const reward = (prev ? 0 : 30) + Math.max(0, stars - prev) * 15;
    S.journey = S.journey || []; S.journey[lv.idx] = Math.max(prev, stars);
    S.coins += G.coinsRun + reward; S.xp += 40; save();
    SFX.win(); confetti(120); vib([30, 40, 60]);
    const last = lv.idx === LEVELS.length - 1;
    modal(`<h2>Level ${lv.n} complete!</h2>
      <div class="lvstars">${[1, 2, 3].map(k => `<span class="${k <= stars ? 'on' : ''}" style="animation-delay:${k * 0.25}s">★</span>`).join('')}</div>
      <p>${lv.movesLeft} move${lv.movesLeft === 1 ? '' : 's'} to spare</p>
      <div class="reward"><i class="coin lg"></i> +${fmt(G.coinsRun + reward)}</div>
      ${last ? '<p>You finished the whole Journey! 🎉</p>' : `<button class="btn green" id="mNext">Next level</button>`}
      <button class="btn blue" id="mMap">Journey map</button>`, card => {
      const n = card.querySelector('#mNext'); if (n) n.onclick = () => openLevelIntro(lv.idx + 1);
      card.querySelector('#mMap').onclick = () => { show('home'); openJourney(); };
    });
  } else {
    SFX.over(); vib([60, 40, 60]);
    const left = lv.goals.filter(g => goalLeft(g));
    const can = !lv.extra && S.coins + G.coinsRun >= CONTINUE_COST;
    modal(`<h2>${lv.movesLeft <= 0 ? 'Out of moves!' : 'Out of room!'}</h2>
      <p>Still to do:</p><div class="goalrow">${left.map(g => `<span class="goal">${goalIcon(g)}<b>${fmt(goalLeft(g))}</b></span>`).join('')}</div>
      ${!lv.extra ? `<button class="btn gold" id="mMore" ${can ? '' : 'disabled'}>${lv.movesLeft <= 0 ? '+5 moves' : 'Clear space'} · ${CONTINUE_COST} <i class="coin"></i></button>` : ''}
      <button class="btn green" id="mRetry">Try again</button>
      <button class="btn ghost" id="mMap">Journey map</button>`, card => {
      const m = card.querySelector('#mMore');
      if (m) m.onclick = () => {
        if (!can) return;
        if (G.coinsRun >= CONTINUE_COST) G.coinsRun -= CONTINUE_COST; else { S.coins -= CONTINUE_COST - G.coinsRun; G.coinsRun = 0; }
        lv.extra = true; G.over = false; closeModal();
        if (lv.movesLeft <= 0) lv.movesLeft += 5;
        if (!anyMove()) { const cells = []; for (let y = 2; y < 6; y++) for (let x = 0; x < N; x++) cells.push([x, y]); smash(cells, true); G.pieces = [0, 1, 2].map(() => makePiece(pickShape(0))); }
        save(); lastHud = ''; updateHud(); checkStuck();
      };
      card.querySelector('#mRetry').onclick = () => { S.coins += G.coinsRun; save(); openLevelIntro(lv.idx); };
      card.querySelector('#mMap').onclick = () => { S.coins += G.coinsRun; save(); show('home'); openJourney(); };
    });
  }
}
function openLevelIntro(i) {
  SFX.tap();
  const d = LEVELS[i], w = WORLDS[Math.floor(i / 10)];
  modal(`<h2>Level ${i + 1}</h2><p>${w.icon} ${w.name}</p>
    ${d.g.map(g => `<div class="mission"><div class="ic">${goalIcon(g)}</div><div class="tx">${goalText(g)}</div></div>`).join('')}
    <div class="mission"><div class="ic">👣</div><div class="tx">in ${d.m} moves</div></div>
    <button class="btn green" id="mGo">Play</button><button class="btn ghost" id="mMap">Journey map</button>`, card => {
    card.querySelector('#mGo').onclick = () => startLevel(i);
    card.querySelector('#mMap').onclick = () => { if (screen === 'game') show('home'); openJourney(); };
  });
}
function openJourney() {
  SFX.tap();
  const done = S.journey || [], next = journeyNext();
  const total = done.reduce((a, b) => a + (b || 0), 0);
  modal(`<h2>Journey</h2><p>★ ${total} / ${LEVELS.length * 3}</p><div class="journey">
    ${WORLDS.map((w, wi) => `<div class="world" style="--wc:${COLORS[w.ci].b};--wl:${COLORS[w.ci].a}"><h3>${w.icon} ${w.name}</h3><div class="lvgrid">
      ${LEVELS.slice(wi * 10, wi * 10 + 10).map((_, k) => { const i = wi * 10 + k, st = done[i] || 0, locked = i > next;
        return `<button class="lvnode ${locked ? 'locked' : ''} ${i === next && !st ? 'next' : ''}" data-l="${i}" ${locked ? 'disabled' : ''}>${locked ? '🔒' : i + 1}<small>${st ? '★'.repeat(st) : ''}</small></button>`; }).join('')}
    </div></div>`).join('')}</div><button class="btn ghost" data-close>Close</button>`, card => {
    card.querySelectorAll('[data-l]').forEach(b => b.onclick = () => openLevelIntro(+b.dataset.l));
    const cur = card.querySelector('.lvnode.next'); if (cur) cur.scrollIntoView({ block: 'center' });
  });
}
