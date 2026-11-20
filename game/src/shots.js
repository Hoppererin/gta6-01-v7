// Isla Fortuna — shots.js
// Deterministic screenshot scenes for ?shot=<name>&seed=1.
// Each shot places the world in a readable, system-rich state and lets
// main.js render exactly one composed frame.

import { createWorld, startGame } from './world.js';
import { startMission } from './missions.js';

export const SHOTS = ['start', 'drive', 'chase', 'heist'];

export function runShot(world, name) {
  world.started = true;
  world.paused = false;
  switch (name) {
    case 'start': {
      // On foot by the taxi at golden hour, job 1 briefing on screen.
      world.time = 17.4; world.weather = 'sunset'; world.weatherLocked = true;
      world.player.x = 880; world.player.y = 1250;
      startMission(world, 0);
      break;
    }
    case 'drive': {
      // Mid-drive in the taxi toward the casino, noon, clear.
      world.time = 12; world.weather = 'clear'; world.weatherLocked = true;
      startMission(world, 0);
      const taxi = world.vehicles.find((v) => v.id === 'taxi-1');
      if (taxi) {
        taxi.x = 1250; taxi.y = 700; taxi.angle = 0; taxi.speed = 260;
        world.player.vehicle = taxi;
        world.player.x = taxi.x; world.player.y = taxi.y;
        world.missionStep = 1;
        world.objective = 'First Fare: Drive the passenger to the Gilded Crown Casino';
      }
      break;
    }
    case 'chase': {
      // Three wanted stars, police closing in on the Gilded Mile.
      world.time = 15; world.weather = 'clear'; world.weatherLocked = true;
      startMission(world, 2);
      world.heat = 65; world.wanted = 3; world.lastCrime = world.playTime;
      const car = world.vehicles.find((v) => v.type === 'car');
      if (car) {
        car.x = 1700; car.y = 1100; car.angle = -Math.PI / 2; car.speed = 200;
        world.player.vehicle = car;
        world.player.x = car.x; world.player.y = car.y;
      }
      for (const [x, y] of [[1700, 900], [1900, 1100], [1700, 1500]]) {
        world.police.push({ type: 'police', x, y, angle: 0, speed: 200, color: '#1c2733', w: 48, h: 22, ramCooldown: 0 });
      }
      break;
    }
    case 'heist': {
      // The finale at the casino vault, night, two stars, loot in reach.
      world.time = 21; world.weather = 'clear'; world.weatherLocked = true;
      startMission(world, 11);
      world.missionStep = 1; // show the loot grab (static shot: steps never advance)
      world.objective = 'The Fortuna Heist: Grab the loot from the vault';
      world.heat = 45; world.wanted = 2; world.lastCrime = world.playTime;
      world.player.x = 1510; world.player.y = 680;
      world.player.vehicle = null;
      for (const [x, y] of [[1400, 700], [1620, 700]]) {
        world.police.push({ type: 'police', x, y, angle: 0, speed: 0, color: '#1c2733', w: 48, h: 22, ramCooldown: 0 });
      }
      break;
    }
    default: {
      startMission(world, 0);
      break;
    }
  }
  // Centre the camera on the player for the shot.
  world.camera.x = Math.max(0, world.player.x - (world.viewW || 1280) / 2);
  world.camera.y = Math.max(0, world.player.y - (world.viewH || 720) / 2);
  return world;
}

export function createShotWorld(name, seed = 1) {
  const world = createWorld(seed);
  world.viewW = 1280; world.viewH = 720;
  return runShot(world, name);
}
