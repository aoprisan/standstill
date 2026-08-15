/**
 * The deterministic core. Pure over GameState + InputFrame.
 * No browser APIs, no Math.random, no wall clock. See CLAUDE.md invariants.
 */
import { DT, type GameState, type InputFrame, type Enemy } from "./types";
import { range } from "./rng";
import { ENEMIES } from "../data/enemies";
import { offersDraft, PICKS_PER_DRAFT, waveDef, WAVE_CLEAR_DELAY } from "../data/waves";
import { levelForWave, TOTAL_WAVES } from "../data/levels";
import { applyUpgrade, DRAFT_SIZE, UPGRADE_BY_ID, UPGRADES } from "../data/upgrades";

// Feel constants — tuned on device, change deliberately (see CLAUDE.md).
const FREEZE_SNAP = 1 - Math.pow(0.0001, DT);
/** Seconds of flowing time to reload one bullet-steal charge. */
const STEAL_RECHARGE_S = 1.5;
const DRAG_AMP = 1.15; // applied in input layer; documented here for reference
void DRAG_AMP;

export function createState(seed: number, arenaW: number, arenaH: number): GameState {
  return {
    rng: seed >>> 0,
    tickCount: 0,
    arenaW,
    arenaH,
    phase: "playing",
    level: 0,
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
      spread: 0,
      spreadGap: 0.16,
      pierce: 0,
      stealR: 14,
      stealMax: 0,
      stealCharge: 0,
      stealRechargeT: 0,
    },
    enemies: [],
    eBullets: [],
    pBullets: [],
    nextEnemyId: 1,
    draft: [],
    draftPicks: 0,
    taken: [],
    events: [],
  };
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Intercept aim: the angle to fire at so a bullet meets where the target is
 * going, not where it was. The player never controls aim in a one-thumb game,
 * so without leading, tangential orbiters simply outrun every shot — measured
 * at a 5% hit rate before this existed. Two fixed-point iterations converge
 * well inside a pixel at these speeds, and cost nothing per tick.
 */
function interceptAngle(px: number, py: number, e: Enemy, speed: number): number {
  let t = Math.hypot(e.x - px, e.y - py) / speed;
  for (let i = 0; i < 2; i++) {
    t = Math.hypot(e.x + e.vx * t - px, e.y + e.vy * t - py) / speed;
  }
  return Math.atan2(e.y + e.vy * t - py, e.x + e.vx * t - px);
}

function spawnWave(s: GameState, wave: number): void {
  s.wave = wave;
  // Crossing into a new level: announce it (the renderer re-bakes terrain on
  // this event) and grant a one-heart respite — a campaign asks you to arrive
  // somewhere, and arriving should feel like reaching shelter. Perks carry
  // over by construction: the state simply persists across the boundary.
  const level = levelForWave(wave);
  if (level !== s.level) {
    s.level = level;
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + 1);
    s.events.push({ kind: "levelStarted", level });
  }
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
        vx: 0,
        vy: 0,
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

function stacksOf(s: GameState, id: string): number {
  let n = 0;
  for (const t of s.taken) if (t === id) n++;
  return n;
}

/**
 * Offer DRAFT_SIZE distinct upgrades, skipping any already at max stacks.
 * Partial Fisher-Yates over the seeded PRNG, so a seed replays its own draft.
 */
function rollDraft(s: GameState): string[] {
  const pool = UPGRADES.filter((u) => stacksOf(s, u.id) < u.maxStacks);
  const out: string[] = [];
  const n = Math.min(DRAFT_SIZE, pool.length);
  for (let k = 0; k < n; k++) {
    let v: number;
    [v, s.rng] = range(s.rng, k, pool.length);
    const j = Math.min(pool.length - 1, Math.floor(v));
    const tmp = pool[k]!;
    pool[k] = pool[j]!;
    pool[j] = tmp;
    out.push(pool[k]!.id);
  }
  return out;
}

/**
 * On a draft wave the world holds still and the player chooses. Time is fully
 * stopped here — no movement, no fire, no incoming — so the choice is never
 * made under duress. A draft grants PICKS_PER_DRAFT picks, resolved one offer
 * at a time; the next wave spawns when the last one is spent.
 */
function tickDraft(s: GameState, input: InputFrame): void {
  const sel = input.select;
  if (sel === undefined || sel < 0 || sel >= s.draft.length) return;
  const def = UPGRADE_BY_ID[s.draft[sel]!];
  if (def) {
    applyUpgrade(s.player, def);
    s.taken.push(def.id);
    s.events.push({ kind: "upgradeTaken", id: def.id });
  }
  s.draftPicks--;
  // Re-roll rather than offer the leftovers: the pick just made may have maxed
  // a stack, and a fresh spread keeps the second choice a real question.
  const next = s.draftPicks > 0 ? rollDraft(s) : [];
  if (next.length > 0) {
    s.draft = next;
    s.events.push({ kind: "draftOffered", options: next.slice(), remaining: s.draftPicks });
    return;
  }
  s.draftPicks = 0;
  s.draft = [];
  s.phase = "playing";
  spawnWave(s, s.wave + 1);
}

/** Advance the simulation by exactly one fixed step. */
export function tick(s: GameState, input: InputFrame): void {
  s.events.length = 0;
  if (s.phase === "dead" || s.phase === "victory") return;
  if (s.phase === "drafting") {
    tickDraft(s, input);
    return;
  }
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
      const a = interceptAngle(p.x, p.y, best, p.bulletSpeed);
      const count = 1 + p.spread;
      const half = (count - 1) / 2;
      for (let i = 0; i < count; i++) {
        const ang = a + (i - half) * p.spreadGap;
        s.pBullets.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * p.bulletSpeed,
          vy: Math.sin(ang) * p.bulletSpeed,
          r: 4,
          pierce: p.pierce,
          hitId: 0,
        });
      }
      p.fireCd = p.fireCooldown;
    }
  }

  // -- bullet-steal: the freeze becomes offence, but only on credit.
  //
  // Charges are spent while frozen and reloaded ONLY while time flows, so the
  // ability is paid for in the vulnerable state it rewards you for leaving.
  // Without that loop it was strictly better to live on ice: freezing simply
  // deleted every threat within reach, and the bots went 100% stall / 14% still
  // — the mechanic inverted.
  if (p.stealMax > 0 && ts > 0.5 && p.stealCharge < p.stealMax) {
    p.stealRechargeT += DT * ts;
    if (p.stealRechargeT >= STEAL_RECHARGE_S) {
      p.stealRechargeT = 0;
      p.stealCharge++;
    }
  }
  if (p.stealMax > 0 && p.stealCharge > 0 && ts < 0.5) {
    for (let i = s.eBullets.length - 1; i >= 0 && p.stealCharge > 0; i--) {
      const b = s.eBullets[i]!;
      if (dist2(b.x, b.y, p.x, p.y) >= p.stealR * p.stealR) continue;
      p.stealCharge--;
      s.eBullets.splice(i, 1);
      let best: Enemy | null = null;
      let bd = Infinity;
      for (const e of s.enemies) {
        const d = dist2(b.x, b.y, e.x, e.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      const a = best ? interceptAngle(b.x, b.y, best, p.bulletSpeed) : -Math.PI / 2;
      s.pBullets.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(a) * p.bulletSpeed,
        vy: Math.sin(a) * p.bulletSpeed,
        r: b.r,
        pierce: p.pierce,
        hitId: 0,
      });
      s.events.push({ kind: "bulletStolen", x: b.x, y: b.y });
    }
  }

  // -- enemies (scaled by ts)
  for (const e of s.enemies) {
    const proto = ENEMIES[e.archetype];
    if (!proto) continue;
    e.wob += DT * ts * proto.wobRate;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    // Shared steering model — seek the orbit ring, slide along it, wobble —
    // with the gains coming from data, so archetypes differ without branching.
    const radial = (d - e.orbitR) * proto.radialGain;
    const tx = (-dy / d) * e.orbitDir;
    const tyv = (dx / d) * e.orbitDir;
    // Velocity is stored in px/s so intercept aim stays correct while frozen.
    e.vx = (dx / d) * radial + tx * proto.tangential + Math.cos(e.wob) * proto.wobAmp;
    e.vy = (dy / d) * radial + tyv * proto.tangential + Math.sin(e.wob) * proto.wobAmp;
    // The arena walls everyone. Without this, wide-orbit archetypes (snipers)
    // settle outside the playfield, where the cull margin eats both their
    // shots and yours — an invisible turret no one can kill, a stalled wave.
    // The wall also zeroes the outward velocity component: intercept aim
    // leads targets by e.vx/e.vy, and a pinned body with phantom steering
    // velocity would be unhittable.
    e.x += e.vx * DT * ts;
    e.y += e.vy * DT * ts;
    if (e.x < e.r) {
      e.x = e.r;
      e.vx = Math.max(0, e.vx);
    } else if (e.x > s.arenaW - e.r) {
      e.x = s.arenaW - e.r;
      e.vx = Math.min(0, e.vx);
    }
    if (e.y < e.r) {
      e.y = e.r;
      e.vy = Math.max(0, e.vy);
    } else if (e.y > s.arenaH - e.r) {
      e.y = s.arenaH - e.r;
      e.vy = Math.min(0, e.vy);
    }

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
          pierce: 0,
          hitId: 0,
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
      if (e.id === b.hitId) continue; // already punched through this one
      const rr = b.r + e.r;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        e.hp--;
        s.events.push({ kind: "enemyHit", x: b.x, y: b.y });
        if (e.hp <= 0) {
          s.events.push({ kind: "enemyDied", x: e.x, y: e.y });
          s.enemies.splice(j, 1);
        }
        if (b.pierce > 0) {
          b.pierce--;
          b.hitId = e.id;
        } else {
          s.pBullets.splice(i, 1);
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
      // Clearing the final wave of the final level ends the campaign.
      if (s.wave >= TOTAL_WAVES) {
        s.phase = "victory";
        s.events.push({ kind: "victory", wave: s.wave });
        return;
      }
      // Most waves roll straight into the next one; only the level-boundary
      // waves stop the run to ask a question (see offersDraft).
      s.draftPicks = offersDraft(s.wave) ? PICKS_PER_DRAFT : 0;
      s.draft = s.draftPicks > 0 ? rollDraft(s) : [];
      if (s.draft.length > 0) {
        s.phase = "drafting";
        s.events.push({ kind: "draftOffered", options: s.draft.slice(), remaining: s.draftPicks });
      } else {
        s.draftPicks = 0;
        spawnWave(s, s.wave + 1);
      }
    }
  }
}
