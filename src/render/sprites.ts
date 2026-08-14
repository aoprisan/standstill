/**
 * Procedural pixel-art sprites in a Warcraft-like style: chunky units with
 * near-black outlines and saturated colors, drawn as if seen from the classic
 * three-quarter top-down RTS camera.
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

/** Shared near-black outline every unit wears, Warcraft style. */
const INK = "#14100c";

// The player: a human footman — plumed helm, mail, kingdom-blue tabard,
// raised sword on one side and a kite shield on the other.
const FOOTMAN_GRID = [
  "......ooo......",
  ".....ohhho.....",
  "....ohHHhho....",
  "....ohhhhho....",
  "....offfffo....",
  "....ofefefo....",
  ".....offfo.....",
  "..oo.ooooo.oo..",
  ".owwo.oaao.sso.",
  ".owwoaattaaoso.",
  ".owwoaatTaaoso.",
  ".oWWoaattaaoso.",
  ".owwoaattaaoso.",
  "..oo.oattao.o..",
  ".....otttto....",
  "....obbobbo....",
  "....obo.obo....",
  "....oo...oo....",
] as const;

// Orc grunt: green skin, jutting tusks, studded leather and spiked pauldrons.
const GRUNT_GRID = [
  ".....ooo.......",
  "....ogggo......",
  "...ogggggo.....",
  "...ogeggego....",
  "...oggggggo....",
  "..otggggggto...",
  "....oggggo.....",
  "..ooooooooooo..",
  ".oppogggogppo..",
  ".oppogvvgoppo..",
  "..oo.gvvvg.oo..",
  "....ogvvgo.....",
  "....ovvvvo.....",
  "....obbobbo....",
  "....obo.obo....",
  "....oo...oo....",
] as const;

// Ogre: hulking blue-skinned bruiser in a leather harness.
const OGRE_GRID = [
  "......ooooo......",
  ".....oyyyyyo.....",
  "....oyyyyyyyo....",
  "....oyeyyyeyo....",
  "....oyyyyyyyo....",
  "...otyyyyyyyto...",
  ".....oyyyyyo.....",
  "..ooooyyyyyoooo..",
  ".oyyoyyyyyyyoyyo.",
  ".oyyohhhhhhhoyyo.",
  ".oyyohhyyyhhoyyo.",
  "..oo.oyyyyyo.oo..",
  ".....ohhhhho.....",
  ".....ohhhhho.....",
  "....oyyo.oyyo....",
  "....oyyo.oyyo....",
  "....oooo.oooo....",
] as const;

// Warlock: hooded violet robe, a void where a face should be, fel-green eyes.
const WARLOCK_GRID = [
  "......ooo......",
  ".....orrro.....",
  "....orrrrro....",
  "...orrooorro...",
  "...oroDDDoro...",
  "...oroEDEoro...",
  "...oroDDDoro...",
  "....orrrrro....",
  "..oorrrrrrroo..",
  ".ororrgggrroro.",
  ".ororrgGgrroro.",
  ".ororrrgrrroro.",
  "..oo.rrrrr.oo..",
  "....orrrrro....",
  "....orrrrro....",
  "...orrrrrrro...",
  "...oo.....oo...",
] as const;

// Red dragon: swept wings, horned brow, furnace glow along the belly.
const DRAGON_GRID = [
  "o...............o",
  "oo.............oo",
  "owo....ooo....owo",
  "owwo..ohhho..owwo",
  "owwwoohEhEhoowwwo",
  ".owwwohhhhhowwwo.",
  "..owwohhhhhowwo..",
  "....oohFFFhoo....",
  ".....ohFFFho.....",
  "......ohhho......",
  ".......ohho......",
  "........oo.......",
] as const;

// Player shot: a spinning throwing axe — twin steel blades about a gilt haft.
const AXE_GRID = [
  "..o...o..",
  ".oWo.oWo.",
  ".oWWoWWo.",
  "..oWXWo..",
  "...oXo...",
  "..oWXWo..",
  ".oWWoWWo.",
  ".oWo.oWo.",
  "..o...o..",
] as const;

// Enemy shot: dragonfire while time flows, a frozen frost orb while held.
const ORB_GRID = [
  "....ooo....",
  "..oorrroo..",
  ".orrfffrro.",
  ".orfyyyfro.",
  "orfyyYyyfro",
  "orfyYYYyfro",
  "orfyyYyyfro",
  ".orfyyyfro.",
  ".orrfffrro.",
  "..oorrroo..",
  "....ooo....",
] as const;

const DEFS = {
  footmanHot: {
    grid: FOOTMAN_GRID,
    scale: 2.5,
    palette: {
      o: INK,
      h: "#b8bfcc",
      H: "#eef2f8",
      f: "#e8b088",
      e: "#241a12",
      a: "#98a0b0",
      t: "#2858c8",
      T: "#6a9af0",
      w: "#c8d0dc",
      W: "#f0f6ff",
      s: "#3a66cc",
      b: "#5a3a20",
    },
  },
  footmanCold: {
    grid: FOOTMAN_GRID,
    scale: 2.5,
    palette: {
      o: "#101420",
      h: "#8894ac",
      H: "#c2cede",
      f: "#a8b4c8",
      e: "#1c2230",
      a: "#707c94",
      t: "#4a5878",
      T: "#7c8cb0",
      w: "#9aa8c0",
      W: "#d0dcee",
      s: "#4c5c84",
      b: "#3c4458",
    },
  },
  gruntHot: {
    grid: GRUNT_GRID,
    scale: 2.5,
    palette: {
      o: INK,
      g: "#4e8f2e",
      e: "#e03020",
      t: "#f0ead8",
      p: "#8a4a2a",
      v: "#5a3a22",
      b: "#3a2a18",
    },
  },
  gruntCold: {
    grid: GRUNT_GRID,
    scale: 2.5,
    palette: {
      o: "#101420",
      g: "#5a7488",
      e: "#8ca8c8",
      t: "#c2cede",
      p: "#54607c",
      v: "#404c64",
      b: "#303a4e",
    },
  },
  ogreHot: {
    grid: OGRE_GRID,
    scale: 2.7,
    palette: {
      o: INK,
      y: "#6878b8",
      e: "#e0b030",
      t: "#f0ead8",
      h: "#6a4a2e",
    },
  },
  ogreCold: {
    grid: OGRE_GRID,
    scale: 2.7,
    palette: {
      o: "#101420",
      y: "#5c6c94",
      e: "#a8bcd8",
      t: "#c2cede",
      h: "#485068",
    },
  },
  warlockHot: {
    grid: WARLOCK_GRID,
    scale: 2.5,
    palette: {
      o: INK,
      r: "#5a2878",
      D: "#181020",
      E: "#58e858",
      g: "#8a48b8",
      G: "#e8d8f0",
    },
  },
  warlockCold: {
    grid: WARLOCK_GRID,
    scale: 2.5,
    palette: {
      o: "#101420",
      r: "#3c4460",
      D: "#141824",
      E: "#9cc8e8",
      g: "#586890",
      G: "#c2cede",
    },
  },
  dragonHot: {
    grid: DRAGON_GRID,
    scale: 2.8,
    palette: {
      o: INK,
      w: "#7a2418",
      h: "#b03a24",
      E: "#ffd94a",
      F: "#ff9a4d",
    },
  },
  dragonCold: {
    grid: DRAGON_GRID,
    scale: 2.8,
    palette: {
      o: "#101420",
      w: "#3c4460",
      h: "#566180",
      E: "#c2d8ee",
      F: "#8ca0c4",
    },
  },
  axeSteel: {
    grid: AXE_GRID,
    scale: 3.2,
    palette: {
      o: "#2a2e38",
      W: "#d9dde8",
      X: "#c89838",
    },
  },
  fireball: {
    grid: ORB_GRID,
    scale: 2.6,
    palette: {
      o: "rgba(122,36,24,0.35)",
      r: "#a83220",
      f: "#ff7a3d",
      y: "#ffc84a",
      Y: "#fff2c4",
    },
  },
  frostOrb: {
    grid: ORB_GRID,
    scale: 2.6,
    palette: {
      o: "rgba(60,90,140,0.35)",
      r: "#3c5a8c",
      f: "#68a8e0",
      y: "#b8e0f8",
      Y: "#f0faff",
    },
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
