//Game Constants and Variables
// y for row and x for column

let direction = { x: 0, y: 0 };
const foodSound=new Audio("/music/food.mp3"); 
const gameOverSound=new Audio("/music/gameover.mp3"); 
const moveSound=new Audio("/music/move.mp3"); 
const musicSound=new Audio("/music/music.mp3");
let speed = 2 ; 
let lastPaintTime = 0;
let snakeArr = [
    { x: 13, y: 15 }
];
let food = { x: 6, y: 7 };
let score = 0;
let hiscoreval = 0;
let hiscoreBox = document.getElementById('hiscoreBox');
let scoreBox = document.getElementById('scoreBox');
let board = document.getElementById('board');
let snakeElement;
let foodElement;
// --- localStorage helpers & keys ---
const HISCORE_KEY = 'snake_hiscore';

function _getItem(key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('localStorage read error for', key, e);
        return defaultValue;
    }
}

function _setItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('localStorage write error for', key, e);
    }
}

function saveHiscore(score) {
    _setItem(HISCORE_KEY, score);
}

function loadHiscore() {
    return _getItem(HISCORE_KEY, 0);
}

// initialize hiscore from storage
hiscoreval = loadHiscore();
if (hiscoreBox) hiscoreBox.innerHTML = 'HiScore: ' + hiscoreval;
// --- history helpers ---
const HISTORY_KEY = 'snake_history';

function loadHistory(){
    return _getItem(HISTORY_KEY, []);
}

function saveHistory(arr){
    _setItem(HISTORY_KEY, arr);
}

function pushHistoryEntry(name, score){
    try{
        const entry = { name: name || 'Unknown', score: score, date: new Date().toISOString() };
        const h = loadHistory();
        h.push(entry);
        // keep last 100 entries at most
        saveHistory(h.slice(-100));
    }catch(e){ console.warn('Could not save history', e); }
}
//Game functions

function main(ctime) 
{
    window.requestAnimationFrame(main);
    if((ctime-lastPaintTime)/1000 < 1/speed)
    {
        return;
    }
    lastPaintTime = ctime;
    gameEngine();
}

function isCollide(snake) { 
    //If you bump into yourself 
    for (let i = 1; i < snake.length; i++) {    
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) {       
            return true;
        }       
    }       
    //If you bump into the wall 
    if (snake[0].x >= 18 || snake[0].x <= 0 || snake[0].y >= 18 || snake[0].y <= 0) {
        return true;        
    }   
    return false;   

}           


function gameEngine()
{
    //Part 1: Updating the snake array & food
    if(isCollide(snakeArr)){
        gameOverSound.play();
        musicSound.pause(); 
        direction = {x: 0, y: 0};       
        // Show game over message
        alert("Game Over. Press any key to play again!");

        // Record score in history before resetting (only if player scored)
        try {
            if (score > 0) {
                // Player name is stored by the landing page under key 'snake_player'
                const playerName = _getItem('snake_player', null);
                pushHistoryEntry(playerName, score);
            }
        } catch (e) {
            console.warn('Failed to record game history', e);
        }

        // Reset snake and resume music
        snakeArr = [{x: 13, y: 15}];    
        musicSound.play();
        score = 0;
    }   
    //If you have eaten the food, increment the score and regenerate the food
    if(snakeArr[0].y === food.y && snakeArr[0].x === food.x){
        foodSound.play();
        score += 1;     
        showToast('+1 point');
        if(score>hiscoreval){   
            hiscoreval = score; 
            saveHiscore(hiscoreval);
            if (hiscoreBox) hiscoreBox.innerHTML = "HiScore: " + hiscoreval; 
        }       
        scoreBox.innerHTML = "Score: " + score; 
        snakeArr.unshift({x: snakeArr[0].x + direction.x, y: snakeArr[0].y + direction.y});
        let a = 2;  
        let b = 16;
        food = {x: Math.round(a + (b-a)* Math.random()), y: Math.round(a + (b-a)* Math.random())};
        console.log('New food position:', food);
    }       
// Toast notification function
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 1200);
}
    //Moving the snake
    for (let i = snakeArr.length - 2; i >= 0; i--) {    
        snakeArr[i+1] = {...snakeArr[i]};
    }
    snakeArr[0].x += direction.x;   
    snakeArr[0].y += direction.y;   


    //Part 2: Display the snake and food
    board.innerHTML = ""; 
    snakeArr.forEach((e, index)=>{
        snakeElement = document.createElement('div');
        snakeElement.style.gridRowStart = e.y;
        snakeElement.style.gridColumnStart = e.x;       
        if(index === 0){
            snakeElement.classList.add('head');
        }       
        else{
            snakeElement.classList.add('snake');
        }                           
        board.appendChild(snakeElement);                            

    });

    //Display the food
    foodElement = document.createElement('div');
    foodElement.style.gridRowStart = food.y;
    foodElement.style.gridColumnStart = food.x;       
    foodElement.classList.add('food');                           
    board.appendChild(foodElement);
}

//Main logic starts here
window.requestAnimationFrame(main);

window.addEventListener('keydown', e=>{
    direction = {x: 0, y: 1} //Start the game
    moveSound.play();   
    switch (e.key) {
        case "ArrowUp":
            console.log("ArrowUp");
            direction.x = 0;
            direction.y = -1;
            break;
        case "ArrowDown":
            console.log("ArrowDown");
            direction.x = 0;    
            direction.y = 1;        
            break;
        case "ArrowLeft":
            console.log("ArrowLeft");       
            direction.x = -1;       
            direction.y = 0;
            break;  
        case "ArrowRight":
            console.log("ArrowRight");  
            direction.x = 1;
            direction.y = 0;        
            break;  
        default:
            break;
    }   
});


