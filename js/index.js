// js/index.js
// Full SnakeMania game script with modern floating messages (savage + encourage),
// keyboard visual feedback, history & high-score persistence.
//
// Messages are placed fixed near the toast: slightly above and to the left of the toast.

//
// Game Constants and Variables
//
let direction = { x: 0, y: 0 };
const foodSound = new Audio("/music/food.mp3");
const gameOverSound = new Audio("/music/gameover.mp3");
const moveSound = new Audio("/music/move.mp3");
const musicSound = new Audio("/music/music.mp3");
musicSound.loop = true;

let speed = 2;
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

//
// localStorage helpers
//
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

//
// UI helpers - toast accepts optional duration (ms)
//
function showToast(message, duration = 1600) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

//
// Modern floating messages (fixed near toast: above & left)
//

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
  .game-msg-fixed-wrapper {
    position: fixed;
    bottom: 84px; /* sits above the toast (toast default bottom ~28px) */
    left: calc(50% - 260px); /* left side relative to center; tweak if needed */
    display:flex;
    gap: 8px;
    flex-direction: column;
    align-items: flex-start;
    pointer-events: none;
    z-index: 1200;
    transform-origin: center;
  }

  .game-msg-container {
    display:flex;
    flex-direction: column;
    gap:10px;
    align-items: flex-start;
    pointer-events: none;
    width: 320px;
  }

  .game-msg {
    pointer-events: auto;
    display:flex;
    gap:12px;
    align-items:center;
    min-width: 220px;
    max-width: 360px;
    padding:12px 14px;
    border-radius:12px;
    background: rgba(12,14,20,0.9);
    backdrop-filter: blur(4px) saturate(110%);
    -webkit-backdrop-filter: blur(4px) saturate(110%);
    box-shadow: 0 10px 30px rgba(8,10,20,0.18);
    border: 1px solid rgba(255,255,255,0.04);
    transform: translateY(8px) scale(0.98);
    opacity: 0;
    transition: transform 260ms cubic-bezier(.2,.9,.3,1), opacity 220ms ease;
    color: #fff;
    font-weight:600;
    font-size:14px;
    position: relative;
    overflow: hidden;
  }
  .game-msg.show { transform: translateY(0) scale(1); opacity: 1; }

  .game-msg .badge { min-width:36px; height:36px; border-radius:8px; display:inline-grid; place-items:center; font-size:16px; }

  .game-msg.savage {
    background: linear-gradient(180deg, rgba(10,12,16,0.96), rgba(8,10,14,0.92));
    color: #fff;
  }
  .game-msg.savage .badge { background: rgba(255,255,255,0.06); color: #fff; }

  .game-msg.encourage {
    background: linear-gradient(90deg, rgba(124,92,255,0.12), rgba(0,194,168,0.06));
    border: 1px solid rgba(124,92,255,0.12);
    color: #041025;
  }
  .game-msg.encourage .badge { background: linear-gradient(90deg,#7c5cff,#00c2a8); color: #fff; box-shadow: 0 8px 20px rgba(124,92,255,0.12); }

  .game-msg .text { flex:1; text-align:left; font-size:13.5px; line-height:1.1; padding-right:8px; }

  .game-msg .progress {
    position:absolute; left:0; bottom:0; height:4px; background: rgba(255,255,255,0.10); width:100%;
  }
  .game-msg.encourage .progress { background: linear-gradient(90deg, rgba(124,92,255,0.55), rgba(0,194,168,0.55)); }

  @keyframes shrink { from { width: 100%; } to { width: 0%; } }

  @media (max-width:900px) {
    .game-msg-fixed-wrapper { left: calc(50% - 180px); bottom: 80px; }
    .game-msg-container { width: 260px; }
  }
  @media (max-width:520px) {
    .game-msg-fixed-wrapper { left: 14px; bottom: 80px; } /* mobile: pin near left edge */
    .game-msg-container { width: 220px; }
    .game-msg { min-width: 160px; max-width: 220px; font-size:13px; padding:10px; }
    .game-msg .badge { min-width:30px; height:30px; font-size:14px; }
  }
  `;
  const s = document.createElement('style');
  s.id = 'game-msg-styles';
  s.appendChild(document.createTextNode(css));
  document.head.appendChild(s);
}

// Create container fixed near toast: slightly above and left of centered toast
function _ensureMsgContainer() {
  if (_msgContainer) return _msgContainer;
  _ensureMessageCSS();

  // Create wrapper and container appended to body (fixed positioning handled by CSS)
  const wrapper = document.createElement('div');
  wrapper.className = 'game-msg-fixed-wrapper';
  const container = document.createElement('div');
  container.className = 'game-msg-container';
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);
  _msgContainer = container;

  // Optionally reposition wrapper based on toast bounding rect for fine-adjustment
  if (toastEl) {
    try {
      const rect = toastEl.getBoundingClientRect();
      // toast is centered; place wrapper to the left of toast's center by about 220px
      // fallback: use CSS calc; this dynamic adjustment helps on narrower screens
      const left = (rect.left || (window.innerWidth / 2 - rect.width / 2)) - 220;
      // clamp left to >= 8px
      const clampedLeft = Math.max(8, Math.round(left));
      wrapper.style.left = clampedLeft + 'px';
      // compute bottom relative to toast: put wrapper above toast by ~60px
      const bottom = window.innerHeight - rect.top + 8; // rect.top is y of toast
      wrapper.style.bottom = Math.max(68, Math.round(bottom)) + 'px';
      wrapper.style.position = 'fixed';
    } catch (e) {
      // ignore and use CSS defaults
    }
  }

  // recompute position on resize to keep alignment reasonable
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

// Show a modern floating message. type = 'savage' | 'encourage'
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

// random helper
function _randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

//
// Game loop
//
function main(ctime) {
    window.requestAnimationFrame(main);
    if (paused) return;
    if ((ctime - lastPaintTime) / 1000 < 1 / speed) return;
    lastPaintTime = ctime;
    gameEngine();
}

function isCollide(snake) {
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) return true;
    }
    if (snake[0].x >= 18 || snake[0].x <= 0 || snake[0].y >= 18 || snake[0].y <= 0) return true;
    return false;
}

function randomFood() {
    const a = 2, b = 16;
    return { x: Math.round(a + (b - a) * Math.random()), y: Math.round(a + (b - a) * Math.random()) };
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

//
// Controls: Start / Pause / Sound / Speed
//
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

speedRange && speedRange.addEventListener('input', (e) => {
    speed = Number(e.target.value);
});

//
// Direction button glow + keyboard visual feedback
//

// helper: select the dir button element for a given direction string
function dirButtonFor(dir) {
    return document.querySelector(`.dir-btn[data-dir="${dir}"]`);
}

// set/unset active class for a direction (true = pressed/glow)
function setDirActive(dir, active) {
    const btn = dirButtonFor(dir);
    if (!btn) return;
    if (active) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
}

// short pulse animation for click/tap
function pulseDir(dir) {
    const btn = dirButtonFor(dir);
    if (!btn) return;
    btn.classList.add('pulse');
    clearTimeout(btn._pulseTimer);
    btn._pulseTimer = setTimeout(() => btn.classList.remove('pulse'), 160);
}

// map arrow key names to data-dir values
const KEY_TO_DIR = {
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'Up': 'up',       // older browser support
    'Down': 'down',
    'Left': 'left',
    'Right': 'right'
};

// handle on-screen direction buttons (touch/mouse/click)
document.querySelectorAll('.dir-btn').forEach(btn => {
    // press start: add active immediately
    const onStart = (e) => {
        e.preventDefault && e.preventDefault();
        const dir = btn.getAttribute('data-dir');
        setDirActive(dir, true);
    };

    // press end: pulse & remove active shortly after
    const onEnd = (e) => {
        e.preventDefault && e.preventDefault();
        const dir = btn.getAttribute('data-dir');
        pulseDir(dir);
        // keep active a short moment so user sees effect
        clearTimeout(btn._activeTimer);
        btn._activeTimer = setTimeout(() => setDirActive(dir, false), 120);
    };

    // mouse events
    btn.addEventListener('mousedown', onStart);
    window.addEventListener('mouseup', onEnd);

    // touch events
    btn.addEventListener('touchstart', onStart, {passive: false});
    btn.addEventListener('touchend', onEnd);

    // click: apply movement logic (same as keyboard)
    btn.addEventListener('click', e => {
        const d = btn.getAttribute('data-dir');
        switch (d) {
            case 'up': direction = { x: 0, y: -1 }; break;
            case 'down': direction = { x: 0, y: 1 }; break;
            case 'left': direction = { x: -1, y: 0 }; break;
            case 'right': direction = { x: 1, y: 0 }; break;
        }
        if(soundOn) {
            try { moveSound.currentTime = 0; moveSound.play(); } catch(e){}
        }
        // if paused, start the game
        if(paused){
            paused = false;
            pauseBtn && (pauseBtn.textContent = 'Pause');
            startBtn && (startBtn.style.display = 'none');
            if(soundOn) { try { musicSound.play(); } catch(e){} }
            lastPaintTime = performance.now();
            window.requestAnimationFrame(main);
        }
    });
});

//
// Keyboard controls (visual + movement)
//
window.addEventListener('keydown', e => {
    // allow pause/resume on space
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        paused = !paused;
        pauseBtn && (pauseBtn.textContent = paused ? 'Resume' : 'Pause');
        if (soundOn && !paused) musicSound.play(); else musicSound.pause();
        return;
    }

    // prefer e.code, fallback to e.key for broader browser support
    const dir = KEY_TO_DIR[e.code] || KEY_TO_DIR[e.key];
    if (!dir) return;

    // prevent default scrolling
    e.preventDefault();

    // set visual active
    setDirActive(dir, true);

    // movement logic
    switch (dir) {
        case "up": direction = { x: 0, y: -1 }; break;
        case "down": direction = { x: 0, y: 1 }; break;
        case "left": direction = { x: -1, y: 0 }; break;
        case "right": direction = { x: 1, y: 0 }; break;
        default: return;
    }

    if(soundOn) {
        try { moveSound.currentTime = 0; moveSound.play(); } catch(e){}
    }

    // if paused, unpause and hide Start
    if (paused) {
        paused = false;
        pauseBtn && (pauseBtn.textContent = 'Pause');
        startBtn && (startBtn.style.display = 'none');
        if(soundOn) { try { musicSound.play(); } catch(e){} }
        lastPaintTime = performance.now();
        window.requestAnimationFrame(main);
    }
});

// keyup -> remove active state for the pressed arrow(s)
window.addEventListener('keyup', e => {
    const dir = KEY_TO_DIR[e.code] || KEY_TO_DIR[e.key];
    if (!dir) return;
    setDirActive(dir, false);
});

// If the window loses focus, clear all active states (safety)
window.addEventListener('blur', () => {
    document.querySelectorAll('.dir-btn.active').forEach(b => b.classList.remove('active'));
});

//
// Replay / Reset button
//
replayBtn && replayBtn.addEventListener('click', () => {
    hideGameOverModal();
    snakeArr = [{ x: 13, y: 15 }];
    food = randomFood();
    score = 0;
    if (scoreBox) scoreBox.innerHTML = "Score: " + score;
    direction = { x: 0, y: 0 };
    paused = true;
    if (startBtn) startBtn.style.display = 'inline-block';
    if (soundOn) { try { musicSound.pause(); musicSound.currentTime = 0; } catch(e){} }
});

//
// initialization
//
window.addEventListener('load', () => {
    try { speed = Number(speedRange.value || speed); } catch(e){}
    paused = true;
    if (startBtn) startBtn.style.display = 'inline-block';
    lastPaintTime = performance.now();
});
