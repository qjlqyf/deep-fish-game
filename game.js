const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const menu = document.querySelector("#menu");
const result = document.querySelector("#result");
const startButton = document.querySelector("#start");
const restartButton = document.querySelector("#restart");
const levelButtons = [...document.querySelectorAll(".level")];
const resultKicker = document.querySelector("#result-kicker");
const resultTitle = document.querySelector("#result-title");
const resultCopy = document.querySelector("#result-copy");
const achievementToast = document.querySelector("#achievement");
const achievementTitle = document.querySelector("#achievement-title");
const achievementCount = document.querySelector("#achievement-count");
const touchStickZone = document.querySelector("#touch-stick-zone");
const touchStick = document.querySelector("#touch-stick");
const touchKnob = document.querySelector("#touch-knob");
const touchLocate = document.querySelector("#touch-locate");

const VIEW = { width: 1280, height: 720 };
const WORLD = { width: 1280, height: 5200 };
const LIMITS = {
  bubbles: 260,
  particles: 180,
  fish: 56,
  edibleSchoolFish: 70,
};
const keys = new Set();
const touchMove = { active: false, id: null, mode: null, x: 0, y: 0 };
const achievementsTotal = 4;
const unlockedAchievements = new Set(JSON.parse(localStorage.getItem("deep-fish-achievements") || "[]"));
let chosenLevel = "easy";
let state = "menu";
let lastTime = performance.now();
let cameraY = 0;
let spawnTimer = 0;
let schoolTimer = 0;
let elapsed = 0;
let score = 0;
let eaten = 0;
let cameraShake = 0;
let finaleTime = 0;
let shotFired = false;
let ripplePulse = 0;
let achievementTimer = 0;
let selfPingTimer = 0;
let introHintTimer = 0;
let swarmWarningTimer = 0;
let pressureNoticeTimer = 0;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function requestLandscape() {
  if (screen.orientation?.lock) {
    screen.orientation.lock("landscape").catch(() => {});
  }
}

const difficulty = {
  easy: {
    label: "低",
    playerSpeed: 260,
    spawnEvery: 0.95,
    smallBias: 0.68,
    enemyMin: 18,
    enemyMax: 56,
    speedMin: 42,
    speedMax: 116,
    current: 10,
    goalRadius: 176,
    growth: 0.042,
  },
  normal: {
    label: "中",
    playerSpeed: 238,
    spawnEvery: 0.76,
    smallBias: 0.56,
    enemyMin: 18,
    enemyMax: 68,
    speedMin: 58,
    speedMax: 152,
    current: 18,
    goalRadius: 186,
    growth: 0.036,
  },
  hard: {
    label: "高",
    playerSpeed: 218,
    spawnEvery: 0.56,
    smallBias: 0.43,
    enemyMin: 18,
    enemyMax: 78,
    speedMin: 76,
    speedMax: 196,
    current: 28,
    goalRadius: 196,
    growth: 0.031,
  },
};

const palette = [
  ["#ffce6a", "#f27d55"],
  ["#77e0cc", "#1fa3a3"],
  ["#f681a6", "#b9487f"],
  ["#b9ed79", "#5fa356"],
  ["#a5bbff", "#5d6ee8"],
  ["#fff0a8", "#df9d45"],
  ["#ff9c7b", "#bc4e52"],
];

const biomes = [
  {
    id: "shallows",
    name: "浅水珊瑚层",
    range: [0, 900],
    requiredRadius: 24,
    colors: ["#0f5b73", "#123546", "#172330"],
    species: ["tropical", "clown", "angel", "puffer", "seahorse", "classic"],
  },
  {
    id: "reef",
    name: "珊瑚礁峡谷",
    range: [900, 1800],
    requiredRadius: 38,
    colors: ["#0c485e", "#123147", "#1b2534"],
    species: ["puffer", "lobster", "crab", "angel", "seahorse", "classic"],
  },
  {
    id: "twilight",
    name: "暮光层",
    range: [1800, 3000],
    requiredRadius: 55,
    colors: ["#12334b", "#172844", "#191d32"],
    species: ["jellyfish", "squid", "eel", "lantern", "puffer", "classic"],
  },
  {
    id: "deep",
    name: "深海火山带",
    range: [3000, 4200],
    requiredRadius: 76,
    colors: ["#141e36", "#17192e", "#130f24"],
    species: ["angler", "nautilus", "squid", "eel", "jellyfish"],
  },
  {
    id: "abyss",
    name: "深渊层",
    range: [4200, WORLD.height],
    requiredRadius: 96,
    colors: ["#0b1228", "#0b0d1d", "#070813"],
    species: ["angler", "giant", "nautilus", "jellyfish", "eel"],
  },
];

const speciesSet = [
  "classic",
  "tropical",
  "clown",
  "angel",
  "puffer",
  "lobster",
  "crab",
  "seahorse",
  "jellyfish",
  "squid",
  "eel",
  "lantern",
  "angler",
  "nautilus",
  "giant",
];
const speciesAccent = {
  classic: "#f8fbff",
  tropical: "#ffef76",
  clown: "#f8fbff",
  angel: "#34d1bc",
  puffer: "#3b2c1c",
  lobster: "#ffd1a2",
  crab: "#ffe1b2",
  seahorse: "#ffe2a1",
  jellyfish: "#d5b4ff",
  squid: "#b9e7ff",
  eel: "#6ff0c7",
  lantern: "#fff08d",
  angler: "#ffd76d",
  nautilus: "#f1dfc6",
  giant: "#ff9a83",
};

const player = {
  x: WORLD.width * 0.28,
  y: WORLD.height * 0.5,
  radius: 24,
  targetRadius: 24,
  dir: 1,
  vx: 0,
  vy: 0,
  invincible: 0,
  biteTimer: 0,
};

const fish = [];
const bubbles = [];
const particles = [];
const plants = [];
const dust = [];
const rocks = [];
const obstacles = [];

const diver = {
  x: WORLD.width + 220,
  y: 128,
  aimX: 0,
  aimY: 0,
};

function updateAchievementCount() {
  achievementCount.textContent = `成就 ${unlockedAchievements.size}/${achievementsTotal}`;
}

function showAchievement(id, title) {
  if (unlockedAchievements.has(id)) return;
  unlockedAchievements.add(id);
  localStorage.setItem("deep-fish-achievements", JSON.stringify([...unlockedAchievements]));
  updateAchievementCount();
  achievementTitle.textContent = title;
  achievementToast.classList.remove("hidden");
  achievementTimer = 3.2;
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function depthMeters(y = player.y) {
  return Math.max(0, Math.round(y * 0.28));
}

function getBiomeAt(y = player.y) {
  return biomes.find((biome) => y >= biome.range[0] && y < biome.range[1]) || biomes[biomes.length - 1];
}

function maxDiveY() {
  const growth = Math.max(0, player.radius - 24);
  return clamp(1280 + growth * 58, 1280, WORLD.height - player.radius - 40);
}

function nextLockedBiome() {
  const limit = maxDiveY();
  return biomes.find((biome) => biome.range[0] > limit);
}

function cameraLimitY() {
  const worldLimit = WORLD.height - VIEW.height;
  const pressureLimit = maxDiveY();
  if (pressureLimit >= WORLD.height - player.radius - 42) return worldLimit;
  return clamp(pressureLimit - VIEW.height + 96, 0, worldLimit);
}

function updateCamera(dt) {
  const target = clamp(player.y - VIEW.height * 0.52, 0, cameraLimitY());
  cameraY += (target - cameraY) * Math.min(1, dt * 4.4);
}

function isVisibleY(y, margin = 220) {
  return y > cameraY - margin && y < cameraY + VIEW.height + margin;
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function viewTransform() {
  const scale = Math.max(canvas.clientWidth / VIEW.width, canvas.clientHeight / VIEW.height);
  return {
    x: (canvas.clientWidth - VIEW.width * scale) / 2,
    y: (canvas.clientHeight - VIEW.height * scale) / 2,
    scale,
  };
}

function resetGame() {
  state = "playing";
  cameraY = 0;
  elapsed = 0;
  score = 0;
  eaten = 0;
  spawnTimer = 0;
  schoolTimer = 0;
  cameraShake = 0;
  finaleTime = 0;
  shotFired = false;
  ripplePulse = 0;
  selfPingTimer = 5.4;
  introHintTimer = 3.2;
  swarmWarningTimer = 0;
  fish.length = 0;
  bubbles.length = 0;
  particles.length = 0;
  player.x = WORLD.width * 0.28;
  player.y = 340;
  player.radius = 24;
  player.targetRadius = 24;
  player.dir = 1;
  player.vx = 0;
  player.vy = 0;
  player.invincible = 5;
  player.biteTimer = 0;
  diver.x = WORLD.width + 240;
  diver.y = 128;
  result.classList.add("hidden");
  menu.classList.add("hidden");

  for (let i = 0; i < 18; i += 1) spawnFish(true);
  for (let i = 0; i < 38; i += 1) addBubble(random(0, WORLD.width), random(40, VIEW.height + 120), random(0.3, 1.2));
}

function buildPlants() {
  plants.length = 0;
  for (let y = 600; y < WORLD.height - 120; y += 160) {
    const biome = getBiomeAt(y);
    const count = biome.id === "shallows" ? 11 : biome.id === "reef" ? 13 : biome.id === "twilight" ? 7 : 4;
    for (let i = 0; i < count; i += 1) {
      const coral = biome.id === "reef" || (biome.id === "shallows" && Math.random() > 0.55);
      plants.push({
        x: random(20, WORLD.width - 20),
        y: y + random(-58, 58),
        height: random(coral ? 30 : 46, coral ? 86 : 150),
        width: random(coral ? 10 : 7, coral ? 22 : 18),
        type: coral ? "coral" : biome.id === "deep" || biome.id === "abyss" ? "vent" : "kelp",
        color: coral
          ? ["#ef6f8e", "#f1b65f", "#8ccf7b", "#be7ee8"][Math.floor(Math.random() * 4)]
          : biome.id === "deep" || biome.id === "abyss"
            ? "#6dc7d4"
            : Math.random() > 0.5
              ? "#2ba070"
              : "#a47c54",
        phase: random(0, Math.PI * 2),
      });
    }
  }
}

function buildDust() {
  dust.length = 0;
  for (let i = 0; i < 460; i += 1) {
    const y = random(0, WORLD.height);
    const depth = y / WORLD.height;
    dust.push({
      x: random(0, WORLD.width),
      y,
      r: random(0.35, 1.9 + depth * 2.2),
      a: random(0.08, 0.32 + depth * 0.22),
      drift: random(4, 18),
      phase: random(0, Math.PI * 2),
      glow: y > 1800 && Math.random() > 0.64,
    });
  }
}

function buildRocks() {
  rocks.length = 0;
  for (let y = 620; y < WORLD.height - 80; y += 135) {
    const count = y > 2600 ? 7 : y > 1200 ? 6 : 4;
    for (let i = 0; i < count; i += 1) {
      rocks.push({
        x: random(18, WORLD.width - 18),
        y: y + random(-48, 48),
        rx: random(12, y > 3000 ? 46 : 32),
        ry: random(5, y > 3000 ? 18 : 12),
        color: y > 3000 ? "#31404b" : "#6b5d4c",
      });
    }
  }
}

function buildObstacles() {
  obstacles.length = 0;
  for (let y = 760; y < WORLD.height - 280; y += random(260, 410)) {
    const biome = getBiomeAt(y);
    const sideBias = Math.random() > 0.5 ? 1 : -1;
    obstacles.push({
      x: sideBias > 0 ? random(WORLD.width * 0.64, WORLD.width - 86) : random(86, WORLD.width * 0.36),
      y: y + random(-90, 90),
      rx: random(58, biome.id === "abyss" ? 150 : 112),
      ry: random(34, biome.id === "shallows" ? 64 : 96),
      type: biome.id === "deep" || biome.id === "abyss" ? "basalt" : biome.id === "reef" ? "reef" : "rock",
      phase: random(0, Math.PI * 2),
    });
  }
}

function addBubble(x, y, scale = 1) {
  if (bubbles.length >= LIMITS.bubbles) bubbles.splice(0, bubbles.length - LIMITS.bubbles + 1);
  bubbles.push({
    x,
    y,
    radius: random(3, 10) * scale,
    speed: random(16, 54) * scale,
    wobble: random(12, 34),
    phase: random(0, Math.PI * 2),
    alpha: random(0.28, 0.78),
  });
}

function addBurst(x, y, color, amount = 14) {
  const room = Math.max(0, LIMITS.particles - particles.length);
  amount = Math.min(amount, room);
  for (let i = 0; i < amount; i += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(40, 210);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: random(2, 5),
      life: random(0.35, 0.85),
      maxLife: random(0.35, 0.85),
      color,
    });
  }
}

function pickSpecies(y = player.y) {
  const biome = getBiomeAt(y);
  const pool = biome.species;
  return pool[Math.floor(Math.random() * pool.length)];
}

function spawnFish(initial = false, options = {}) {
  const maxFish = options.edibleOnly ? LIMITS.edibleSchoolFish : LIMITS.fish;
  if (!initial && fish.length >= maxFish) return;

  const settings = difficulty[chosenLevel];
  const direction = options.direction || (Math.random() > 0.5 ? 1 : -1);
  const sideX = direction === 1 ? -90 : WORLD.width + 90;
  const visibleTop = clamp(cameraY + 72, 40, WORLD.height - VIEW.height);
  const visibleBottom = clamp(cameraY + VIEW.height - 92, 150, WORLD.height - 80);
  const targetY = options.y ?? (initial ? random(90, VIEW.height - 120) : random(visibleTop, visibleBottom));
  const species = options.species || pickSpecies(targetY);
  let x = options.x ?? (initial ? random(0, WORLD.width) : sideX);
  const playerRatio = random(0.46, 1.52);
  const mostlySmall = Math.random() < settings.smallBias;
  let rawRadius = mostlySmall
    ? random(settings.enemyMin * 0.84, Math.max(settings.enemyMin + 4, player.radius * 0.88))
    : player.radius * playerRatio + random(0, 18);
  if (options.edibleOnly) {
    rawRadius = random(settings.enemyMin * 0.76, Math.max(settings.enemyMin, player.radius * 0.82));
  }
  const deepBoost = targetY > 2800 ? random(0, 20) : targetY > 1600 ? random(0, 10) : 0;
  const radius = options.radius ?? clamp(rawRadius + deepBoost, settings.enemyMin * 0.72, settings.enemyMax + player.radius * 0.18 + deepBoost);
  const bottomDweller = species === "lobster" || species === "crab" || species === "nautilus";
  let y = targetY;
  if (bottomDweller && !options.y) y = clamp(visibleBottom - random(8, 92), 90, WORLD.height - 70);
  if (initial && Math.hypot(x - player.x, y - player.y) < 270) {
    x = player.x + (x < player.x ? -1 : 1) * random(290, 520);
    y = bottomDweller ? y : clamp(player.y + random(-240, 240), 78, VIEW.height - 112);
    x = clamp(x, 40, WORLD.width - 40);
  }
  const colors = palette[Math.floor(Math.random() * palette.length)];
  const speedMod =
    bottomDweller ? 0.54 : species === "puffer" ? 0.72 : species === "jellyfish" ? 0.42 : species === "eel" ? 1.18 : species === "angel" ? 0.88 : 1;
  const speed = (options.speed ?? random(settings.speedMin, settings.speedMax) * speedMod) * direction;

  fish.push({
    x,
    y,
    radius,
    vx: speed,
    vy: random(-12, 12),
    dir: direction,
    colors,
    accent: speciesAccent[species],
    phase: random(0, Math.PI * 2),
    species,
    tail: random(0.8, 1.25),
    turn: random(0.3, 0.9),
    value: Math.round(radius * (bottomDweller ? 5 : 4)),
  });
}

function spawnEdibleSchool() {
  const settings = difficulty[chosenLevel];
  const direction = Math.random() > 0.5 ? 1 : -1;
  const baseY = clamp(player.y + random(-180, 180), cameraY + 96, cameraY + VIEW.height - 126);
  const count = chosenLevel === "hard" ? 18 : chosenLevel === "normal" ? 15 : 13;
  const maxRadius = Math.max(settings.enemyMin * 0.85, player.radius * 0.82);
  const minRadius = Math.max(12, Math.min(settings.enemyMin, player.radius * 0.48));
  const schoolSpecies = getBiomeAt(baseY).species.filter((species) => !["angler", "giant"].includes(species));

  for (let i = 0; i < count; i += 1) {
    if (fish.length >= LIMITS.edibleSchoolFish) break;
    spawnFish(false, {
      direction,
      edibleOnly: true,
      species: schoolSpecies[Math.floor(Math.random() * schoolSpecies.length)] || "classic",
      x: direction === 1 ? -120 - i * random(22, 42) : WORLD.width + 120 + i * random(22, 42),
      y: clamp(baseY + Math.sin(i * 0.8) * 46 + random(-28, 28), 80, WORLD.height - 126),
      radius: random(minRadius, maxRadius),
      speed: random(settings.speedMin + 44, settings.speedMax + 80),
    });
  }

  swarmWarningTimer = 4.4;
}

function drawFishBody(item, isPlayer = false) {
  if (isPlayer) {
    drawPiranha(item);
    return;
  }

  if (item.species === "tropical") {
    drawTropicalFish(item);
  } else if (item.species === "clown") {
    drawClownFish(item);
  } else if (item.species === "angel") {
    drawAngelFish(item);
  } else if (item.species === "puffer") {
    drawPufferFish(item);
  } else if (item.species === "lobster") {
    drawLobster(item);
  } else if (item.species === "crab") {
    drawCrab(item);
  } else if (item.species === "seahorse") {
    drawSeahorse(item);
  } else if (item.species === "jellyfish") {
    drawJellyfish(item);
  } else if (item.species === "squid") {
    drawSquid(item);
  } else if (item.species === "eel") {
    drawEel(item);
  } else if (item.species === "lantern") {
    drawLanternFish(item);
  } else if (item.species === "angler") {
    drawAnglerFish(item);
  } else if (item.species === "nautilus") {
    drawNautilus(item);
  } else if (item.species === "giant") {
    drawGiantFish(item);
  } else {
    drawClassicFish(item);
  }
}

function drawClassicFish(item, isPlayer = false) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;
  const tailWave = Math.sin(elapsed * (isPlayer ? 9 : 6) + item.phase) * r * 0.1;
  const bodyGradient = ctx.createLinearGradient(item.x - r * dir, item.y - r, item.x + r * dir, item.y + r);
  const colors = isPlayer ? ["#f7df72", "#ef685b"] : item.colors;
  bodyGradient.addColorStop(0, colors[0]);
  bodyGradient.addColorStop(1, colors[1]);

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);

  ctx.beginPath();
  ctx.moveTo(-r * 0.9, tailWave);
  ctx.lineTo(-r * 1.52, -r * 0.62);
  ctx.quadraticCurveTo(-r * 1.22, 0, -r * 1.52, r * 0.62);
  ctx.closePath();
  ctx.fillStyle = isPlayer ? "#ffb85c" : colors[1];
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.12, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-r * 0.12, -r * 0.58);
  ctx.quadraticCurveTo(r * 0.1, -r * 1.08, r * 0.42, -r * 0.5);
  ctx.quadraticCurveTo(r * 0.18, -r * 0.38, -r * 0.12, -r * 0.58);
  ctx.fillStyle = isPlayer ? "#ffd56d" : colors[0];
  ctx.fill();

  ctx.beginPath();
  ctx.arc(r * 0.48, -r * 0.14, Math.max(2.6, r * 0.105), 0, Math.PI * 2);
  ctx.fillStyle = "#fbffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.52, -r * 0.13, Math.max(1.2, r * 0.052), 0, Math.PI * 2);
  ctx.fillStyle = "#08131b";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(r * 0.58, r * 0.16);
  ctx.quadraticCurveTo(r * 0.78, r * 0.28, r * 0.96, r * 0.12);
  ctx.strokeStyle = "rgba(5, 18, 22, 0.38)";
  ctx.lineWidth = Math.max(1.3, r * 0.035);
  ctx.lineCap = "round";
  ctx.stroke();

  if (isPlayer) {
    ctx.beginPath();
    ctx.ellipse(-r * 0.02, r * 0.06, r * 0.62, r * 0.34, 0, 0, Math.PI);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPiranha(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;
  const bite = clamp(item.biteTimer / 0.28, 0, 1);
  const mouthOpen = r * (0.16 + bite * 0.52);
  const tailWave = Math.sin(elapsed * 10 + item.phase) * r * 0.11;
  const bodyGradient = ctx.createLinearGradient(-r, -r, r, r);
  bodyGradient.addColorStop(0, "#ffe06a");
  bodyGradient.addColorStop(0.46, "#f46a4f");
  bodyGradient.addColorStop(1, "#a51f31");

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);

  ctx.fillStyle = "#b72837";
  ctx.beginPath();
  ctx.moveTo(-r * 0.88, tailWave);
  ctx.lineTo(-r * 1.6, -r * 0.58);
  ctx.quadraticCurveTo(-r * 1.26, 0, -r * 1.6, r * 0.58);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.15, r * 0.76, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 232, 142, 0.72)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.12, r * 0.18, r * 0.72, r * 0.32, 0, 0, Math.PI);
  ctx.fill();

  ctx.fillStyle = "#d8233a";
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, -r * 0.58);
  ctx.quadraticCurveTo(r * 0.12, -r * 1.22, r * 0.46, -r * 0.44);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#12090b";
  ctx.beginPath();
  ctx.moveTo(r * 0.36, -r * 0.31);
  ctx.quadraticCurveTo(r * 1.18, -mouthOpen, r * 1.08, 0);
  ctx.quadraticCurveTo(r * 1.18, mouthOpen, r * 0.36, r * 0.31);
  ctx.quadraticCurveTo(r * 0.55, 0, r * 0.36, -r * 0.31);
  ctx.fill();

  ctx.fillStyle = "#fff6d8";
  for (let i = 0; i < 5; i += 1) {
    const x = r * (0.48 + i * 0.13);
    const top = -r * 0.27 - bite * r * 0.12 + i * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + r * 0.075, top + r * 0.19);
    ctx.lineTo(x + r * 0.15, top + r * 0.02);
    ctx.closePath();
    ctx.fill();

    const bottom = r * 0.27 + bite * r * 0.12 - i * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x + r * 0.075, bottom - r * 0.19);
    ctx.lineTo(x + r * 0.15, bottom - r * 0.02);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.46, -r * 0.2, Math.max(3, r * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#071018";
  ctx.beginPath();
  ctx.arc(r * 0.5, -r * 0.19, Math.max(1.4, r * 0.058), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(42, 5, 13, 0.45)";
  ctx.lineWidth = Math.max(1.4, r * 0.04);
  ctx.beginPath();
  ctx.moveTo(r * 0.14, -r * 0.3);
  ctx.quadraticCurveTo(-r * 0.03, 0, r * 0.16, r * 0.32);
  ctx.stroke();

  ctx.restore();
}

function drawTropicalFish(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;
  const tailWave = Math.sin(elapsed * 7 + item.phase) * r * 0.1;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);

  ctx.fillStyle = item.colors[1];
  ctx.beginPath();
  ctx.moveTo(-r * 0.88, tailWave);
  ctx.lineTo(-r * 1.52, -r * 0.58);
  ctx.lineTo(-r * 1.32, 0);
  ctx.lineTo(-r * 1.52, r * 0.58);
  ctx.closePath();
  ctx.fill();

  const gradient = ctx.createLinearGradient(-r, -r, r, r);
  gradient.addColorStop(0, item.colors[0]);
  gradient.addColorStop(1, item.colors[1]);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.08, r * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = item.accent;
  ctx.lineWidth = Math.max(3, r * 0.14);
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(r * (i * 0.26 - 0.05), -r * 0.56);
    ctx.quadraticCurveTo(r * (i * 0.18 + 0.08), 0, r * (i * 0.26 - 0.05), r * 0.56);
    ctx.stroke();
  }

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.52, -r * 0.12, Math.max(2.8, r * 0.1), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#08131b";
  ctx.beginPath();
  ctx.arc(r * 0.56, -r * 0.11, Math.max(1.3, r * 0.047), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawClownFish(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);

  ctx.fillStyle = "#f06b33";
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, 0);
  ctx.lineTo(-r * 1.48, -r * 0.52);
  ctx.lineTo(-r * 1.32, 0);
  ctx.lineTo(-r * 1.48, r * 0.52);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.1, r * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = Math.max(2, r * 0.08);
  for (const x of [-r * 0.46, r * 0.04, r * 0.52]) {
    ctx.strokeStyle = "#251c1a";
    ctx.lineWidth = Math.max(4, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(x, -r * 0.56);
    ctx.quadraticCurveTo(x + r * 0.08, 0, x, r * 0.56);
    ctx.stroke();
    ctx.strokeStyle = "#f8fbff";
    ctx.lineWidth = Math.max(3, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(x, -r * 0.54);
    ctx.quadraticCurveTo(x + r * 0.08, 0, x, r * 0.54);
    ctx.stroke();
  }

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.56, -r * 0.13, Math.max(2.7, r * 0.1), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#08131b";
  ctx.beginPath();
  ctx.arc(r * 0.6, -r * 0.12, Math.max(1.3, r * 0.047), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAngelFish(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);

  const gradient = ctx.createLinearGradient(-r, -r, r, r);
  gradient.addColorStop(0, item.colors[0]);
  gradient.addColorStop(1, item.colors[1]);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, 0);
  ctx.lineTo(-r * 0.14, -r * 1.12);
  ctx.quadraticCurveTo(r * 0.98, -r * 0.4, r * 0.92, 0);
  ctx.quadraticCurveTo(r * 0.98, r * 0.4, -r * 0.14, r * 1.12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = item.colors[1];
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, 0);
  ctx.lineTo(-r * 1.5, -r * 0.52);
  ctx.lineTo(-r * 1.3, 0);
  ctx.lineTo(-r * 1.5, r * 0.52);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.54)";
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, -r * 0.78);
  ctx.lineTo(r * 0.24, r * 0.7);
  ctx.stroke();

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.48, -r * 0.12, Math.max(2.7, r * 0.095), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#08131b";
  ctx.beginPath();
  ctx.arc(r * 0.52, -r * 0.11, Math.max(1.2, r * 0.045), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPufferFish(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);

  ctx.fillStyle = item.colors[1];
  ctx.beginPath();
  ctx.moveTo(-r * 0.74, 0);
  ctx.lineTo(-r * 1.32, -r * 0.44);
  ctx.lineTo(-r * 1.16, 0);
  ctx.lineTo(-r * 1.32, r * 0.44);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = item.colors[0];
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16;
    const radius = i % 2 === 0 ? r * 0.92 : r * 0.76;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(65, 43, 22, 0.28)";
  for (let i = 0; i < 8; i += 1) {
    const angle = i * 0.8 + item.phase;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r * 0.42, Math.sin(angle) * r * 0.36, Math.max(1.8, r * 0.055), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 0.16, Math.max(2.8, r * 0.105), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#08131b";
  ctx.beginPath();
  ctx.arc(r * 0.46, -r * 0.15, Math.max(1.3, r * 0.05), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawLobster(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;
  const clawWave = Math.sin(elapsed * 5 + item.phase) * r * 0.05;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "#8d2430";
  ctx.lineWidth = Math.max(3, r * 0.12);
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.24 + i * r * 0.18, r * 0.24);
    ctx.lineTo(-r * 0.34 + i * r * 0.2, r * 0.66);
    ctx.moveTo(-r * 0.24 + i * r * 0.18, -r * 0.24);
    ctx.lineTo(-r * 0.34 + i * r * 0.2, -r * 0.66);
    ctx.stroke();
  }

  ctx.fillStyle = "#d54f3f";
  ctx.beginPath();
  ctx.ellipse(-r * 0.18, 0, r * 0.86, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f07148";
  ctx.beginPath();
  ctx.ellipse(r * 0.54, 0, r * 0.46, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(92, 20, 24, 0.52)";
  ctx.lineWidth = Math.max(1.2, r * 0.04);
  for (let i = -3; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.18, -r * 0.34);
    ctx.lineTo(i * r * 0.18, r * 0.34);
    ctx.stroke();
  }

  ctx.strokeStyle = "#9f2e34";
  ctx.lineWidth = Math.max(4, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(r * 0.66, -r * 0.12);
  ctx.lineTo(r * 1.12, -r * 0.48 + clawWave);
  ctx.moveTo(r * 0.66, r * 0.12);
  ctx.lineTo(r * 1.12, r * 0.48 - clawWave);
  ctx.stroke();

  ctx.fillStyle = "#e85c43";
  ctx.beginPath();
  ctx.ellipse(r * 1.24, -r * 0.54 + clawWave, r * 0.28, r * 0.2, -0.45, 0, Math.PI * 2);
  ctx.ellipse(r * 1.24, r * 0.54 - clawWave, r * 0.28, r * 0.2, 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.78, -r * 0.16, Math.max(2, r * 0.07), 0, Math.PI * 2);
  ctx.arc(r * 0.78, r * 0.16, Math.max(2, r * 0.07), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#071018";
  ctx.beginPath();
  ctx.arc(r * 0.8, -r * 0.16, Math.max(1, r * 0.035), 0, Math.PI * 2);
  ctx.arc(r * 0.8, r * 0.16, Math.max(1, r * 0.035), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCrab(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;
  const wave = Math.sin(elapsed * 6 + item.phase) * r * 0.05;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);
  ctx.lineCap = "round";

  ctx.strokeStyle = "#a6423a";
  ctx.lineWidth = Math.max(3, r * 0.11);
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.19, r * 0.24);
    ctx.lineTo((i - 0.2) * r * 0.26, r * 0.62 + Math.abs(i) * 2);
    ctx.moveTo(i * r * 0.19, -r * 0.24);
    ctx.lineTo((i - 0.2) * r * 0.26, -r * 0.62 - Math.abs(i) * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#d95b43";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.9, r * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#9d302f";
  ctx.lineWidth = Math.max(4, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(r * 0.56, -r * 0.2);
  ctx.lineTo(r * 1.06, -r * 0.56 + wave);
  ctx.moveTo(r * 0.56, r * 0.2);
  ctx.lineTo(r * 1.06, r * 0.56 - wave);
  ctx.stroke();

  ctx.fillStyle = "#ee744d";
  ctx.beginPath();
  ctx.ellipse(r * 1.18, -r * 0.62 + wave, r * 0.26, r * 0.2, -0.55, 0, Math.PI * 2);
  ctx.ellipse(r * 1.18, r * 0.62 - wave, r * 0.26, r * 0.2, 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#812927";
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.beginPath();
  ctx.moveTo(r * 0.18, -r * 0.34);
  ctx.lineTo(r * 0.28, -r * 0.58);
  ctx.moveTo(r * 0.18, r * 0.34);
  ctx.lineTo(r * 0.28, r * 0.58);
  ctx.stroke();

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.3, -r * 0.62, Math.max(2, r * 0.07), 0, Math.PI * 2);
  ctx.arc(r * 0.3, r * 0.62, Math.max(2, r * 0.07), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#071018";
  ctx.beginPath();
  ctx.arc(r * 0.32, -r * 0.62, Math.max(1, r * 0.035), 0, Math.PI * 2);
  ctx.arc(r * 0.32, r * 0.62, Math.max(1, r * 0.035), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSeahorse(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;
  const curl = Math.sin(elapsed * 3 + item.phase) * r * 0.08;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);
  ctx.fillStyle = item.colors[0];
  ctx.strokeStyle = item.colors[1];
  ctx.lineWidth = Math.max(4, r * 0.16);
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.ellipse(0, r * 0.16, r * 0.42, r * 0.82, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.2, -r * 0.58, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.46, -r * 0.58);
  ctx.lineTo(r * 0.9, -r * 0.48);
  ctx.lineTo(r * 0.48, -r * 0.36);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-r * 0.1, r * 0.76);
  ctx.quadraticCurveTo(-r * 0.54 + curl, r * 1.1, -r * 0.12, r * 1.22);
  ctx.quadraticCurveTo(r * 0.32, r * 1.28, r * 0.1, r * 0.98);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, -r * 0.18 + i * r * 0.2);
    ctx.lineTo(r * 0.18, -r * 0.1 + i * r * 0.2);
    ctx.stroke();
  }

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.3, -r * 0.68, Math.max(2, r * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#071018";
  ctx.beginPath();
  ctx.arc(r * 0.33, -r * 0.68, Math.max(1, r * 0.035), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawJellyfish(item) {
  const r = item.radius;
  const glow = item.y > 1800 ? 0.34 : 0.16;
  const pulse = 1 + Math.sin(elapsed * 3 + item.phase) * 0.08;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = item.y > 1800 ? "rgba(187, 154, 255, 0.72)" : "rgba(255, 180, 220, 0.72)";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.1, r * 0.82 * pulse, r * 0.56, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(r * 0.74, r * 0.2);
  ctx.quadraticCurveTo(0, r * 0.46, -r * 0.74, r * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = glow;
  ctx.fillStyle = "#d7d0ff";
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.74;
  ctx.strokeStyle = item.y > 1800 ? "#dcd0ff" : "#ffe6f5";
  ctx.lineWidth = Math.max(1.4, r * 0.045);
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.18, r * 0.18);
    ctx.quadraticCurveTo(i * r * 0.28 + Math.sin(elapsed * 3 + i) * r * 0.12, r * 0.86, i * r * 0.1, r * 1.36);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSquid(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;
  const wiggle = Math.sin(elapsed * 6 + item.phase) * r * 0.1;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);
  ctx.fillStyle = item.colors[1];
  ctx.beginPath();
  ctx.moveTo(r * 0.82, 0);
  ctx.quadraticCurveTo(r * 0.2, -r * 0.72, -r * 0.68, -r * 0.42);
  ctx.quadraticCurveTo(-r * 1.05, 0, -r * 0.68, r * 0.42);
  ctx.quadraticCurveTo(r * 0.2, r * 0.72, r * 0.82, 0);
  ctx.fill();

  ctx.fillStyle = item.colors[0];
  ctx.beginPath();
  ctx.moveTo(-r * 0.56, -r * 0.38);
  ctx.lineTo(-r * 1.08, -r * 0.82);
  ctx.lineTo(-r * 0.86, -r * 0.1);
  ctx.closePath();
  ctx.moveTo(-r * 0.56, r * 0.38);
  ctx.lineTo(-r * 1.08, r * 0.82);
  ctx.lineTo(-r * 0.86, r * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = item.colors[0];
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.lineCap = "round";
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(r * 0.58, i * r * 0.08);
    ctx.quadraticCurveTo(r * 1.06, i * r * 0.18 + wiggle, r * 1.24, i * r * 0.25);
    ctx.stroke();
  }

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.28, -r * 0.17, Math.max(2, r * 0.08), 0, Math.PI * 2);
  ctx.arc(r * 0.28, r * 0.17, Math.max(2, r * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#071018";
  ctx.beginPath();
  ctx.arc(r * 0.3, -r * 0.17, Math.max(1, r * 0.034), 0, Math.PI * 2);
  ctx.arc(r * 0.3, r * 0.17, Math.max(1, r * 0.034), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEel(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);
  ctx.strokeStyle = item.colors[1];
  ctx.lineWidth = Math.max(12, r * 0.44);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 1.45, Math.sin(elapsed * 5 + item.phase) * r * 0.22);
  ctx.bezierCurveTo(-r * 0.72, -r * 0.58, r * 0.2, r * 0.52, r * 1.12, 0);
  ctx.stroke();
  ctx.strokeStyle = item.colors[0];
  ctx.lineWidth = Math.max(4, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(-r * 1.25, -r * 0.03);
  ctx.bezierCurveTo(-r * 0.58, -r * 0.38, r * 0.22, r * 0.34, r * 0.92, -r * 0.04);
  ctx.stroke();

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.84, -r * 0.14, Math.max(2, r * 0.07), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#071018";
  ctx.beginPath();
  ctx.arc(r * 0.87, -r * 0.14, Math.max(1, r * 0.032), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLanternFish(item) {
  drawClassicFish(item);
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#ffe86f";
  ctx.beginPath();
  ctx.arc(item.x + item.dir * item.radius * 0.95, item.y + item.radius * 0.28, item.radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.arc(item.x + item.dir * item.radius * 0.95, item.y + item.radius * 0.28, item.radius * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAnglerFish(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  drawGiantFish({ ...item, radius: item.radius * 0.92 });
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);
  ctx.strokeStyle = "#384855";
  ctx.lineWidth = Math.max(2, item.radius * 0.055);
  ctx.beginPath();
  ctx.moveTo(item.radius * 0.42, -item.radius * 0.38);
  ctx.quadraticCurveTo(item.radius * 0.76, -item.radius * 1.06, item.radius * 1.16, -item.radius * 0.72);
  ctx.stroke();
  ctx.fillStyle = "#ffe86f";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(item.radius * 1.2, -item.radius * 0.72, item.radius * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.26;
  ctx.beginPath();
  ctx.arc(item.radius * 1.2, -item.radius * 0.72, item.radius * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNautilus(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);
  ctx.fillStyle = "#f1dfc6";
  ctx.beginPath();
  ctx.arc(-r * 0.08, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#b8895f";
  ctx.lineWidth = Math.max(2, r * 0.055);
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(-r * 0.08, 0, r * (0.18 + i * 0.1), 0.2 + i * 0.25, Math.PI * 1.65);
    ctx.stroke();
  }
  ctx.fillStyle = item.colors[1];
  ctx.beginPath();
  ctx.ellipse(r * 0.54, 0, r * 0.52, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = item.colors[0];
  ctx.lineWidth = Math.max(1.8, r * 0.055);
  ctx.lineCap = "round";
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(r * 0.88, i * r * 0.05);
    ctx.lineTo(r * 1.18, i * r * 0.12);
    ctx.stroke();
  }
  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.68, -r * 0.1, Math.max(2, r * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#071018";
  ctx.beginPath();
  ctx.arc(r * 0.71, -r * 0.1, Math.max(1, r * 0.034), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGiantFish(item) {
  const dir = item.dir >= 0 ? 1 : -1;
  const r = item.radius;
  const colors = item.y > 3000 ? ["#2e4967", "#111827"] : item.colors;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(dir, 1);
  const gradient = ctx.createLinearGradient(-r, -r, r, r);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.35, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.moveTo(-r * 1.02, 0);
  ctx.lineTo(-r * 1.78, -r * 0.72);
  ctx.lineTo(-r * 1.46, 0);
  ctx.lineTo(-r * 1.78, r * 0.72);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, r * 0.18, r * 0.8, r * 0.32, 0, 0, Math.PI);
  ctx.fill();

  ctx.fillStyle = "#fbffff";
  ctx.beginPath();
  ctx.arc(r * 0.58, -r * 0.16, Math.max(2.8, r * 0.1), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#071018";
  ctx.beginPath();
  ctx.arc(r * 0.62, -r * 0.15, Math.max(1.4, r * 0.05), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayerMarker() {
  const pulseStrength = clamp(selfPingTimer / 1.8, 0, 1);

  if (pulseStrength > 0) {
    ctx.save();
    for (let i = 0; i < 3; i += 1) {
      const progress = (elapsed * 1.7 + i / 3) % 1;
      ctx.globalAlpha = (1 - progress) * pulseStrength * 0.75;
      ctx.strokeStyle = "#66c0f4";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 20 + progress * 88, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = pulseStrength * 0.42;
    ctx.strokeStyle = "#f8fbff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, Math.max(68, player.y - player.radius - 130));
    ctx.lineTo(player.x, player.y - player.radius - 18);
    ctx.stroke();
    ctx.restore();
  }

  const labelY = Math.max(82, player.y - player.radius - 36);
  ctx.save();
  ctx.fillStyle = "rgba(5, 14, 22, 0.82)";
  ctx.beginPath();
  ctx.roundRect(player.x - 26, labelY - 16, 52, 24, 4);
  ctx.fill();
  ctx.strokeStyle = "#66c0f4";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#f8fbff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 15px system-ui, sans-serif";
  ctx.fillText("1P", player.x, labelY - 4);

  ctx.fillStyle = "#66c0f4";
  ctx.beginPath();
  ctx.moveTo(player.x - 8, labelY + 8);
  ctx.lineTo(player.x + 8, labelY + 8);
  ctx.lineTo(player.x, labelY + 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDiver() {
  const t = finaleTime;
  const bob = Math.sin(elapsed * 3.4) * 5;
  const x = diver.x;
  const y = diver.y + bob;
  const angle = Math.atan2(player.y - y, player.x - x);

  ctx.save();
  ctx.translate(x, y);

  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = "#222a31";
  ctx.fillRect(-12, -5, -106, 10);
  ctx.fillStyle = "#d2b173";
  ctx.fillRect(-116, -8, -32, 16);
  ctx.fillStyle = "#f2ecdc";
  ctx.fillRect(-122, -11, 8, 22);
  ctx.restore();

  ctx.fillStyle = "#171f28";
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 42, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffcc8a";
  ctx.beginPath();
  ctx.arc(-2, -48, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#74d8e9";
  ctx.beginPath();
  ctx.roundRect(-23, -59, 42, 19, 8);
  ctx.fill();

  ctx.fillStyle = "#0d1820";
  ctx.fillRect(-34, -62, 13, 7);
  ctx.fillRect(18, -62, 20, 7);

  ctx.strokeStyle = "#10171e";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-14, 38);
  ctx.lineTo(-38, 83);
  ctx.moveTo(15, 37);
  ctx.lineTo(45, 76);
  ctx.stroke();

  ctx.fillStyle = "#e9a742";
  ctx.beginPath();
  ctx.ellipse(-46, 88, 26, 8, -0.2, 0, Math.PI * 2);
  ctx.ellipse(54, 80, 28, 8, 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#263945";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(20, -12);
  ctx.lineTo(66, -28);
  ctx.stroke();

  if (t > 2.05 && t < 2.35) {
    const flash = 1 - Math.abs(t - 2.2) / 0.15;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(-150, 0);
    ctx.fillStyle = `rgba(255, 232, 118, ${flash})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-52, -22);
    ctx.lineTo(-34, 0);
    ctx.lineTo(-52, 22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawBackground() {
  const biome = getBiomeAt(cameraY + VIEW.height * 0.5);
  const depth = clamp((cameraY + VIEW.height * 0.5) / WORLD.height, 0, 1);
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, depth < 0.22 ? "#1d7384" : biome.colors[0]);
  gradient.addColorStop(0.38, biome.colors[0]);
  gradient.addColorStop(0.72, biome.colors[1]);
  gradient.addColorStop(1, biome.colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  drawWaterSurface(depth);
  drawDistantReefs(depth, biome);
  drawLightShafts(depth);
  drawCaustics(depth);
  drawWaterFog(depth, biome);

  ctx.save();
  ctx.translate(0, -cameraY);
  drawEnvironment();
  ctx.restore();

  ctx.save();
  for (const mote of dust) {
    if (!isVisibleY(mote.y, 80)) continue;
    const x = (mote.x + Math.sin(elapsed * 0.7 + mote.phase) * mote.drift) % WORLD.width;
    ctx.globalAlpha = mote.glow ? mote.a * 1.2 : mote.a;
    ctx.fillStyle = mote.glow ? "#8ff9ff" : "#d7fff2";
    ctx.beginPath();
    ctx.arc(x, mote.y - cameraY, mote.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (pressureNoticeTimer > 0) {
    const limitScreenY = maxDiveY() - cameraY;
    if (limitScreenY > -40 && limitScreenY < VIEW.height + 60) {
      ctx.save();
      ctx.globalAlpha = clamp(pressureNoticeTimer / 0.9, 0, 1) * 0.74;
      ctx.strokeStyle = "#ffcd6d";
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(0, limitScreenY);
      ctx.lineTo(VIEW.width, limitScreenY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(12, 18, 26, 0.78)";
      ctx.beginPath();
      ctx.roundRect(VIEW.width / 2 - 178, Math.max(76, limitScreenY - 54), 356, 38, 3);
      ctx.fill();
      ctx.fillStyle = "#ffcd6d";
      ctx.font = "900 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("水压过高，需要继续长大才能下潜", VIEW.width / 2, Math.max(101, limitScreenY - 30));
      ctx.restore();
    }
  }

  drawDepthVignette(depth);
}

function drawWaterSurface(depth) {
  if (cameraY > 720) return;

  const surfaceY = -cameraY;
  const alpha = clamp(1 - cameraY / 720, 0, 1);

  ctx.save();
  ctx.globalAlpha = alpha;
  const surface = ctx.createLinearGradient(0, Math.max(0, surfaceY), 0, Math.max(120, surfaceY + 180));
  surface.addColorStop(0, "rgba(183, 244, 255, 0.52)");
  surface.addColorStop(0.32, "rgba(79, 193, 205, 0.2)");
  surface.addColorStop(1, "rgba(17, 67, 83, 0)");
  ctx.fillStyle = surface;
  ctx.fillRect(0, Math.max(0, surfaceY), VIEW.width, 190);

  ctx.strokeStyle = "rgba(223, 255, 255, 0.58)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const y = surfaceY + 16 + i * 14;
    if (y < -20 || y > 160) continue;
    ctx.beginPath();
    for (let x = -40; x <= VIEW.width + 40; x += 36) {
      const wave = Math.sin(x * 0.018 + elapsed * 1.7 + i) * 4;
      if (x === -40) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawLightShafts(depth) {
  const strength = clamp(0.56 - depth * 1.45, 0, 0.56);
  if (strength <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 7; i += 1) {
    const x = ((i * 215 + Math.sin(elapsed * 0.22 + i) * 46 - cameraY * 0.035) % (VIEW.width + 260)) - 130;
    const width = 86 + i * 15;
    const alpha = strength * (0.22 + (i % 3) * 0.08);
    const shaft = ctx.createLinearGradient(x, 0, x + width * 0.55, VIEW.height);
    shaft.addColorStop(0, `rgba(198, 255, 244, ${alpha})`);
    shaft.addColorStop(0.45, `rgba(143, 231, 229, ${alpha * 0.28})`);
    shaft.addColorStop(1, "rgba(33, 128, 154, 0)");
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + width, 0);
    ctx.lineTo(x + width * 1.9, VIEW.height);
    ctx.lineTo(x - width * 0.7, VIEW.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCaustics(depth) {
  const alpha = clamp(0.16 - depth * 0.62, 0, 0.16);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = `rgba(207, 255, 244, ${alpha})`;
  ctx.lineWidth = 1.15;
  for (let row = 0; row < 8; row += 1) {
    const y = 86 + row * 62 + Math.sin(elapsed * 0.8 + row) * 8;
    for (let segment = 0; segment < 7; segment += 1) {
      const start = segment * 210 + ((row * 47 + elapsed * 18) % 88) - 70;
      ctx.beginPath();
      for (let step = 0; step <= 7; step += 1) {
        const x = start + step * 24;
        const wave = Math.sin(x * 0.025 + elapsed * 1.4 + row * 0.9) * 7;
        const curveY = y + wave + Math.sin(x * 0.006 + row) * 5;
        if (step === 0) ctx.moveTo(x, curveY);
        else ctx.lineTo(x, curveY);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawDistantReefs(depth, biome) {
  ctx.save();
  const reefAlpha = biome.id === "shallows" || biome.id === "reef" ? 0.28 : 0.16;
  const offset = -((cameraY * 0.12) % 380);

  for (let layer = 0; layer < 3; layer += 1) {
    ctx.globalAlpha = reefAlpha - layer * 0.055;
    ctx.fillStyle = layer === 0 ? "#194c55" : layer === 1 ? "#123843" : "#0d2837";
    ctx.beginPath();
    const base = 500 + layer * 72 + offset * (0.18 + layer * 0.08);
    ctx.moveTo(-60, VIEW.height + 80);
    for (let x = -60; x <= VIEW.width + 80; x += 86) {
      const ridge = Math.sin(x * 0.008 + layer * 1.9 + cameraY * 0.001) * 44;
      const hump = Math.cos(x * 0.017 + layer) * 26;
      ctx.lineTo(x, base + ridge + hump);
    }
    ctx.lineTo(VIEW.width + 80, VIEW.height + 80);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawWaterFog(depth, biome) {
  ctx.save();
  const haze = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  haze.addColorStop(0, `rgba(102, 215, 220, ${0.09 + Math.max(0, 0.12 - depth * 0.18)})`);
  haze.addColorStop(0.48, `rgba(46, 130, 153, ${0.09 + depth * 0.06})`);
  haze.addColorStop(1, `rgba(4, 9, 19, ${0.16 + depth * 0.42})`);
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.globalAlpha = biome.id === "deep" || biome.id === "abyss" ? 0.18 : 0.09;
  ctx.fillStyle = biome.id === "deep" || biome.id === "abyss" ? "#5fd8ff" : "#b7fff3";
  for (let i = 0; i < 22; i += 1) {
    const x = ((i * 83 + Math.sin(elapsed * 0.5 + i) * 18) % VIEW.width);
    const y = ((i * 47 - cameraY * 0.18 + elapsed * 6) % (VIEW.height + 90)) - 45;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + (i % 4) * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDepthVignette(depth) {
  ctx.save();
  const vignette = ctx.createRadialGradient(VIEW.width / 2, VIEW.height * 0.46, VIEW.width * 0.12, VIEW.width / 2, VIEW.height * 0.5, VIEW.width * 0.78);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.62, `rgba(0, 0, 0, ${0.08 + depth * 0.1})`);
  vignette.addColorStop(1, `rgba(0, 0, 0, ${0.28 + depth * 0.38})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.restore();
}

function drawEnvironment() {
  for (const obstacle of obstacles) {
    if (!isVisibleY(obstacle.y, 220)) continue;
    drawObstacle(obstacle);
  }

  ctx.globalAlpha = 0.46;
  for (const rock of rocks) {
    if (!isVisibleY(rock.y, 80)) continue;
    ctx.fillStyle = rock.color;
    ctx.beginPath();
    ctx.ellipse(rock.x, rock.y, rock.rx, rock.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const plant of plants) {
    if (!isVisibleY(plant.y, 180)) continue;
    if (plant.type === "coral") drawCoral(plant);
    else if (plant.type === "vent") drawVent(plant);
    else drawKelp(plant);
  }

  const floorY = WORLD.height - 28;
  if (isVisibleY(floorY, 100)) {
    ctx.fillStyle = "#5a4d47";
    ctx.beginPath();
    ctx.moveTo(0, WORLD.height);
    for (let x = 0; x <= WORLD.width; x += 72) {
      ctx.lineTo(x, floorY - Math.sin(x * 0.018 + elapsed * 0.45) * 10);
    }
    ctx.lineTo(WORLD.width, WORLD.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawObstacle(obstacle) {
  const gradient = ctx.createRadialGradient(obstacle.x - obstacle.rx * 0.22, obstacle.y - obstacle.ry * 0.3, 8, obstacle.x, obstacle.y, obstacle.rx * 1.2);
  if (obstacle.type === "reef") {
    gradient.addColorStop(0, "#8fc06b");
    gradient.addColorStop(0.55, "#7f5e6a");
    gradient.addColorStop(1, "#493c4c");
  } else if (obstacle.type === "basalt") {
    gradient.addColorStop(0, "#536270");
    gradient.addColorStop(0.58, "#283242");
    gradient.addColorStop(1, "#121725");
  } else {
    gradient.addColorStop(0, "#87705c");
    gradient.addColorStop(0.62, "#5e5049");
    gradient.addColorStop(1, "#342d2d");
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(obstacle.x, obstacle.y, obstacle.rx, obstacle.ry, Math.sin(obstacle.phase) * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#02070d";
  ctx.beginPath();
  ctx.ellipse(obstacle.x + obstacle.rx * 0.14, obstacle.y + obstacle.ry * 0.18, obstacle.rx * 0.88, obstacle.ry * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(211,255,246,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (obstacle.type === "reef") {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = -2; i <= 2; i += 1) {
      ctx.fillStyle = i % 2 ? "#ed7895" : "#8fd06e";
      ctx.beginPath();
      ctx.arc(obstacle.x + i * obstacle.rx * 0.24, obstacle.y - obstacle.ry * (0.28 + Math.abs(i) * 0.03), obstacle.rx * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawKelp(plant) {
  const sway = Math.sin(elapsed * 1.6 + plant.phase) * 12;
  ctx.strokeStyle = plant.color;
  ctx.lineWidth = plant.width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(plant.x, plant.y + plant.height * 0.4);
  ctx.quadraticCurveTo(plant.x + sway, plant.y - plant.height * 0.1, plant.x + sway * 0.62, plant.y - plant.height);
  ctx.stroke();

  ctx.fillStyle = plant.color;
  ctx.globalAlpha = 0.72;
  for (let i = 0; i < 4; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const y = plant.y - plant.height * (0.12 + i * 0.18);
    const x = plant.x + sway * (0.22 + i * 0.08);
    ctx.beginPath();
    ctx.ellipse(x + side * plant.width * 1.8, y, plant.width * 1.7, plant.width * 0.55, side * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCoral(plant) {
  ctx.strokeStyle = plant.color;
  ctx.lineWidth = plant.width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(plant.x, plant.y + plant.height * 0.38);
  ctx.lineTo(plant.x, plant.y - plant.height * 0.5);
  ctx.moveTo(plant.x, plant.y - plant.height * 0.1);
  ctx.lineTo(plant.x - plant.width * 2.2, plant.y - plant.height * 0.36);
  ctx.moveTo(plant.x, plant.y - plant.height * 0.25);
  ctx.lineTo(plant.x + plant.width * 2.5, plant.y - plant.height * 0.58);
  ctx.stroke();

  ctx.fillStyle = plant.color;
  ctx.globalAlpha = 0.86;
  for (let i = -2; i <= 2; i += 1) {
    const x = plant.x + i * plant.width * 1.3;
    const y = plant.y - plant.height * (0.18 + Math.abs(i) * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, plant.width * 0.58), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawVent(plant) {
  const base = ctx.createLinearGradient(plant.x - plant.width * 3, plant.y - plant.height, plant.x + plant.width * 3, plant.y + plant.height);
  base.addColorStop(0, "#1a2632");
  base.addColorStop(0.55, "#47545e");
  base.addColorStop(1, "#0f1722");
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(plant.x, plant.y, plant.width * 1.5, plant.height * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.34;
  const plume = ctx.createRadialGradient(plant.x, plant.y - plant.height * 0.45, 2, plant.x, plant.y - plant.height * 0.72, plant.width * 5);
  plume.addColorStop(0, "#9af7ff");
  plume.addColorStop(1, "rgba(154,247,255,0)");
  ctx.fillStyle = plume;
  ctx.beginPath();
  ctx.ellipse(plant.x + Math.sin(elapsed * 2 + plant.phase) * 9, plant.y - plant.height * 0.6, plant.width * 2.4, plant.height * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBubbles() {
  ctx.save();
  for (const bubble of bubbles) {
    if (!isVisibleY(bubble.y, 60)) continue;
    ctx.globalAlpha = bubble.alpha;
    ctx.strokeStyle = "#c9fff6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = bubble.alpha * 0.55;
    ctx.beginPath();
    ctx.arc(bubble.x - bubble.radius * 0.26, bubble.y - bubble.radius * 0.3, bubble.radius * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    if (!isVisibleY(particle.y, 80)) continue;
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  const settings = difficulty[chosenLevel];
  const progress = clamp((player.radius - 24) / (settings.goalRadius - 24), 0, 1);
  const biome = getBiomeAt(player.y);
  const lock = nextLockedBiome();
  const maxDepth = depthMeters(maxDiveY());

  ctx.save();
  ctx.fillStyle = "rgba(10, 17, 24, 0.72)";
  ctx.beginPath();
  ctx.roundRect(28, 78, 386, 104, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.stroke();

  ctx.fillStyle = "#efffff";
  ctx.font = "800 20px system-ui, sans-serif";
  ctx.fillText(`难度 ${settings.label}`, 48, 110);
  ctx.textAlign = "right";
  ctx.fillText(score.toString(), 390, 110);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.beginPath();
  ctx.roundRect(48, 126, 342, 12, 3);
  ctx.fill();

  const bar = ctx.createLinearGradient(48, 0, 334, 0);
  bar.addColorStop(0, "#66c0f4");
  bar.addColorStop(0.55, "#8bc53f");
  bar.addColorStop(1, "#f0b05f");
  ctx.fillStyle = bar;
  ctx.beginPath();
  ctx.roundRect(48, 126, 342 * progress, 12, 3);
  ctx.fill();

  ctx.fillStyle = "#8fa3b5";
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.fillText(`${biome.name}  ·  ${depthMeters()}m`, 48, 162);
  if (lock) {
    ctx.fillStyle = "#ffcd6d";
    ctx.fillText(`水压极限 ${maxDepth}m，长大后解锁 ${lock.name}`, 48, 178);
  } else {
    ctx.fillStyle = "#8bc53f";
    ctx.fillText("水压已适应，可继续探索深渊", 48, 178);
  }

  if (player.invincible > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.fillText("READY", 326, 162);
  }

  ctx.fillStyle = "rgba(10, 17, 24, 0.64)";
  ctx.beginPath();
  ctx.roundRect(VIEW.width - 286, 78, 258, 104, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = "#8fa3b5";
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.fillText("EXPEDITION", VIEW.width - 266, 106);
  ctx.fillStyle = "#efffff";
  ctx.font = "900 22px system-ui, sans-serif";
  ctx.fillText(`${eaten} PREY`, VIEW.width - 266, 134);
  ctx.fillStyle = "#66c0f4";
  ctx.font = "800 14px system-ui, sans-serif";
  ctx.fillText(`最大下潜 ${maxDepth}m`, VIEW.width - 266, 162);

  ctx.restore();
}

function drawIntroTips() {
  if (introHintTimer <= 0 || state !== "playing") return;

  const alpha = clamp(introHintTimer / 1.1, 0, 1);
  const x = WORLD.width - 390;
  const y = 178;
  const width = 362;
  const height = 154;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(10, 17, 24, 0.76)";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(102, 192, 244, 0.42)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#66c0f4";
  ctx.font = "900 16px system-ui, sans-serif";
  ctx.fillText("新手提示", x + 20, y + 30);

  ctx.fillStyle = "#efffff";
  ctx.font = "800 15px system-ui, sans-serif";
  ctx.fillText("WASD / 方向键  移动", x + 20, y + 60);
  ctx.fillText("空格  定位自己的 1P", x + 20, y + 84);
  ctx.fillText("向下探索不同水层生态", x + 20, y + 108);
  ctx.fillStyle = "#ffb36f";
  ctx.fillText("体型不够会被水压挡住", x + 20, y + 136);
  ctx.restore();
}

function drawSwarmWarning() {
  if (swarmWarningTimer <= 0 || state !== "playing") return;

  const alpha = clamp(swarmWarningTimer / 0.8, 0, 1);
  const x = VIEW.width / 2 - 190;
  const y = 82;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(14, 29, 40, 0.86)";
  ctx.beginPath();
  ctx.roundRect(x, y, 380, 48, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(139, 197, 63, 0.58)";
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#8bc53f";
  ctx.font = "900 17px system-ui, sans-serif";
  ctx.fillText("鱼群来袭", VIEW.width / 2, y + 20);
  ctx.fillStyle = "#f5fbff";
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.fillText("这一波都比你小，可以放心捕食", VIEW.width / 2, y + 38);
  ctx.restore();
}

function drawFinaleOverlay() {
  const fade = clamp((finaleTime - 2.05) / 1.25, 0, 1);
  if (fade <= 0) return;

  ctx.save();
  ctx.globalAlpha = fade * 0.56;
  ctx.fillStyle = "#060b10";
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.globalAlpha = fade;
  ctx.textAlign = "center";
  ctx.fillStyle = "#f8fbff";
  ctx.font = "900 52px system-ui, sans-serif";
  ctx.fillText("彩蛋触发", VIEW.width / 2, VIEW.height / 2 - 12);
  ctx.fillStyle = "#ffdc77";
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.fillText("海洋之外，还有猎人。", VIEW.width / 2, VIEW.height / 2 + 34);
  ctx.restore();
}

function drawScene() {
  const transform = viewTransform();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);

  if (cameraShake > 0) {
    ctx.translate(random(-cameraShake, cameraShake), random(-cameraShake, cameraShake));
  }

  drawBackground();

  ctx.save();
  ctx.translate(0, -cameraY);
  drawBubbles();

  const sortedFish = fish.filter((item) => isVisibleY(item.y, 180)).sort((a, b) => a.radius - b.radius);
  for (const item of sortedFish) {
    drawFishBody(item);
  }

  if (state !== "menu") {
    if (player.invincible > 0 && Math.floor(elapsed * 12) % 2 === 0) {
      ctx.globalAlpha = 0.56;
    }
    drawFishBody({ ...player, phase: elapsed, colors: ["#f7df72", "#ef685b"] }, true);
    ctx.globalAlpha = 1;
    drawPlayerMarker();
  }

  if (state === "finale") {
    drawDiver();
    if (finaleTime > 2.15) drawPelletTrail();
  }

  drawParticles();

  if (ripplePulse > 0) {
    ctx.save();
    ctx.globalAlpha = ripplePulse;
    ctx.strokeStyle = "#f8fbff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, (1 - ripplePulse) * 210 + player.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  if (state === "playing") {
    drawHud();
    drawIntroTips();
    drawSwarmWarning();
  }
  drawFinaleOverlay();
  ctx.restore();
}

function drawPelletTrail() {
  const progress = clamp((finaleTime - 2.12) / 0.25, 0, 1);
  const startX = diver.x - 150;
  const startY = diver.y + Math.sin(elapsed * 3.4) * 5;
  const endX = player.x;
  const endY = player.y;

  ctx.save();
  ctx.strokeStyle = `rgba(255, 232, 165, ${1 - progress * 0.45})`;
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(startX, startY + i * 4);
    ctx.lineTo(startX + (endX - startX) * progress, startY + (endY - startY) * progress + i * 7);
    ctx.stroke();
  }
  ctx.restore();
}

function updatePlayer(dt) {
  const settings = difficulty[chosenLevel];
  const left = keys.has("arrowleft") || keys.has("a");
  const right = keys.has("arrowright") || keys.has("d");
  const up = keys.has("arrowup") || keys.has("w");
  const down = keys.has("arrowdown") || keys.has("s");
  let dx = Number(right) - Number(left);
  let dy = Number(down) - Number(up);
  if (touchMove.active) {
    dx += touchMove.x;
    dy += touchMove.y;
  }
  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;

  const sizeDrag = clamp((player.radius - 24) * 1.2, 0, 82);
  const speed = Math.max(138, settings.playerSpeed - sizeDrag);
  player.vx += (dx * speed - player.vx) * Math.min(1, dt * 11);
  player.vy += (dy * speed - player.vy) * Math.min(1, dt * 11);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = clamp(player.x, player.radius + 12, WORLD.width - player.radius - 12);
  const pressureFloor = maxDiveY();
  const lowerBound = Math.min(WORLD.height - player.radius - 38, pressureFloor);
  player.y = clamp(player.y, player.radius + 48, lowerBound);
  if (player.y >= lowerBound - 0.5 && down && pressureFloor < WORLD.height - player.radius - 42) {
    player.vy = Math.min(0, player.vy);
    pressureNoticeTimer = 1.8;
  }
  player.radius += (player.targetRadius - player.radius) * Math.min(1, dt * 5);
  player.invincible = Math.max(0, player.invincible - dt);

  if (Math.abs(player.vx) > 12) player.dir = player.vx >= 0 ? 1 : -1;
}

function resolveObstacleCollisions() {
  for (const obstacle of obstacles) {
    if (!isVisibleY(obstacle.y, 260)) continue;
    const dx = (player.x - obstacle.x) / Math.max(1, obstacle.rx + player.radius * 0.72);
    const dy = (player.y - obstacle.y) / Math.max(1, obstacle.ry + player.radius * 0.58);
    const overlap = dx * dx + dy * dy;
    if (overlap >= 1) continue;

    const angle = Math.atan2(player.y - obstacle.y, player.x - obstacle.x);
    const push = (1 - Math.sqrt(overlap)) * 26;
    player.x += Math.cos(angle) * push;
    player.y += Math.sin(angle) * push;
    player.vx *= 0.5;
    player.vy *= 0.5;
  }

  player.x = clamp(player.x, player.radius + 12, WORLD.width - player.radius - 12);
  player.y = clamp(player.y, player.radius + 48, Math.min(WORLD.height - player.radius - 38, maxDiveY()));
}

function updateFish(dt) {
  const settings = difficulty[chosenLevel];
  spawnTimer += dt;
  schoolTimer += dt;
  const interval = Math.max(0.24, settings.spawnEvery - elapsed * 0.004);
  if (spawnTimer > interval) {
    spawnTimer = 0;
    spawnFish(false);
  }
  if (schoolTimer > 60) {
    schoolTimer = 0;
    spawnEdibleSchool();
  }

  for (let i = fish.length - 1; i >= 0; i -= 1) {
    const item = fish[i];
    item.phase += dt * 3.2;
    const verticalDrift = item.species === "jellyfish" ? 26 : item.species === "eel" ? 34 : 18;
    item.x += (item.vx + Math.sin(elapsed * item.turn + item.phase) * settings.current) * dt;
    item.y += (item.vy + Math.cos(elapsed * 1.4 + item.phase) * verticalDrift) * dt;
    item.y = clamp(item.y, 60 + item.radius, WORLD.height - 58 - item.radius);

    const tooFarDepth = Math.abs(item.y - player.y) > VIEW.height * 1.7;
    if ((item.dir > 0 && item.x > WORLD.width + 140) || (item.dir < 0 && item.x < -140) || tooFarDepth) {
      fish.splice(i, 1);
    }
  }
}

function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i -= 1) {
    const bubble = bubbles[i];
    bubble.y -= bubble.speed * dt;
    bubble.x += Math.sin(elapsed * 1.2 + bubble.phase) * bubble.wobble * dt;
    if (bubble.y < cameraY - 120 || bubble.y > cameraY + VIEW.height + 360) {
      bubbles.splice(i, 1);
    }
  }

  const trailRate = player.radius > 110 ? 0.8 : player.radius > 72 ? 1.3 : 2.1;
  if (bubbles.length < LIMITS.bubbles * 0.82 && Math.random() < dt * trailRate) {
    addBubble(player.x - player.dir * player.radius, player.y + player.radius * 0.25, 0.55);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - dt * 2.6;
    particle.vy *= 1 - dt * 2.6;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function handleCollisions() {
  if (state !== "playing") return;
  const shielded = player.invincible > 0;

  for (let i = fish.length - 1; i >= 0; i -= 1) {
    const item = fish[i];
    const distance = Math.hypot(player.x - item.x, player.y - item.y);
    const edible = item.radius < player.radius * 0.92;
    const deadly = item.radius > player.radius * 1.06;
    const touching = distance < player.radius * 0.72 + item.radius * 0.68;
    if (!touching) continue;

    if (edible) {
      fish.splice(i, 1);
      eaten += 1;
      score += item.value;
      player.biteTimer = 0.28;
      if (eaten === 1) showAchievement("first-bite", "第一口");
      if (eaten === 10) showAchievement("ten-fish", "十连吞噬");
      const settings = difficulty[chosenLevel];
      player.targetRadius = Math.min(settings.goalRadius, player.targetRadius + item.radius * settings.growth);
      addBurst(item.x, item.y, item.colors[0], player.radius > 110 ? 6 : 12);
      cameraShake = Math.min(6, cameraShake + 1.8);
      const biteBubbles = player.radius > 110 ? 1 : player.radius > 72 ? 2 : 3;
      for (let j = 0; j < biteBubbles; j += 1) addBubble(item.x, item.y, 0.72);
      if (player.targetRadius >= settings.goalRadius - 0.2 && getBiomeAt(player.y).id === "abyss") startFinale();
    } else if (deadly && !shielded) {
      addBurst(player.x, player.y, "#ff7268", 30);
      cameraShake = 14;
      endGame("被更大的鱼吞掉了", `分数 ${score}，吞食 ${eaten} 条。`);
    } else {
      const pushX = (player.x - item.x) / Math.max(1, distance);
      const pushY = (player.y - item.y) / Math.max(1, distance);
      player.x += pushX * 10;
      player.y += pushY * 8;
    }
  }
}

function startFinale() {
  state = "finale";
  finaleTime = 0;
  player.invincible = 99;
  score += 1200;
  ripplePulse = 1;
  fish.length = fish.filter((item) => item.radius < player.radius * 0.7);
  showAchievement("apex", "深海霸主");
}

function updateFinale(dt) {
  finaleTime += dt;
  const entrance = clamp(finaleTime / 1.6, 0, 1);
  diver.x = WORLD.width + 230 - easeOutCubic(entrance) * 420;
  diver.y = player.y - 210 + Math.sin(finaleTime * 1.5) * 20;

  player.vx *= 0.96;
  player.vy *= 0.96;
  player.x += Math.sin(finaleTime * 2.1) * dt * 20;
  player.radius += (difficulty[chosenLevel].goalRadius - player.radius) * dt * 2.5;
  ripplePulse = Math.max(0, ripplePulse - dt * 0.45);

  if (finaleTime > 2.2 && !shotFired) {
    shotFired = true;
    cameraShake = 24;
    addBurst(player.x, player.y, "#ffe37f", 48);
    for (let i = 0; i < 20; i += 1) addBubble(player.x + random(-30, 30), player.y + random(-20, 20), 1.2);
  }

  if (finaleTime > 4.4) {
    showAchievement("hunter-ending", "隐藏结局：猎人");
    endGame("彩蛋结局", `你成为最大的鱼后，被潜水猎人击中了。分数 ${score}，吞食 ${eaten} 条。`, true);
  }
}

function endGame(title, copy, finale = false) {
  state = "over";
  resultKicker.textContent = finale ? "Surprise Ending" : "Game Over";
  resultTitle.textContent = title;
  resultCopy.textContent = copy;
  result.classList.remove("hidden");
}

function update(dt) {
  elapsed += dt;
  cameraShake = Math.max(0, cameraShake - dt * 22);
  selfPingTimer = Math.max(0, selfPingTimer - dt);
  introHintTimer = Math.max(0, introHintTimer - dt);
  swarmWarningTimer = Math.max(0, swarmWarningTimer - dt);
  pressureNoticeTimer = Math.max(0, pressureNoticeTimer - dt);
  player.biteTimer = Math.max(0, player.biteTimer - dt);
  if (achievementTimer > 0) {
    achievementTimer -= dt;
    if (achievementTimer <= 0) achievementToast.classList.add("hidden");
  }
  if (state === "playing") {
    updatePlayer(dt);
    updateFish(dt);
    handleCollisions();
  } else if (state === "finale") {
    updateFinale(dt);
    updateFish(dt);
  }
  if (state !== "menu") updateCamera(dt);
  updateBubbles(dt);
  updateParticles(dt);
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  drawScene();
  requestAnimationFrame(loop);
}

levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    chosenLevel = button.dataset.level;
    levelButtons.forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

startButton.addEventListener("click", () => {
  requestLandscape();
  resetGame();
});
restartButton.addEventListener("click", () => {
  result.classList.add("hidden");
  menu.classList.remove("hidden");
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    keys.add(key);
  }
  if (key === " " && (state === "playing" || state === "finale")) {
    event.preventDefault();
    selfPingTimer = 1.9;
  }
  if (key === "enter" && state === "menu") resetGame();
  if (key === "enter" && state === "over") {
    result.classList.add("hidden");
    menu.classList.remove("hidden");
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", resize);

function resetTouchStick() {
  touchMove.active = false;
  touchMove.id = null;
  touchMove.mode = null;
  touchMove.x = 0;
  touchMove.y = 0;
  touchKnob.style.transform = "translate(-50%, -50%)";
}

function updateTouchStick(clientX, clientY) {
  const rect = touchStick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const max = rect.width * 0.42;
  const rawX = clientX - centerX;
  const rawY = clientY - centerY;
  const distance = Math.hypot(rawX, rawY);
  if (distance < max * 0.08) {
    touchMove.x = 0;
    touchMove.y = 0;
    touchKnob.style.transform = "translate(-50%, -50%)";
    return;
  }
  const scale = distance > max ? max / distance : 1;
  const x = rawX * scale;
  const y = rawY * scale;
  touchMove.x = x / max;
  touchMove.y = y / max;
  touchKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

function startTouchControl(id, mode, clientX, clientY) {
  requestLandscape();
  touchMove.active = true;
  touchMove.id = id;
  touchMove.mode = mode;
  updateTouchStick(clientX, clientY);
}

touchStickZone.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (touchMove.active && touchMove.mode === "touch") return;
  startTouchControl(event.pointerId, "pointer", event.clientX, event.clientY);
  if (touchStickZone.setPointerCapture) {
    try {
      touchStickZone.setPointerCapture(event.pointerId);
    } catch {
      // iOS may refuse capture during fast edge gestures; window listeners still track movement.
    }
  }
});

window.addEventListener("pointermove", (event) => {
  if (!touchMove.active || touchMove.mode !== "pointer" || event.pointerId !== touchMove.id) return;
  event.preventDefault();
  updateTouchStick(event.clientX, event.clientY);
});

window.addEventListener("pointerup", (event) => {
  if (touchMove.mode !== "pointer" || event.pointerId !== touchMove.id) return;
  resetTouchStick();
});

window.addEventListener("pointercancel", (event) => {
  if (touchMove.mode !== "pointer" || event.pointerId !== touchMove.id) return;
  resetTouchStick();
});

touchStickZone.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    event.preventDefault();
    startTouchControl(touch.identifier, "touch", touch.clientX, touch.clientY);
  },
  { passive: false }
);

window.addEventListener(
  "touchmove",
  (event) => {
    if (!touchMove.active || touchMove.mode !== "touch") return;
    const touch = Array.from(event.touches).find((item) => item.identifier === touchMove.id);
    if (!touch) return;
    event.preventDefault();
    updateTouchStick(touch.clientX, touch.clientY);
  },
  { passive: false }
);

window.addEventListener(
  "touchend",
  (event) => {
    if (touchMove.mode !== "touch") return;
    const ended = Array.from(event.changedTouches).some((item) => item.identifier === touchMove.id);
    if (ended) resetTouchStick();
  },
  { passive: false }
);

window.addEventListener(
  "touchcancel",
  (event) => {
    if (touchMove.mode !== "touch") return;
    const cancelled = Array.from(event.changedTouches).some((item) => item.identifier === touchMove.id);
    if (cancelled) resetTouchStick();
  },
  { passive: false }
);

touchLocate.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  requestLandscape();
  selfPingTimer = 1.9;
});

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + width, y, x + width, y + height, r);
    this.arcTo(x + width, y + height, x, y + height, r);
    this.arcTo(x, y + height, x, y, r);
    this.arcTo(x, y, x + width, y, r);
    this.closePath();
    return this;
  };
}

buildPlants();
buildDust();
buildRocks();
buildObstacles();
resize();
updateAchievementCount();
for (let i = 0; i < 26; i += 1) addBubble(random(0, WORLD.width), random(0, WORLD.height), random(0.4, 1.3));
requestAnimationFrame(loop);
