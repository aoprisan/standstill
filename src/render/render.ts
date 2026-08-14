/**
 * Canvas2d renderer. Reads GameState + events; never writes sim state.
 * Visual randomness/time here is real-time and unseeded — outside the
 * deterministic boundary by design.
 *
 * Theme: medieval fantasy. A ruined castle hall whose floor-runes glow
 * while time flows; pixel-art mages, dragons and priests crossfade between
 * their living (hot) and time-held (cold) variants as timeScale moves.
 */
import type { GameState, SimEvent } from "../sim/types";
import { SpriteAtlas, type SpriteKey } from "./sprites";
import { Terrain } from "./terrain";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
  color: string;
}

/** Ambient atmosphere: gold sparks rise off the runes while time flows, arcane dust falls while held. */
interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
  kind: "spark" | "dust";
}

const COLORS = {
  bg: "#0e0b10",
  arcane: "#9b8fd0",
  arcaneBullet: "#b3a5e8",
  gold: "#e8b84b",
  fire: "#ff9a4d",
  blood: "#e8443a",
  parchment: "#e8e0ce",
};

/**
 * Hot/cold sprite pair per enemy, keyed on stable id so a given enemy keeps
 * its face for its whole life. Cosmetic variety only — when fire-pattern
 * archetypes land (roadmap 3), key on e.archetype instead.
 */
const ENEMY_SPRITES: [cold: SpriteKey, hot: SpriteKey][] = [
  ["mageCold", "mageHot"],
  ["dragonCold", "dragonHot"],
  ["priestCold", "priestHot"],
];

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private atlas = new SpriteAtlas();
  private terrain = new Terrain();
  private particles: Particle[] = [];
  private motes: Mote[] = [];
  private shake = 0;
  private flash = 0;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private seed = 1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas2d unavailable");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.terrain.bake(this.seed, this.W, this.H, this.dpr);
  }

  /** Re-bake the arena floor for a fresh run's seed. */
  newRun(seed: number): void {
    this.seed = seed >>> 0;
    this.terrain.bake(this.seed, this.W, this.H, this.dpr);
    this.motes.length = 0;
    this.particles.length = 0;
  }

  get size(): { w: number; h: number } {
    return { w: this.W, h: this.H };
  }

  consume(events: readonly SimEvent[]): void {
    for (const ev of events) {
      switch (ev.kind) {
        case "enemyHit":
          this.burst(ev.x, ev.y, COLORS.fire, 5, 160);
          break;
        case "enemyDied":
          this.burst(ev.x, ev.y, COLORS.gold, 22, 260);
          this.shake = Math.min(this.shake + 5, 10);
          break;
        case "playerHit":
          this.burst(ev.x, ev.y, COLORS.blood, 16, 240);
          this.flash = 0.5;
          this.shake = 12;
          break;
      }
    }
  }

  private burst(x: number, y: number, color: string, n: number, spd: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.35,
        t: 0,
        color,
      });
    }
  }

  private updateAtmosphere(ts: number, realDt: number): void {
    // Gold sparks lift off the rune circles while time flows…
    const sites = this.terrain.runePoints;
    if (ts > 0.4 && sites.length > 0 && Math.random() < realDt * 8 * ts) {
      const p = sites[(Math.random() * sites.length) | 0]!;
      this.motes.push({
        x: p.x + (Math.random() * 2 - 1) * 4,
        y: p.y,
        vx: (Math.random() * 2 - 1) * 6,
        vy: -14 - Math.random() * 22,
        life: 1.2 + Math.random() * 1.2,
        t: 0,
        kind: "spark",
      });
    }
    // …and pale arcane dust sifts down while the world is held.
    if (ts < 0.5 && Math.random() < realDt * 10 * (1 - ts)) {
      this.motes.push({
        x: Math.random() * this.W,
        y: -4,
        vx: (Math.random() * 2 - 1) * 10,
        vy: 22 + Math.random() * 26,
        life: 3 + Math.random() * 3,
        t: 0,
        kind: "dust",
      });
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i]!;
      m.t += realDt;
      if (m.t > m.life || m.y > this.H + 8) {
        this.motes.splice(i, 1);
        continue;
      }
      // Sparks belong to the world: they freeze with it. The dust is ambient.
      const flow = m.kind === "spark" ? ts : 1;
      m.x += m.vx * realDt * flow;
      m.y += m.vy * realDt * flow;
    }
  }

  draw(s: GameState, realDt: number): void {
    const ctx = this.ctx;
    const { W, H } = this;
    const ts = s.timeScale;
    const coldness = 1 - ts;
    const p = s.player;

    // particle update (real-time juice)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pa = this.particles[i]!;
      pa.t += realDt;
      if (pa.t > pa.life) {
        this.particles.splice(i, 1);
        continue;
      }
      pa.x += pa.vx * realDt;
      pa.y += pa.vy * realDt;
      pa.vx *= 0.94;
      pa.vy *= 0.94;
    }
    this.shake = Math.max(0, this.shake - realDt * 40);
    this.flash = Math.max(0, this.flash - realDt * 2);
    this.updateAtmosphere(ts, realDt);

    ctx.save();
    if (this.shake > 0.5) {
      ctx.translate((Math.random() * 2 - 1) * this.shake * 0.4, (Math.random() * 2 - 1) * this.shake * 0.4);
    }

    // castle-hall arena floor
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    this.terrain.drawBase(ctx, W, H);
    if (coldness > 0.02) {
      ctx.fillStyle = `rgba(84,72,120,${0.1 * coldness})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    // carved magic: rune circles glow with time flow, flicker like candleflame
    const flicker = 0.9 + 0.1 * Math.sin(performance.now() * 0.013);
    this.terrain.drawRunes(ctx, W, H, 0.12 + 0.75 * ts * flicker);

    // ambient motes
    for (const m of this.motes) {
      const fade = 1 - m.t / m.life;
      if (m.kind === "spark") {
        ctx.globalAlpha = fade * 0.8;
        ctx.fillStyle = COLORS.gold;
        ctx.fillRect(m.x - 1, m.y - 1, 2, 2);
      } else {
        ctx.globalAlpha = fade * 0.5;
        ctx.fillStyle = COLORS.arcaneBullet;
        ctx.fillRect(m.x - 1, m.y - 1, 1.5, 1.5);
      }
    }
    ctx.globalAlpha = 1;

    // held-time trajectory ghosts
    if (coldness > 0.3) {
      ctx.strokeStyle = `rgba(155,143,208,${0.35 * coldness})`;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      for (const b of s.eBullets) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + b.vx * 0.55, b.y + b.vy * 0.55);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // enemy bullets (binary hot/cold swap — these are the hot path)
    const orbKey = ts > 0.5 ? "orbFire" : "orbArcane";
    const orbHalo = ts > 0.5 ? "rgba(255,122,61,0.35)" : "rgba(159,143,208,0.3)";
    ctx.strokeStyle = orbHalo;
    ctx.lineWidth = 1;
    for (const b of s.eBullets) {
      this.atlas.draw(ctx, orbKey, b.x, b.y, b.r);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // player bullets
    for (const b of s.pBullets) {
      this.atlas.draw(ctx, "boltSteel", b.x, b.y, b.r);
    }

    // enemies — mages, dragons and priests, crossfading living over held
    for (const e of s.enemies) {
      const rot = e.wob * 0.5;
      const [cold, hot] = ENEMY_SPRITES[e.id % ENEMY_SPRITES.length]!;
      this.atlas.draw(ctx, cold, e.x, e.y, e.r, rot);
      if (ts > 0.02) {
        ctx.globalAlpha = ts;
        this.atlas.draw(ctx, hot, e.x, e.y, e.r, rot);
        ctx.globalAlpha = 1;
      }
    }

    // particles
    for (const pa of this.particles) {
      ctx.globalAlpha = 1 - pa.t / pa.life;
      ctx.fillStyle = pa.color;
      ctx.fillRect(pa.x - 2, pa.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // player — the knight, heart-core crossfading gilt/arcane
    const blink = p.iframes > 0 && Math.floor(p.iframes * 12) % 2 === 0;
    if (!blink) {
      this.atlas.draw(ctx, "knightCold", p.x, p.y, p.r);
      if (ts > 0.02) {
        ctx.globalAlpha = ts;
        this.atlas.draw(ctx, "knightHot", p.x, p.y, p.r);
        ctx.globalAlpha = 1;
      }
      if (ts > 0.5 && s.phase === "playing") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 6 + Math.sin(performance.now() * 0.01) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(232,184,75,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(232,68,58,${this.flash * 0.35})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    if (coldness > 0.05) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(155,143,208,0)");
      vg.addColorStop(1, `rgba(94,82,140,${0.28 * coldness})`);
      ctx.fillStyle = vg;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    ctx.restore();
  }
}
