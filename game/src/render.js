// Isla Fortuna — render.js
// All canvas drawing: the island, vehicles, people, HUD, live minimap,
// dialogue, title screen and pause menu. No imports except config/city/weather.

import { WORLD_W, WORLD_H, LAND, DISTRICTS, CASINO, CREW } from './config.js';
import { ROADS_X, ROADS_Y, ROAD_W, LAGOON, HARBOUR_BASIN, DOCKS, RUNWAY, districtAt } from './city.js';
import { daylight, clockString, isNight } from './weather.js';
import { missionObjective, missionTarget, currentMission } from './missions.js';
import { clamp } from './random.js';

function drawCar(ctx, x, y, angle, color, w = 48, h = 22, lights = false) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.beginPath(); ctx.roundRect(-w / 6, -h / 2 + 3, w / 3, h - 6, 3); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 4, -h / 2 + 3, 3, 5); ctx.fillRect(w / 2 - 4, h / 2 - 8, 3, 5);
  if (lights) {
    const on = Math.floor(performance.now() / 350) % 2 === 0;
    ctx.fillStyle = on ? '#ff4444' : '#4488ff';
    ctx.fillRect(-w / 2 - 2, -h / 2, 6, 7); ctx.fillRect(-w / 2 - 2, h / 2 - 7, 6, 7);
    ctx.fillStyle = on ? '#4488ff' : '#ff4444';
    ctx.fillRect(-w / 2 - 2, -h / 2 + 8, 6, 6);
  }
  ctx.restore();
}

function drawBoat(ctx, x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(-6, 0, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) { ctx.rotate(Math.PI / 2); ctx.globalAlpha = 0.75; }
  else ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, world) {
  const cam = world.camera;
  const vw = world.viewW, vh = world.viewH;
  // Ocean.
  ctx.fillStyle = '#1d6fa8';
  ctx.fillRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // Island base: sand rim + grass.
  ctx.fillStyle = '#e8d28a';
  ctx.fillRect(LAND.x - 26, LAND.y - 26, LAND.w + 52, LAND.h + 52);
  ctx.fillStyle = '#69a84f';
  ctx.fillRect(LAND.x, LAND.y, LAND.w, LAND.h);
  // Palm Beach sand on the east coast.
  ctx.fillStyle = '#f0d48a';
  ctx.fillRect(2580, 580, 500, 1040);
  // Jungle darkening.
  ctx.fillStyle = 'rgba(20,80,30,0.35)';
  ctx.fillRect(2000, 1700, 1080, 580);
  // Water bodies.
  ctx.fillStyle = '#2b8bc4';
  ctx.fillRect(LAGOON.x, LAGOON.y, LAGOON.w, LAGOON.h);
  ctx.fillRect(HARBOUR_BASIN.x, HARBOUR_BASIN.y, HARBOUR_BASIN.w, HARBOUR_BASIN.h);
  // District labels (painted on the ground).
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
  }
  // Docks.
  ctx.fillStyle = '#8a6b42';
  for (const d of DOCKS) ctx.fillRect(d.x, d.y, d.w, d.h);
  // Runway.
  ctx.fillStyle = '#3a3f45';
  ctx.fillRect(RUNWAY.x, RUNWAY.y, RUNWAY.w, RUNWAY.h);
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('ISLA FORTUNA AIR', RUNWAY.x + RUNWAY.w / 2, RUNWAY.y + RUNWAY.h / 2 + 7);
  // Roads.
  ctx.fillStyle = '#3c4147';
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, LAND.y, ROAD_W, LAND.h);
  for (const ry of ROADS_Y) ctx.fillRect(LAND.x, ry - ROAD_W / 2, LAND.w, ROAD_W);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3; ctx.setLineDash([24, 22]);
  ctx.beginPath();
  for (const rx of ROADS_X) { ctx.moveTo(rx, LAND.y); ctx.lineTo(rx, LAND.y + LAND.h); }
  for (const ry of ROADS_Y) { ctx.moveTo(LAND.x, ry); ctx.lineTo(LAND.x + LAND.w, ry); }
  ctx.stroke();
  ctx.setLineDash([]);
  // Buildings.
  for (const b of world.city.buildings) {
    ctx.fillStyle = b.casino ? '#d4a017' : `hsl(${b.hue}, 45%, 62%)`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x, b.y + b.h - 12, b.w, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 34) {
      for (let wy = b.y + 14; wy < b.y + b.h - 14; wy += 30) ctx.fillRect(wx, wy, 12, 9);
    }
    if (b.casino) {
      ctx.fillStyle = '#fff3c4';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('★ GILDED CROWN ★', b.x + b.w / 2, b.y + 34);
      ctx.font = '16px sans-serif';
      ctx.fillText('CASINO', b.x + b.w / 2, b.y + 58);
    }
  }
  // Palms.
  for (const p of world.city.palms) {
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4 * p.s, p.y - 14 * p.s); ctx.stroke();
    ctx.fillStyle = '#2f8f3a';
    ctx.beginPath(); ctx.arc(p.x + 4 * p.s, p.y - 16 * p.s, 10 * p.s, 0, Math.PI * 2); ctx.fill();
  }
  // Golden doubloons.
  for (const d of world.doubloons) {
    if (d.taken) continue;
    const pulse = 1 + 0.15 * Math.sin(world.playTime * 4 + d.x);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(d.x, d.y, 11 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a67c00'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#a67c00';
    ctx.font = 'bold 12px sans-serif'; ctx.fillText('$', d.x, d.y + 4);
  }
  // Fare markers.
  const f = world.fare;
  if (f) {
    const tx = f.state === 'waiting' ? f.x : f.tx;
    const ty = f.state === 'waiting' ? f.y : f.ty;
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tx, ty, 22 + 4 * Math.sin(world.playTime * 5), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 20px sans-serif'; ctx.fillText('$', tx, ty + 7);
  }
  // Mission target beacon.
  const target = missionTarget(world);
  if (target && world.started && !world.finale) {
    const pulse = 26 + 8 * Math.sin(world.playTime * 5);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.beginPath(); ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(target.x, target.y - 70); ctx.lineTo(target.x, target.y - 30); ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.moveTo(target.x, target.y - 70); ctx.lineTo(target.x + 10, target.y - 56); ctx.lineTo(target.x, target.y - 46); ctx.closePath(); ctx.fill();
  }
  // Traffic, race rivals, parked vehicles.
  for (const t of world.traffic) drawCar(ctx, t.x, t.y, t.angle, t.color);
  for (const r of world.raceRivals) drawCar(ctx, r.x, r.y, r.angle, r.color);
  for (const v of world.vehicles) {
    if (v.type === 'boat') drawBoat(ctx, v.x, v.y, v.angle, v.color);
    else drawCar(ctx, v.x, v.y, v.angle, v.color);
  }
  // Police.
  for (const p of world.police) {
    if (p.type === 'policeBoat') drawBoat(ctx, p.x, p.y, p.angle, p.color);
    else drawCar(ctx, p.x, p.y, p.angle, p.color, 48, 22, true);
  }
  // Pedestrians + rivals.
  for (const p of world.peds) drawPerson(ctx, p.x, p.y, p.angle, p.color, p.down > 0);
  for (const r of world.rivals) {
    drawPerson(ctx, r.x, r.y, r.angle, r.color, false);
    if (r.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(r.x, r.y, 12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ff5555';
    ctx.fillRect(r.x - 12, r.y - 20, 24 * (r.hp / 3), 4);
  }
  // Player.
  const pl = world.player;
  if (!pl.vehicle) drawPerson(ctx, pl.x, pl.y, pl.angle, '#2ecc71', false);
  else {
    // Highlight the driven vehicle.
    ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pl.x, pl.y, 34, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // --- Lighting: day/night + weather tint ---
  const dl = daylight(world);
  if (dl < 0.55) {
    ctx.fillStyle = `rgba(8,12,40,${(0.55 - dl) * 0.9})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  if (world.weather === 'sunset') {
    ctx.fillStyle = 'rgba(255,120,40,0.12)';
    ctx.fillRect(0, 0, vw, vh);
  }
  if (world.weather === 'haze') {
    ctx.fillStyle = 'rgba(220,220,200,0.10)';
    ctx.fillRect(0, 0, vw, vh);
  }
  if (world.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,200,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of world.rainDrops) {
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 6, d.y + 16);
    }
    ctx.stroke();
  }
}

function drawMinimap(ctx, world) {
  const mw = 190, mh = 142;
  const x0 = world.viewW - mw - 14, y0 = 14;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,20,30,0.72)';
  ctx.beginPath(); ctx.roundRect(x0 - 6, y0 - 6, mw + 12, mh + 12, 8); ctx.fill();
  ctx.fillStyle = '#1d6fa8';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#69a84f';
  ctx.fillRect(x0 + LAND.x * sx, y0 + LAND.y * sy, LAND.w * sx, LAND.h * sy);
  ctx.fillStyle = '#2b8bc4';
  ctx.fillRect(x0 + LAGOON.x * sx, y0 + LAGOON.y * sy, LAGOON.w * sx, LAGOON.h * sy);
  ctx.fillRect(x0 + HARBOUR_BASIN.x * sx, y0 + HARBOUR_BASIN.y * sy, HARBOUR_BASIN.w * sx, HARBOUR_BASIN.h * sy);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
  for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + mh); ctx.stroke(); }
  for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + mw, y0 + ry * sy); ctx.stroke(); }
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(x0 + CASINO.x * sx, y0 + CASINO.y * sy, 8, 6);
  const target = missionTarget(world);
  if (target && world.started && !world.finale) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of world.police) {
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  const pl = world.player;
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath(); ctx.arc(x0 + pl.x * sx, y0 + pl.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x0 + pl.x * sx, y0 + pl.y * sy, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, world) {
  const vw = world.viewW;
  const pl = world.player;
  ctx.textAlign = 'left';
  // Top-left status block.
  ctx.fillStyle = 'rgba(10,20,30,0.66)';
  ctx.beginPath(); ctx.roundRect(12, 12, 300, 118, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${world.cash}`, 24, 40);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.fillText('★'.repeat(world.wanted) + '☆'.repeat(5 - world.wanted), 24, 66);
  ctx.fillStyle = '#fff';
  ctx.fillText(`Heat ${Math.round(world.heat)}`, 150, 66);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 74, 180, 8);
  ctx.fillStyle = world.heat > 60 ? '#ff5544' : '#ffaa33';
  ctx.fillRect(24, 74, 180 * clamp(world.heat / 100, 0, 1), 8);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`${clockString(world)}  ·  ${world.weather}  ·  ${world.started ? '' : ''}${districtName(world)}`, 24, 100);
  ctx.fillText(`HP ${Math.round(pl.hp)}`, 24, 120);
  // Objective bar.
  const obj = missionObjective(world);
  ctx.fillStyle = 'rgba(10,20,30,0.66)';
  const ow = Math.min(640, ctx.measureText(obj).width + 120);
  ctx.beginPath(); ctx.roundRect((vw - ow) / 2, 12, ow, 34, 8); ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  const job = world.finale ? 'FREE ROAM' : `JOB ${Math.min(world.missionIndex + 1, 12)}/12`;
  ctx.fillText(`${job} — ${obj}`, vw / 2, 34);
  ctx.textAlign = 'left';
  // Mission timer.
  if (world.missionTimer !== null && world.missionTimer !== undefined && !world.finale) {
    ctx.fillStyle = world.missionTimer < 15 ? '#ff5544' : '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`⏱ ${Math.ceil(world.missionTimer)}s`, 24, 160);
  }
  // Speed.
  if (pl.vehicle) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(pl.speed) * 0.24)} mph`, 24, world.viewH - 150);
  }
  // Dialogue box.
  const last = world.dialogue[world.dialogue.length - 1];
  if (last) {
    ctx.fillStyle = 'rgba(10,20,30,0.78)';
    ctx.beginPath(); ctx.roundRect(12, world.viewH - 132, Math.min(620, vw - 230), 86, 10); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(last.who, 26, world.viewH - 106);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    wrapText(ctx, last.text, 26, world.viewH - 84, Math.min(590, vw - 260), 19);
  }
  // Controls hint.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px sans-serif';
  ctx.fillText('WASD drive · E enter/exit · Space punch · Shift run · P pause · M mute · H horn · R retry', 24, world.viewH - 16);
  drawMinimap(ctx, world);
}

function districtName(world) {
  return districtAt(world.player.x, world.player.y);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW && line) { ctx.fillText(line, x, yy); line = ''; yy += lh; }
    line += w + ' ';
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawTitle(ctx, world) {
  const vw = world.viewW, vh = world.viewH;
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, '#ff9a3c'); g.addColorStop(0.55, '#c94b7c'); g.addColorStop(1, '#2b1a4a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ISLA FORTUNA', vw / 2, vh / 2 - 90);
  ctx.fillStyle = '#fff';
  ctx.font = '24px sans-serif';
  ctx.fillText('An open-world crime story — twelve jobs, one island, one last heist.', vw / 2, vh / 2 - 48);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#ffe9a8';
  const lines = [
    'Dante Reyes, getaway driver. Auntie Marisol has work for you.',
    '',
    'WASD / arrows — move & drive · E — enter a car or boat · Space — punch',
    'Shift — run · P — pause · M — mute · H — horn · R — retry a failed job',
    'Hire crew in the pause menu: 1 Mara the Driver ($400) · 2 Leo the Lookout ($350) · 3 Ada the Hacker ($600)',
    '',
    'Press ENTER to start — L loads your save',
  ];
  lines.forEach((l, i) => ctx.fillText(l, vw / 2, vh / 2 + 10 + i * 26));
  ctx.textAlign = 'left';
}

function drawPause(ctx, world) {
  const vw = world.viewW, vh = world.viewH;
  ctx.fillStyle = 'rgba(5,10,20,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 150);
  ctx.font = '18px sans-serif';
  ctx.fillText('Hire crew — press 1, 2 or 3:', vw / 2, vh / 2 - 100);
  CREW.forEach((c, i) => {
    const owned = world.crew[c.id];
    ctx.fillStyle = owned ? '#2ecc71' : '#fff';
    ctx.fillText(`${c.key}. ${c.name} — $${c.cost}${owned ? '  ✓ HIRED' : ''}`, vw / 2, vh / 2 - 66 + i * 30);
    ctx.fillStyle = '#bbb';
    ctx.font = '15px sans-serif';
    ctx.fillText(c.benefit, vw / 2, vh / 2 - 46 + i * 30);
    ctx.font = '18px sans-serif';
  });
  ctx.fillStyle = '#fff';
  ctx.fillText('P resume · S save · L load · M mute', vw / 2, vh / 2 + 50);
  ctx.textAlign = 'left';
}

function drawBusted(ctx, world) {
  const vw = world.viewW, vh = world.viewH;
  ctx.fillStyle = 'rgba(120,0,0,0.55)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('BUSTED!', vw / 2, vh / 2 - 20);
  ctx.font = '20px sans-serif';
  ctx.fillText('The police took you in. Press R to retry the job.', vw / 2, vh / 2 + 24);
  ctx.textAlign = 'left';
}

export function render(ctx, world) {
  ctx.clearRect(0, 0, world.viewW, world.viewH);
  if (!world.started) {
    drawTitle(ctx, world);
    return;
  }
  drawWorld(ctx, world);
  drawHUD(ctx, world);
  if (world.paused) drawPause(ctx, world);
  if (world.busted) drawBusted(ctx, world);
  if (world.missionFailed && !world.busted) {
    ctx.fillStyle = 'rgba(10,10,10,0.6)';
    ctx.fillRect(0, world.viewH / 2 - 50, world.viewW, 100);
    ctx.fillStyle = '#ff5544';
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('JOB FAILED — press R to retry', world.viewW / 2, world.viewH / 2 + 10);
    ctx.textAlign = 'left';
  }
}
