/**
 * Permafrost terrain: the frozen arena floor, baked once per run.
 *
 * Two layers: `base` (cracked ice plates, snow drifts, frozen boulders,
 * frost specks) and `embers` (jagged fissures of buried heat, drawn each
 * frame with alpha driven by timeScale so the ground itself glows when time
 * flows and goes dark when the world freezes).
 *
 * Baked deterministically from the run seed using the same mulberry32 the
 * sim uses — purely so each run has its own recognizable arena. This is
 * render-only cosmetic state; the sim never reads any of it.
 */
import { next } from "../sim/rng";

export class Terrain {
  private base = document.createElement("canvas");
  private embers = document.createElement("canvas");
  /** Points along ember fissures, in CSS px — mote spawn sites for the renderer. */
  fissurePoints: { x: number; y: number }[] = [];
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
    this.fissurePoints.length = 0;
    this.bakeBase(w, h, dpr);
    this.bakeEmbers(w, h, dpr);
  }

  drawBase(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.drawImage(this.base, 0, 0, w, h);
  }

  drawEmbers(ctx: CanvasRenderingContext2D, w: number, h: number, glow: number): void {
    if (glow <= 0.01) return;
    ctx.globalAlpha = Math.min(1, glow);
    ctx.drawImage(this.embers, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  private bakeBase(w: number, h: number, dpr: number): void {
    this.base.width = Math.max(1, Math.round(w * dpr));
    this.base.height = Math.max(1, Math.round(h * dpr));
    const ctx = this.base.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#0c1119");
    sky.addColorStop(1, "#0a0d13");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Broad sheens of deeper ice under the surface.
    for (let i = 0; i < 6; i++) {
      const x = this.range(0, w);
      const y = this.range(0, h);
      const r = this.range(Math.min(w, h) * 0.2, Math.min(w, h) * 0.55);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(143,180,201,0.035)");
      g.addColorStop(1, "rgba(143,180,201,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Plate cracks: jittered random walks, some of which branch once.
    const cracks = Math.min(60, Math.max(14, Math.round((w * h) / 26000)));
    for (let i = 0; i < cracks; i++) {
      this.crack(ctx, this.range(0, w), this.range(0, h), this.range(0, Math.PI * 2), Math.floor(this.range(5, 13)), true);
    }

    // Frozen boulders locked into the ice.
    const boulders = Math.floor(this.range(5, 10));
    for (let i = 0; i < boulders; i++) {
      this.boulder(ctx, this.range(20, w - 20), this.range(20, h - 20), this.range(9, 22));
    }

    // Snow drifts: soft bright patches.
    const drifts = Math.floor(this.range(8, 15));
    for (let i = 0; i < drifts; i++) {
      const x = this.range(0, w);
      const y = this.range(0, h);
      const r = this.range(40, 140);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(232,228,218,0.05)");
      g.addColorStop(1, "rgba(232,228,218,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Frost specks glinting in the surface.
    const specks = Math.round((w * h) / 9000);
    for (let i = 0; i < specks; i++) {
      ctx.fillStyle = `rgba(214,236,247,${this.range(0.05, 0.16).toFixed(3)})`;
      ctx.fillRect(this.range(0, w), this.range(0, h), 1.5, 1.5);
    }
  }

  private crack(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, segs: number, mayBranch: boolean): void {
    ctx.strokeStyle = `rgba(143,180,201,${this.range(0.05, 0.12).toFixed(3)})`;
    ctx.lineWidth = this.range(0.8, 1.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    let px = x;
    let py = y;
    for (let i = 0; i < segs; i++) {
      heading += this.range(-0.9, 0.9);
      const len = this.range(18, 55);
      px += Math.cos(heading) * len;
      py += Math.sin(heading) * len;
      ctx.lineTo(px, py);
      if (mayBranch && i === Math.floor(segs / 2) && this.rand() < 0.35) {
        const bx = px;
        const by = py;
        // Finish this stroke before recursing so styles don't interleave.
        ctx.stroke();
        this.crack(ctx, bx, by, heading + this.range(0.6, 1.4) * (this.rand() < 0.5 ? 1 : -1), Math.floor(segs / 2), false);
        ctx.beginPath();
        ctx.moveTo(bx, by);
      }
    }
    ctx.stroke();
  }

  private boulder(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
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
    ctx.fillStyle = "rgba(125,149,166,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(232,228,218,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Snow cap on the upper face.
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, r * 0.55, Math.PI, 0);
    ctx.fillStyle = "rgba(232,228,218,0.10)";
    ctx.fill();
  }

  private bakeEmbers(w: number, h: number, dpr: number): void {
    this.embers.width = Math.max(1, Math.round(w * dpr));
    this.embers.height = Math.max(1, Math.round(h * dpr));
    const ctx = this.embers.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const fissures = 3 + Math.floor((w * h) / 180000);
    for (let i = 0; i < fissures; i++) {
      const pts: { x: number; y: number }[] = [];
      let x = this.range(w * 0.08, w * 0.92);
      let y = this.range(h * 0.08, h * 0.92);
      let heading = this.range(0, Math.PI * 2);
      pts.push({ x, y });
      const segs = Math.floor(this.range(5, 11));
      for (let s = 0; s < segs; s++) {
        heading += this.range(-0.7, 0.7);
        x += Math.cos(heading) * this.range(16, 44);
        y += Math.sin(heading) * this.range(16, 44);
        pts.push({ x, y });
      }
      // Wide dim heat bloom, then the crack, then its white-hot core.
      for (const [width, color] of [
        [7, "rgba(255,122,61,0.10)"],
        [2.5, "rgba(255,122,61,0.38)"],
        [1, "rgba(255,217,168,0.75)"],
      ] as const) {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p]!.x, pts[p]!.y);
        ctx.stroke();
      }
      for (const p of pts) {
        if (p.x > 0 && p.x < w && p.y > 0 && p.y < h) this.fissurePoints.push(p);
      }
    }
  }
}
