/** Declarative enemy archetypes. Add enemies here, not in engine code. */
export interface EnemyDef {
  archetype: string;
  r: number;
  baseHp: number;
  /** Extra hp per 3 waves (global campaign wave). */
  hpScale: number;
  orbitRMin: number;
  orbitRMax: number;
  /**
   * Movement shape. The steering model is shared (seek the orbit ring, slide
   * along it, wobble); these gains are what make a charger a charger and a
   * sniper a sniper without a branch in tick.ts.
   */
  radialGain: number;
  /** Tangential slide speed along the orbit ring, px/s. */
  tangential: number;
  /** Wobble amplitude (px/s) and rate (rad/s). */
  wobAmp: number;
  wobRate: number;
  fireCdMin: number;
  fireCdMax: number;
  /** Aimed spread: number of bullets and angular gap (radians). */
  spreadCount: number;
  spreadGap: number;
  bulletSpeed: number;
  bulletR: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  // The baseline: circles at mid range, throws aimed three-shot fans.
  orbiter: {
    archetype: "orbiter",
    r: 14,
    baseHp: 3,
    hpScale: 1,
    orbitRMin: 140,
    orbitRMax: 220,
    radialGain: 0.81,
    tangential: 70,
    wobAmp: 20,
    wobRate: 2,
    fireCdMin: 1.4,
    fireCdMax: 2.4,
    spreadCount: 3,
    spreadGap: 0.22,
    bulletSpeed: 190,
    bulletR: 5,
  },
  // Closes to point-blank and lobs a single fat slow shot. The threat is the
  // body: it makes "stand wherever you are" stop being safe.
  charger: {
    archetype: "charger",
    r: 16,
    baseHp: 5,
    hpScale: 1,
    orbitRMin: 45,
    orbitRMax: 75,
    radialGain: 0.9,
    tangential: 30,
    wobAmp: 12,
    wobRate: 1.4,
    fireCdMin: 1.6,
    fireCdMax: 2.6,
    spreadCount: 1,
    spreadGap: 0,
    bulletSpeed: 150,
    bulletR: 7,
  },
  // Hangs at the arena edge and fires fast single bolts — quick enough that
  // reading them wants a freeze, far enough that it outlives careless fans.
  sniper: {
    archetype: "sniper",
    r: 12,
    baseHp: 2,
    hpScale: 1,
    orbitRMin: 250,
    orbitRMax: 330,
    radialGain: 0.81,
    tangential: 95,
    wobAmp: 14,
    wobRate: 2.4,
    fireCdMin: 2.4,
    fireCdMax: 3.4,
    spreadCount: 1,
    spreadGap: 0,
    bulletSpeed: 320,
    bulletR: 4,
  },
  // Slow wide walls of shot: the arena fills with geometry to thread while
  // frozen rather than single bullets to sidestep.
  warden: {
    archetype: "warden",
    r: 16,
    baseHp: 4,
    hpScale: 1,
    orbitRMin: 170,
    orbitRMax: 230,
    radialGain: 0.7,
    tangential: 40,
    wobAmp: 16,
    wobRate: 1.6,
    fireCdMin: 2.8,
    fireCdMax: 3.8,
    spreadCount: 5,
    spreadGap: 0.38,
    bulletSpeed: 140,
    bulletR: 6,
  },
  // Citadel anchor: huge, slow, and rings the field with shot in every
  // direction. Killing it is a project; ignoring it poisons the whole floor.
  brute: {
    archetype: "brute",
    r: 20,
    baseHp: 12,
    hpScale: 2,
    orbitRMin: 85,
    orbitRMax: 125,
    radialGain: 0.85,
    tangential: 25,
    wobAmp: 8,
    wobRate: 1.2,
    fireCdMin: 3.0,
    fireCdMax: 4.0,
    spreadCount: 10,
    spreadGap: (Math.PI * 2) / 10,
    bulletSpeed: 150,
    bulletR: 6,
  },
};
