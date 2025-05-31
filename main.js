// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const messageDisplay = document.getElementById('message');
const gameTitleElement = document.getElementById('gameTitle');
const uiContainerElement = document.getElementById('ui-container');
const levelDisplay = document.getElementById('levelDisplay');

// Ensure crisp pixels for pixel art
ctx.imageSmoothingEnabled = false;

// Canvas dimensions
let canvasWidth = 600;
let canvasHeight = 400;
canvas.width = canvasWidth;
canvas.height = canvasHeight;

// Global game variables
let hueShift = 0;
const PIXEL_SIZE_RENDER_FACTOR = 1; // This constant is used in exit dimensions, ensure it's 1 if not scaling pixels.
let victoryAchieved = false;

// --- Platform Styling Palette ---
const platformWoodColors = ['#7E5539', '#A0765E', '#8C6D52', '#6B4F34'];
const platformMossColors = ['#556B2F', '#6B8E23'];
const platformHighlightColor = '#C69C7E';
const platformShadowColor = '#4A3B31';

// --- Asset Loading ---
const staticBackgroundImage = new Image();
const playerSpritesheet = new Image();
const victoryImage = new Image();

let staticBackgroundLoaded = false;
let playerSheetLoaded = false;
let victoryImageLoaded = false;
const backgroundScrollFactor = 0.3;

// *** Victory Animation: Variables ***
let victoryStars = [];
let victoryAnimationActive = false;
let victoryAnimationStartTime = 0;
const VICTORY_STAR_COUNT = 10;
const VICTORY_ANIM_ORBIT_DURATION = 7000;
const VICTORY_ANIM_ASCEND_DURATION = 4000;

staticBackgroundImage.onload = () => {
    staticBackgroundLoaded = true;
};
staticBackgroundImage.onerror = () => { /* Error handling for production */ };
staticBackgroundImage.src = 'treehouse_background.jpg';

playerSpritesheet.onload = () => {
    playerSheetLoaded = true;
};
playerSpritesheet.onerror = () => { /* Error handling for production */ };
playerSpritesheet.src = 'player_spritesheet.png';

victoryImage.onload = () => {
    victoryImageLoaded = true;
};
victoryImage.onerror = () => { /* Error handling for production */ };
victoryImage.src = 'victory.png';


// --- Player Definition ---
const player = {
    x: 50, y: 0,
    scale: 0.7,
    spriteSheetFrameWidth: 117,
    spriteSheetPartHeight: 68,
    get drawWidth() { return this.spriteSheetFrameWidth * PIXEL_SIZE_RENDER_FACTOR * this.scale; },
    get drawHeight() { return this.spriteSheetPartHeight * 3 * PIXEL_SIZE_RENDER_FACTOR * this.scale; },
    hitboxOffsetX: 0,
    hitboxOffsetY: 0,
    get hitboxWidth() { return this.spriteSheetFrameWidth * PIXEL_SIZE_RENDER_FACTOR * 0.75 * this.scale; },
    get hitboxHeight() { return this.spriteSheetPartHeight * 3 * PIXEL_SIZE_RENDER_FACTOR * this.scale; },
    velocityX: 0, velocityY: 0,
    acceleration: 0.35, friction: 0.83, maxSpeed: 3.8,
    gravity: 0.50, jumpStrength: -13,
    jumpHoldForce: 0.25,
    maxJumpHoldFrames: 15, jumpHoldFrames: 0,
    isJumping: false, onGround: false,
    facingRight: true,
    ignorePlatformCollisionUntil: 0,
    animation: {
        currentState: 'idle',
        currentFrameIndex: 0,
        frameTimer: 0,
        sequences: {
            idle: {
                frames: [{ x: 24, y: 14 }],
                duration: 25
            },
            walk: {
                frames: [
                    { x: 500, y: 300 }, { x: 867, y: 300 }, { x: 750, y: 10 },
                    { x: 879, y: 10 },  { x: 867, y: 300 }, { x: 673, y: 300 },
                    { x: 513, y: 300 }, { x: 867, y: 300 }, { x: 673, y: 300 }
                ],
                duration: 9
            },
            jump: {
                frames: [{ x: 892, y: 800 }],
                duration: 60
            }
        }
    },
};

// --- Camera ---
const camera = { x: 0, y: 0 };

// --- Levels ---
let currentLevelIndex = 0;
let currentCollectibles = [];
let totalCollectiblesInLevel = 0;
let currentExit = {};
const BASE_STAR_SIZE = 12;
const STAR_SIZE = BASE_STAR_SIZE * 1.3;

const TRAMPOLINE_DEFAULT_PROPS = {
    type: 'trampoline',
    bounceStrength: -20,
    isBouncing: false,
    animation: { squashedHeightFactor: 0.5, duration: 15, timer: 0 }
};

// *** Portal Exit Dimensions ***
const originalExitWidth = 5 * PIXEL_SIZE_RENDER_FACTOR * 2; // Original was 10
const originalExitHeight = 10 * PIXEL_SIZE_RENDER_FACTOR * 2; // Original was 20
const portalWidth = originalExitWidth * 5; // New width: 50
const portalHeight = originalExitHeight * 5; // New height: 100
const portalPlatformY = canvasHeight - 40; // Y position of the platform the portal sits on
const portalY = portalPlatformY - portalHeight; // Portal's top Y, so it sits on the platform
const originalExitX = 2350;
const portalX = originalExitX - (portalWidth - originalExitWidth) / 2; // Adjust X to keep it centered

const levels = [
    {
        width: 2400,
        playerStart: { x: 80, y: canvasHeight - 40 - player.hitboxHeight },
        platforms: [
            { x: 0, y: canvasHeight - 40, width: 400, height: 40 },
            { x: 450, y: canvasHeight - 100, width: 150, height: 20 },
            { ...TRAMPOLINE_DEFAULT_PROPS, x: 300, y: canvasHeight - 60, width: 70, height: 20 },
            { x: 650, y: canvasHeight - 160, width: 120, height: 20 },
            { x: 400, y: canvasHeight - 220, width: 100, height: 20 },
            { x: 800, y: canvasHeight - 40, width: 300, height: 40 },
            { ...TRAMPOLINE_DEFAULT_PROPS, x: 1000, y: canvasHeight - 60, width: 70, height: 20, bounceStrength: -22 },
            { x: 1150, y: canvasHeight - 120, width: 130, height: 20 },
            { x: 1350, y: canvasHeight - 180, width: 150, height: 20 },
            { x: 1200, y: canvasHeight - 250, width: 100, height: 20 },
            { x: 1550, y: canvasHeight - 150, width: 100, height: 20, moving: true, range: 150, speed: 0.7 },
            { x: 1850, y: canvasHeight - 40, width: 550, height: 40 }, // Platform for the exit
            { x: 2000, y: canvasHeight - 200, width: 150, height: 20 },
            { ...TRAMPOLINE_DEFAULT_PROPS, x: 1850, y: canvasHeight - 60, width: 70, height: 20, bounceStrength: -25 },
            { x: 2200, y: canvasHeight - 140, width: 100, height: 20 },
        ],
        collectibles: [
            { x: 200, y: canvasHeight - 40 - STAR_SIZE - 30, width: STAR_SIZE, height: STAR_SIZE },
            { x: 480, y: canvasHeight - 100 - STAR_SIZE - 10, width: STAR_SIZE, height: STAR_SIZE },
            { x: 750, y: canvasHeight - 160 - STAR_SIZE - 20, width: STAR_SIZE, height: STAR_SIZE },
            { x: 430, y: canvasHeight - 220 - STAR_SIZE - 10, width: STAR_SIZE, height: STAR_SIZE },
            { x: 850, y: canvasHeight - 40 - STAR_SIZE - 70, width: STAR_SIZE, height: STAR_SIZE },
            { x: 1180, y: canvasHeight - 120 - STAR_SIZE - 10, width: STAR_SIZE, height: STAR_SIZE },
            { x: 1250, y: canvasHeight - 250 - STAR_SIZE - 10, width: STAR_SIZE, height: STAR_SIZE },
            { x: 1600, y: canvasHeight - 150 - STAR_SIZE - 40, width: STAR_SIZE, height: STAR_SIZE },
            { x: 1900, y: canvasHeight - 40 - STAR_SIZE - 80, width: STAR_SIZE, height: STAR_SIZE },
            { x: 2250, y: canvasHeight - 140 - STAR_SIZE - 10, width: STAR_SIZE, height: STAR_SIZE }
        ],
        exit: { x: portalX, y: portalY, width: portalWidth, height: portalHeight } // Updated exit definition
    },
];

// --- Input Handling ---
const keys = { left: false, right: false, up: false, down: false };

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
    if (victoryAchieved) return;
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowDown') keys.down = true;
    if (e.key === 'ArrowUp' || e.key === ' ') {
        if (!player.isJumping && player.onGround) {
            player.velocityY = player.jumpStrength;
            player.isJumping = true; player.onGround = false; player.jumpHoldFrames = 0;
            player.ignorePlatformCollisionUntil = 0;
        }
        keys.up = true;
    }
});
window.addEventListener('keyup', (e) => {
    if (victoryAchieved) return;
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowDown') keys.down = false;
    if (e.key === 'ArrowUp' || e.key === ' ') keys.up = false;
});

// Touch Listeners
function handleTouchStart(event) {
    if (victoryAchieved) return;
    event.preventDefault(); // Prevent default touch actions like scrolling

    const rect = canvas.getBoundingClientRect();
    // Handle multi-touch by iterating through changedTouches or touches
    // For simplicity, this example uses the first touch point.
    const touch = event.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    // Horizontal movement (Left/Right Halves)
    if (touchX < canvas.width / 2) {
        keys.left = true;
        keys.right = false; // Ensure no conflicting horizontal input
    } else {
        keys.right = true;
        keys.left = false; // Ensure no conflicting horizontal input
    }

    // Vertical movement
    keys.up = false; // Reset vertical keys at the start of handling
    keys.down = false;

    if (touchY < canvas.height / 2) { // Top half for up/jump
        if (!player.isJumping && player.onGround) {
            player.velocityY = player.jumpStrength;
            player.isJumping = true;
            player.onGround = false;
            player.jumpHoldFrames = 0;
            player.ignorePlatformCollisionUntil = 0;
        }
        keys.up = true;
    } else if (touchY > canvas.height * 0.8) { // Bottom 20% of the screen for down
        keys.down = true;
    }
    // If touchY is between canvas.height / 2 and canvas.height * 0.8,
    // keys.up and keys.down remain false, effectively creating a vertical dead zone.
}

function handleTouchEnd(event) {
    if (victoryAchieved) return;
    // When any touch ends, reset all directional keys.
    // This is a simple approach; more complex multi-touch might require tracking individual touch IDs.
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;
}

canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });


// --- Drawing Functions ---
function drawPlayer() {
    if (!playerSheetLoaded) return;
    let currentFrameData;
    const anim = player.animation;
    const sequence = anim.sequences[anim.currentState];
    if (!sequence || !sequence.frames || sequence.frames.length === 0) {
        ctx.fillStyle = 'red'; ctx.fillRect(player.x, player.y, player.hitboxWidth, player.hitboxHeight); return;
    }
    currentFrameData = sequence.frames[anim.currentFrameIndex % sequence.frames.length];
    if (!currentFrameData || typeof currentFrameData.x === 'undefined' || typeof currentFrameData.y === 'undefined') {
        ctx.fillStyle = 'blue'; ctx.fillRect(player.x, player.y, player.hitboxWidth, player.hitboxHeight); return;
    }
    const sourceX = currentFrameData.x;
    const headSourceY = currentFrameData.y;
    const torsoSourceY = headSourceY + player.spriteSheetPartHeight; 
    const legsSourceY = headSourceY + (2 * player.spriteSheetPartHeight); 
    if (headSourceY < 0 || torsoSourceY < 0 || legsSourceY < 0 ||
        legsSourceY + player.spriteSheetPartHeight > playerSpritesheet.height ||
        sourceX < 0 || sourceX + player.spriteSheetFrameWidth > playerSpritesheet.width) {
        if (playerSpritesheet.width > 0 && playerSpritesheet.height > 0) {}
        ctx.fillStyle = 'magenta'; ctx.fillRect(player.x, player.y, player.hitboxWidth, player.hitboxHeight); return;
    }
    ctx.save();
    if (!player.facingRight) {
        ctx.translate(player.x + player.drawWidth, player.y); ctx.scale(-1, 1);
    } else {
        ctx.translate(player.x, player.y);
    }
    const scaledPartHeight = player.spriteSheetPartHeight * PIXEL_SIZE_RENDER_FACTOR * player.scale;
    ctx.drawImage(playerSpritesheet, sourceX, headSourceY, player.spriteSheetFrameWidth, player.spriteSheetPartHeight, 0, 0, player.drawWidth, scaledPartHeight);
    ctx.drawImage(playerSpritesheet, sourceX, torsoSourceY, player.spriteSheetFrameWidth, player.spriteSheetPartHeight, 0, scaledPartHeight, player.drawWidth, scaledPartHeight);
    ctx.drawImage(playerSpritesheet, sourceX, legsSourceY, player.spriteSheetFrameWidth, player.spriteSheetPartHeight, 0, 2 * scaledPartHeight, player.drawWidth, scaledPartHeight);
    ctx.restore();
}

function drawPlatforms(level) {
    if (!level || !level.platforms) return;
    level.platforms.forEach(platform => {
        if (platform.type === 'trampoline') {
            const frameColor = '#27ae60'; 
            const topColor = '#3498db';   
            let currentHeight = platform.height;
            let yPos = platform.y;
            if (platform.isBouncing && platform.animation) {
                const squashedAmount = platform.height * (1 - platform.animation.squashedHeightFactor);
                const progress = Math.sin((platform.animation.timer / platform.animation.duration) * Math.PI);
                const heightChange = squashedAmount * progress;
                currentHeight = platform.height - heightChange;
                yPos = platform.y + heightChange; 
            }
            ctx.fillStyle = frameColor;
            ctx.fillRect(platform.x, yPos, platform.width, currentHeight);
            const padInset = Math.min(2, platform.width / 10, currentHeight / 5) ; 
            ctx.fillStyle = topColor;
            ctx.fillRect(platform.x + padInset, yPos + padInset, platform.width - padInset * 2, Math.max(1, currentHeight * 0.4 - padInset));
        } else { 
            const platWidth = platform.width;
            const platHeight = platform.height;
            const plankLineFrequency = 8; 
            const mossChanceThreshold = Math.floor(0.03 * 100); 
            for (let r = 0; r < platHeight; r++) { 
                for (let c = 0; c < platWidth; c++) { 
                    let chosenColor;
                    let seedX = Math.floor(platform.x); 
                    if (platform.moving && typeof platform.initialX === 'number') { 
                        seedX = Math.floor(platform.initialX);
                    }
                    const hash = (c * 13 + r * 31 + seedX * 5 + Math.floor(platform.y) * 7); 
                    if (c === 0 || c === platWidth - 1 || r === platHeight - 1) { 
                        chosenColor = platformShadowColor;
                    } else if (r === 0) { 
                         chosenColor = platformHighlightColor;
                    } else if (r % plankLineFrequency === (plankLineFrequency - 1) ) { 
                        chosenColor = platformShadowColor;
                    } else { 
                        if ((hash % 100) < mossChanceThreshold) { 
                            chosenColor = platformMossColors[ (hash >> 8) % platformMossColors.length ]; 
                        } else {
                            chosenColor = platformWoodColors[hash % platformWoodColors.length];
                        }
                    }
                    ctx.fillStyle = chosenColor;
                    ctx.fillRect(platform.x + c, platform.y + r, 1, 1); 
                }
            }
        }
    });
}

function drawStarShape(x, y, size, color) {
    ctx.fillStyle = color;
    const s = size / 5; 
    ctx.fillRect(x + s * 2, y, s, s); ctx.fillRect(x, y + s, s, s); ctx.fillRect(x + s, y + s, s, s);
    ctx.fillRect(x + s * 2, y + s, s, s); ctx.fillRect(x + s * 3, y + s, s, s); ctx.fillRect(x + s * 4, y + s, s, s);
    ctx.fillRect(x + s, y + s * 2, s, s); ctx.fillRect(x + s * 2, y + s * 2, s, s); ctx.fillRect(x + s * 3, y + s * 2, s, s);
    ctx.fillRect(x + s * 2, y + s * 3, s, s); ctx.fillRect(x + s, y + s * 4, s, s); ctx.fillRect(x + s * 3, y + s * 4, s, s);
}

function drawCollectibles() {
    if (!currentCollectibles) return;
    currentCollectibles.forEach(item => { 
        if (!item.collected) {
            const itemHue = (item.baseHue + hueShift) % 360; 
            const itemShimmer = 70 + Math.sin(Date.now() * 0.008 + item.y * 0.1) * 15;
            const starColor = `hsl(${itemHue}, 90%, ${itemShimmer}%)`;
            drawStarShape(item.x, item.y, item.width, starColor); 
            const sparkleHue = (itemHue + 40) % 360;
            const sparkleColor = `hsla(${sparkleHue}, 100%, ${80 + Math.sin(Date.now() * 0.015 + item.x * 0.2) * 15}%, 0.8)`;
            ctx.fillStyle = sparkleColor; const sparkleSize = item.width * 0.3; 
            ctx.fillRect(item.x + item.width*0.5 - sparkleSize*0.5, item.y + item.height*0.5 - sparkleSize*0.5, sparkleSize, sparkleSize);
        }
    });
}

const exitColorBaseHue = 280; // Base hue for the portal (purple/magenta range)
function drawExit() {
    if (currentExit && currentExit.x !== undefined) {
        const portalCenterX = currentExit.x + currentExit.width / 2;
        const portalCenterY = currentExit.y + currentExit.height / 2;
        const portalRadiusX = currentExit.width / 2;
        const portalRadiusY = currentExit.height / 2;

        const time = Date.now();
        const dynamicHue = (exitColorBaseHue + hueShift + Math.sin(time * 0.001) * 15) % 360;
        const dynamicSaturation = 75 + Math.sin(time * 0.0015) * 15;
        const dynamicLightnessCore = 60 + Math.sin(time * 0.002) * 10;
        const dynamicLightnessOuter = 40 + Math.sin(time * 0.0025) * 10;

        // Outer glow (larger, more transparent)
        ctx.beginPath();
        ctx.ellipse(portalCenterX, portalCenterY, portalRadiusX * 1.3, portalRadiusY * 1.3, 0, 0, Math.PI * 2);
        const outerGlowGradient = ctx.createRadialGradient(portalCenterX, portalCenterY, portalRadiusX * 0.5, portalCenterX, portalCenterY, portalRadiusX * 1.3);
        outerGlowGradient.addColorStop(0, `hsla(${dynamicHue}, ${dynamicSaturation}%, ${dynamicLightnessOuter}%, 0)`);
        outerGlowGradient.addColorStop(0.8, `hsla(${dynamicHue}, ${dynamicSaturation}%, ${dynamicLightnessOuter}%, 0.4)`);
        outerGlowGradient.addColorStop(1, `hsla(${dynamicHue}, ${dynamicSaturation}%, ${dynamicLightnessOuter}%, 0)`);
        ctx.fillStyle = outerGlowGradient;
        ctx.fill();

        // Main portal body (elliptical)
        ctx.beginPath();
        ctx.ellipse(portalCenterX, portalCenterY, portalRadiusX, portalRadiusY, 0, 0, Math.PI * 2);
        const portalGradient = ctx.createRadialGradient(portalCenterX, portalCenterY, portalRadiusX * 0.1, portalCenterX, portalCenterY, portalRadiusX);
        portalGradient.addColorStop(0, `hsla(${dynamicHue}, ${dynamicSaturation + 10}%, ${dynamicLightnessCore + 10}%, 0.95)`); // Brighter center
        portalGradient.addColorStop(0.3, `hsla(${dynamicHue}, ${dynamicSaturation}%, ${dynamicLightnessCore}%, 0.9)`);
        portalGradient.addColorStop(1, `hsla(${(dynamicHue + 20) % 360}, ${dynamicSaturation -10}%, ${dynamicLightnessOuter}%, 0.7)`); // Darker, slightly different hue edge
        ctx.fillStyle = portalGradient;
        ctx.fill();

        // Inner core (smaller, very bright, almost white)
        ctx.beginPath();
        ctx.ellipse(portalCenterX, portalCenterY, portalRadiusX * 0.3, portalRadiusY * 0.3, 0, 0, Math.PI * 2);
        const coreGradient = ctx.createRadialGradient(portalCenterX, portalCenterY, portalRadiusX * 0.05, portalCenterX, portalCenterY, portalRadiusX * 0.3);
        coreGradient.addColorStop(0, `hsla(${(dynamicHue + 30) % 360}, 100%, 95%, 1)`); // Almost white center
        coreGradient.addColorStop(1, `hsla(${dynamicHue}, ${dynamicSaturation + 10}%, ${dynamicLightnessCore + 5}%, 0)`);
        ctx.fillStyle = coreGradient;
        ctx.fill();

        // Optional: Add some subtle "energy" particles or lines if desired
        ctx.save();
        ctx.strokeStyle = `hsla(${(dynamicHue + 180) % 360}, 100%, 80%, 0.5 + Math.sin(time * 0.005) * 0.3)`;
        ctx.lineWidth = 1 + Math.sin(time * 0.006) * 0.5;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const angle = time * 0.0002 * (i + 1) + i * Math.PI / 3;
            const lengthFactor = 0.6 + Math.sin(time * 0.0005 * (i+1)) * 0.2;
            ctx.moveTo(portalCenterX + Math.cos(angle) * portalRadiusX * 0.2, portalCenterY + Math.sin(angle) * portalRadiusY * 0.2);
            ctx.lineTo(portalCenterX + Math.cos(angle) * portalRadiusX * lengthFactor, portalCenterY + Math.sin(angle) * portalRadiusY * lengthFactor);
            ctx.stroke();
        }
        ctx.restore();
    }
}


function drawStaticTreehouseBackground(levelWidth) {
    if (staticBackgroundLoaded && staticBackgroundImage.width > 0) {
        const bgX = Math.floor(camera.x * backgroundScrollFactor); 
        const imgWidth = staticBackgroundImage.width; const imgHeight = staticBackgroundImage.height;
        const startX = - (bgX % imgWidth);
        for (let xOffset = startX; xOffset < canvasWidth; xOffset += imgWidth) {
            ctx.drawImage(staticBackgroundImage, xOffset, 0, imgWidth, imgHeight);
        }
    } else if (!staticBackgroundLoaded) {
        const fallbackHue = (150 + hueShift * 0.5) % 360; ctx.fillStyle = `hsl(${fallbackHue}, 30%, 20%)`;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else if (staticBackgroundImage.width === 0) {
        const fallbackHue = (0 + hueShift * 0.5) % 360; ctx.fillStyle = `hsl(${fallbackHue}, 70%, 40%)`;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
}

// --- Game Logic ---
function updatePlayerAnimation() {
    const anim = player.animation; let newState = 'idle';
    if (!player.onGround) newState = 'jump';
    else if (Math.abs(player.velocityX) > 0.1) newState = 'walk';

    if (anim.currentState !== newState) {
        anim.currentState = newState; anim.currentFrameIndex = 0; anim.frameTimer = 0;
    }
    anim.frameTimer++;
    const currentSequence = anim.sequences[anim.currentState];
    if (currentSequence && currentSequence.frames && currentSequence.frames.length > 0 && anim.frameTimer >= currentSequence.duration) {
        anim.frameTimer = 0; anim.currentFrameIndex++;
        if (anim.currentFrameIndex >= currentSequence.frames.length) anim.currentFrameIndex = 0;
    }
}

function updatePlayer(level) {
    if (!level) { return; }
    if (keys.down && player.onGround && !player.isJumping) {
        player.onGround = false;
        player.isJumping = true; 
        player.velocityY = 3; 
        player.ignorePlatformCollisionUntil = Date.now() + 50; 
    }
    if (keys.left) { player.velocityX -= player.acceleration; player.facingRight = false; }
    else if (keys.right) { player.velocityX += player.acceleration; player.facingRight = true; }
    else { player.velocityX *= player.friction; }
    if (Math.abs(player.velocityX) < 0.1) player.velocityX = 0;
    player.velocityX = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.velocityX));
    player.x += player.velocityX;
    if (keys.up && player.isJumping && player.jumpHoldFrames < player.maxJumpHoldFrames) {
        player.velocityY -= player.jumpHoldForce; player.jumpHoldFrames++;
    }
    player.velocityY += player.gravity;
    player.y += player.velocityY;
    player.onGround = false;
    if (player.x < 0) { player.x = 0; player.velocityX = 0; }
    if (level.width && player.x + player.hitboxOffsetX + player.hitboxWidth > level.width) {
        player.x = level.width - player.hitboxWidth - player.hitboxOffsetX; player.velocityX = 0;
    }
    if (level.platforms) {
        level.platforms.forEach(platform => {
            let platformDeltaX = 0; let platX = platform.x;
            if (platform.moving) {
                if (platform.initialX === undefined) platform.initialX = platform.x; 
                const timeFactor = Date.now() * 0.001 * (platform.speed || 1);
                const movement = Math.sin(timeFactor) * (platform.range || 100);
                const prevActualX = platform.prevActualX !== undefined ? platform.prevActualX : (platform.initialX + (platform.prevMovement !== undefined ? platform.prevMovement : 0));
                platform.x = platform.initialX + movement; platformDeltaX = platform.x - prevActualX; 
                platform.prevMovement = movement; platX = platform.x; platform.prevActualX = platform.x; 
            }
            const playerLeft = player.x + player.hitboxOffsetX;
            const playerRight = player.x + player.hitboxOffsetX + player.hitboxWidth;
            const playerTop = player.y + player.hitboxOffsetY;
            const playerBottom = player.y + player.hitboxOffsetY + player.hitboxHeight;
            const platformLeft = platX; const platformRight = platX + platform.width;
            const platformTop = platform.y; const platformBottom = platform.y + platform.height;
            if (playerRight > platformLeft && playerLeft < platformRight &&
                playerBottom > platformTop && playerTop < platformBottom) {
                if (player.velocityY >= 0 && 
                    (playerBottom - player.velocityY) <= platformTop + (platform.type === 'trampoline' ? platform.height : 2.5) && 
                    (platform.type === 'trampoline' || Date.now() > player.ignorePlatformCollisionUntil) 
                ) { 
                    if (platform.type === 'trampoline') {
                        player.velocityY = platform.bounceStrength;
                        player.isJumping = true;
                        player.onGround = false; 
                        player.jumpHoldFrames = 0; 
                        player.ignorePlatformCollisionUntil = 0; 
                        player.animation.currentState = 'jump'; 
                        player.animation.currentFrameIndex = 0;
                        player.animation.frameTimer = 0;
                        platform.isBouncing = true; 
                        if(platform.animation) platform.animation.timer = 0;
                    } else {
                        player.y = platformTop - player.hitboxHeight - player.hitboxOffsetY;
                        player.velocityY = 0;
                        player.isJumping = false;
                        player.onGround = true;
                        player.jumpHoldFrames = 0;
                        player.ignorePlatformCollisionUntil = 0; 
                        if (platform.moving) player.x += platformDeltaX; 
                    }
                } 
                else if (player.velocityY < 0 && (playerTop - player.velocityY) >= platformBottom - 2.5) { 
                    player.y = platformBottom - player.hitboxOffsetY; player.velocityY = 0.1; 
                    player.ignorePlatformCollisionUntil = 0; 
                } 
                else if (!player.onGround || (platform.type === 'trampoline' && player.velocityY < platform.bounceStrength * 0.5) ) { 
                     if (player.velocityX > 0 && (playerRight - player.velocityX) <= platformLeft) { 
                        player.x = platformLeft - player.hitboxWidth - player.hitboxOffsetX; player.velocityX = 0;
                    } else if (player.velocityX < 0 && (playerLeft - player.velocityX) >= platformRight) { 
                        player.x = platformRight - player.hitboxOffsetX; player.velocityX = 0;
                    }
                }
            }
        });
    }
    if (player.y > canvasHeight + player.drawHeight) { 
        messageDisplay.textContent = "Lost in the dream wood...";
        loadLevel(currentLevelIndex); 
        setTimeout(() => { if(!window.gameOver && !victoryAchieved) messageDisplay.textContent = ""; }, 2000);
    }
    let collectedCount = 0;
    if (currentCollectibles) {
        currentCollectibles.forEach(item => {
            if (!item.collected) {
                if (player.x + player.hitboxOffsetX < item.x + item.width &&
                    player.x + player.hitboxOffsetX + player.hitboxWidth > item.x &&
                    player.y + player.hitboxOffsetY < item.y + item.height &&
                    player.y + player.hitboxOffsetY + player.hitboxHeight > item.y) {
                    item.collected = true; 
                    if (!victoryAchieved) messageDisplay.textContent = `Star collected!`;
                    setTimeout(() => { if(!window.gameOver && !victoryAchieved) messageDisplay.textContent = ""; }, 1200);
                }
            }
            if (item.collected) collectedCount++;
        });
    }
    if (!victoryAchieved) scoreDisplay.textContent = `Stars: ${collectedCount} / ${totalCollectiblesInLevel}`;
    if (currentExit && currentExit.x !== undefined && collectedCount === totalCollectiblesInLevel) {
         if (player.x + player.hitboxOffsetX < currentExit.x + currentExit.width &&
            player.x + player.hitboxOffsetX + player.hitboxWidth > currentExit.x &&
            player.y + player.hitboxOffsetY < currentExit.y + currentExit.height &&
            player.y + player.hitboxOffsetY + player.hitboxHeight > currentExit.y) {
            currentLevelIndex++;
            loadLevel(currentLevelIndex);
            if (!window.gameOver && !victoryAchieved) {
                messageDisplay.textContent = `Ascending to Canopy ${currentLevelIndex + 1}...`;
                setTimeout(() => { if(!window.gameOver && !victoryAchieved) messageDisplay.textContent = ""; }, 2000);
            }
        }
    }
}

function updateCamera(level) {
    if (!level || level.width === undefined) { camera.x = 0; return; }
    const targetCameraX = player.x - canvasWidth / 2 + player.drawWidth / 2; 
    camera.x += (targetCameraX - camera.x) * 0.08; 
    if (camera.x < 0) camera.x = 0;
    if (level.width > canvasWidth) { 
        if (camera.x > level.width - canvasWidth) camera.x = level.width - canvasWidth;
    } else { camera.x = 0; }
}

function updateInteractiveObjects(level) {
    if (level && level.platforms) {
        level.platforms.forEach(platform => {
            if (platform.type === 'trampoline' && platform.isBouncing && platform.animation) {
                platform.animation.timer++;
                if (platform.animation.timer >= platform.animation.duration) {
                    platform.isBouncing = false;
                    platform.animation.timer = 0;
                }
            }
        });
    }
}

function initializeVictoryAnimationStars() {
    victoryStars = [];
    const orbitRadius = Math.min(canvasWidth, canvasHeight) / 2.8;
    const angularStep = (Math.PI * 2) / VICTORY_STAR_COUNT;
    for (let i = 0; i < VICTORY_STAR_COUNT; i++) {
        victoryStars.push({
            baseHue: (i * (360 / VICTORY_STAR_COUNT)) % 360,
            size: STAR_SIZE * 1.2,
            angle: angularStep * i + Math.PI /2 ,
            orbitRadius: orbitRadius + (Math.random() - 0.5) * (orbitRadius * 0.2),
            currentOrbitRadius: orbitRadius + (Math.random() - 0.5) * (orbitRadius * 0.2),
            x: canvasWidth / 2,
            y: canvasHeight / 2,
            alpha: 1,
            phase: 'orbiting',
            orbitSpeed: 0.01 + Math.random() * 0.01,
            ascendSpeed: 1 + Math.random() * 1,
            delay: i * 100
        });
    }
}

function updateAndDrawVictoryAnimation(currentTime) {
    const animationElapsedTime = currentTime - victoryAnimationStartTime;
    let allFaded = true;
    victoryStars.forEach(star => {
        if (star.alpha <= 0) { return; }
        allFaded = false;
        if (animationElapsedTime < star.delay) { return; }
        const starElapsedTime = animationElapsedTime - star.delay;
        if (star.phase === 'orbiting') {
            star.angle += star.orbitSpeed;
            star.x = canvasWidth / 2 + Math.cos(star.angle) * star.currentOrbitRadius;
            star.y = canvasHeight / 2 + Math.sin(star.angle) * star.currentOrbitRadius;
            if (starElapsedTime > VICTORY_ANIM_ORBIT_DURATION) {
                star.phase = 'ascending';
            }
        } else if (star.phase === 'ascending') {
            star.y -= star.ascendSpeed;
            star.currentOrbitRadius += 0.3;
             star.x = canvasWidth / 2 + Math.cos(star.angle) * star.currentOrbitRadius;
            const ascendProgress = (starElapsedTime - VICTORY_ANIM_ORBIT_DURATION) / VICTORY_ANIM_ASCEND_DURATION;
            star.alpha = Math.max(0, 1 - ascendProgress);
            if (star.alpha <= 0 || star.y < -star.size) {
                star.alpha = 0;
            }
        }
        if (star.alpha > 0) {
            ctx.globalAlpha = star.alpha;
            const itemHue = (star.baseHue + hueShift) % 360;
            const itemShimmer = 70 + Math.sin(Date.now() * 0.008 + star.y * 0.1 + star.baseHue) * 15;
            const starColor = `hsl(${itemHue}, 90%, ${itemShimmer}%)`;
            drawStarShape(star.x - star.size / 2, star.y - star.size / 2, star.size, starColor);
            const sparkleHue = (itemHue + 40) % 360;
            const sparkleColor = `hsla(${sparkleHue}, 100%, ${80 + Math.sin(Date.now() * 0.015 + star.x * 0.2 + star.baseHue) * 15}%, 0.8)`;
            ctx.fillStyle = sparkleColor;
            const sparkleSize = star.size * 0.3;
            ctx.fillRect(star.x - sparkleSize / 2, star.y - sparkleSize / 2, sparkleSize, sparkleSize);
            ctx.globalAlpha = 1.0;
        }
    });
    if (allFaded) {
        victoryAnimationActive = false;
    }
}

function loadLevel(levelIndex) {
    if (levelIndex >= levels.length) {
        victoryAchieved = true;
        window.gameOver = true;
        messageDisplay.textContent = "";
        if (gameTitleElement) gameTitleElement.style.display = 'none';
        if (uiContainerElement) uiContainerElement.style.display = 'none';
        initializeVictoryAnimationStars();
        victoryAnimationActive = true;
        victoryAnimationStartTime = performance.now();
        return;
    }
    window.gameOver = false;
    victoryAchieved = false;
    victoryAnimationActive = false;
    if (gameTitleElement) gameTitleElement.style.display = 'block';
    if (uiContainerElement) uiContainerElement.style.display = 'block';
    const level = levels[levelIndex];
    if (!level || !level.playerStart) {
        messageDisplay.textContent = "Error loading level data!"; window.gameOver = true; return;
    }
    player.x = level.playerStart.x;
    player.y = level.playerStart.y;
    player.velocityX = 0; player.velocityY = 0;
    player.onGround = false; player.isJumping = true;
    player.animation.currentState = 'idle'; player.animation.currentFrameIndex = 0;
    player.ignorePlatformCollisionUntil = 0;
    currentCollectibles = level.collectibles ? JSON.parse(JSON.stringify(level.collectibles)) : [];
    currentCollectibles.forEach(item => { item.baseHue = Math.random() * 360; });
    totalCollectiblesInLevel = currentCollectibles.length;
    currentExit = level.exit ? JSON.parse(JSON.stringify(level.exit)) : {}; // Load new exit dimensions
    if (level.platforms) {
        level.platforms.forEach(p => {
            if(p.moving) {
                p.initialX = p.x_original !== undefined ? p.x_original : p.x;
                if(p.x_original === undefined) p.x_original = p.x;
                p.prevMovement = 0; p.x = p.initialX; p.prevActualX = p.initialX;
            }
            if (p.type === 'trampoline') {
                p.isBouncing = false;
                const defaultAnim = TRAMPOLINE_DEFAULT_PROPS.animation;
                p.animation = {
                    squashedHeightFactor: (p.animation && typeof p.animation.squashedHeightFactor === 'number') ? p.animation.squashedHeightFactor : defaultAnim.squashedHeightFactor,
                    duration: (p.animation && typeof p.animation.duration === 'number') ? p.animation.duration : defaultAnim.duration,
                    timer: 0
                };
            }
        });
    }
    if(levelDisplay) levelDisplay.textContent = `Canopy: ${levelIndex + 1}`;
    scoreDisplay.textContent = `Stars: 0 / ${totalCollectiblesInLevel}`;
    camera.x = player.x - canvasWidth / 3;
    updateCamera(level);
}

// --- Main Game Loop ---
let lastTime = 0;
const targetFPS = 60;
const timeStep = 1000 / targetFPS;

function gameLoop(currentTime = 0) {
    if (window.gameOver) {
        if (victoryAchieved) {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            if (victoryImageLoaded) {
                ctx.drawImage(victoryImage, 0, 0, canvasWidth, canvasHeight);
            } else {
                ctx.fillStyle = "rgba(20, 20, 50, 1)";
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                ctx.font = "bold 24px Verdana";
                ctx.fillStyle = "#E07A5F";
                ctx.textAlign = "center";
                ctx.fillText("Victory!", canvasWidth / 2, canvasHeight / 2 - 20);
                ctx.font = "16px Verdana";
                ctx.fillStyle = "#F4F1DE";
                if (victoryImage.src.endsWith('victory.png') && !victoryImageLoaded && !victoryImage.error) {
                     ctx.fillText("Loading final scene...", canvasWidth / 2, canvasHeight / 2 + 20);
                } else {
                     ctx.fillText("Final scene image could not be loaded.", canvasWidth / 2, canvasHeight / 2 + 20);
                }
            }
            if (victoryAnimationActive) {
                updateAndDrawVictoryAnimation(performance.now());
            } else if (!victoryImageLoaded) {
                 ctx.font = "16px Verdana"; ctx.fillStyle = "#F4F1DE";
                 ctx.fillText("Refresh to play again!", canvasWidth / 2, canvasHeight / 2 + 60);
            } else if (victoryImageLoaded && !victoryAnimationActive) {
                ctx.font = "bold 20px Verdana"; ctx.fillStyle = "#FFEB3B"; ctx.textAlign = "center";
                ctx.fillText("YOU WIN!", canvasWidth / 2, canvasHeight * 0.3);
                ctx.font = "16px Verdana"; ctx.fillStyle = "#F4F1DE";
                ctx.fillText("Refresh to play again!", canvasWidth / 2, canvasHeight * 0.7);
            }
        } else {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.font = "bold 30px Verdana"; ctx.fillStyle = "#FFEB3B"; ctx.textAlign = "center";
            const gameOverMsg = messageDisplay.textContent || "Game Over!";
            ctx.fillText(gameOverMsg, canvasWidth / 2, canvasHeight / 2);
            if (!messageDisplay.textContent.toLowerCase().includes("lost in the dream wood")) {
                 ctx.font = "16px Verdana"; ctx.fillText("Refresh to play again!", canvasWidth / 2, canvasHeight / 2 + 40);
            }
        }
        requestAnimationFrame(gameLoop);
        return;
    }
    requestAnimationFrame(gameLoop);
    const deltaTime = currentTime - lastTime;
    const dtForLogic = Math.max(0, Math.min(deltaTime, timeStep * 5));
    if (dtForLogic >= timeStep || lastTime === 0) {
        lastTime = currentTime - (deltaTime % timeStep);
        const currentLevelData = levels[currentLevelIndex];
        if (!currentLevelData) {
            messageDisplay.textContent = "Error: Level data missing! Game halted."; window.gameOver = true; return;
        }
        if (staticBackgroundLoaded && playerSheetLoaded) {
            updatePlayerAnimation();
            updatePlayer(currentLevelData);
            updateInteractiveObjects(currentLevelData);
        }
        updateCamera(currentLevelData);
        hueShift = (hueShift + 0.8) % 360;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        drawStaticTreehouseBackground(currentLevelData.width);
        ctx.save();
        ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));
        if (currentLevelData.platforms) drawPlatforms(currentLevelData);
        if (currentCollectibles) drawCollectibles();
        if (currentExit) drawExit(); // Draw the new portal exit
        if (playerSheetLoaded) drawPlayer();
        ctx.restore();
    }
}

// --- Initialize ---
levels.forEach(level => {
    if (level.playerStart) {
        const initialPlayerScaledHitboxHeight = player.spriteSheetPartHeight * 3 * PIXEL_SIZE_RENDER_FACTOR * player.scale;
        level.playerStart.y = canvasHeight - 40 - initialPlayerScaledHitboxHeight;
    }
    if (level.collectibles) {
        level.collectibles.forEach(collectible => {
            collectible.width = STAR_SIZE;
            collectible.height = STAR_SIZE;
        });
    }
});

if (!player.animation.sequences.walk || !player.animation.sequences.walk.frames || player.animation.sequences.walk.frames.length === 0) {
    if (player.animation.sequences.idle && player.animation.sequences.idle.frames && player.animation.sequences.idle.frames.length > 0) {
        player.animation.sequences.walk = { frames: [...player.animation.sequences.idle.frames], duration: player.animation.sequences.idle.duration };
    } else { player.animation.sequences.walk = { frames: [{ x: 0, y: 0 }], duration: 10 }; }
}
if (!player.animation.sequences.jump || !player.animation.sequences.jump.frames || player.animation.sequences.jump.frames.length === 0) {
    if (player.animation.sequences.idle && player.animation.sequences.idle.frames && player.animation.sequences.idle.frames.length > 0) {
        player.animation.sequences.jump = { frames: [...player.animation.sequences.idle.frames], duration: player.animation.sequences.idle.duration };
    } else { player.animation.sequences.jump = { frames: [{ x: 0, y: 0 }], duration: 10 }; }
}

loadLevel(currentLevelIndex);
if (!victoryAchieved) {
    messageDisplay.textContent = "Welcome to the treehouse!";
    setTimeout(() => { if(!window.gameOver && !victoryAchieved) messageDisplay.textContent = ''; }, 2500);
}
requestAnimationFrame(gameLoop);
