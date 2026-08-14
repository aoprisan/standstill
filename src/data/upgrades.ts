/**
 * Upgrade draft stubs — roadmap step 2.
 * Upgrades are composable modifiers over player stats / fire behavior.
 * Keep them declarative; the draft system applies them, engine code stays generic.
 */
export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  /** Flat/multiplier stat patches; extend as systems land. */
  apply: {
    fireCooldownMul?: number;
    bulletSpeedMul?: number;
    maxHpAdd?: number;
  };
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "rapid",
    name: "Rapid Stance",
    description: "Fire 25% faster while still.",
    apply: { fireCooldownMul: 0.8 },
  },
  {
    id: "velocity",
    name: "Ember Velocity",
    description: "Your bullets fly 30% faster.",
    apply: { bulletSpeedMul: 1.3 },
  },
  {
    id: "vitality",
    name: "Cold Blood",
    description: "+1 max heart.",
    apply: { maxHpAdd: 1 },
  },
  // TODO(step 2): ricochet, pierce, spread — need fire-behavior modifiers
  // TODO(step 2): bullet-steal — while frozen, passing near a frozen enemy
  // bullet converts it; it launches at the nearest enemy when time resumes.
];
