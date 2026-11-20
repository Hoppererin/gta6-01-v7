// Isla Fortuna — main.js
// Entry point: canvas setup, game loop, keyboard actions, save/load,
// the ?shot= screenshot mode, and the window.__isla debug hook.

import { createWorld, startGame, stepWorld, saveGame, loadGame, enterVehicle, exitVehicle, punch, nearestVehicle, retryAfterBusted } from './world.js';
import { createInput, attachInput } from './input.js';
import { createAudio } from './audio.js';
import { startMission, currentMission, missionObjective, missionTarget, MISSIONS } from './missions.js';
import { hire } from './crew.js';
import { render } from './render.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const world = createWorld(seed);
world.viewW = canvas.width;
world.viewH = canvas.height;
const input = createInput();
attachInput(input, window);
const audio = createAudio();
world.audio = audio;
world.input = input;

// Debug / automation hook: the playtest bot reads positions and mission state here and steers the player with real keyboard input.
window.__isla = {
  world,
  version: 'v7',
  missions: MISSIONS,
  state() {
    const t = missionTarget(world);
    const m = currentMission(world);
    return {
      px: Math.round(world.player.x), py: Math.round(world.player.y),
      angle: world.player.angle, speed: Math.round(world.player.speed || 0),
      hp: Math.round(world.player.hp),
      inCar: !!(world.player.vehicle && world.player.vehicle.type !== 'boat'),
      inBoat: !!(world.player.vehicle && world.player.vehicle.type === 'boat'),
      vehicle: world.player.vehicle ? { type: world.player.vehicle.type, x: Math.round(world.player.vehicle.x), y: Math.round(world.player.vehicle.y) } : null,
      missionIndex: world.missionIndex, missionStep: world.missionStep,
      missionName: m ? m.name : null,
      missionTime: +(world.missionTime || 0).toFixed(2),
      missionTimer: world.missionTimer === null ? null : +(world.missionTimer || 0).toFixed(1),
      missionDone: world.missionDone, missionFailed: world.missionFailed,
      objective: world.objective,
      target: t ? { x: Math.round(t.x), y: Math.round(t.y), label: t.label } : null,
      wanted: world.wanted, heat: Math.round(world.heat),
      cash: world.cash, time: +world.time.toFixed(2), weather: world.weather,
      started: world.started, paused: world.paused, busted: world.busted,
      finale: world.finale, playTime: +(world.playTime || 0).toFixed(1),
      rivals: world.rivals.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), hp: r.hp })),
      police: world.police.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), type: p.type })),
      vehicles: world.vehicles.map((v) => ({ id: v.id, type: v.type, x: Math.round(v.x), y: Math.round(v.y) })),
      crew: { ...world.crew },
      dialogue: world.dialogue.length ? world.dialogue[world.dialogue.length - 1] : null,
    };
  },
  startMission(i) { startMission(world, i); },
  teleport(x, y) { world.player.x = x; world.player.y = y; if (world.player.vehicle) { world.player.vehicle.x = x; world.player.vehicle.y = y; } },
  setHeat(h) { world.heat = h; },
};

function handleKeys() {
  // Title screen.
  if (!world.started) {
    if (input.wasPressed('Enter')) { audio.resume(); startGame(world); }
    if (input.wasPressed('KeyL')) {
      if (loadGame(world)) world.dialogue.push({ who: 'Marisol', text: 'Save loaded. Press Enter to continue.' });
    }
    return;
  }
  // Busted / failed: R retries the current job.
  if (world.busted && input.wasPressed('KeyR')) { retryAfterBusted(world); return; }
  if (world.missionFailed && input.wasPressed('KeyR')) {
    world.missionFailed = false;
    world.heat = 0; world.wanted = 0; world.lastCrime = -999;
    startMission(world, world.missionIndex);
    return;
  }
  if (input.wasPressed('KeyP')) { world.paused = !world.paused; audio.click(); }
  if (input.wasPressed('KeyM')) {
    world.muted = !world.muted;
    audio.setMuted(world.muted);
  }
  if (world.paused) {
    if (input.wasPressed('Digit1')) { const r = hire(world, 'mara'); world.dialogue.push({ who: 'Marisol', text: r.msg }); }
    if (input.wasPressed('Digit2')) { const r = hire(world, 'leo'); world.dialogue.push({ who: 'Marisol', text: r.msg }); }
    if (input.wasPressed('Digit3')) { const r = hire(world, 'ada'); world.dialogue.push({ who: 'Marisol', text: r.msg }); }
    if (input.wasPressed('KeyS')) { saveGame(world); world.dialogue.push({ who: 'Marisol', text: 'Game saved.' }); }
    if (input.wasPressed('KeyL')) {
      if (loadGame(world)) { world.dialogue.push({ who: 'Marisol', text: 'Save loaded.' }); startMission(world, world.missionIndex); }
    }
    return;
  }
  if (input.wasPressed('KeyE')) {
    if (world.player.vehicle) exitVehicle(world);
    else {
      const v = nearestVehicle(world, 85);
      if (v) enterVehicle(world, v);
    }
  }
  if (input.wasPressed('Space')) punch(world);
  if (input.wasPressed('KeyH') && world.player.vehicle) audio.horn();
  if (input.wasPressed('KeyR') && world.missionFailed) {
    startMission(world, world.missionIndex);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  world.viewW = canvas.width;
  world.viewH = canvas.height;
  handleKeys();
  stepWorld(world, input, dt);
  audio.musicTick(dt);
  render(ctx, world);
  input.endFrame();
  requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot mode: one deterministic frame, no game loop — the scene
  // is exactly what runShot() set up (police do not ram, missions do
  // not advance while the screenshot is taken).
  audio.muted = true;
  runShot(world, shotName);
  world.viewW = 1280; world.viewH = 720;
  canvas.width = 1280; canvas.height = 720;
  render(ctx, world);
  document.title = `Isla Fortuna — shot ${shotName}`;
} else {
  requestAnimationFrame(frame);
}
