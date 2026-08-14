/** Declarative enemy archetypes. Add enemies here, not in engine code. */
export interface EnemyDef {
  archetype: string;
  r: number;
  baseHp: number;
  /** Extra hp per 3 waves. */
  hpScale: number;
  orbitRMin: number;
  orbitRMax: number;
  fireCdMin: number;
  fireCdMax: number;
  /** Aimed spread: number of bullets and angular gap (radians). */
  spreadCount: number;
  spreadGap: number;
  bulletSpeed: number;
  bulletR: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  orbiter: {
    archetype: "orbiter",
    r: 14,
    baseHp: 3,
    hpScale: 1,
    orbitRMin: 140,
    orbitRMax: 220,
    fireCdMin: 1.4,
    fireCdMax: 2.4,
    spreadCount: 3,
    spreadGap: 0.22,
    bulletSpeed: 190,
    bulletR: 5,
  },
};
