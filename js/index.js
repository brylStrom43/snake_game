// index.modified.js
// Modified SnakeMania script
// Features added:
// 1) Speed can no longer be directly manipulated by the user (speedRange disabled)
// 2) Speed now gradually increases with score (configurable base/max/slope)
// 3) Level bar (progress toward next level) is shown and updated as score increases
// 4) Walls appear in blocks as score increases; touching a wall causes game over
// 5) Food and walls never overlap snake or each other

// --- Config ---
const BASE_SPEED = 2;          // starting speed
const MAX_SPEED = 9;           // cap speed
const SPEED_PER_POINT = 0.22;  // speed increases by this much per point (gradual)
const POINTS_PER_LEVEL = 5;    // how many points make a level
const WALL_BUILD_SCORE = 3;    // start showing walls after this many points
const WALLS_PER_LEVEL = 3;     // how many new wall blocks to add per level
const WALL_SPAWN_ATTEMPTS = 200; // attempts to place walls without collision

// --- existing variables (keeps most of your original names) ---
let direction = { x: 0, y: 0 };
const foodSound = new Audio("/music/food.mp3");
const gameOverSound = new Audio("/music/gameover.mp3");
const moveSound = new Audio("/music/move.mp3");
const musicSound = new Audio("/music/music.mp3");
musicSound.loop = true;

let speed = BASE_SPEED;
let lastPaintTime = 0;
let snakeArr = [{ x: 13, y: 15 }];
let food = { x: 6, y: 7 };
let score = 0;
let hiscoreval = 0;

// game is paused until Start is pressed
let paused = true;
let soundOn = true;

const HISCORE_KEY = 'snake_hiscore';
const HISTORY_KEY = 'snake_history';

const hiscoreBox = document.getElementById('hiscoreBox');
const scoreBox = document.getElementById('scoreBox');
const board = document.getElementById('board');
const toastEl = document.getElementById('toast');

const pauseBtn = document.getElementById('pauseBtn');
const startBtn = document.getElementById('startBtn');
const soundBtn = document.getElementById('soundBtn');
const speedRange = document.getElementById('speedRange');
const gameOverModal = document.getElementById('gameOverModal');
const finalScoreText = document.getElementById('finalScoreText');
const replayBtn = document.getElementById('replayBtn');

// --- new state: walls and level UI ---
let walls = []; // array of {x,y}
let _levelUI = null;

// --- localStorage helpers ---
function _getItem(key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
    } catch (e) { return defaultValue; }
}
function _setItem(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
}

function saveHiscore(val) { _setItem(HISCORE_KEY, val); }
function loadHiscore() { return _getItem(HISCORE_KEY, 0); }

function loadHistory() { return _getItem(HISTORY_KEY, []); }
function saveHistory(arr) { _setItem(HISTORY_KEY, arr); }

function pushHistoryEntry(name, score) {
    try{
        const entry = { name: name || 'Player', score: score, date: new Date().toISOString() };
        const h = loadHistory();
        h.push(entry);
        saveHistory(h.slice(-100));
    }catch(e){ console.warn('Could not save history', e); }
}

// initialize hiscore
hiscoreval = loadHiscore();
if (hiscoreBox) hiscoreBox.innerHTML = 'High score: ' + hiscoreval;

// --- UI: Toast ---
function showToast(message, duration = 1600) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

// --- Floating messages (keep as-is) ---
const SAVAGE_MESSAGES = [
  "Nice try. The snake disagrees.",
  "Ouch — tasty wall!",
  "You call that a move?",
  "Keep going... slowly.",
  "Snake says: practice more.",
  "That was adorable."
];

const ENCOURAGE_MESSAGES = [
  "🔥 Hot streak! Keep it up!",
  "✨ Nice! +5 — you're getting there!",
  "💪 Strong move — keep the run alive!",
  "🏆 Milestone! You're doing great!",
  "🚀 Five more and you're legendary!"
];

let _msgContainer = null;
const MSG_MAX_VISIBLE = 3;

// Inject CSS for messages (injected once)
function _ensureMessageCSS() {
  if (document.getElementById('game-msg-styles')) return;
  const css = `
  /* Fixed message wrapper placed relative to the toast (left side) */
  .game-msg-fixed-wrapper { position: fixed; bottom: 84px; left: calc(50% - 260px); display:flex; gap: 8px; flex-direction: column; align-items: flex-start; pointer-events: none; z-index: 1200; transform-origin: center; }
  .game-msg-container { display:flex; flex-direction: column; gap:10px; align-items: flex-start; pointer-events: none; width: 320px; }
  .game-msg { pointer-events: auto; display:flex; gap:12px; align-items:center; min-width: 220px; max-width: 360px; padding:12px 14px; border-radius:12px; background: rgba(12,14,20,0.9); backdrop-filter: blur(4px) saturate(110%); -webkit-backdrop-filter: blur(4px) saturate(110%); box-shadow: 0 10px 30px rgba(8,10,20,0.18); border: 1px solid rgba(255,255,255,0.04); transform: translateY(8px) scale(0.98); opacity: 0; transition: transform 260ms cubic-bezier(.2,.9,.3,1), opacity 220ms ease; color: #fff; font-weight:600; font-size:14px; position: relative; overflow: hidden; }
  .game-msg.show { transform: translateY(0) scale(1); opacity: 1; }
  .game-msg .badge { min-width:36px; height:36px; border-radius:8px; display:inline-grid; place-items:center; font-size:16px; }
  .game-msg.savage { background: linear-gradient(180deg, rgba(10,12,16,0.96), rgba(8,10,14,0.92)); color: #fff; }
  .game-msg.savage .badge { background: rgba(255,255,255,0.06); color: #fff; }
  .game-msg.encourage { background: linear-gradient(90deg, rgba(124,92,255,0.12), rgba(0,194,168,0.06)); border: 1px solid rgba(124,92,255,0.12); color: #041025; }
  .game-msg.encourage .badge { background: linear-gradient(90deg,#7c5cff,#00c2a8); color: #fff; box-shadow: 0 8px 20px rgba(124,92,255,0.12); }
  .game-msg .text { flex:1; text-align:left; font-size:13.5px; line-height:1.1; padding-right:8px; }
  .game-msg .progress { position:absolute; left:0; bottom:0; height:4px; background: rgba(255,255,255,0.10); width:100%; }
  .game-msg.encourage .progress { background: linear-gradient(90deg, rgba(124,92,255,0.55), rgba(0,194,168,0.55)); }
  .wall { background: linear-gradient(180deg,#7b2eff,#3b0f6b); border-radius:6px; box-shadow: 0 6px 16px rgba(59,15,107,0.18); }
  .level-ui { display:flex; gap:8px; align-items:center; margin-left:12px; }
  .level-ui .label { font-size:13px; font-weight:700; }
  .level-ui .bar { width:160px; height:12px; background: rgba(255,255,255,0.07); border-radius:8px; overflow:hidden; position:relative; }
  .level-ui .fill { position:absolute; left:0; top:0; height:100%; width:0%; background: linear-gradient(90deg,#7c5cff,#00c2a8); transition: width 220ms linear; }
  @media (max-width:520px) { .game-msg-fixed-wrapper { left:14px; bottom:80px; } .game-msg-container { width:220px; } }
  `;
  const s = document.createElement('style');
  s.id = 'game-msg-styles';
  s.appendChild(document.createTextNode(css));
  document.head.appendChild(s);
}

function _ensureMsgContainer() {
  if (_msgContainer) return _msgContainer;
  _ensureMessageCSS();
  const wrapper = document.createElement('div');
  wrapper.className = 'game-msg-fixed-wrapper';
  const container = document.createElement('div');
  container.className = 'game-msg-container';
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);
  _msgContainer = container;
  if (toastEl) {
    try {
      const rect = toastEl.getBoundingClientRect();
      const left = (rect.left || (window.innerWidth / 2 - rect.width / 2)) - 220;
      const clampedLeft = Math.max(8, Math.round(left));
      wrapper.style.left = clampedLeft + 'px';
      const bottom = window.innerHeight - rect.top + 8;
      wrapper.style.bottom = Math.max(68, Math.round(bottom)) + 'px';
      wrapper.style.position = 'fixed';
    } catch (e) {}
  }
  window.addEventListener('resize', () => {
    if (!toastEl) return;
    try {
      const rect = toastEl.getBoundingClientRect();
      const left = (rect.left || (window.innerWidth / 2 - rect.width / 2)) - 220;
      const clampedLeft = Math.max(8, Math.round(left));
      wrapper.style.left = clampedLeft + 'px';
    } catch (e) {}
  });
  return _msgContainer;
}

function showFloatingMessage(text, type = 'savage', duration = 1800) {
  const container = _ensureMsgContainer();
  if (container.children.length >= MSG_MAX_VISIBLE) {
    const oldest = container.children[0];
    oldest.classList.remove('show');
    setTimeout(() => oldest.remove(), 180);
  }
  const msg = document.createElement('div');
  msg.className = `game-msg ${type}`;
  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = type === 'encourage' ? '💫' : '😈';
  const txt = document.createElement('div');
  txt.className = 'text';
  txt.textContent = text;
  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.style.animation = `shrink ${duration}ms linear forwards`;
  msg.appendChild(badge);
  msg.appendChild(txt);
  msg.appendChild(progress);
  container.appendChild(msg);
  requestAnimationFrame(() => msg.classList.add('show'));
  const t = setTimeout(() => {
    msg.classList.remove('show');
    setTimeout(() => { try { msg.remove(); } catch (e){} }, 220);
  }, duration);
  msg.addEventListener('click', () => {
    clearTimeout(t);
    msg.classList.remove('show');
    setTimeout(() => { try { msg.remove(); } catch(e){} }, 180);
  });
}

function _randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- Level UI helpers ---
function _ensureLevelUI() {
    if (_levelUI) return _levelUI;
    // If there's a speedRange element we repurpose it as read-only visual; disable direct manipulation
    if (speedRange) {
        try { speedRange.disabled = true; speedRange.setAttribute('aria-hidden', 'true'); } catch (e) {}
    }

    const container = document.createElement('div');
    container.className = 'level-ui';
    const label = document.createElement('div'); label.className = 'label'; label.textContent = 'Level: 1';
    const bar = document.createElement('div'); bar.className = 'bar';
    const fill = document.createElement('div'); fill.className = 'fill';
    bar.appendChild(fill);
    container.appendChild(label); container.appendChild(bar);
    // append next to speedRange if possible, otherwise to header or body
    if (speedRange && speedRange.parentElement) {
        speedRange.parentElement.insertBefore(container, speedRange.nextSibling);
    } else {
        document.body.appendChild(container);
    }
    _levelUI = { container, label, bar, fill };
    return _levelUI;
}

function updateLevelUI(score) {
    const ui = _ensureLevelUI();
    const level = Math.floor(score / POINTS_PER_LEVEL) + 1;
    const progress = (score % POINTS_PER_LEVEL) / POINTS_PER_LEVEL;
    ui.label.textContent = 'Level: ' + level;
    ui.fill.style.width = Math.round(progress * 100) + '%';
}

// --- Walls generation & helpers ---
function clearWalls() { walls = []; }

// safe check if pos is occupied by snake or food or existing wall
function _posOccupied(x, y) {
    // snake
    for (const s of snakeArr) if (s.x === x && s.y === y) return true;
    // food
    if (food.x === x && food.y === y) return true;
    // walls
    for (const w of walls) if (w.x === x && w.y === y) return true;
    return false;
}

function updateWallsForScore(score) {
    // start creating walls after a threshold
    if (score < WALL_BUILD_SCORE) return;
    const level = Math.floor(score / POINTS_PER_LEVEL) + 1;
    // aim for a number of walls proportional to level
    const desiredCount = Math.min(60, (level - 1) * WALLS_PER_LEVEL + 2); // small at start, grows
    // if we already have enough walls, skip
    if (walls.length >= desiredCount) return;

    // spawn a few new blocks
    let attempts = 0;
    while (walls.length < desiredCount && attempts < WALL_SPAWN_ATTEMPTS) {
        attempts++;
        // create a compact block (2x1 or 1x2) or single cell to make "blocks" of walls
        const w = randomFood(); // random position inside grid
        // try to expand to form small block sometimes
        if (_posOccupied(w.x, w.y)) continue;
        walls.push({ x: w.x, y: w.y });
        // optionally try to add neighbor to form a block
        if (Math.random() > 0.5) {
            const dx = Math.random() > 0.5 ? 1 : -1;
            const nx = w.x + dx;
            if (nx > 1 && nx < 17 && !_posOccupied(nx, w.y)) walls.push({ x: nx, y: w.y });
        }
    }
}

// randomFood adjusted to avoid snake and walls
function randomFood() {
    const a = 2, b = 16;
    // try multiple times to find a free spot
    for (let attempt = 0; attempt < 300; attempt++) {
        const x = Math.round(a + (b - a) * Math.random());
        const y = Math.round(a + (b - a) * Math.random());
        if (!_posOccupied(x, y)) return { x, y };
    }
    // fallback, return something likely safe
    return { x: a, y: a };
}

// collision detection now includes walls
function isCollide(snake) {
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) return true;
    }
    if (snake[0].x >= 18 || snake[0].x <= 0 || snake[0].y >= 18 || snake[0].y <= 0) return true;
    // walls
    for (const w of walls) {
        if (w.x === snake[0].x && w.y === snake[0].y) return true;
    }
    return false;
}

// --- Game loop ---
function main(ctime) {
    window.requestAnimationFrame(main);
    if (paused) return;
    if ((ctime - lastPaintTime) / 1000 < 1 / speed) return;
    lastPaintTime = ctime;
    gameEngine();
}

function gameEngine() {
    // collisions
    if (isCollide(snakeArr)) {
        if(soundOn) {
            try { gameOverSound.currentTime = 0; gameOverSound.play(); } catch(e){}
        }
        musicSound.pause();
        direction = { x: 0, y: 0 };
        paused = true;

        // Save history only if player scored
        try {
            if (score > 0) {
                let playerName = null;
                try { playerName = sessionStorage.getItem('snake_player'); } catch(e){}
                pushHistoryEntry(playerName || 'Player', score);
            }
            if (score > hiscoreval) {
                hiscoreval = score;
                saveHiscore(hiscoreval);
                if (hiscoreBox) hiscoreBox.innerHTML = "High score: " + hiscoreval;
            }
        } catch (e) { console.warn('Failed to record game history', e); }

        // Show modal with final score and leave snake in place
        showGameOverModal(score);
        // reveal Start button so user can start a new game
        if (startBtn) startBtn.style.display = 'inline-block';
        return;
    }

    // check if eaten food
    if (snakeArr[0].y === food.y && snakeArr[0].x === food.x) {
        if(soundOn) {
            try { foodSound.currentTime = 0; foodSound.play(); } catch(e){}
        }

        const prevHigh = hiscoreval;
        score += 1;

        // adjust speed gradually based on score
        speed = Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_PER_POINT);

        // Build toast message: always show +1; append new high note if exceeded
        let toastMsg = '+1 point';
        if (score > prevHigh) {
            hiscoreval = score;
            saveHiscore(hiscoreval);
            if (hiscoreBox) hiscoreBox.innerHTML = "High score: " + hiscoreval;
            toastMsg += ` • New High score: ${hiscoreval}`;
        }

        // show combined toast
        showToast(toastMsg, 2000);

        if (scoreBox) scoreBox.innerHTML = "Score: " + score;

        // add new head segment in direction of movement
        snakeArr.unshift({ x: snakeArr[0].x + direction.x, y: snakeArr[0].y + direction.y });
        food = randomFood();

        // floating messages: encourage on multiples of 5, otherwise savage
        if (score % 5 === 0) {
            showFloatingMessage(_randFrom(ENCOURAGE_MESSAGES), 'encourage', 2400);
        } else {
            showFloatingMessage(_randFrom(SAVAGE_MESSAGES), 'savage', 1600);
        }

        // update walls and level UI after scoring
        updateWallsForScore(score);
        updateLevelUI(score);
    }

    // move snake body
    for (let i = snakeArr.length - 2; i >= 0; i--) {
        snakeArr[i + 1] = { ...snakeArr[i] };
    }
    snakeArr[0].x += direction.x;
    snakeArr[0].y += direction.y;

    // render board
    if (board) {
        board.innerHTML = "";
        // render walls first so they're behind snake/food visually if needed
        walls.forEach(w => {
            const el = document.createElement('div');
            el.style.gridRowStart = w.y;
            el.style.gridColumnStart = w.x;
            el.classList.add('wall');
            board.appendChild(el);
        });

        snakeArr.forEach((e, index) => {
            const snakeElement = document.createElement('div');
            snakeElement.style.gridRowStart = e.y;
            snakeElement.style.gridColumnStart = e.x;
            snakeElement.classList.add(index === 0 ? 'head' : 'snake');
            board.appendChild(snakeElement);
        });

        const foodElement = document.createElement('div');
        foodElement.style.gridRowStart = food.y;
        foodElement.style.gridColumnStart = food.x;
        foodElement.classList.add('food');
        board.appendChild(foodElement);
    }
}

function showGameOverModal(finalScore) {
    if (!gameOverModal) return;
    finalScoreText.textContent = `Final score: ${finalScore}`;
    gameOverModal.setAttribute('aria-hidden', 'false');
    gameOverModal.classList.add('show');
}

function hideGameOverModal() {
    if (!gameOverModal) return;
    gameOverModal.setAttribute('aria-hidden', 'true');
    gameOverModal.classList.remove('show');
}

// --- Controls: Start / Pause / Sound / Speed ---
pauseBtn && pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (!paused) {
        if(soundOn) {
            try { musicSound.play(); } catch(e){}
        }
        lastPaintTime = performance.now();
        window.requestAnimationFrame(main);
    } else {
        musicSound.pause();
    }
});

startBtn && startBtn.addEventListener('click', () => {
    // if snake is at rest, begin moving right as default
    if (direction.x === 0 && direction.y === 0) direction = { x: 1, y: 0 };
    paused = false;
    startBtn.style.display = 'none';
    hideGameOverModal();
    lastPaintTime = performance.now();
    if(soundOn) { try { musicSound.currentTime = 0; musicSound.play(); } catch(e){} }
    window.requestAnimationFrame(main);
});

soundBtn && soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? 'Sound: On' : 'Sound: Off';
    if (!soundOn) { musicSound.pause(); } else { if(!paused) { try { musicSound.play(); } catch(e){} } }
});

// disable user manipulation of speedRange and ensure it reflects level (visual only)
if (speedRange) {
    try { speedRange.disabled = true; speedRange.title = 'Speed is automatic and increases with score'; } catch(e) {}
}

// init level UI as soon as possible
window.addEventListener('DOMContentLoaded', () => _ensureLevelUI());

// Direction button glow + keyboard visual feedback (keeps your existing logic)
function dirButtonFor(dir) { return document.querySelector(`.dir-btn[data-dir="${dir}"]`); }
function setDirActive(dir, active) { const btn = dirButtonFor(dir); if (!btn) return; if (active) { btn.classList.add('active'); } else { btn.classList.remove('active'); } }
function pulseDir(dir) { const btn = dirButtonFor(dir); if (!btn) return; btn.classList.add('pulse'); clearTimeout(btn._pulseTimer); btn._pulseTimer = setTimeout(() => btn.classList.remove('pulse'), 160); }
const KEY_TO_DIR = { 'ArrowUp': 'up','ArrowDown': 'down','ArrowLeft': 'left','ArrowRight': 'right','Up': 'up','Down': 'down','Left': 'left','Right': 'right' };

// on-screen direction buttons
document.querySelectorAll('.dir-btn').forEach(btn => {
    const onStart = (e) => { e.preventDefault && e.preventDefault(); const dir = btn.getAttribute('data-dir'); setDirActive(dir, true); };
    const onEnd = (e) => { e.preventDefault && e.preventDefault(); const dir = btn.getAttribute('data-dir'); pulseDir(dir); clearTimeout(btn._activeTimer); btn._activeTimer = setTimeout(() => setDirActive(dir, false), 120); };
    btn.addEventListener('mousedown', onStart); window.addEventListener('mouseup', onEnd);
    btn.addEventListener('touchstart', onStart, {passive: false}); btn.addEventListener('touchend', onEnd);
    btn.addEventListener('click', e => {
        const d = btn.getAttribute('data-dir');
        switch (d) { case 'up': direction = { x: 0, y: -1 }; break; case 'down': direction = { x: 0, y: 1 }; break; case 'left': direction = { x: -1, y: 0 }; break; case 'right': direction = { x: 1, y: 0 }; break; }
        if(soundOn) { try { moveSound.currentTime = 0; moveSound.play(); } catch(e){} }
        if(paused){ paused = false; pauseBtn && (pauseBtn.textContent = 'Pause'); startBtn && (startBtn.style.display = 'none'); if(soundOn) { try { musicSound.play(); } catch(e){} } lastPaintTime = performance.now(); window.requestAnimationFrame(main); }
    });
});

// Keyboard controls (visual + movement)
window.addEventListener('keydown', e => {
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        paused = !paused;
        pauseBtn && (pauseBtn.textContent = paused ? 'Resume' : 'Pause');
        if (soundOn && !paused) musicSound.play(); else musicSound.pause();
        return;
    }
    const dir = KEY_TO_DIR[e.code] || KEY_TO_DIR[e.key];
    if (!dir) return;
    e.preventDefault();
    setDirActive(dir, true);
    switch (dir) { case "up": direction = { x: 0, y: -1 }; break; case "down": direction = { x: 0, y: 1 }; break; case "left": direction = { x: -1, y: 0 }; break; case "right": direction = { x: 1, y: 0 }; break; default: return; }
    if(soundOn) { try { moveSound.currentTime = 0; moveSound.play(); } catch(e){} }
    if (paused) { paused = false; pauseBtn && (pauseBtn.textContent = 'Pause'); startBtn && (startBtn.style.display = 'none'); if(soundOn) { try { musicSound.play(); } catch(e){} } lastPaintTime = performance.now(); window.requestAnimationFrame(main); }
});
window.addEventListener('keyup', e => { const dir = KEY_TO_DIR[e.code] || KEY_TO_DIR[e.key]; if (!dir) return; setDirActive(dir, false); });
window.addEventListener('blur', () => { document.querySelectorAll('.dir-btn.active').forEach(b => b.classList.remove('active')); });

// Replay / Reset button
replayBtn && replayBtn.addEventListener('click', () => {
    hideGameOverModal();
    snakeArr = [{ x: 13, y: 15 }];
    food = randomFood();
    score = 0;
    if (scoreBox) scoreBox.innerHTML = "Score: " + score;
    direction = { x: 0, y: 0 };
    paused = true;
    clearWalls();
    updateLevelUI(score);
    speed = BASE_SPEED;
    if (startBtn) startBtn.style.display = 'inline-block';
    if (soundOn) { try { musicSound.pause(); musicSound.currentTime = 0; } catch(e){} }
});

// initialization
window.addEventListener('load', () => {
    try { /* respect existing UI value but keep disabled */ } catch(e){}
    paused = true;
    if (startBtn) startBtn.style.display = 'inline-block';
    lastPaintTime = performance.now();
    // make sure level UI reflects starting state
    updateLevelUI(score); 
});

// expose a small API for testing / tweaks
window.__snakemania = {
    setSpeedConfig: (base, perPoint, max) => { if (typeof base === 'number') BASE_SPEED = base; if (typeof perPoint === 'number') SPEED_PER_POINT = perPoint; if (typeof max === 'number') MAX_SPEED = max; },
    getWalls: () => walls,
    clearWalls
};

// end of modified file
