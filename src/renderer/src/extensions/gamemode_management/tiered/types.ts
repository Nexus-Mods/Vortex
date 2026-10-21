export const Tiers = {
  tier0: "Tier 0",
  tier1: "Tier 1",
  tier2: "Tier 2",
} as const;

export type Tier = (typeof Tiers)[keyof typeof Tiers];
