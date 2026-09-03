const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');

let score = 0, timeLeft = 30, gameActive = false;
let target = { x: 100, y: 100, radius: 40, type: 'good' };

const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5 });
hands.onResults(onResults);

function moveTarget() {
    target.x = Math.random() * (canvas.width - 100) + 50;
    target.y = Math.random() * (canvas.height - 100) + 50;
    target.type = Math.random() > 0.7 ? 'bad' : 'good'; // 30% de probabilidad de ser un obstáculo rojo
}

function onResults(results) {
    if (!gameActive) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar objetivo
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
    ctx.fillStyle = target.type === 'good' ? '#00ff88' : '#ff3e3e';
    ctx.fill();
    ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.stroke();

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            const x = landmarks[8].x * canvas.width;
            const y = landmarks[8].y * canvas.height;
            
            // Colisión
            if (Math.hypot(x - target.x, y - target.y) < target.radius) {
                if(target.type === 'good') score += 10; else score -= 5;
                scoreEl.innerText = score;
                moveTarget();
            }
            // Dibujar punto en el dedo
            ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(x,y,8,0,7); ctx.fill();
        }
    }
}

const camera = new Camera(video, { onFrame: async () => { await hands.send({image: video}); }, width: 640, height: 480 });

startBtn.onclick = () => {
    overlay.style.display = 'none';
    gameActive = true;
    camera.start();
    let timer = setInterval(() => {
        timeLeft--;
        timerEl.innerText = timeLeft;
        if(timeLeft <= 0) { 
            clearInterval(timer); 
            gameActive = false; 
            overlay.innerHTML = `<h2>FIN</h2><p>Puntos: ${score}</p><button onclick="location.reload()">REPETIR</button>`;
            overlay.style.display = 'block';
        }
    }, 1000);
};