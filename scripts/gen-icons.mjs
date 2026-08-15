/**
 * Generates every PWA icon from one 32x32 pixel-art scene.
 *
 * The icons are committed to `public/icons/`; this script exists so they can be
 * re-derived (`npm run icons`) instead of being opaque binaries nobody can edit.
 * It has no dependencies — PNGs are encoded here with node's zlib, and scaling
 * is nearest-neighbour so the art stays chunky at every size, matching the
 * in-game sprite atlas.
 *
 * Scene: the footman standing still inside a gold circle of power, with two
 * enemy orbs held frozen mid-flight — the whole game in one glance.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/** Scene resolution. Every icon is this grid scaled by an integer-ish factor. */
const GRID = 32;

// ---------------------------------------------------------------- png encoding

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode straight RGBA bytes as a PNG (filter 0 on every scanline). */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- tiny canvas

/** A flat RGBA surface with just the primitives this scene needs. */
class Surface {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }

  set(x, y, hex) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = parseHex(hex);
    if (a === 0) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  fill(hex) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, hex);
  }

  /** Filled disc, centre in fractional coords so even-sized grids stay balanced. */
  disc(cx, cy, r, hex) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, hex);
      }
    }
  }

  /** One-pixel ring. `dash` > 0 leaves gaps, for a rune-circle look. */
  ring(cx, cy, r, hex, dash = 0) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d < r - 0.5 || d > r + 0.5) continue;
        if (dash > 0) {
          const a = Math.atan2(dy, dx) + Math.PI;
          if (Math.floor((a / (Math.PI * 2)) * dash) % 2 === 1) continue;
        }
        this.set(x, y, hex);
      }
    }
  }

  /** Stamp a character grid with the given palette; "." is transparent. */
  stamp(grid, palette, ox, oy) {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const hex = palette[row[x]];
        if (hex) this.set(ox + x, oy + y, hex);
      }
    }
  }

  /** Nearest-neighbour scale onto `dst` at the given offset and integer-ish factor. */
  blitScaled(dst, scale, ox, oy) {
    for (let y = 0; y < Math.round(this.h * scale); y++) {
      for (let x = 0; x < Math.round(this.w * scale); x++) {
        const sx = Math.min(this.w - 1, Math.floor(x / scale));
        const sy = Math.min(this.h - 1, Math.floor(y / scale));
        const i = (sy * this.w + sx) * 4;
        if (this.data[i + 3] === 0) continue;
        const j = ((oy + y) * dst.w + (ox + x)) * 4;
        if (oy + y < 0 || oy + y >= dst.h || ox + x < 0 || ox + x >= dst.w) continue;
        this.data.copy(dst.data, j, i, i + 4);
      }
    }
  }
}

function parseHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  return hex.length === 7 ? [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255] : [0, 0, 0, 0];
}

// ------------------------------------------------------------------------ scene

const INK = "#14100c";

/**
 * The footman, mirroring src/render/sprites.ts. Kept as a copy on purpose: that
 * module is browser-only (it bakes to canvases), and the icon must not drift
 * with in-game sprite tuning.
 */
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
];

const FOOTMAN_PALETTE = {
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
};

/** A held enemy orb: frost, not fire, because time is stopped in this picture. */
const ORB_GRID = [
  "..o..",
  ".ofo.",
  "ofFfo",
  ".ofo.",
  "..o..",
];

const ORB_PALETTE = { o: "#101420", f: "#8cb4d8", F: "#dff2ff" };

/** Draw the 32x32 scene. */
function scene() {
  const s = new Surface(GRID, GRID);
  const c = GRID / 2;

  s.fill("#0e0b10"); // the shell's background, so the icon sits on its own colour
  s.disc(c, c, 15.5, INK); // outline: the arena reads as a struck coin
  s.disc(c, c, 14.6, "#1a3110"); // arena floor, dark at the treeline
  s.disc(c, c, 12.4, "#22441a");
  s.ring(c, c, 11.4, "#e8b84b", 16); // circle of power
  s.disc(c, 25, 4.2, "#16280f"); // trodden ground under the footman

  s.stamp(ORB_GRID, ORB_PALETTE, 3, 7);
  s.stamp(ORB_GRID, ORB_PALETTE, 24, 19);

  s.stamp(FOOTMAN_GRID, FOOTMAN_PALETTE, (GRID - 15) / 2, 7);
  return s;
}

/**
 * Render the scene at `size`. Maskable icons inset the art to ~76% so nothing
 * important lands outside the 80% safe zone Android's mask can crop to.
 */
function icon(size, maskable = false) {
  const out = new Surface(size, size);
  out.fill("#0e0b10");
  const scale = maskable ? (size * 0.76) / GRID : size / GRID;
  const drawn = Math.round(GRID * scale);
  const off = Math.round((size - drawn) / 2);
  scene().blitScaled(out, scale, off, off);
  return encodePng(size, size, out.data);
}

const TARGETS = [
  ["icon-32.png", 32, false],
  ["icon-180.png", 180, false],
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-192.png", 192, true],
  ["icon-maskable-512.png", 512, true],
];

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size, maskable] of TARGETS) {
  const png = icon(size, maskable);
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`${name.padEnd(24)} ${String(size).padStart(3)}px  ${png.length} bytes`);
}
