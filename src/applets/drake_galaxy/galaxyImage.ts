/**
 * Optional galaxy image → star positions via luminance-weighted sampling.
 * Simulation stays usable if the asset fails to load (caller falls back to procedural).
 */

/** Respect Vite `base` so GitHub Pages subpath deploys resolve the asset. */
function galaxyImageUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}drake_galaxy/milky_way_nasa.jpg`;
}

export const GALAXY_IMAGE_URL = galaxyImageUrl();
export const GALAXY_IMAGE_CREDIT =
  "NASA/JPL-Caltech/R. Hurt (public domain artist's impression)";

export type GalaxyLuminanceMap = {
  image: HTMLImageElement;
  width: number;
  height: number;
  /** Cumulative luminance weights, length width*height; last entry = total. */
  cum: Float64Array;
  total: number;
};

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
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

/**
 * Build a sampling map from an already-decoded image.
 * Dark sky is suppressed; bright disk/arms dominate the CDF.
 */
export function buildLuminanceMap(image: HTMLImageElement): GalaxyLuminanceMap {
  const maxSide = 360;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(32, Math.round(image.naturalWidth * scale));
  const height = Math.max(32, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not read galaxy image pixels");
  }
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const n = width * height;
  const cum = new Float64Array(n);
  let total = 0;
  const cx = (width - 1) * 0.5;
  const cy = (height - 1) * 0.5;
  const rad = Math.min(cx, cy);

  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    const r = data[o] / 255;
    const g = data[o + 1] / 255;
    const b = data[o + 2] / 255;
    // Perceived luminance; gamma concentrates samples on bright structure.
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const x = i % width;
    const y = Math.floor(i / width);
    const rr = Math.hypot(x - cx, y - cy) / rad;
    // Soft circular mask so black corners do not steal samples.
    const mask = rr > 1 ? 0 : clamp01(1 - Math.pow(Math.max(0, rr - 0.92) / 0.08, 2));
    const w = Math.pow(Math.max(0, lum - 0.06), 1.65) * mask;
    total += w;
    cum[i] = total;
  }

  if (total <= 1e-9) {
    throw new Error("Galaxy image has no usable luminance");
  }

  return { image, width, height, cum, total };
}

export function loadGalaxyLuminanceMap(url: string = GALAXY_IMAGE_URL): Promise<GalaxyLuminanceMap> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try {
        resolve(buildLuminanceMap(image));
      } catch (err) {
        reject(err);
      }
    };
    image.onerror = () => reject(new Error(`Failed to load galaxy image: ${url}`));
    image.src = url;
  });
}

export type ImageSamplePoint = {
  x: number;
  y: number;
  brightness: number;
};

/**
 * Sample star positions in logical canvas space from the luminance CDF.
 * Points are placed in an ellipse matching the procedural disk foreshortening.
 */
export function samplePointsFromMap(
  map: GalaxyLuminanceMap,
  count: number,
  seed: number,
  layout: { cx: number; cy: number; rx: number; ry: number }
): ImageSamplePoint[] {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const out: ImageSamplePoint[] = [];
  const { width, height, cum, total } = map;

  for (let i = 0; i < count; i += 1) {
    const target = rand() * total;
    // Binary search CDF.
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const ix = lo % width;
    const iy = Math.floor(lo / width);
    // Jitter within pixel, then map image square → foreshortened disk ellipse.
    const u = (ix + rand()) / width;
    const v = (iy + rand()) / height;
    const x = layout.cx + (u - 0.5) * 2 * layout.rx;
    const y = layout.cy + (v - 0.5) * 2 * layout.ry;

    // Recover approximate source luminance for render brightness.
    const prev = lo > 0 ? cum[lo - 1] : 0;
    const w = Math.max(0, cum[lo] - prev);
    const brightness = clamp01(0.35 + Math.pow(w / (total / cum.length + 1e-12), 0.35) * 0.65);

    out.push({ x, y, brightness });
  }
  return out;
}
