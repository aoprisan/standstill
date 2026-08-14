/**
 * Upgrade content — roadmap step 2.
 *
 * Upgrades are composable stat patches. The engine applies them generically;
 * adding one means adding a row here, never a branch in tick.ts (CLAUDE.md
 * rule 4). If an upgrade needs a field that does not exist yet, add the field
 * to Player and honour it in the fire/collision path — then every future
 * upgrade can reuse it.
 */
import type { Player } from "../sim/types";

export interface UpgradePatch {
  fireCooldownMul?: number;
  bulletSpeedMul?: number;
  maxHpAdd?: number;
  spreadAdd?: number;
  pierceAdd?: number;
  /** Bullet-steal reach, in px. */
  stealRAdd?: number;
  /** Bullets stealable per freeze. */
  stealMaxAdd?: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  /** How many times this may be taken in one run. */
  maxStacks: number;
  apply: UpgradePatch;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "rapid",
    name: "Rapid Stance",
    description: "Fire 20% faster while still.",
    maxStacks: 4,
    apply: { fireCooldownMul: 0.8 },
  },
  {
    id: "velocity",
    name: "Dragonfire Bolts",
    description: "Your bullets fly 30% faster.",
    maxStacks: 3,
    apply: { bulletSpeedMul: 1.3 },
  },
  {
    id: "vitality",
    name: "Priest's Blessing",
    description: "+1 max heart, and heal it.",
    maxStacks: 3,
    apply: { maxHpAdd: 1 },
  },
  {
    id: "fan",
    name: "Split Breath",
    description: "+1 bullet per shot, fanned.",
    maxStacks: 3,
    apply: { spreadAdd: 1 },
  },
  {
    id: "pierce",
    name: "Throughline",
    description: "Bullets pass through one more body.",
    maxStacks: 2,
    apply: { pierceAdd: 1 },
  },
  {
    id: "steal",
    name: "Sleight",
    description: "While frozen, brush past a bullet to make it yours. Reloads while you stand.",
    maxStacks: 3,
    apply: { stealRAdd: 12, stealMaxAdd: 1 },
  },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

/** How many upgrades are offered per draft. */
export const DRAFT_SIZE = 3;

/**
 * Apply a patch to the player. Generic over the patch fields — no per-upgrade
 * branching, so new content is pure data.
 */
export function applyUpgrade(p: Player, def: UpgradeDef): void {
  const a = def.apply;
  if (a.fireCooldownMul !== undefined) p.fireCooldown *= a.fireCooldownMul;
  if (a.bulletSpeedMul !== undefined) p.bulletSpeed *= a.bulletSpeedMul;
  if (a.maxHpAdd !== undefined) {
    p.maxHp += a.maxHpAdd;
    p.hp += a.maxHpAdd;
  }
  if (a.spreadAdd !== undefined) p.spread += a.spreadAdd;
  if (a.pierceAdd !== undefined) p.pierce += a.pierceAdd;
  if (a.stealRAdd !== undefined) p.stealR += a.stealRAdd;
  if (a.stealMaxAdd !== undefined) {
    p.stealMax += a.stealMaxAdd;
    p.stealCharge += a.stealMaxAdd;
  }
}
