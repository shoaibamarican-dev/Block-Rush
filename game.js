(() => {
  const N = 8;
  const PALETTES = [
    ['#ff3b3b', '#ffd23f', '#3b82f6', '#ff8a1f', '#22c55e'],
    ['#22d3ee', '#a855f7', '#f472b6', '#4ade80', '#facc15'],
    ['#fb923c', '#ef4444', '#8b5cf6', '#06b6d4', '#eab308']
  ];
  const SHAPES = [
    [[0,0]],
    [[0,0],[0,1]],
    [[0,0],[1,0]],
    [[0,0],[0,1],[0,2]],
    [[0,0],[1,0],[2,0]],
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[0,1],[0,2],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,0],[1,0],[2,0],[2,1],[2,2]],
    [[0,0],[0,1],[0,2],[1,0],[2,0]]
  ];
  const EASY = SHAPES.filter(s => s.length <= 3);

  const $ = (id) => document.getElementById(id);
  const welcome = $('welcome'), game = $('game'), acceptBtn = $('acceptBtn');
  const notifyModal = $('notifyModal'), notifyYes = $('notifyYes'), notifyNo = $('notifyNo');
  const levelModal = $('levelModal'), levelText = $('levelText'), nextBtn = $('nextBtn');
  const overModal = $('overModal'), overText = $('overText'), retryBtn = $('retryBtn');
  const gridEl = $('grid'), fxEl = $('fx'), trayEl = $('tray');
  const crownScore = $('crownScore'), bigScore = $('bigScore');
  const levelLabel = $('levelLabel'), progress = $('progress');
  const soundBtn = $('soundBtn'), hand = $('hand');

  let cells = [], grid = [], tray = [];
  let palette = PALETTES[0];
  let level = 1, levelLines = 0, levelTarget = 1;
  let score = 0, best = Number(localStorage.getItem('blockrush_best') || 0);
  let busy = false, locked = false, handDone = false, drag = null;
  let audioCtx = null;
  let soundOn = localStorage.getItem('blockrush_sound') !== 'off';

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function ensureAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }

  function tone(freq, delay, dur, type, vol) {
    if (!soundOn || !audioCtx) return;
    try {
      const t = audioCtx.currentTime + delay;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* ignore audio errors */ }
  }

  function noise(delay, dur, vol) {
    if (!soundOn || !audioCtx) return;
    try {
      const len = Math.floor(audioCtx.sampleRate * dur);
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audioCtx.createBufferSource();
      const g = audioCtx.createGain();
      g.gain.value = vol;
      src.buffer = buf;
      src.connect(g);
      g.connect(audioCtx.destination);
      src.start(audioCtx.currentTime + delay);
    } catch (e) { /* ignore */ }
  }

  function sfxClick() { tone(660, 0, 0.08, 'triangle', 0.2); }
  function sfxPlace() { tone(420, 0, 0.08, 'triangle', 0.2); tone(300, 0.05, 0.08, 'sine', 0.12); }
  function sfxClear() {
    noise(0, 0.25, 0.12);
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.2, 'triangle', 0.18));
  }
  function sfxLevel() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.12, 0.35, 'square', 0.1));
    noise(0.6, 0.3, 0.08);
  }
  function sfxOver() {
    [400, 320, 240, 160].forEach((f, i) => tone(f, i * 0.18, 0.3, 'sawtooth', 0.1));
  }

  function sizeBoard() {
    const avail = Math.min(window.innerWidth - 64, 380);
    const cell = Math.max(24, Math.floor((avail - (N - 1) * 4) / N));
    document.documentElement.style.setProperty('--cell', cell + 'px');
  }

  function buildGrid() {
    gridEl.innerHTML = '';
    cells = [];
    for (let i = 0; i < N * N; i++) {
      const d = document.createElement('div');
      d.className = 'cell';
      gridEl.appendChild(d);
      cells.push(d);
    }
  }

  function currentPool() { return level <= 2 ? EASY : SHAPES; }

  function randPiece() {
    const pool = currentPool();
    return {
      shape: pool[Math.floor(Math.random() * pool.length)],
      color: palette[Math.floor(Math.random() * palette.length)]
    };
  }

  function newTray() {
    tray = [randPiece(), randPiece(), randPiece()];
  }

  function fullLinesOf(g) {
    const out = [];
    for (let r = 0; r < N; r++) {
      let ok = true;
      for (let c = 0; c < N; c++) if (!g[r * N + c]) { ok = false; break; }
      if (ok) out.push({ t: 'r', i: r });
    }
    for (let c = 0; c < N; c++) {
      let ok = true;
      for (let r = 0; r < N; r++) if (!g[r * N + c]) { ok = false; break; }
      if (ok) out.push({ t: 'c', i: c });
    }
    return out;
  }

  function fits(shape, r0, c0) {
    return shape.every(([dr, dc]) => {
      const r = r0 + dr, c = c0 + dc;
      return r >= 0 && r < N && c >= 0 && c < N && !grid[r * N + c];
    });
  }

  function hasSpot(shape) {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (fits(shape, r, c)) return true;
    return false;
  }

  function wouldClear(shape, r0, c0) {
    const idxs = shape.map(([dr, dc]) => (r0 + dr) * N + (c0 + dc));
    idxs.forEach(i => { grid[i] = '#fff'; });
    const n = fullLinesOf(grid).length;
    idxs.forEach(i => { grid[i] = null; });
    return n > 0;
  }

  function findHint() {
    for (let i = 0; i < tray.length; i++) {
      const p = tray[i];
      if (!p) continue;
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
          if (fits(p.shape, r, c) && wouldClear(p.shape, r, c)) return { idx: i, r, c };
    }
    return null;
  }

  function makeLevel(n) {
    const rowsCount = Math.min(1 + Math.floor((n - 1) / 2), 4);
    const gapLen = n === 1 ? 2 : 1 + Math.floor(Math.random() * 2);
    for (let tries = 0; tries < 300; tries++) {
      const g = new Array(N * N).fill(null);
      const partialRows = [];
      for (let k = 0; k < rowsCount; k++) partialRows.push(N - 1 - k * 2);
      partialRows.forEach(r => {
        const gc = Math.floor(Math.random() * (N - gapLen + 1));
        for (let c = 0; c < N; c++) {
          if (c < gc || c >= gc + gapLen) g[r * N + c] = palette[(r + c) % palette.length];
        }
      });
      const extra = n === 1 ? 0 : Math.min(2 * n, 14);
      let placedCount = 0, guard = 0;
      while (placedCount < extra && guard < 300) {
        guard++;
        const r = Math.floor(Math.random() * N);
        if (partialRows.includes(r)) continue;
        const c = Math.floor(Math.random() * N);
        if (g[r * N + c]) continue;
        g[r * N + c] = palette[Math.floor(Math.random() * palette.length)];
        placedCount++;
      }
      if (fullLinesOf(g).length === 0) return { grid: g, target: rowsCount, gapLen };
    }
    return { grid: new Array(N * N).fill(null), target: 1, gapLen: 2 };
  }

  function renderTray() {
    trayEl.innerHTML = '';
    tray.forEach((p, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.i = i;
      if (p) slot.appendChild(makePiece(p.shape, p.color, 26, 3));
      else slot.classList.add('empty');
      trayEl.appendChild(slot);
    });
  }

  function makePiece(shape, color, size, gap) {
    const maxR = Math.max(...shape.map(s => s[0]));
    const maxC = Math.max(...shape.map(s => s[1]));
    const wrap = document.createElement('div');
    wrap.className = 'piece';
    wrap.style.width = (maxC + 1) * (size + gap) - gap + 'px';
    wrap.style.height = (maxR + 1) * (size + gap) - gap + 'px';
    shape.forEach(([r, c]) => {
      const b = document.createElement('div');
      b.className = 'blk';
      b.style.left = c * (size + gap) + 'px';
      b.style.top = r * (size + gap) + 'px';
      b.style.width = size + 'px';
      b.style.height = size + 'px';
      b.style.background = color;
      wrap.appendChild(b);
    });
    return wrap;
  }

  function updateHud() {
    crownScore.textContent = score;
    bigScore.textContent = score;
    levelLabel.textContent = 'LEVEL ' + level;
    progress.textContent = 'Lines ' + levelLines + '/' + levelTarget;
  }

  function render(clearSet) {
    cells.forEach((el, i) => {
      const v = grid[i];
      el.className = 'cell' + (v ? ' filled' : '') + (clearSet && clearSet.has(i) ? ' clearing' : '');
      el.style.background = v ? v : '';
    });
    renderTray();
    updateHud();
  }

  function hideHand() { hand.classList.remove('show'); }

  function showHint() {
    if (level !== 1 || handDone || locked || drag) { hideHand(); return; }
    const h = findHint();
    if (!h) { hideHand(); return; }
    const slot = trayEl.children[h.idx];
    if (!slot) { hideHand(); return; }
    const s = slot.getBoundingClientRect();
    const t = cells[h.r * N + h.c].getBoundingClientRect();
    hand.style.setProperty('--sx', (s.left + s.width / 2 - 21) + 'px');
    hand.style.setProperty('--sy', (s.top + s.height / 2 - 4) + 'px');
    hand.style.setProperty('--tx', (t.left + t.width / 2 - 21) + 'px');
    hand.style.setProperty('--ty', (t.top + t.height / 2 - 4) + 'px');
    hand.classList.remove('show');
    void hand.offsetWidth;
    hand.classList.add('show');
  }

  function spawnFx(lines, bonus) {
    const cellSet = new Set();
    lines.forEach(L => {
      for (let k = 0; k < N; k++) cellSet.add(L.t === 'r' ? L.i * N + k : k * N + L.i);
    });

    lines.forEach(L => {
      const beam = document.createElement('div');
      const first = L.t === 'r' ? cells[L.i * N] : cells[L.i];
      const last = L.t === 'r' ? cells[L.i * N + N - 1] : cells[(N - 1) * N + L.i];
      beam.className = 'beam' + (L.t === 'c' ? ' vert' : '');
      beam.style.left = first.offsetLeft + 'px';
      beam.style.top = first.offsetTop + 'px';
      if (L.t === 'r') {
        beam.style.width = (last.offsetLeft + last.offsetWidth - first.offsetLeft) + 'px';
        beam.style.height = first.offsetHeight + 'px';
      } else {
        beam.style.width = first.offsetWidth + 'px';
        beam.style.height = (last.offsetTop + last.offsetHeight - first.offsetTop) + 'px';
      }
      fxEl.appendChild(beam);
      setTimeout(() => beam.remove(), 600);
    });

    cellSet.forEach(i => {
      const el = cells[i];
      const color = grid[i] || '#ffffff';
      const cx = el.offsetLeft + el.offsetWidth / 2;
      const cy = el.offsetTop + el.offsetHeight / 2;
      for (let k = 0; k < 3; k++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.background = color;
        p.style.left = (cx - 4) + 'px';
        p.style.top = (cy - 4) + 'px';
        p.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
        p.style.setProperty('--dy', (Math.random() * 80 - 40) + 'px');
        fxEl.appendChild(p);
        setTimeout(() => p.remove(), 700);
      }
    });

    const firstLine = lines[0];
    const anchor = firstLine.t === 'r' ? cells[firstLine.i * N + Math.floor(N / 2)] : cells[Math.floor(N / 2) * N + firstLine.i];
    const pop = document.createElement('div');
    pop.className = 'pop-text';
    pop.textContent = '+' + bonus;
    pop.style.left = (anchor.offsetLeft + anchor.offsetWidth / 2) + 'px';
    pop.style.top = (anchor.offsetTop - 10) + 'px';
    fxEl.appendChild(pop);
    setTimeout(() => pop.remove(), 950);
  }

  function confetti() {
    const colors = ['#ff3b3b', '#ffd23f', '#3b82f6', '#22c55e', '#f472b6', '#22d3ee'];
    for (let i = 0; i < 60; i++) {
      const d = document.createElement('div');
      d.className = 'confetti';
      d.style.left = Math.random() * 100 + 'vw';
      d.style.background = colors[i % colors.length];
      d.style.animationDelay = Math.random() * 0.4 + 's';
      d.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 3200);
    }
  }

  function place(idx, r0, c0) {
    const p = tray[idx];
    p.shape.forEach(([dr, dc]) => { grid[(r0 + dr) * N + (c0 + dc)] = p.color; });
    score += p.shape.length;
    tray[idx] = null;
    handDone = true;
    hideHand();
    sfxPlace();

    const lines = fullLinesOf(grid);
    if (lines.length > 0) {
      busy = true;
      const clearSet = new Set();
      lines.forEach(L => {
        for (let k = 0; k < N; k++) clearSet.add(L.t === 'r' ? L.i * N + k : k * N + L.i);
      });
      const bonus = lines.length * 10 + (lines.length > 1 ? (lines.length - 1) * 20 : 0);
      score += bonus;
      levelLines += lines.length;
      render(clearSet);
      spawnFx(lines, bonus);
      sfxClear();
      setTimeout(() => {
        clearSet.forEach(i => { grid[i] = null; });
        busy = false;
        afterMove();
      }, 380);
    } else {
      afterMove();
    }
  }

  function afterMove() {
    if (tray.every(p => !p)) newTray();
    if (score > best) {
      best = score;
      localStorage.setItem('blockrush_best', String(best));
    }
    render();
    if (levelLines >= levelTarget) { levelDone(); return; }
    if (!tray.some(p => p && hasSpot(p.shape))) { gameOver(); return; }
  }

  function levelDone() {
    locked = true;
    hideHand();
    confetti();
    sfxLevel();
    levelText.textContent = 'Score: ' + score + '   |   Best: ' + best;
    show(levelModal);
  }

  function gameOver() {
    locked = true;
    hideHand();
    sfxOver();
    overText.textContent = 'Score: ' + score + '   |   Best: ' + best;
    show(overModal);
  }

  function startLevel(n) {
    level = n;
    levelLines = 0;
    busy = false;
    locked = false;
    palette = PALETTES[(n - 1) % PALETTES.length];
    const lv = makeLevel(n);
    grid = lv.grid;
    levelTarget = lv.target;
    newTray();
    if (n === 1) {
      tray[0] = {
        shape: Array.from({ length: lv.gapLen }, (_, i) => [0, i]),
        color: palette[0]
      };
    }
    render();
    if (n === 1 && !handDone) setTimeout(showHint, 500);
  }

  function restartGame() {
    hide(overModal);
    hide(levelModal);
    score = 0;
    handDone = false;
    startLevel(1);
  }

  function startDrag(idx, e) {
    const p = tray[idx];
    const cell = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell'), 10);
    const ghost = makePiece(p.shape, p.color, cell, 4);
    ghost.classList.add('ghost');
    document.body.appendChild(ghost);
    trayEl.children[idx].classList.add('hidden');
    drag = { idx, p, ghost, target: null };
    moveDrag(e.clientX, e.clientY);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function moveDrag(x, y) {
    const { ghost, p } = drag;
    const left = x - ghost.offsetWidth / 2;
    const top = y - ghost.offsetHeight - 50;
    ghost.style.left = left + 'px';
    ghost.style.top = top + 'px';

    const first = cells[0].getBoundingClientRect();
    const second = cells[1].getBoundingClientRect();
    const step = second.left - first.left;
    const c = Math.round((left - first.left) / step);
    const r = Math.round((top - first.top) / step);
    const ok = fits(p.shape, r, c);
    drag.target = ok ? { r, c } : null;

    cells.forEach(el => el.classList.remove('preview'));
    if (ok) p.shape.forEach(([dr, dc]) => cells[(r + dr) * N + (c + dc)].classList.add('preview'));
  }

  function onMove(e) { moveDrag(e.clientX, e.clientY); }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    const d = drag;
    drag = null;
    cells.forEach(el => el.classList.remove('preview'));
    d.ghost.remove();
    if (d.target) {
      place(d.idx, d.target.r, d.target.c);
    } else {
      const slot = trayEl.children[d.idx];
      if (slot) slot.classList.remove('hidden');
      if (level === 1 && !handDone) showHint();
    }
  }

  function askNotify() {
    show(notifyModal);
  }

  function closeNotifyAndEnter() {
    hide(notifyModal);
    game.classList.add('active');
    setTimeout(() => { sizeBoard(); startLevel(1); }, 300);
  }

  acceptBtn.addEventListener('click', () => {
    ensureAudio();
    sfxClick();
    welcome.classList.remove('active');
    setTimeout(() => { askNotify(); }, 650);
  });

  notifyYes.addEventListener('click', () => {
    ensureAudio();
    try {
      if ('Notification' in window && typeof Notification.requestPermission === 'function') {
        const p = Notification.requestPermission();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (e) { /* notifications not supported */ }
    closeNotifyAndEnter();
  });

  notifyNo.addEventListener('click', () => {
    ensureAudio();
    closeNotifyAndEnter();
  });

  trayEl.addEventListener('pointerdown', (e) => {
    const slot = e.target.closest('.slot');
    if (!slot || drag) return;
    const idx = Number(slot.dataset.i);
    if (!tray[idx] || busy || locked) return;
    e.preventDefault();
    ensureAudio();
    hideHand();
    startDrag(idx, e);
  });

  nextBtn.addEventListener('click', () => {
    ensureAudio();
    sfxClick();
    hide(levelModal);
    startLevel(level + 1);
  });

  retryBtn.addEventListener('click', () => {
    ensureAudio();
    sfxClick();
    restartGame();
  });

  soundBtn.addEventListener('click', () => {
    ensureAudio();
    soundOn = !soundOn;
    localStorage.setItem('blockrush_sound', soundOn ? 'on' : 'off');
    soundBtn.textContent = soundOn ? 'Sound On' : 'Sound Off';
    if (soundOn) sfxClick();
  });

  window.addEventListener('resize', () => {
    sizeBoard();
    if (level === 1 && !handDone && !drag) showHint();
  });

  soundBtn.textContent = soundOn ? 'Sound On' : 'Sound Off';
  sizeBoard();
  buildGrid();
  newTray();
  grid = new Array(N * N).fill(null);
  render();
  setTimeout(() => welcome.classList.add('active'), 80);
})();
