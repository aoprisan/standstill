/**
 * Warcraft-style battlefield terrain, baked once per campaign level.
 *
 * Two layers: `base` (a mottled ground tilemap with blobby clearings, a
 * treeline hugging the screen border, scattered rocks and flora — the
 * classic RTS map look) and `runes` (gold circles of power inlaid in the
 * ground, drawn each frame with alpha driven by timeScale so the ground
 * itself glows when time flows and goes dark when the world is held).
 *
 * Every color comes from a TerrainTheme, one per campaign level (see
 * src/data/levels.ts for which level uses which): the same bake produces a
 * summer greenwood, an ash waste, a frozen march, a blighted fen or an
 * obsidian citadel purely by palette. The runes stay gold everywhere —
 * their glow means "time flows", and that meaning should not change color
 * per level.
 *
 * Baked deterministically from the run seed using the same mulberry32 the
 * sim uses — purely so each run has its own recognizable battlefield. This
 * is render-only cosmetic state; the sim never reads any of it.
 */
import { next } from "../sim/rng";

/** CSS px per terrain tile. */
const TILE = 26;

/** Palette for one campaign level's battlefield. Render-only. */
export interface TerrainTheme {
  /** Renderer clear color behind the baked tiles. */
  bg: string;
  /** Main ground tile and clearing-blob tile, as rgb triples for tinting. */
  ground: [number, number, number];
  clearing: [number, number, number];
  /** Per-tile speckles, [light, dark]. */
  groundSpecks: [string, string];
  clearingSpecks: [string, string];
  /** Worn lip where clearing meets ground. */
  edge: string;
  /** Small flora dots on the ground, two variants, plus their stem. */
  flora: [string, string];
  floraStem: string;
  rock: string;
  rockLine: string;
  rockLit: string;
  treeShadow: string;
  trunk: string;
  canopy: string;
  canopyLine: string;
  canopyLit: string;
}

export const THEMES: Record<string, TerrainTheme> = {
  // The summer overworld the game shipped with.
  greenwood: {
    bg: "#1c3a12",
    ground: [0x37, 0x77, 0x24],
    clearing: [0x8a, 0x62, 0x34],
    groundSpecks: ["rgba(120,190,70,0.5)", "rgba(24,70,18,0.55)"],
    clearingSpecks: ["rgba(196,150,90,0.5)", "rgba(74,50,26,0.55)"],
    edge: "rgba(40,28,14,0.45)",
    flora: ["#e8d84a", "#e07888"],
    floraStem: "rgba(24,70,18,0.6)",
    rock: "#787a72",
    rockLine: "rgba(20,16,12,0.7)",
    rockLit: "rgba(200,202,192,0.5)",
    treeShadow: "rgba(12,24,8,0.4)",
    trunk: "#5a3a1e",
    canopy: "#1d4d14",
    canopyLine: "rgba(10,20,6,0.8)",
    canopyLit: "#2f7a1f",
  },
  // Scorched soil, char clearings, ember flora, burnt trees.
  ash: {
    bg: "#241d16",
    ground: [0x5c, 0x4c, 0x3e],
    clearing: [0x33, 0x27, 0x20],
    groundSpecks: ["rgba(150,128,104,0.5)", "rgba(40,30,24,0.55)"],
    clearingSpecks: ["rgba(232,122,58,0.45)", "rgba(20,14,10,0.6)"],
    edge: "rgba(16,10,8,0.5)",
    flora: ["#e88a3a", "#d84a2a"],
    floraStem: "rgba(30,20,14,0.6)",
    rock: "#6a6058",
    rockLine: "rgba(14,10,8,0.7)",
    rockLit: "rgba(190,170,150,0.45)",
    treeShadow: "rgba(10,6,4,0.4)",
    trunk: "#2c2018",
    canopy: "#3a322a",
    canopyLine: "rgba(12,8,6,0.8)",
    canopyLit: "#55483a",
  },
  // Snowfield over frozen-lake clearings, snow-capped pines.
  frost: {
    bg: "#1e2c3c",
    // Kept dimmer than real snow: frozen-state bullets are pale blue, and
    // they must stay readable against the ground.
    ground: [0x74, 0x86, 0x9c],
    clearing: [0x44, 0x5e, 0x7c],
    groundSpecks: ["rgba(235,245,255,0.55)", "rgba(90,110,140,0.5)"],
    clearingSpecks: ["rgba(200,230,255,0.5)", "rgba(40,60,90,0.55)"],
    edge: "rgba(30,45,70,0.45)",
    flora: ["#dff2ff", "#9cc8e8"],
    floraStem: "rgba(60,80,110,0.6)",
    rock: "#8c94a0",
    rockLine: "rgba(20,26,36,0.7)",
    rockLit: "rgba(230,240,250,0.55)",
    treeShadow: "rgba(8,14,22,0.4)",
    trunk: "#4a3524",
    canopy: "#1e4438",
    canopyLine: "rgba(6,16,14,0.8)",
    canopyLit: "#e2eef6",
  },
  // Murk moss, black-water pools, blight mushrooms, violet canopies.
  fen: {
    bg: "#171d12",
    ground: [0x3e, 0x46, 0x28],
    clearing: [0x26, 0x34, 0x30],
    groundSpecks: ["rgba(140,160,80,0.5)", "rgba(20,28,14,0.55)"],
    clearingSpecks: ["rgba(90,140,120,0.45)", "rgba(10,16,14,0.6)"],
    edge: "rgba(12,18,10,0.5)",
    flora: ["#b06ad8", "#5ad8b8"],
    floraStem: "rgba(30,20,40,0.6)",
    rock: "#5e6456",
    rockLine: "rgba(14,16,10,0.7)",
    rockLit: "rgba(170,180,160,0.45)",
    treeShadow: "rgba(8,10,6,0.4)",
    trunk: "#33261f",
    canopy: "#41395c",
    canopyLine: "rgba(14,10,22,0.8)",
    canopyLit: "#6a5a92",
  },
  // Flagstone floor, void-stone clearings, brazier sparks, obsidian spires.
  citadel: {
    bg: "#161320",
    ground: [0x40, 0x3c, 0x4c],
    clearing: [0x28, 0x24, 0x32],
    groundSpecks: ["rgba(150,145,170,0.4)", "rgba(18,16,26,0.6)"],
    clearingSpecks: ["rgba(120,90,200,0.4)", "rgba(8,6,14,0.6)"],
    edge: "rgba(10,8,16,0.5)",
    flora: ["#e8b84b", "#b08ae8"],
    floraStem: "rgba(20,16,30,0.6)",
    rock: "#565064",
    rockLine: "rgba(10,8,14,0.7)",
    rockLit: "rgba(170,160,200,0.5)",
    treeShadow: "rgba(4,4,10,0.45)",
    trunk: "#1c1826",
    canopy: "#241f36",
    canopyLine: "rgba(60,45,110,0.8)",
    canopyLit: "#4a3f70",
  },
};

export class Terrain {
  private base = document.createElement("canvas");
  private runes = document.createElement("canvas");
  /** Points along the power circles, in CSS px — mote spawn sites for the renderer. */
  runePoints: { x: number; y: number }[] = [];
  private rng = 1;
  private theme: TerrainTheme = THEMES.greenwood!;

  private rand(): number {
    const [v, s] = next(this.rng);
    this.rng = s;
    return v;
  }

  private range(a: number, b: number): number {
    return a + this.rand() * (b - a);
  }

  bake(seed: number, w: number, h: number, dpr: number, theme: TerrainTheme = this.theme): void {
    this.theme = theme;
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
    const th = this.theme;
    this.base.width = Math.max(1, Math.round(w * dpr));
    this.base.height = Math.max(1, Math.round(h * dpr));
    const ctx = this.base.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cols = Math.ceil(w / TILE) + 1;
    const rows = Math.ceil(h / TILE) + 1;

    // Dirt clearings: a few soft metaball blobs; a tile is dirt when close
    // enough to any blob center. Rolled first so the tile pass can consult it.
    const blobs: { x: number; y: number; r: number }[] = [];
    const blobCount = 2 + Math.floor((w * h) / 300000);
    for (let i = 0; i < blobCount; i++) {
      blobs.push({
        x: this.range(w * 0.15, w * 0.85),
        y: this.range(h * 0.15, h * 0.85),
        r: this.range(Math.min(w, h) * 0.1, Math.min(w, h) * 0.22),
      });
    }
    const dirtAt = (px: number, py: number, fuzz: number): boolean => {
      for (const b of blobs) {
        const d = Math.hypot(px - b.x, py - b.y);
        if (d < b.r * (1 + fuzz)) return true;
      }
      return false;
    };

    // Tile pass: every tile is grass or dirt with per-tile shade wobble and
    // a scatter of lighter/darker speckles — the WC2 mottled-ground look.
    const dirt: boolean[] = new Array(cols * rows);
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const x = tx * TILE;
        const y = ty * TILE;
        const isDirt = dirtAt(x + TILE / 2, y + TILE / 2, this.range(-0.12, 0.12));
        dirt[ty * cols + tx] = isDirt;
        const shade = this.range(-0.06, 0.06);
        const [gr, gg, gb] = isDirt ? th.clearing : th.ground;
        ctx.fillStyle = tint(gr, gg, gb, shade);
        ctx.fillRect(x, y, TILE, TILE);
        // Speckles: the ground gets blade tufts, clearings pebbles and pocks.
        const specks = 4 + Math.floor(this.rand() * 4);
        for (let s = 0; s < specks; s++) {
          const sx = x + this.range(1, TILE - 2);
          const sy = y + this.range(1, TILE - 2);
          const light = this.rand() < 0.5;
          if (isDirt) {
            ctx.fillStyle = th.clearingSpecks[light ? 0 : 1];
            ctx.fillRect(sx, sy, 2, 2);
          } else {
            ctx.fillStyle = th.groundSpecks[light ? 0 : 1];
            ctx.fillRect(sx, sy, light ? 1.5 : 2, light ? 3 : 2);
          }
        }
      }
    }

    // Edge pass: a dark worn lip where clearing meets ground, so clearings
    // read as cut into the turf rather than painted on top of it.
    ctx.fillStyle = th.edge;
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        if (!dirt[ty * cols + tx]) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        if (tx > 0 && !dirt[ty * cols + tx - 1]) ctx.fillRect(x, y, 2.5, TILE);
        if (tx < cols - 1 && !dirt[ty * cols + tx + 1]) ctx.fillRect(x + TILE - 2.5, y, 2.5, TILE);
        if (ty > 0 && !dirt[(ty - 1) * cols + tx]) ctx.fillRect(x, y, TILE, 2.5);
        if (ty < rows - 1 && !dirt[(ty + 1) * cols + tx]) ctx.fillRect(x, y + TILE - 2.5, TILE, 2.5);
      }
    }

    // Flora dotting the ground — wildflowers, embers, ice sprigs, blight
    // mushrooms or brazier sparks, depending on the level.
    const flowers = Math.round((w * h) / 26000);
    for (let i = 0; i < flowers; i++) {
      const x = this.range(4, w - 4);
      const y = this.range(4, h - 4);
      if (dirtAt(x, y, 0)) continue;
      ctx.fillStyle = this.rand() < 0.6 ? th.flora[0] : th.flora[1];
      ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillStyle = th.floraStem;
      ctx.fillRect(x - 0.5, y + 1, 1, 2);
    }

    // Rocks: small grey boulder clusters, mostly on dirt.
    const rocks = 4 + Math.floor((w * h) / 220000);
    for (let i = 0; i < rocks; i++) {
      this.rock(ctx, this.range(20, w - 20), this.range(20, h - 20), this.range(5, 11));
    }

    // Forest treeline: dense canopy hugging the border band, the way WC maps
    // wall the playfield in trees. Kept out of the arena so it never suggests
    // cover that the sim doesn't model.
    const band = Math.min(w, h) * 0.085;
    const step = 26;
    for (let x = -6; x < w + 6; x += step) {
      this.tree(ctx, x + this.range(-8, 8), this.range(-4, band * this.rand()));
      this.tree(ctx, x + this.range(-8, 8), h - this.range(-4, band * this.rand()));
    }
    for (let y = band; y < h - band; y += step) {
      this.tree(ctx, this.range(-4, band * this.rand()), y + this.range(-8, 8));
      this.tree(ctx, w - this.range(-4, band * this.rand()), y + this.range(-8, 8));
    }
  }

  private rock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    const verts = Math.floor(this.range(5, 8));
    ctx.beginPath();
    for (let i = 0; i < verts; i++) {
      const a = (i / verts) * Math.PI * 2 + this.range(-0.25, 0.25);
      const rr = r * this.range(0.7, 1.15);
      const vx = x + Math.cos(a) * rr;
      const vy = y + Math.sin(a) * rr * 0.8;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fillStyle = this.theme.rock;
    ctx.fill();
    ctx.strokeStyle = this.theme.rockLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Sunlit top face.
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.rockLit;
    ctx.fill();
  }

  private tree(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const th = this.theme;
    const r = this.range(9, 14);
    // Ground shadow, trunk, then a lumpy three-lobed canopy with outline —
    // the classic RTS forest tree read. Themed palettes turn the same shape
    // into pines, burnt snags or obsidian spires.
    ctx.fillStyle = th.treeShadow;
    ctx.beginPath();
    ctx.ellipse(x + 2, y + r * 0.7, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = th.trunk;
    ctx.fillRect(x - 1.5, y, 3, r * 0.7);
    const lobes: [number, number, number][] = [
      [x, y - r * 0.5, r * 0.85],
      [x - r * 0.55, y + r * 0.05, r * 0.6],
      [x + r * 0.55, y + r * 0.05, r * 0.6],
    ];
    ctx.fillStyle = th.canopy;
    ctx.strokeStyle = th.canopyLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [lx, ly, lr] of lobes) {
      ctx.moveTo(lx + lr, ly);
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    // Sunlit clusters on the upper-left of the canopy.
    ctx.fillStyle = th.canopyLit;
    for (let i = 0; i < 4; i++) {
      const a = this.range(Math.PI * 0.9, Math.PI * 1.7);
      const d = this.range(0.1, 0.55) * r;
      ctx.fillRect(x + Math.cos(a) * d - 1.5, y - r * 0.5 + Math.sin(a) * d - 1.5, 3, 3);
    }
  }

  private bakeRunes(w: number, h: number, dpr: number): void {
    this.runes.width = Math.max(1, Math.round(w * dpr));
    this.runes.height = Math.max(1, Math.round(h * dpr));
    const ctx = this.runes.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Gold circles of power inlaid in the battlefield.
    const circles = 3 + Math.floor((w * h) / 180000);
    for (let i = 0; i < circles; i++) {
      const cx = this.range(w * 0.15, w * 0.85);
      const cy = this.range(h * 0.15, h * 0.85);
      const cr = this.range(18, 36);

      // Glyph strokes inside the ring — chords and radial ticks. Geometry is
      // rolled once so every glow pass traces the same inlaid lines.
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

      // Each pass: wide dim bloom, then the inlay, then its bright core.
      // The double ring is the circle-of-power signature.
      for (const [width, color] of [
        [7, "rgba(232,184,75,0.10)"],
        [2.5, "rgba(232,184,75,0.38)"],
        [1, "rgba(255,242,196,0.75)"],
      ] as const) {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.arc(cx, cy, cr * 0.72, 0, Math.PI * 2);
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

/** Lighten (t>0) or darken (t<0) an rgb triple by fraction |t|. */
function tint(r: number, g: number, b: number, t: number): string {
  const f = (c: number) => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
