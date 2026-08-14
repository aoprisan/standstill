/**
 * Castle-hall terrain: the flagstone arena floor, baked once per run.
 *
 * Two layers: `base` (jointed flagstone slabs, moss patches, fallen masonry,
 * strewn dust) and `runes` (arcane circles carved into the floor, drawn each
 * frame with alpha driven by timeScale so the ground itself glows when time
 * flows and goes dark when the world is held).
 *
 * Baked deterministically from the run seed using the same mulberry32 the
 * sim uses — purely so each run has its own recognizable arena. This is
 * render-only cosmetic state; the sim never reads any of it.
 */
import { next } from "../sim/rng";

export class Terrain {
  private base = document.createElement("canvas");
  private runes = document.createElement("canvas");
  /** Points along the rune circles, in CSS px — mote spawn sites for the renderer. */
  runePoints: { x: number; y: number }[] = [];
  private rng = 1;

  private rand(): number {
    const [v, s] = next(this.rng);
    this.rng = s;
    return v;
  }

  private range(a: number, b: number): number {
    return a + this.rand() * (b - a);
  }

  bake(seed: number, w: number, h: number, dpr: number): void {
    // Offset the seed so terrain doesn't mirror the sim's first rolls.
    this.rng = (seed ^ 0x9e3779b9) >>> 0;
    this.runePoints.length = 0;
    this.bakeBase(w, h, dpr);
    this.bakeRunes(w, h, dpr);
  }

  drawBase(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.drawImage(this.base, 0, 0, w, h);
  }

  drawRunes(ctx: CanvasRenderingContext2D, w: number, h: number, glow: number): void {
    if (glow <= 0.01) return;
    ctx.globalAlpha = Math.min(1, glow);
    ctx.drawImage(this.runes, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  private bakeBase(w: number, h: number, dpr: number): void {
    this.base.width = Math.max(1, Math.round(w * dpr));
    this.base.height = Math.max(1, Math.round(h * dpr));
    const ctx = this.base.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const dusk = ctx.createLinearGradient(0, 0, 0, h);
    dusk.addColorStop(0, "#141018");
    dusk.addColorStop(1, "#0e0b10");
    ctx.fillStyle = dusk;
    ctx.fillRect(0, 0, w, h);

    // Broad pools of torchless gloom and faint warm sheen.
    for (let i = 0; i < 6; i++) {
      const x = this.range(0, w);
      const y = this.range(0, h);
      const r = this.range(Math.min(w, h) * 0.2, Math.min(w, h) * 0.55);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(201,185,138,0.03)");
      g.addColorStop(1, "rgba(201,185,138,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Flagstone slabs: jittered courses with staggered joints.
    let y = -this.range(0, 40);
    while (y < h + 50) {
      const rowH = this.range(38, 56);
      this.mortarLine(ctx, 0, y + rowH, w, y + rowH, true);
      let x = -this.range(0, 60);
      while (x < w + 60) {
        const slabW = this.range(46, 88);
        this.mortarLine(ctx, x + slabW, y, x + slabW, y + rowH, false);
        // Some slabs sit a shade lighter or darker than their neighbours.
        const roll = this.rand();
        if (roll < 0.3) {
          ctx.fillStyle = roll < 0.15 ? "rgba(232,224,206,0.03)" : "rgba(0,0,0,0.12)";
          ctx.fillRect(x, y, slabW, rowH);
        }
        x += slabW;
      }
      y += rowH;
    }

    // Fallen masonry blocks from the ruined walls.
    const blocks = Math.floor(this.range(5, 10));
    for (let i = 0; i < blocks; i++) {
      this.masonry(ctx, this.range(20, w - 20), this.range(20, h - 20), this.range(9, 22));
    }

    // Moss creeping across the stones.
    const moss = Math.floor(this.range(8, 15));
    for (let i = 0; i < moss; i++) {
      const x = this.range(0, w);
      const my = this.range(0, h);
      const r = this.range(40, 140);
      const g = ctx.createRadialGradient(x, my, 0, x, my, r);
      g.addColorStop(0, "rgba(96,128,68,0.05)");
      g.addColorStop(1, "rgba(96,128,68,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, my - r, r * 2, r * 2);
    }

    // Strewn dust and straw catching what light there is.
    const specks = Math.round((w * h) / 9000);
    for (let i = 0; i < specks; i++) {
      ctx.fillStyle = `rgba(232,224,206,${this.range(0.04, 0.12).toFixed(3)})`;
      ctx.fillRect(this.range(0, w), this.range(0, h), 1.5, 1.5);
    }
  }

  private mortarLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, horizontal: boolean): void {
    ctx.strokeStyle = `rgba(0,0,0,${this.range(0.18, 0.32).toFixed(3)})`;
    ctx.lineWidth = this.range(1, 2);
    ctx.beginPath();
    if (horizontal) {
      // Long joints wander slightly, as hand-laid courses do.
      ctx.moveTo(x0, y0 + this.range(-1.5, 1.5));
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        ctx.lineTo(x0 + ((x1 - x0) * i) / steps, y1 + this.range(-1.5, 1.5));
      }
    } else {
      ctx.moveTo(x0 + this.range(-1, 1), y0);
      ctx.lineTo(x1 + this.range(-1, 1), y1);
    }
    ctx.stroke();
  }

  private masonry(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    const verts = Math.floor(this.range(5, 8));
    ctx.beginPath();
    for (let i = 0; i < verts; i++) {
      const a = (i / verts) * Math.PI * 2 + this.range(-0.25, 0.25);
      const rr = r * this.range(0.7, 1.15);
      const vx = x + Math.cos(a) * rr;
      const vy = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(122,112,98,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(232,224,206,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Moss cap on the upper face.
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, r * 0.55, Math.PI, 0);
    ctx.fillStyle = "rgba(96,128,68,0.12)";
    ctx.fill();
  }

  private bakeRunes(w: number, h: number, dpr: number): void {
    this.runes.width = Math.max(1, Math.round(w * dpr));
    this.runes.height = Math.max(1, Math.round(h * dpr));
    const ctx = this.runes.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const circles = 3 + Math.floor((w * h) / 180000);
    for (let i = 0; i < circles; i++) {
      const cx = this.range(w * 0.1, w * 0.9);
      const cy = this.range(h * 0.1, h * 0.9);
      const cr = this.range(16, 34);

      // Glyph strokes inside the ring — chords and radial ticks. Geometry is
      // rolled once so every glow pass traces the same carved lines.
      const glyphs: [number, number, number, number][] = [];
      let ga = this.range(0, Math.PI * 2);
      for (let gi = 0; gi < 3 + (i % 3); gi++) {
        ga += this.range(0.8, 2.2);
        const a2 = ga + this.range(1.2, 2.6);
        const inner = this.range(0.4, 1);
        glyphs.push([
          cx + Math.cos(ga) * cr,
          cy + Math.sin(ga) * cr,
          cx + Math.cos(a2) * cr * inner,
          cy + Math.sin(a2) * cr * inner,
        ]);
      }

      // Each pass: wide dim bloom, then the carved line, then its bright core.
      for (const [width, color] of [
        [7, "rgba(232,184,75,0.10)"],
        [2.5, "rgba(232,184,75,0.38)"],
        [1, "rgba(255,242,196,0.75)"],
      ] as const) {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        for (const [x0, y0, x1, y1] of glyphs) {
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
        }
        ctx.stroke();
      }

      // Spawn sites for rising gold motes, spaced around the ring.
      const sites = 6;
      for (let s = 0; s < sites; s++) {
        const a = (s / sites) * Math.PI * 2 + this.range(-0.3, 0.3);
        const px = cx + Math.cos(a) * cr;
        const py = cy + Math.sin(a) * cr;
        if (px > 0 && px < w && py > 0 && py < h) this.runePoints.push({ x: px, y: py });
      }
    }
  }
}
