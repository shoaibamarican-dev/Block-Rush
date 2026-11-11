(() => {
  const N = 8;
  const MAX_LEVEL = 200;
  const ADMOB = {
    app: 'ca-app-pub-2888936097455517~7944464730',
    banner: 'ca-app-pub-2888936097455517/1346945991',
    reward: 'ca-app-pub-2888936097455517/2461037917',
    testing: false
  };
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
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="#ffffff"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z" fill="#cbd5e1"/></svg>';

  const $ = (id) => document.getElementById(id);
  const welcome = $('welcome'), game = $('game'), menu = $('menu'), acceptBtn = $('acceptBtn');
  const menuBtn = $('menuBtn'), backBtn = $('backBtn'), levelGrid = $('levelGrid');
  const levelModal = $('levelModal'), levelText = $('levelText'), nextBtn = $('nextBtn'), levelMenuBtn = $('levelMenuBtn');
  const overModal = $('overModal'), overText = $('overText'), reviveBtn = $('reviveBtn'), retryBtn = $('retryBtn'), overMenuBtn = $('overMenuBtn');
  const gridEl = $('grid'), fxEl = $('fx'), trayEl = $('tray'), bgEl = $('bg'), toastEl = $('toast');
  const crownScore = $('crownScore'), bigScore = $('bigScore'), levelLabel = $('levelLabel'), progress = $('progress');
  const soundBtn = $('soundBtn'), hand = $('hand');

  let cells = [], grid = [], tray = [], palette = PALETTES[0];
  let level = 1, levelLines = 0, levelTarget = 1, levelStartScore = 0, score = 0;
  let snapshot = null;
  let highest = Number(localStorage.getItem('blockrush_highest') || 0);
  let best = Number(localStorage.getItem('blockrush_best') || 0);
  let busy = false, handDone = false, drag = null, audioCtx = null;
  let gameState = 'playing';
  let menuOpen = false;
  let soundOn = localStorage.getItem('blockrush_sound') !== 'off';

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function statsHtml(l, sc, b) {
    return '<div class="stats"><div><span>LEVEL</span><b>' + l + '</b></div>'
      + '<div><span>SCORE</span><b>' + sc + '</b></div>'
      + '<div><span>BEST</span><b>' + b + '</b></div></div>';
  }

  function toast(text) {
    toastEl.textContent = text;
    show(toastEl);
    clearTimeout(toast.t);
    toast.t = setTimeout(() => hide(toastEl), 2600);
  }

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
    } catch (e) { /* ignore */ }
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

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixColor(h, t) {
    const [r, g, b] = hexToRgb(h);
    const target = t < 0 ? 0 : 255;
    const p = Math.abs(t);
    const m = (v) => Math.round(v + (target - v) * p);
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  function blockBg(h) {
    return 'linear-gradient(160deg, ' + mixColor(h, 0.4) + ' 0%, ' + h + ' 55%, ' + mixColor(h, -0.3) + ' 100%)';
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

  function makeBg() {
    bgEl.innerHTML = '';
    const colors = ['#ff3b3b', '#ffd23f', '#3b82f6', '#22d3ee', '#a855f7', '#4ade80'];
    for (let i = 0; i < 16; i++) {
      const d = document.createElement('div');
      d.className = 'bgb';
      const s = 18 + Math.random() * 34;
      d.style.width = s + 'px';
      d.style.height = s + 'px';
      d.style.left = (Math.random() * 100) + '%';
      d.style.background = blockBg(colors[i % colors.length]);
      d.style.animationDuration = (14 + Math.random() * 12) + 's';
      d.style.animationDelay = (-Math.random() * 20) + 's';
      bgEl.appendChild(d);
    }
  }

  function currentPool() {
    if (level <= 2) return EASY;
    if (level <= 10) return SHAPES.filter(s => s.length <= 5);
    if (level <= 30) return SHAPES.filter(s => s.length <= 6);
    return SHAPES;
  }

  function randPiece() {
    const pool = currentPool();
    return {
      shape: pool[Math.floor(Math.random() * pool.length)],
      color: palette[Math.floor(Math.random() * palette.length)]
    };
  }

  function newTray() {
    tray = [randPiece(), randPiece(), randPiece()];
    takeSnapshot();
  }

  function takeSnapshot() {
    snapshot = {
      grid: grid.slice(),
      tray: tray.map(p => (p ? { shape: p.shape, color: p.color } : null)),
      score: score,
      levelLines: levelLines
    };
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

  function clearableIfPlaced(shape, r0, c0) {
    const idxs = shape.map(([dr, dc]) => (r0 + dr) * N + (c0 + dc));
    idxs.forEach(i => { grid[i] = '#fff'; });
    const lines = fullLinesOf(grid);
    idxs.forEach(i => { grid[i] = null; });
    const set = new Set();
    lines.forEach(L => {
      for (let k = 0; k < N; k++) set.add(L.t === 'r' ? L.i * N + k : k * N + L.i);
    });
    return set;
  }

  function findHint() {
    for (let i = 0; i < tray.length; i++) {
      const p = tray[i];
      if (!p) continue;
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
          if (fits(p.shape, r, c) && clearableIfPlaced(p.shape, r, c).size > 0) return { idx: i, r, c };
    }
    return null;
  }

  function targetFor(n) {
    // Gradually raise the line-clear goal throughout the 200-level campaign.
    return n === 1 ? 1 : Math.min(30, 2 + Math.floor((n - 2) / 7));
  }

  function makeLevel(n) {
    const rowsCount = Math.min(1 + Math.floor((n - 1) / 2), 7);
    const gapLen = n === 1 ? 2 : (n < 8 ? 2 : 1 + (Math.random() < 0.18 ? 1 : 0));
    for (let tries = 0; tries < 300; tries++) {
      const g = new Array(N * N).fill(null);
      const partialRows = [];
      for (let k = 0; k < rowsCount; k++) partialRows.push(Math.floor((k + 1) * N / (rowsCount + 1)));
      partialRows.forEach(r => {
        const gc = Math.floor(Math.random() * (N - gapLen + 1));
        for (let c = 0; c < N; c++) {
          if (c < gc || c >= gc + gapLen) g[r * N + c] = palette[(r + c) % palette.length];
        }
      });
      const extra = n === 1 ? 0 : Math.min(3 + Math.floor(n * 0.22), 42);
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
      if (fullLinesOf(g).length === 0) return { grid: g, gapLen };
    }
    return { grid: new Array(N * N).fill(null), gapLen: 2 };
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
      b.style.background = blockBg(color);
      wrap.appendChild(b);
    });
    return wrap;
  }

  function renderTray() {
    trayEl.innerHTML = '';
    tray.forEach((p, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.i = i;
      if (p) {
        const piece = makePiece(p.shape, p.color, 26, 3);
        piece.classList.add('bob');
        piece.style.animationDelay = (-Math.random() * 2.6) + 's';
        slot.appendChild(piece);
      } else {
        slot.classList.add('empty');
      }
      trayEl.appendChild(slot);
    });
  }

  function updateHud() {
    crownScore.textContent = score;
    bigScore.textContent = score;
    levelLabel.textContent = 'LEVEL ' + level;
    progress.textContent = 'Lines ' + levelLines + '/' + levelTarget;
  }

  function render(clearSet, popSet) {
    cells.forEach((el, i) => {
      const v = grid[i];
      let cls = 'cell';
      if (v) cls += ' filled';
      if (clearSet && clearSet.has(i)) cls += ' clearing';
      else if (popSet && popSet.has(i)) cls += ' pop';
      el.className = cls;
      el.style.background = v ? blockBg(v) : '';
    });
    renderTray();
    updateHud();
  }

  function hideHand() { hand.classList.remove('show'); }

  function showHint() {
    if (level !== 1 || handDone || drag || menuOpen || gameState !== 'playing') { hideHand(); return; }
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
    const anchor = firstLine.t === 'r'
      ? cells[firstLine.i * N + Math.floor(N / 2)]
      : cells[Math.floor(N / 2) * N + firstLine.i];
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
    const popSet = new Set();
    p.shape.forEach(([dr, dc]) => {
      const i = (r0 + dr) * N + (c0 + dc);
      grid[i] = p.color;
      popSet.add(i);
    });
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
      render(clearSet, popSet);
      spawnFx(lines, bonus);
      sfxClear();
      setTimeout(() => {
        clearSet.forEach(i => { grid[i] = null; });
        busy = false;
        afterMove(null);
      }, 380);
    } else {
      afterMove(popSet);
    }
  }

  function afterMove(popSet) {
    if (tray.every(p => !p)) newTray();
    if (score > best) {
      best = score;
      localStorage.setItem('blockrush_best', String(best));
    }
    render(null, popSet);
    if (levelLines >= levelTarget) { levelDone(); return; }
    if (!tray.some(p => p && hasSpot(p.shape))) { gameOver(); return; }
    if (level === 1 && !handDone) showHint();
  }

  function buildMenu() {
    levelGrid.innerHTML = '';
    for (let n = 1; n <= MAX_LEVEL; n++) {
      const b = document.createElement('button');
      b.className = 'lv';
      if (n <= highest) {
        b.classList.add('done');
        b.innerHTML = CHECK.replace('<svg', '<svg') + '';
        b.innerHTML = '<span>' + n + '</span>';
      } else if (n === highest + 1) {
        b.classList.add('current');
        b.textContent = n;
      } else {
        b.classList.add('locked');
        b.innerHTML = LOCK;
      }
      b.addEventListener('click', () => {
        ensureAudio();
        if (n > highest + 1) {
          b.classList.remove('shake');
          void b.offsetWidth;
          b.classList.add('shake');
          sfxClick();
          return;
        }
        sfxClick();
        closeMenuAndStart(n);
      });
      levelGrid.appendChild(b);
    }
  }

  function openMenu() {
    ensureAudio();
    buildMenu();
    menuOpen = true;
    hideHand();
    hide(levelModal);
    hide(overModal);
    menu.classList.add('active');
  }

  function closeMenu() {
    menu.classList.remove('active');
    menuOpen = false;
    if (gameState === 'over') show(overModal);
    else if (gameState === 'complete') show(levelModal);
    else if (level === 1 && !handDone) showHint();
  }

  function closeMenuAndStart(n) {
    menu.classList.remove('active');
    menuOpen = false;
    startLevel(n);
  }

  function levelDone() {
    gameState = 'complete';
    hideHand();
    highest = Math.max(highest, level);
    localStorage.setItem('blockrush_highest', String(highest));
    confetti();
    sfxLevel();
    levelText.innerHTML = statsHtml(level, score, best);
    if (level >= MAX_LEVEL) {
      levelText.innerHTML = '<div class="final-message">You ended the game!<br>More levels coming soon.</div>' + statsHtml(level, score, best);
      nextBtn.textContent = 'Go Back';
      nextBtn.dataset.final = 'true';
      show(nextBtn);
    } else {
      nextBtn.textContent = 'Next Level';
      nextBtn.dataset.final = 'false';
      show(nextBtn);
    }
    show(levelModal);
  }

  function gameOver() {
    gameState = 'over';
    hideHand();
    sfxOver();
    overText.innerHTML = statsHtml(level, score, best);
    show(overModal);
  }

  function startLevel(n) {
    level = n;
    gameState = 'playing';
    levelLines = 0;
    busy = false;
    handDone = false;
    levelStartScore = score;
    hide(levelModal);
    hide(overModal);
    palette = PALETTES[(n - 1) % PALETTES.length];
    const lv = makeLevel(n);
    grid = lv.grid;
    levelTarget = targetFor(n);
    newTray();
    if (n === 1) {
      tray[0] = {
        shape: Array.from({ length: lv.gapLen }, (_, i) => [0, i]),
        color: palette[0]
      };
      takeSnapshot();
    }
    game.classList.add('active');
    render(null, null);
    if (n === 1) setTimeout(showHint, 500);
  }

  function enterGame() {
    startLevel(Math.min(highest + 1, MAX_LEVEL));
  }

  function revive() {
    if (!snapshot) { startLevel(level); return; }
    grid = snapshot.grid.slice();
    tray = snapshot.tray.map(p => (p ? { shape: p.shape, color: p.color } : null));
    score = snapshot.score;
    levelLines = snapshot.levelLines;
    gameState = 'playing';
    hide(overModal);
    render(null, null);
    toast('Blocks wapas aa gaye, khel jaari rakhein');
  }

  /* ---------- ADS ---------- */
  let adPending = null;
  let adRewarded = false;

  function getAdPlugin() {
    try {
      return window.BlockRushAdMob || null;
    } catch (e) { return null; }
  }

  function prepareReward() {
    const A = getAdPlugin();
    if (!A) return;
    try {
      const p = A.prepareRewardVideoAd({ adId: ADMOB.reward, isTesting: ADMOB.testing });
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  function initAds() {
    const A = getAdPlugin();
    if (!A) {
      const slot = document.getElementById('adSlot');
      if (slot) { slot.textContent = 'Banner ad available in the Android app'; slot.classList.remove('hidden'); }
      return;
    }
    try {
      A.addListener('onRewardedVideoAdReward', () => { adRewarded = true; });
      A.addListener('onRewardedVideoAdDismissed', () => {
        const cb = adPending;
        const ok = adRewarded;
        adPending = null;
        adRewarded = false;
        prepareReward();
        if (cb) cb(ok);
      });
      A.addListener('onRewardedVideoAdFailedToLoad', () => {
        const cb = adPending;
        adPending = null;
        if (cb) cb(false);
      });
      // Wait for the native SDK before requesting banner or rewarded inventory.
      Promise.resolve(A.initialize({ requestTrackingAuthorization: false, initializeForTesting: ADMOB.testing }))
        .then(() => {
          const b = A.showBanner({ adId: ADMOB.banner, adSize: 'BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: ADMOB.testing });
          if (b && b.catch) b.catch(() => {
            const slot = document.getElementById('adSlot');
            if (slot) slot.classList.remove('hidden');
          });
          prepareReward();
        })
        .catch(() => {
          const slot = document.getElementById('adSlot');
          if (slot) slot.classList.remove('hidden');
        });
    } catch (e) {
      const slot = document.getElementById('adSlot');
      if (slot) slot.classList.remove('hidden');
    }
  }

  function showFakeAd(cb) {
    const box = document.createElement('div');
    box.className = 'adsim';
    let left = 3;
    box.textContent = 'Ad playing... ' + left;
    document.body.appendChild(box);
    const t = setInterval(() => {
      left--;
      if (left > 0) { box.textContent = 'Ad playing... ' + left; return; }
      clearInterval(t);
      box.remove();
      cb(true);
    }, 1000);
  }

  function showRewardAd(cb) {
    const A = getAdPlugin();
    if (!A) { showFakeAd(cb); return; }
    adPending = cb;
    adRewarded = false;
    try {
      const p = A.showRewardVideoAd();
      if (p && p.catch) p.catch(() => {
        adPending = null;
        cb(false);
      });
    } catch (e) {
      adPending = null;
      cb(false);
    }
  }

  reviveBtn.addEventListener('click', () => {
    ensureAudio();
    sfxClick();
    showRewardAd((ok) => {
      if (ok) revive();
      else toast('Ad abhi load nahi hua. Thodi der baad dobara try karein.');
    });
  });

  /* ---------- DRAG ---------- */
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

    cells.forEach(el => el.classList.remove('preview', 'warn'));
    if (ok) {
      p.shape.forEach(([dr, dc]) => cells[(r + dr) * N + (c + dc)].classList.add('preview'));
      clearableIfPlaced(p.shape, r, c).forEach(i => cells[i].classList.add('warn'));
    }
  }

  function onMove(e) { moveDrag(e.clientX, e.clientY); }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    const d = drag;
    drag = null;
    cells.forEach(el => el.classList.remove('preview', 'warn'));
    d.ghost.remove();
    if (d.target) {
      place(d.idx, d.target.r, d.target.c);
    } else {
      const slot = trayEl.children[d.idx];
      if (slot) slot.classList.remove('hidden');
      if (level === 1 && !handDone) showHint();
    }
  }

  /* ---------- BUTTONS ---------- */
  acceptBtn.addEventListener('click', () => {
    ensureAudio();
    sfxClick();
    welcome.classList.remove('active');
    setTimeout(enterGame, 650);
  });

  trayEl.addEventListener('pointerdown', (e) => {
    const slot = e.target.closest('.slot');
    if (!slot || drag || menuOpen || gameState !== 'playing') return;
    const idx = Number(slot.dataset.i);
    if (!tray[idx] || busy) return;
    e.preventDefault();
    ensureAudio();
    hideHand();
    startDrag(idx, e);
  });

  menuBtn.addEventListener('click', () => { ensureAudio(); sfxClick(); openMenu(); });
  backBtn.addEventListener('click', () => { ensureAudio(); sfxClick(); closeMenu(); });

  nextBtn.addEventListener('click', () => {
    ensureAudio(); sfxClick();
    if (nextBtn.dataset.final === 'true') {
      hide(levelModal);
      openMenu();
      return;
    }
    startLevel(level + 1);
  });
  levelMenuBtn.addEventListener('click', () => { ensureAudio(); sfxClick(); openMenu(); });

  retryBtn.addEventListener('click', () => {
    ensureAudio();
    sfxClick();
    retryBtn.disabled = true;
    retryBtn.textContent = 'Loading Ad...';
    showRewardAd((ok) => {
      retryBtn.disabled = false;
      retryBtn.textContent = 'Try Again';
      if (ok) {
        score = levelStartScore;
        startLevel(level);
      } else {
        toast('Rewarded ad load nahi hua. Please dobara try karein.');
      }
    });
  });
  overMenuBtn.addEventListener('click', () => { ensureAudio(); sfxClick(); openMenu(); });

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

  /* ---------- INIT ---------- */
  soundBtn.textContent = soundOn ? 'Sound On' : 'Sound Off';
  makeBg();
  sizeBoard();
  buildGrid();
  grid = new Array(N * N).fill(null);
  newTray();
  render(null, null);
  initAds();
  setTimeout(() => welcome.classList.add('active'), 80);
})();
