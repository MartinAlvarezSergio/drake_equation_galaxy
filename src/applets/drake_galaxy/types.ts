export type DrakeFactors = {
  /** Star-formation rate proxy R* (stars/year), used in classic Drake product. */
  rStar: number;
  /** Fraction of stars with planets. */
  fP: number;
  /** Average habitable planets per planet-bearing system. */
  nE: number;
  /** Fraction of habitable planets that develop life. */
  fL: number;
  /** Fraction of life-bearing worlds that develop intelligence. */
  fI: number;
  /** Fraction of civilizations that become communicative. */
  fC: number;
  /** Lifetime of communicative phase (years). */
  L: number;
};

export type DrakeStage =
  | "star"
  | "planets"
  | "habitable"
  | "life"
  | "intelligent"
  | "communicating"
  | "active";

export type DrakeStar = {
  x: number;
  y: number;
  /** Galactocentric radius in logical pixels. */
  radius: number;
  /** Deterministic thresholds in [0,1] for successive filters. */
  uPlanets: number;
  uHabitable: number;
  uLife: number;
  uIntel: number;
  uComm: number;
  uActive: number;
  /** Soft twinkle phase. */
  phase: number;
  arm: number;
  /** Relative brightness for rendering. */
  brightness: number;
};

export type DrakeCounts = {
  stars: number;
  withPlanets: number;
  habitable: number;
  withLife: number;
  intelligent: number;
  communicating: number;
  active: number;
  /** Stars inside the hostile central bulge. */
  inBulge: number;
};

export type EarthMarker = {
  x: number;
  y: number;
  radius: number;
};

export type DetectableCategoryId =
  | "habitable"
  | "life"
  | "intelligent"
  | "communicating"
  | "active";

export type DetectableCategory = {
  id: DetectableCategoryId;
  label: string;
  count: number;
};

/** Detection-horizon teaching PDF (counts + radial distance histogram). */
export type DetectablePdf = {
  detectRadius: number;
  starsInHorizon: number;
  categories: DetectableCategory[];
  /** Habitable+ worlds binned by distance from Earth in [0, detectRadius]. */
  radialBins: number[];
};

export type DrakeLayoutMode = "procedural" | "image";

export type DrakeSnapshot = {
  width: number;
  height: number;
  stars: DrakeStar[];
  factors: DrakeFactors;
  /** Classic Drake product N = R* fp ne fl fi fc L */
  classicN: number;
  /** Expected active count in this visual sample (ignores bulge filter). */
  expectedActive: number;
  counts: DrakeCounts;
  highlightStage: DrakeStage;
  /** Hostile central bulge radius in logical pixels. */
  bulgeRadius: number;
  /** Camera zoom centered on Earth (Sun). */
  zoom: number;
  /** Detection horizon radius from Earth (deprojected px). */
  detectRadius: number;
  detectable: DetectablePdf;
  /** Logarithmic spiral wind strength (higher = tighter arms). */
  armTightness: number;
  layoutMode: DrakeLayoutMode;
  /** Optional NASA artist's impression used as luminance prior (image mode). */
  galaxyImage: HTMLImageElement | null;
  earth: EarthMarker;
  note: string;
  seed: number;
  time: number;
};

export type DrakeSettings = {
  starCount: number;
  seed: number;
  factors: DrakeFactors;
  highlightStage: DrakeStage;
  bulgeRadius: number;
  zoom: number;
  detectRadius: number;
  armTightness: number;
  layoutMode: DrakeLayoutMode;
};
