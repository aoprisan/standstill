/**
 * Canvas2d renderer. Reads GameState + events; never writes sim state.
 * Visual randomness/time here is real-time and unseeded — outside the
 * deterministic boundary by design.
 */
import type { GameState, SimEvent } from "../sim/types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
  color: string;
}

const COLORS = {
  bg: "#0b0d12",
  ice: "#8fb4c9",
  iceBullet: "#a9cfe0",
  ember: "#ff7a3d",
  blood: "#e8443a",
  bone: "#e8e4da",
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private shake = 0;
  private flash = 0;
  private W = 0;
  private H = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas2d unavailable");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get size(): { w: number; h: number } {
    return { w: this.W, h: this.H };
  }

  consume(events: readonly SimEvent[]): void {
    for (const ev of events) {
      switch (ev.kind) {
        case "enemyHit":
          this.burst(ev.x, ev.y, COLORS.ember, 5, 160);
          break;
        case "enemyDied":
          this.burst(ev.x, ev.y, COLORS.ember, 22, 260);
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

    ctx.save();
    if (this.shake > 0.5) {
      ctx.translate((Math.random() * 2 - 1) * this.shake * 0.4, (Math.random() * 2 - 1) * this.shake * 0.4);
    }

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    if (coldness > 0.02) {
      ctx.fillStyle = `rgba(66,95,116,${0.1 * coldness})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    // drifting floor grid (moves only when time flows)
    ctx.strokeStyle = "rgba(143,180,201,0.05)";
    ctx.lineWidth = 1;
    const g = 56;
    const off = (performance.now() * 0.006 * ts) % g;
    ctx.beginPath();
    for (let x = -off; x < W; x += g) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = -off; y < H; y += g) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    // frozen trajectory ghosts
    if (coldness > 0.3) {
      ctx.strokeStyle = `rgba(143,180,201,${0.35 * coldness})`;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      for (const b of s.eBullets) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + b.vx * 0.55, b.y + b.vy * 0.55);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // enemy bullets
    for (const b of s.eBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = ts > 0.5 ? COLORS.blood : COLORS.iceBullet;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = ts > 0.5 ? "rgba(232,68,58,0.35)" : "rgba(169,207,224,0.3)";
      ctx.stroke();
    }

    // player bullets
    ctx.fillStyle = COLORS.ember;
    for (const b of s.pBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // enemies — diamond shards
    for (const e of s.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.wob * 0.5);
      ctx.beginPath();
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, 0);
      ctx.lineTo(0, e.r);
      ctx.lineTo(-e.r, 0);
      ctx.closePath();
      ctx.fillStyle = ts > 0.5 ? "#c2453c" : "#7d95a6";
      ctx.fill();
      ctx.strokeStyle = "rgba(232,228,218,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // particles
    for (const pa of this.particles) {
      ctx.globalAlpha = 1 - pa.t / pa.life;
      ctx.fillStyle = pa.color;
      ctx.fillRect(pa.x - 2, pa.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // player
    const blink = p.iframes > 0 && Math.floor(p.iframes * 12) % 2 === 0;
    if (!blink) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.bone;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = ts > 0.5 ? COLORS.ember : COLORS.ice;
      ctx.fill();
      if (ts > 0.5 && s.phase === "playing") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 6 + Math.sin(performance.now() * 0.01) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,122,61,0.5)";
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
      vg.addColorStop(0, "rgba(143,180,201,0)");
      vg.addColorStop(1, `rgba(70,100,125,${0.28 * coldness})`);
      ctx.fillStyle = vg;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    ctx.restore();
  }
}
