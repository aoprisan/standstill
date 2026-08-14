/**
 * Procedural pixel-art sprites for the Permafrost theme.
 *
 * Each sprite is a small character grid baked once to an offscreen canvas at
 * startup; draws scale the baked canvas with image smoothing off for a crisp
 * chunky-pixel look. Hot/cold variants exist so the renderer can crossfade
 * entities between their thawed and frozen appearance as timeScale moves.
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

// The hearth-spirit: a bone shell around a burning (or frozen) core.
const PLAYER_GRID = [
  "...ooooooo...",
  "..obbbbbbbo..",
  ".obbbbbbbbbo.",
  "obbbbcccbbbbo",
  "obbbcccccbbbo",
  "obbccXXXccbbo",
  "obbccXXXccbbo",
  "obbccXXXccbbo",
  "obbbcccccbbbo",
  "obbbbcccbbbbo",
  ".obbbbbbbbbo.",
  "..obbbbbbbo..",
  "...ooooooo...",
] as const;

// Ice-shard construct: a faceted diamond crystal with a glinting core.
const SHARD_GRID = [
  "......o......",
  ".....ofo.....",
  "....offfo....",
  "...offcffo...",
  "..offcccffo..",
  ".offcccccffo.",
  "offccXXXccffo",
  ".offcccccffo.",
  "..offcccffo..",
  "...offcffo...",
  "....offfo....",
  ".....ofo.....",
  "......o......",
] as const;

// Player shot: a hot ember bolt.
const BOLT_GRID = [
  "..eee..",
  ".eEEEe.",
  "eEEXEEe",
  "eEXXXEe",
  "eEEXEEe",
  ".eEEEe.",
  "..eee..",
] as const;

// Enemy shot: a frost orb when frozen, blood-warm while time flows.
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
  playerHot: {
    grid: PLAYER_GRID,
    scale: 2.4,
    palette: { o: "rgba(20,16,14,0.55)", b: "#e8e4da", c: "#e0622e", X: "#ffc48a" },
  },
  playerCold: {
    grid: PLAYER_GRID,
    scale: 2.4,
    palette: { o: "rgba(12,16,22,0.55)", b: "#e8e4da", c: "#5e8aa3", X: "#c6e4f2" },
  },
  shardHot: {
    grid: SHARD_GRID,
    scale: 2.3,
    palette: { o: "rgba(232,228,218,0.5)", f: "#c2453c", c: "#a13029", X: "#ffb3a8" },
  },
  shardCold: {
    grid: SHARD_GRID,
    scale: 2.3,
    palette: { o: "rgba(232,228,218,0.5)", f: "#7d95a6", c: "#5f7889", X: "#d6ecf7" },
  },
  boltEmber: {
    grid: BOLT_GRID,
    scale: 3.4,
    palette: { e: "#c2532a", E: "#ff7a3d", X: "#ffd9a8" },
  },
  orbBlood: {
    grid: ORB_GRID,
    scale: 2.6,
    palette: { o: "rgba(232,68,58,0.4)", C: "#b3352d", X: "#e8443a" },
  },
  orbFrost: {
    grid: ORB_GRID,
    scale: 2.6,
    palette: { o: "rgba(169,207,224,0.4)", C: "#7fa8bf", X: "#a9cfe0" },
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
