import { DrakeFactors, DrakeStage } from "./types";

export type DrakePresetId = "drake1961" | "optimistic" | "pessimistic" | "microbes" | "classroom";

export type DrakePreset = {
  id: DrakePresetId;
  label: string;
  blurb: string;
  factors: DrakeFactors;
};

/** Milky Way age scale used to turn L into a “visible now” fraction for the map. */
export const GALAXY_AGE_YEARS = 1e10;

export const FACTOR_META: {
  key: keyof DrakeFactors;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}[] = [
  {
    key: "rStar",
    label: "R★ — star formation rate",
    hint: "New stars per year in the galaxy (classic Drake term).",
    min: 1,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)} / yr`
  },
  {
    key: "fP",
    label: "fₚ — fraction with planets",
    hint: "Share of stars that host planetary systems.",
    min: 0.01,
    max: 1,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`
  },
  {
    key: "nE",
    label: "nₑ — habitable planets / system",
    hint: "Average number of habitable-zone worlds per planet-bearing system.",
    min: 0.01,
    max: 5,
    step: 0.01,
    format: (v) => v.toFixed(2)
  },
  {
    key: "fL",
    label: "fₗ — fraction where life arises",
    hint: "Of habitable worlds, fraction where life begins.",
    min: 0.0001,
    max: 1,
    step: 0.0001,
    format: (v) => (v < 0.01 ? v.toExponential(1) : `${(v * 100).toFixed(1)}%`)
  },
  {
    key: "fI",
    label: "fᵢ — fraction with intelligence",
    hint: "Of life-bearing worlds, fraction that evolve intelligence.",
    min: 0.0001,
    max: 1,
    step: 0.0001,
    format: (v) => (v < 0.01 ? v.toExponential(1) : `${(v * 100).toFixed(1)}%`)
  },
  {
    key: "fC",
    label: "f_c — fraction that communicate",
    hint: "Of intelligent civilizations, fraction that send detectable signals.",
    min: 0.01,
    max: 1,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`
  },
  {
    key: "L",
    label: "L — communicative lifetime",
    hint: "Years a civilization remains detectable. Compared with ~10¹⁰ yr galactic age for the map.",
    min: 10,
    max: 1e9,
    step: 10,
    format: (v) => {
      if (v >= 1e6) {
        return `${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)} Myr`;
      }
      if (v >= 1e3) {
        return `${(v / 1e3).toFixed(0)} kyr`;
      }
      return `${Math.round(v)} yr`;
    }
  }
];

export const DEFAULT_FACTORS: DrakeFactors = {
  rStar: 10,
  fP: 0.5,
  nE: 0.4,
  fL: 0.2,
  fI: 0.1,
  fC: 0.2,
  L: 1e4
};

export const DRAKE_PRESETS: DrakePreset[] = [
  {
    id: "classroom",
    label: "Classroom mid-range",
    blurb: "Balanced teaching defaults — enough green lights to discuss without claiming certainty.",
    factors: { ...DEFAULT_FACTORS }
  },
  {
    id: "drake1961",
    label: "Drake-ish optimistic",
    blurb: "Order-of-magnitude optimistic choices in the spirit of early Drake estimates.",
    factors: {
      rStar: 10,
      fP: 0.5,
      nE: 2,
      fL: 1,
      fI: 1,
      fC: 0.2,
      L: 1e4
    }
  },
  {
    id: "optimistic",
    label: "Optimistic SETI",
    blurb: "Planets common, life and intelligence not rare, long-lived communicators.",
    factors: {
      rStar: 20,
      fP: 0.9,
      nE: 1.5,
      fL: 0.5,
      fI: 0.2,
      fC: 0.5,
      L: 1e6
    }
  },
  {
    id: "pessimistic",
    label: "Rare Earth",
    blurb: "Habitable worlds and intelligence are scarce; communicative windows are short.",
    factors: {
      rStar: 5,
      fP: 0.2,
      nE: 0.05,
      fL: 0.01,
      fI: 0.001,
      fC: 0.1,
      L: 200
    }
  },
  {
    id: "microbes",
    label: "Life common, minds rare",
    blurb: "Many blue/cyan worlds with life, but almost no green intelligent civilizations.",
    factors: {
      rStar: 15,
      fP: 0.8,
      nE: 1,
      fL: 0.8,
      fI: 0.0005,
      fC: 0.2,
      L: 5000
    }
  }
];

export const STAGE_LABELS: Record<DrakeStage, string> = {
  star: "All stars",
  planets: "With planets",
  habitable: "Habitable (blue)",
  life: "Life arises",
  intelligent: "Intelligent (green)",
  communicating: "Communicating",
  active: "Active now"
};

/**
 * Probability a planet-bearing system counts as “habitable” for the map.
 * Uses 1 − e^{−nₑ} so nₑ is an average count, not forced into [0,1].
 */
export function habitableProbability(nE: number): number {
  return 1 - Math.exp(-Math.max(0, nE));
}

/** Fraction of communicative civilizations still “on air” in a static snapshot. */
export function activeProbability(L: number): number {
  return Math.min(1, Math.max(0, L) / GALAXY_AGE_YEARS);
}

export function classicDrakeN(f: DrakeFactors): number {
  return f.rStar * f.fP * f.nE * f.fL * f.fI * f.fC * f.L;
}

export const HONESTY_NOTE =
  "Illustrative population model only — not a prediction. The central bulge is treated as largely uninhabitable (radiation / dynamical hazards), a common galactic-habitable-zone teaching simplification.";
