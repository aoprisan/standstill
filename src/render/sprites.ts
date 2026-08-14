/**
 * Procedural pixel-art sprites for the medieval-fantasy theme.
 *
 * Each sprite is a small character grid baked once to an offscreen canvas at
 * startup; draws scale the baked canvas with image smoothing off for a crisp
 * chunky-pixel look. Hot/cold variants exist so the renderer can crossfade
 * entities between their living and time-held appearance as timeScale moves.
 *
 * Render-only: nothing here reads or writes sim state.
 */

type Palette = Record<string, string>;

interface SpriteDef {
  grid: readonly string[];
  palette: Palette;
  /** Drawn width as a multiple of the entity radius. */
  scale: number;
}

/** Device pixels per grid cell when baking. */
const CELL = 4;

// The player: a knight — plumed helm, visor slit, a burning heart in the cuirass.
const KNIGHT_GRID = [
  "......p......",
  ".....ppp.....",
  "....hhhhh....",
  "...hhhhhhh...",
  "..hhhXXXhhh..",
  "..hhhhhhhhh..",
  "..aaacccaaa..",
  "..aacCCCcaa..",
  "..aacCCCcaa..",
  "..aaacccaaa..",
  "...aaaaaaa...",
  "....aa.aa....",
] as const;

// Mage: wide-brimmed pointed hat, glowing eyes, robe with a focus gem.
const MAGE_GRID = [
  "......h......",
  ".....hhh.....",
  ".....hhh.....",
  "....hhhhh....",
  "...hhhhhhh...",
  "..hhhhhhhhh..",
  "....fXfXf....",
  "....fffff....",
  "...rrrrrrr...",
  "..rrrcCcrrr..",
  "..rrrrrrrrr..",
  "...rr...rr...",
] as const;

// Dragon: raised wings, horned head, a furnace glowing through the belly scales.
const DRAGON_GRID = [
  "w...........w",
  "ww.........ww",
  "www..bbb..www",
  "wwwwbbbbbwwww",
  ".wwbbXbXbbww.",
  "..wbbbbbbbw..",
  "...bbFFFbb...",
  "....bbFbb....",
  ".....bbb.....",
  "......b......",
] as const;

// Priest: mitre, vestments, and a tall glowing cross on the chest.
const PRIEST_GRID = [
  ".....mmm.....",
  "....mmmmm....",
  "....mmmmm....",
  "....fXfXf....",
  "....fffff....",
  "...rrrrrrr...",
  "..rrrrCrrrr..",
  "..rrrCCCrrr..",
  "..rrrrCrrrr..",
  "..rrrrCrrrr..",
  "..rrrrrrrrr..",
  "...rrrrrrr...",
] as const;

// Player shot: a blessed steel quarrel with a gilt core.
const BOLT_GRID = [
  "..eee..",
  ".eEEEe.",
  "eEEXEEe",
  "eEXXXEe",
  "eEEXEEe",
  ".eEEEe.",
  "..eee..",
] as const;

// Enemy shot: dragonfire while time flows, an arcane stasis orb while held.
const ORB_GRID = [
  "...ooo...",
  ".ooCCCoo.",
  ".oCCCCCo.",
  "oCCXXXCCo",
  "oCXXXXXCo",
  "oCCXXXCCo",
  ".oCCCCCo.",
  ".ooCCCoo.",
  "...ooo...",
] as const;

const DEFS = {
  knightHot: {
    grid: KNIGHT_GRID,
    scale: 2.4,
    palette: { p: "#c2453c", h: "#c7cdd9", X: "#ffd9a8", a: "#8a92a5", c: "#e8b84b", C: "#fff2c4" },
  },
  knightCold: {
    grid: KNIGHT_GRID,
    scale: 2.4,
    palette: { p: "#6b5a82", h: "#9aa3b8", X: "#cdbdf0", a: "#707a90", c: "#8f7fd0", C: "#d9ccf5" },
  },
  mageHot: {
    grid: MAGE_GRID,
    scale: 2.4,
    palette: { h: "#5a3d8f", f: "#e8d5b8", X: "#c9a8ff", r: "#3f2f66", c: "#8f5fd0", C: "#e0ccff" },
  },
  mageCold: {
    grid: MAGE_GRID,
    scale: 2.4,
    palette: { h: "#4a5570", f: "#c6cdda", X: "#d6ecf7", r: "#333c52", c: "#5f7889", C: "#d6ecf7" },
  },
  dragonHot: {
    grid: DRAGON_GRID,
    scale: 2.7,
    palette: { w: "#6e2a22", b: "#a13a2c", X: "#ffd9a8", F: "#ff9a4d" },
  },
  dragonCold: {
    grid: DRAGON_GRID,
    scale: 2.7,
    palette: { w: "#3f4a63", b: "#566178", X: "#d6ecf7", F: "#8f9fbd" },
  },
  priestHot: {
    grid: PRIEST_GRID,
    scale: 2.4,
    palette: { m: "#e8e0ce", f: "#d9b891", X: "#ffd9a8", r: "#6b5a3f", C: "#ffcf5e" },
  },
  priestCold: {
    grid: PRIEST_GRID,
    scale: 2.4,
    palette: { m: "#b9c1cf", f: "#aab3c2", X: "#d6ecf7", r: "#454e60", C: "#9fb8d9" },
  },
  boltSteel: {
    grid: BOLT_GRID,
    scale: 3.4,
    palette: { e: "#8a92a5", E: "#d9dde8", X: "#fff2c4" },
  },
  orbFire: {
    grid: ORB_GRID,
    scale: 2.6,
    palette: { o: "rgba(255,122,61,0.4)", C: "#c2532a", X: "#ff9a4d" },
  },
  orbArcane: {
    grid: ORB_GRID,
    scale: 2.6,
    palette: { o: "rgba(159,143,208,0.4)", C: "#6f63a8", X: "#b3a5e8" },
  },
} satisfies Record<string, SpriteDef>;

export type SpriteKey = keyof typeof DEFS;

export class SpriteAtlas {
  private baked = new Map<string, HTMLCanvasElement>();

  constructor() {
    for (const [key, def] of Object.entries(DEFS)) {
      this.baked.set(key, bake(def));
    }
  }

  /** Draw sprite `key` centered on (x,y), sized from the entity radius. */
  draw(ctx: CanvasRenderingContext2D, key: SpriteKey, x: number, y: number, r: number, rot = 0): void {
    const canvas = this.baked.get(key);
    const def = DEFS[key];
    if (!canvas || !def) return;
    const w = r * def.scale;
    const h = (w * def.grid.length) / def.grid[0]!.length;
    ctx.save();
    ctx.translate(x, y);
    if (rot !== 0) ctx.rotate(rot);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function bake(def: SpriteDef): HTMLCanvasElement {
  const rows = def.grid.length;
  const cols = def.grid[0]!.length;
  const canvas = document.createElement("canvas");
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < rows; y++) {
    const row = def.grid[y]!;
    for (let x = 0; x < cols; x++) {
      const color = def.palette[row[x]!];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  return canvas;
}
