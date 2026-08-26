import {
  activeProbability,
  classicDrakeN,
  habitableProbability,
  HONESTY_NOTE,
  DEFAULT_FACTORS
} from "./factors";
import { GalaxyLuminanceMap, samplePointsFromMap } from "./galaxyImage";
import {
  DetectablePdf,
  DrakeCounts,
  DrakeFactors,
  DrakeLayoutMode,
  DrakeSettings,
  DrakeSnapshot,
  DrakeStage,
  DrakeStar,
  EarthMarker
} from "./types";

const LOGICAL_WIDTH = 900;
const LOGICAL_HEIGHT = 620;
export const GALAXY_CX = LOGICAL_WIDTH / 2;
export const GALAXY_CY = LOGICAL_HEIGHT / 2;
/** Matches the foreshortened disk used when placing stars. */
export const DISK_Y_SCALE = 0.62;
/** Outer disk scale (px). */
export const DISK_RADIUS = 275;
/**
 * Sun/Earth galactocentric distance as a fraction of the drawn disk.
 * Milky Way: ~8 kpc / ~16 kpc outer disk ≈ 0.5.
 */
export const EARTH_RADIUS_FRAC = 0.48;
export const EARTH_ANGLE = -0.55;
export const DEFAULT_BULGE_RADIUS = 52;
export const MIN_BULGE_RADIUS = 10;
export const MAX_BULGE_RADIUS = 140;
export const DEFAULT_ZOOM = 1;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;
export const DEFAULT_DETECT_RADIUS = 95;
export const MIN_DETECT_RADIUS = 15;
export const MAX_DETECT_RADIUS = 420;
/** Higher = more wound logarithmic spiral (tighter arms). */
export const DEFAULT_ARM_TIGHTNESS = 0.95;
export const MIN_ARM_TIGHTNESS = 0.2;
export const MAX_ARM_TIGHTNESS = 1.8;
const DETECT_RADIAL_BINS = 24;

export type DrakeGalaxySim = {
  step: (dt: number) => void;
  setFactors: (factors: DrakeFactors) => void;
  setHighlightStage: (stage: DrakeStage) => void;
  setStarCount: (count: number) => void;
  setBulgeRadius: (radius: number) => void;
  setZoom: (zoom: number) => void;
  setDetectRadius: (radius: number) => void;
  setArmTightness: (tightness: number) => void;
  setLayoutMode: (mode: DrakeLayoutMode) => void;
  setGalaxyImageMap: (map: GalaxyLuminanceMap | null) => void;
  setEarthPosition: (x: number, y: number) => void;
  hitTestEarth: (screenX: number, screenY: number) => boolean;
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  reseed: (seed?: number) => void;
  getSnapshot: () => DrakeSnapshot;
  reset: () => void;
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function earthMarker(): EarthMarker {
  const radius = DISK_RADIUS * EARTH_RADIUS_FRAC;
  return {
    x: GALAXY_CX + Math.cos(EARTH_ANGLE) * radius,
    y: GALAXY_CY + Math.sin(EARTH_ANGLE) * radius * DISK_Y_SCALE,
    radius
  };
}

/** Deprojected distance from Earth in the same metric as galactocentric radius. */
export function distanceFromEarth(star: DrakeStar, earth: EarthMarker): number {
  return Math.hypot(star.x - earth.x, (star.y - earth.y) / DISK_Y_SCALE);
}

function generateProceduralStars(count: number, seed: number, armTightness: number): DrakeStar[] {
  const rand = mulberry32(seed);
  const stars: DrakeStar[] = [];
  const arms = 4;
  const wind = clamp(armTightness, MIN_ARM_TIGHTNESS, MAX_ARM_TIGHTNESS);
  const widthScale = 1.15 - 0.35 * ((wind - MIN_ARM_TIGHTNESS) / (MAX_ARM_TIGHTNESS - MIN_ARM_TIGHTNESS));

  for (let i = 0; i < count; i += 1) {
    const arm = i % arms;
    const roll = rand();
    let radius: number;
    let inArm = false;
    if (roll < 0.22) {
      radius = Math.pow(rand(), 1.7) * (DISK_RADIUS * 0.28);
    } else if (roll < 0.86) {
      inArm = true;
      radius = (0.12 + Math.pow(rand(), 0.72) * 0.88) * DISK_RADIUS;
    } else {
      radius = Math.pow(rand(), 0.55) * DISK_RADIUS;
    }

    let theta: number;
    if (inArm) {
      const armBase = (arm / arms) * Math.PI * 2;
      const angularJitter = (0.55 - 0.18 * ((wind - 0.55) / 1.25)) * widthScale;
      theta = armBase + Math.log(1 + radius) * wind + (rand() - 0.5) * Math.max(0.18, angularJitter);
    } else {
      theta = rand() * Math.PI * 2;
    }

    const armWidth = inArm ? (10 + radius * 0.03) * widthScale : 22;
    const jitter = (rand() - 0.5) * armWidth;
    const x =
      GALAXY_CX + Math.cos(theta) * radius + Math.cos(theta + Math.PI / 2) * jitter * 0.4;
    const y =
      GALAXY_CY +
      Math.sin(theta) * radius * DISK_Y_SCALE +
      Math.sin(theta + Math.PI / 2) * jitter * 0.28;

    const brightness = inArm ? 0.55 + rand() * 0.45 : 0.25 + rand() * 0.4;

    stars.push({
      x: clamp(x, 4, LOGICAL_WIDTH - 4),
      y: clamp(y, 4, LOGICAL_HEIGHT - 4),
      radius: Math.hypot(x - GALAXY_CX, (y - GALAXY_CY) / DISK_Y_SCALE),
      uPlanets: rand(),
      uHabitable: rand(),
      uLife: rand(),
      uIntel: rand(),
      uComm: rand(),
      uActive: rand(),
      phase: rand() * Math.PI * 2,
      arm,
      brightness
    });
  }
  return stars;
}

function generateImageStars(count: number, seed: number, map: GalaxyLuminanceMap): DrakeStar[] {
  const rand = mulberry32(seed ^ 0x51ed);
  const points = samplePointsFromMap(map, count, seed, {
    cx: GALAXY_CX,
    cy: GALAXY_CY,
    rx: DISK_RADIUS,
    ry: DISK_RADIUS * DISK_Y_SCALE
  });
  const stars: DrakeStar[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    stars.push({
      x: clamp(p.x, 4, LOGICAL_WIDTH - 4),
      y: clamp(p.y, 4, LOGICAL_HEIGHT - 4),
      radius: Math.hypot(p.x - GALAXY_CX, (p.y - GALAXY_CY) / DISK_Y_SCALE),
      uPlanets: rand(),
      uHabitable: rand(),
      uLife: rand(),
      uIntel: rand(),
      uComm: rand(),
      uActive: rand(),
      phase: rand() * Math.PI * 2,
      arm: i % 4,
      brightness: p.brightness
    });
  }
  return stars;
}

function stageOfStar(star: DrakeStar, f: DrakeFactors, bulgeRadius: number): DrakeStage {
  const inHostileBulge = star.radius <= bulgeRadius;
  if (star.uPlanets >= f.fP) {
    return "star";
  }
  if (inHostileBulge) {
    return "planets";
  }
  const pHab = habitableProbability(f.nE);
  if (star.uHabitable >= pHab) {
    return "planets";
  }
  if (star.uLife >= f.fL) {
    return "habitable";
  }
  if (star.uIntel >= f.fI) {
    return "life";
  }
  if (star.uComm >= f.fC) {
    return "intelligent";
  }
  const pActive = activeProbability(f.L);
  if (star.uActive >= pActive) {
    return "communicating";
  }
  return "active";
}

const STAGE_RANK: Record<DrakeStage, number> = {
  star: 0,
  planets: 1,
  habitable: 2,
  life: 3,
  intelligent: 4,
  communicating: 5,
  active: 6
};

function countStages(stars: DrakeStar[], f: DrakeFactors, bulgeRadius: number): DrakeCounts {
  const counts: DrakeCounts = {
    stars: stars.length,
    withPlanets: 0,
    habitable: 0,
    withLife: 0,
    intelligent: 0,
    communicating: 0,
    active: 0,
    inBulge: 0
  };
  for (const star of stars) {
    if (star.radius <= bulgeRadius) {
      counts.inBulge += 1;
    }
    const stage = stageOfStar(star, f, bulgeRadius);
    const rank = STAGE_RANK[stage];
    if (rank >= 1) {
      counts.withPlanets += 1;
    }
    if (rank >= 2) {
      counts.habitable += 1;
    }
    if (rank >= 3) {
      counts.withLife += 1;
    }
    if (rank >= 4) {
      counts.intelligent += 1;
    }
    if (rank >= 5) {
      counts.communicating += 1;
    }
    if (rank >= 6) {
      counts.active += 1;
    }
  }
  return counts;
}

function expectedActiveInSample(starCount: number, f: DrakeFactors): number {
  return (
    starCount *
    f.fP *
    habitableProbability(f.nE) *
    f.fL *
    f.fI *
    f.fC *
    activeProbability(f.L)
  );
}

function buildDetectablePdf(
  stars: DrakeStar[],
  f: DrakeFactors,
  bulgeRadius: number,
  earth: EarthMarker,
  detectRadius: number
): DetectablePdf {
  const radialBins = new Array<number>(DETECT_RADIAL_BINS).fill(0);
  let starsInHorizon = 0;
  let habitable = 0;
  let withLife = 0;
  let intelligent = 0;
  let communicating = 0;
  let active = 0;

  for (const star of stars) {
    const dist = distanceFromEarth(star, earth);
    if (dist > detectRadius) {
      continue;
    }
    starsInHorizon += 1;
    const rank = STAGE_RANK[stageOfStar(star, f, bulgeRadius)];
    if (rank >= 2) {
      habitable += 1;
      const bin = Math.min(
        DETECT_RADIAL_BINS - 1,
        Math.floor((dist / Math.max(detectRadius, 1e-6)) * DETECT_RADIAL_BINS)
      );
      radialBins[bin] += 1;
    }
    if (rank >= 3) {
      withLife += 1;
    }
    if (rank >= 4) {
      intelligent += 1;
    }
    if (rank >= 5) {
      communicating += 1;
    }
    if (rank >= 6) {
      active += 1;
    }
  }

  return {
    detectRadius,
    starsInHorizon,
    categories: [
      { id: "habitable", label: "habitable", count: habitable },
      { id: "life", label: "life", count: withLife },
      { id: "intelligent", label: "intelligent", count: intelligent },
      { id: "communicating", label: "comm.", count: communicating },
      { id: "active", label: "active", count: active }
    ],
    radialBins
  };
}

export function createDrakeGalaxySim(initial?: Partial<DrakeSettings>): DrakeGalaxySim {
  let starCount = clamp(initial?.starCount ?? 10000, 1500, 20000);
  let seed = initial?.seed ?? 42;
  let factors: DrakeFactors = { ...(initial?.factors ?? DEFAULT_FACTORS) };
  let highlightStage: DrakeStage = initial?.highlightStage ?? "active";
  let bulgeRadius = clamp(initial?.bulgeRadius ?? DEFAULT_BULGE_RADIUS, MIN_BULGE_RADIUS, MAX_BULGE_RADIUS);
  let zoom = clamp(initial?.zoom ?? DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM);
  let detectRadius = clamp(
    initial?.detectRadius ?? DEFAULT_DETECT_RADIUS,
    MIN_DETECT_RADIUS,
    MAX_DETECT_RADIUS
  );
  let armTightness = clamp(
    initial?.armTightness ?? DEFAULT_ARM_TIGHTNESS,
    MIN_ARM_TIGHTNESS,
    MAX_ARM_TIGHTNESS
  );
  let layoutMode: DrakeLayoutMode = initial?.layoutMode ?? "procedural";
  let galaxyMap: GalaxyLuminanceMap | null = null;
  let time = 0;
  let earth = earthMarker();
  let stars: DrakeStar[] = [];

  function rebuildStars(): void {
    if (layoutMode === "image" && galaxyMap) {
      stars = generateImageStars(starCount, seed, galaxyMap);
    } else {
      stars = generateProceduralStars(starCount, seed, armTightness);
    }
  }

  rebuildStars();

  return {
    step(dt: number): void {
      time += clamp(dt, 0, 0.05);
    },
    setFactors(next: DrakeFactors): void {
      factors = {
        rStar: clamp(next.rStar, 1, 100),
        fP: clamp(next.fP, 0.01, 1),
        nE: clamp(next.nE, 0.01, 5),
        fL: clamp(next.fL, 0.0001, 1),
        fI: clamp(next.fI, 0.0001, 1),
        fC: clamp(next.fC, 0.01, 1),
        L: clamp(next.L, 10, 1e9)
      };
    },
    setHighlightStage(stage: DrakeStage): void {
      highlightStage = stage;
    },
    setStarCount(count: number): void {
      starCount = clamp(Math.round(count), 1500, 20000);
      rebuildStars();
    },
    setBulgeRadius(radius: number): void {
      bulgeRadius = clamp(radius, MIN_BULGE_RADIUS, MAX_BULGE_RADIUS);
    },
    setZoom(next: number): void {
      zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);
    },
    setDetectRadius(radius: number): void {
      detectRadius = clamp(radius, MIN_DETECT_RADIUS, MAX_DETECT_RADIUS);
    },
    setArmTightness(tightness: number): void {
      armTightness = clamp(tightness, MIN_ARM_TIGHTNESS, MAX_ARM_TIGHTNESS);
      if (layoutMode === "procedural") {
        rebuildStars();
      }
    },
    setLayoutMode(mode: DrakeLayoutMode): void {
      layoutMode = mode;
      rebuildStars();
    },
    setGalaxyImageMap(map: GalaxyLuminanceMap | null): void {
      galaxyMap = map;
      if (layoutMode === "image") {
        rebuildStars();
      }
    },
    setEarthPosition(x: number, y: number): void {
      const nx = clamp(x, 8, LOGICAL_WIDTH - 8);
      const ny = clamp(y, 8, LOGICAL_HEIGHT - 8);
      earth = {
        x: nx,
        y: ny,
        radius: Math.hypot(nx - GALAXY_CX, (ny - GALAXY_CY) / DISK_Y_SCALE)
      };
    },
    screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
      return {
        x: earth.x + (screenX - earth.x) / zoom,
        y: earth.y + (screenY - earth.y) / zoom
      };
    },
    hitTestEarth(screenX: number, screenY: number): boolean {
      return Math.hypot(screenX - earth.x, screenY - earth.y) <= 22;
    },
    reseed(nextSeed?: number): void {
      seed = nextSeed ?? (Math.floor(Math.random() * 1e9) | 0);
      rebuildStars();
    },
    getSnapshot(): DrakeSnapshot {
      return {
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
        stars,
        factors: { ...factors },
        classicN: classicDrakeN(factors),
        expectedActive: expectedActiveInSample(starCount, factors),
        counts: countStages(stars, factors, bulgeRadius),
        highlightStage,
        bulgeRadius,
        zoom,
        detectRadius,
        detectable: buildDetectablePdf(stars, factors, bulgeRadius, earth, detectRadius),
        armTightness,
        layoutMode,
        galaxyImage: layoutMode === "image" && galaxyMap ? galaxyMap.image : null,
        earth: { ...earth },
        note: HONESTY_NOTE,
        seed,
        time
      };
    },
    reset(): void {
      time = 0;
      bulgeRadius = DEFAULT_BULGE_RADIUS;
      zoom = DEFAULT_ZOOM;
      detectRadius = DEFAULT_DETECT_RADIUS;
      armTightness = DEFAULT_ARM_TIGHTNESS;
      layoutMode = "procedural";
      earth = earthMarker();
      rebuildStars();
    }
  };
}

export function classifyStar(
  star: DrakeStar,
  factors: DrakeFactors,
  bulgeRadius: number
): DrakeStage {
  return stageOfStar(star, factors, bulgeRadius);
}

export function stageRank(stage: DrakeStage): number {
  return STAGE_RANK[stage];
}
