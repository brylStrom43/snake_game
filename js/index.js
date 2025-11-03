// Game Constants and Variables
let direction = { x: 0, y: 0 };
const foodSound = new Audio("/music/food.mp3");
const gameOverSound = new Audio("/music/gameover.mp3");
const moveSound = new Audio("/music/move.mp3");
const musicSound = new Audio("/music/music.mp3");
musicSound.loop = true;

let speed = 4;
let lastPaintTime = 0;
let snakeArr = [{ x: 13, y: 15 }];
let food = { x: 6, y: 7 };
let score = 0;
let hiscoreval = 0;
let paused = false;
let soundOn = true;

const HISCORE_KEY = 'snake_hiscore';
const HISTORY_KEY = 'snake_history';

const hiscoreBox = document.getElementById('hiscoreBox');
const scoreBox = document.getElementById('scoreBox');
const board = document.getElementById('board');
const toastEl = document.getElementById('toast');

const pauseBtn = document.getElementById('pauseBtn');
const soundBtn = document.getElementById('soundBtn');
const speedRange = document.getElementById('speedRange');
const gameOverModal = document.getElementById('gameOverModal');
const tauntImg = document.getElementById('tauntImg');
const tauntText = document.getElementById('tauntText');
const finalScoreText = document.getElementById('finalScoreText');
const replayBtn = document.getElementById('replayBtn');

// localStorage helpers
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
        // keep last 100 entries at most
        saveHistory(h.slice(-100));
    }catch(e){ console.warn('Could not save history', e); }
}

// initialize hiscore
hiscoreval = loadHiscore();
if (hiscoreBox) hiscoreBox.innerHTML = 'HiScore: ' + hiscoreval;

// UI helpers
function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 1200);
}

// Game loop
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
        if(soundOn) gameOverSound.play();
        musicSound.pause();
        direction = { x: 0, y: 0 };

        // Save history only if player scored
        try {
            if (score > 0) {
                // get name from sessionStorage (no persistent save)
                let playerName = null;
                try { playerName = sessionStorage.getItem('snake_player'); } catch(e){}
                pushHistoryEntry(playerName || 'Player', score);
            }
        } catch (e) { console.warn('Failed to record game history', e); }

        // Show taunt modal instead of alert
        showGameOverModal(score);

        // reset for next play (actual reset handled when user clicks Play Again)
        snakeArr = [{ x: 13, y: 15 }];
        score = 0;
        scoreBox.innerHTML = "Score: " + score;
        return;
    }

    // check if eaten food
    if (snakeArr[0].y === food.y && snakeArr[0].x === food.x) {
        if(soundOn) foodSound.play();
        score += 1;
        showToast('+1 point');
        scoreBox.innerHTML = "Score: " + score;
        // animate hiscore
        if (score > hiscoreval) {
            hiscoreval = score;
            saveHiscore(hiscoreval);
            if (hiscoreBox) {
                hiscoreBox.innerHTML = "HiScore: " + hiscoreval;
                hiscoreBox.classList.add('hiscore-pop');
                setTimeout(() => hiscoreBox.classList.remove('hiscore-pop'), 900);
            }
        }
        snakeArr.unshift({ x: snakeArr[0].x + direction.x, y: snakeArr[0].y + direction.y });
        food = randomFood();
    }

    // move snake body
    for (let i = snakeArr.length - 2; i >= 0; i--) {
        snakeArr[i + 1] = { ...snakeArr[i] };
    }
    snakeArr[0].x += direction.x;
    snakeArr[0].y += direction.y;

    // render board
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

// UI: taunt messages; rotate a few fun taunts
const TAUNTS = [
    "Ouch — the tail got you!",
    "Snake says: 'Better luck next time, chump.'",
    "Too slow! The worm wins this round.",
    "Maybe try turning the other way? 😏",
    "Ha! My pixel-perfect strike."
];

function showGameOverModal(finalScore) {
    if (!gameOverModal) return;
    // choose random taunt
    const t = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
    tauntText.textContent = t;
    finalScoreText.textContent = `Score: ${finalScore}`;
    gameOverModal.setAttribute('aria-hidden', 'false');
    gameOverModal.classList.add('show');
}

function hideGameOverModal() {
    if (!gameOverModal) return;
    gameOverModal.setAttribute('aria-hidden', 'true');
    gameOverModal.classList.remove('show');
}

// Controls
pauseBtn && pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (!paused) {
        // resume music if sound allowed
        if(soundOn) musicSound.play();
        // ensure the loop keeps running
        lastPaintTime = performance.now();
    } else {
        musicSound.pause();
    }
});

soundBtn && soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? 'Sound: On' : 'Sound: Off';
    if (!soundOn) { musicSound.pause(); } else { if(!paused) musicSound.play(); }
});

speedRange && speedRange.addEventListener('input', (e) => {
    speed = Number(e.target.value);
});

// mobile on-screen controls
document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        const d = btn.getAttribute('data-dir');
        switch (d) {
            case 'up': direction = { x: 0, y: -1 }; break;
            case 'down': direction = { x: 0, y: 1 }; break;
            case 'left': direction = { x: -1, y: 0 }; break;
            case 'right': direction = { x: 1, y: 0 }; break;
        }
        if(soundOn) moveSound.play();
    });
});

// keyboard controls
window.addEventListener('keydown', e => {
    // allow pause/resume on space
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        paused = !paused;
        pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        if (soundOn && !paused) musicSound.play(); else musicSound.pause();
        return;
    }
    // start the game if not started
    if (direction.x === 0 && direction.y === 0) {
        direction = { x: 1, y: 0 }; // default right if player presses key
    }

    switch (e.key) {
        case "ArrowUp": direction = { x: 0, y: -1 }; break;
        case "ArrowDown": direction = { x: 0, y: 1 }; break;
        case "ArrowLeft": direction = { x: -1, y: 0 }; break;
        case "ArrowRight": direction = { x: 1, y: 0 }; break;
        default: return;
    }
    if(soundOn) moveSound.play();
});

// Replay button
replayBtn && replayBtn.addEventListener('click', () => {
    hideGameOverModal();
    // reset game state and auto-start after 500ms
    snakeArr = [{ x: 13, y: 15 }];
    food = randomFood();
    score = 0;
    scoreBox.innerHTML = "Score: " + score;
    // start music if allowed
    if (soundOn) {
        try { musicSound.currentTime = 0; musicSound.play(); } catch (e) {}
    }
    // small delay then start moving right
    setTimeout(() => { direction = { x: 1, y: 0 }; paused = false; }, 300);
});

// initialization: auto-start after 1 second (move right)
window.addEventListener('load', () => {
    // set speed from slider if present
    try { speed = Number(speedRange.value || speed); } catch(e){}

    // small delay to let UI settle, then auto-start snake to the right
    setTimeout(() => {
        direction = { x: 1, y: 0 };
        if(soundOn) {
            try { musicSound.play(); } catch(e){}
        }
    }, 1000);

    // start animation loop
    lastPaintTime = performance.now();
    window.requestAnimationFrame(main);
});
