/**
 * The deterministic core. Pure over GameState + InputFrame.
 * No browser APIs, no Math.random, no wall clock. See CLAUDE.md invariants.
 */
import { DT, type GameState, type InputFrame, type Enemy } from "./types";
import { range } from "./rng";
import { ENEMIES } from "../data/enemies";
import { waveDef, WAVE_CLEAR_DELAY } from "../data/waves";

// Feel constants — tuned on device, change deliberately (see CLAUDE.md).
const FREEZE_SNAP = 1 - Math.pow(0.0001, DT);
const DRAG_AMP = 1.15; // applied in input layer; documented here for reference
void DRAG_AMP;

export function createState(seed: number, arenaW: number, arenaH: number): GameState {
  return {
    rng: seed >>> 0,
    tickCount: 0,
    arenaW,
    arenaH,
    phase: "playing",
    wave: 0,
    waveClearT: 0,
    timeScale: 1,
    player: {
      x: arenaW / 2,
      y: arenaH * 0.7,
      r: 11,
      hp: 3,
      maxHp: 3,
      iframes: 0,
      fireCd: 0,
      fireCooldown: 0.22,
      bulletSpeed: 520,
    },
    enemies: [],
    eBullets: [],
    pBullets: [],
    nextEnemyId: 1,
    events: [],
  };
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function spawnWave(s: GameState, wave: number): void {
  s.wave = wave;
  const def = waveDef(wave);
  for (const spawn of def.spawns) {
    const proto = ENEMIES[spawn.archetype];
    if (!proto) continue;
    for (let i = 0; i < spawn.count; i++) {
      // Rejection-sample a spawn point outside a 200px bubble around the player.
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 16; tries++) {
        let v: number;
        [v, s.rng] = range(s.rng, 0, 4);
        const side = Math.floor(v);
        let rx: number;
        let ry: number;
        [rx, s.rng] = range(s.rng, 0, s.arenaW);
        [ry, s.rng] = range(s.rng, 0, s.arenaH * 0.6);
        x = side === 0 ? -30 : side === 1 ? s.arenaW + 30 : rx;
        y = side === 2 ? -30 : side === 3 ? s.arenaH + 30 : ry;
        if (dist2(x, y, s.player.x, s.player.y) >= 200 * 200) break;
      }
      let fireCd: number;
      [fireCd, s.rng] = range(s.rng, 1.0, 2.2);
      let dirRoll: number;
      [dirRoll, s.rng] = range(s.rng, 0, 1);
      let orbitR: number;
      [orbitR, s.rng] = range(s.rng, proto.orbitRMin, proto.orbitRMax);
      let wob: number;
      [wob, s.rng] = range(s.rng, 0, Math.PI * 2);
      const e: Enemy = {
        id: s.nextEnemyId++,
        archetype: proto.archetype,
        x,
        y,
        r: proto.r,
        hp: proto.baseHp + Math.floor(wave / 3) * proto.hpScale,
        fireCd,
        orbitDir: dirRoll < 0.5 ? 1 : -1,
        orbitR,
        wob,
      };
      s.enemies.push(e);
    }
  }
  s.events.push({ kind: "waveStarted", wave });
}

/** Advance the simulation by exactly one fixed step. */
export function tick(s: GameState, input: InputFrame): void {
  s.events.length = 0;
  if (s.phase !== "playing") return;
  s.tickCount++;

  const p = s.player;

  // -- THE MECHANIC: moving freezes the world; stillness lets time flow.
  const target = input.moving ? 0 : 1;
  s.timeScale += (target - s.timeScale) * FREEZE_SNAP;
  if (Math.abs(s.timeScale - target) < 0.01) s.timeScale = target;
  const ts = s.timeScale;

  // -- player movement (always real time)
  p.x = clamp(p.x + input.mx, p.r, s.arenaW - p.r);
  p.y = clamp(p.y + input.my, p.r, s.arenaH - p.r);
  if (p.iframes > 0) p.iframes -= DT;
  if (p.fireCd > 0) p.fireCd -= DT * ts;

  // -- bootstrap first wave
  if (s.wave === 0) spawnWave(s, 1);

  // -- player auto-fire at nearest enemy (only while time flows)
  if (ts > 0.5 && s.enemies.length > 0 && p.fireCd <= 0) {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of s.enemies) {
      const d = dist2(p.x, p.y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) {
      const a = Math.atan2(best.y - p.y, best.x - p.x);
      s.pBullets.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * p.bulletSpeed,
        vy: Math.sin(a) * p.bulletSpeed,
        r: 4,
      });
      p.fireCd = p.fireCooldown;
    }
  }

  // -- enemies (scaled by ts)
  for (const e of s.enemies) {
    const proto = ENEMIES[e.archetype];
    if (!proto) continue;
    e.wob += DT * ts * 2;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const radial = (d - e.orbitR) * 0.9;
    const tx = (-dy / d) * e.orbitDir;
    const tyv = (dx / d) * e.orbitDir;
    e.x += ((dx / d) * radial * 0.9 + tx * 70 + Math.cos(e.wob) * 20) * DT * ts;
    e.y += ((dy / d) * radial * 0.9 + tyv * 70 + Math.sin(e.wob) * 20) * DT * ts;

    e.fireCd -= DT * ts;
    if (e.fireCd <= 0) {
      [e.fireCd, s.rng] = range(s.rng, proto.fireCdMin, proto.fireCdMax);
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      const half = (proto.spreadCount - 1) / 2;
      for (let i = 0; i < proto.spreadCount; i++) {
        const a = base + (i - half) * proto.spreadGap;
        s.eBullets.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * proto.bulletSpeed,
          vy: Math.sin(a) * proto.bulletSpeed,
          r: proto.bulletR,
        });
      }
    }
  }

  // -- player bullets vs enemies
  const margin = 20;
  for (let i = s.pBullets.length - 1; i >= 0; i--) {
    const b = s.pBullets[i]!;
    b.x += b.vx * DT * ts;
    b.y += b.vy * DT * ts;
    if (b.x < -margin || b.x > s.arenaW + margin || b.y < -margin || b.y > s.arenaH + margin) {
      s.pBullets.splice(i, 1);
      continue;
    }
    for (let j = s.enemies.length - 1; j >= 0; j--) {
      const e = s.enemies[j]!;
      const rr = b.r + e.r;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        s.pBullets.splice(i, 1);
        e.hp--;
        s.events.push({ kind: "enemyHit", x: b.x, y: b.y });
        if (e.hp <= 0) {
          s.events.push({ kind: "enemyDied", x: e.x, y: e.y });
          s.enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  // -- enemy bullets vs player
  // Collision stays live even while frozen: you can walk into a frozen bullet.
  // That is the dodge-maze tension — do not "fix" it.
  for (let i = s.eBullets.length - 1; i >= 0; i--) {
    const b = s.eBullets[i]!;
    b.x += b.vx * DT * ts;
    b.y += b.vy * DT * ts;
    if (b.x < -margin || b.x > s.arenaW + margin || b.y < -margin || b.y > s.arenaH + margin) {
      s.eBullets.splice(i, 1);
      continue;
    }
    const rr = b.r + p.r;
    if (p.iframes <= 0 && dist2(b.x, b.y, p.x, p.y) < rr * rr) {
      s.eBullets.splice(i, 1);
      p.hp--;
      p.iframes = 1.1;
      s.events.push({ kind: "playerHit", x: p.x, y: p.y });
      if (p.hp <= 0) {
        s.phase = "dead";
        s.events.push({ kind: "gameOver", wave: s.wave });
        return;
      }
    }
  }

  // -- wave clear
  if (s.enemies.length === 0 && s.wave > 0) {
    s.waveClearT += DT;
    if (s.waveClearT > WAVE_CLEAR_DELAY) {
      s.waveClearT = 0;
      spawnWave(s, s.wave + 1);
    }
  }
}
