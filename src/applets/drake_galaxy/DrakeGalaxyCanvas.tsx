import { useEffect, useMemo, useRef, useState } from "react";
import { AppletHostAdapter } from "../../core/host";
import { ControlCard } from "../../ui/ControlCard";
import {
  DEFAULT_FACTORS,
  DRAKE_PRESETS,
  FACTOR_META,
  STAGE_LABELS,
  type DrakePresetId
} from "./factors";
import { renderDetectablePdfPlot } from "./detectPdfPlot";
import { GALAXY_IMAGE_CREDIT, loadGalaxyLuminanceMap } from "./galaxyImage";
import { renderDrakeGalaxy } from "./render";
import {
  createDrakeGalaxySim,
  DEFAULT_ARM_TIGHTNESS,
  DEFAULT_BULGE_RADIUS,
  DEFAULT_DETECT_RADIUS,
  DEFAULT_ZOOM,
  MAX_ARM_TIGHTNESS,
  MAX_BULGE_RADIUS,
  MAX_DETECT_RADIUS,
  MAX_ZOOM,
  MIN_ARM_TIGHTNESS,
  MIN_BULGE_RADIUS,
  MIN_DETECT_RADIUS,
  MIN_ZOOM
} from "./sim";
import { DrakeFactors, DrakeLayoutMode, DrakeStage } from "./types";

type DrakeGalaxyCanvasProps = {
  host?: AppletHostAdapter;
};

const STAGE_OPTIONS: DrakeStage[] = [
  "star",
  "planets",
  "habitable",
  "life",
  "intelligent",
  "communicating",
  "active"
];

const DETECT_PLOT_W = 900;
const DETECT_PLOT_H = 360;

function formatClassicN(n: number): string {
  if (n >= 1e6) {
    return n.toExponential(2);
  }
  if (n >= 100) {
    return Math.round(n).toLocaleString();
  }
  if (n >= 1) {
    return n.toFixed(2);
  }
  return n.toExponential(2);
}

export function DrakeGalaxyCanvas({ host }: DrakeGalaxyCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectPlotRef = useRef<HTMLCanvasElement | null>(null);
  const draggingEarthRef = useRef(false);
  const [running, setRunning] = useState(true);
  const [paused, setPaused] = useState(false);
  const [factors, setFactors] = useState<DrakeFactors>({ ...DEFAULT_FACTORS });
  const [starCount, setStarCount] = useState(10000);
  const [bulgeRadius, setBulgeRadius] = useState(DEFAULT_BULGE_RADIUS);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [detectRadius, setDetectRadius] = useState(DEFAULT_DETECT_RADIUS);
  const [armTightness, setArmTightness] = useState(DEFAULT_ARM_TIGHTNESS);
  const [layoutMode, setLayoutMode] = useState<DrakeLayoutMode>("image");
  const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [highlightStage, setHighlightStage] = useState<DrakeStage>("active");
  const [dimBelow, setDimBelow] = useState(false);
  const [twinkle, setTwinkle] = useState(true);
  const [classicN, setClassicN] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [countsText, setCountsText] = useState("");
  const [detectText, setDetectText] = useState("");

  const reducedMotion = host?.readReducedMotion?.() ?? false;
  const sim = useMemo(
    () =>
      createDrakeGalaxySim({
        starCount: 10000,
        seed: 42,
        factors: DEFAULT_FACTORS,
        highlightStage: "active",
        bulgeRadius: DEFAULT_BULGE_RADIUS,
        zoom: DEFAULT_ZOOM,
        detectRadius: DEFAULT_DETECT_RADIUS,
        armTightness: DEFAULT_ARM_TIGHTNESS,
        layoutMode: "image"
      }),
    []
  );

  useEffect(() => {
    if (reducedMotion) {
      setTwinkle(false);
    }
  }, [reducedMotion]);

  useEffect(() => {
    let cancelled = false;
    setImageStatus("loading");
    loadGalaxyLuminanceMap()
      .then((map) => {
        if (cancelled) {
          return;
        }
        sim.setGalaxyImageMap(map);
        setImageStatus("ready");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        sim.setGalaxyImageMap(null);
        setImageStatus("error");
        setLayoutMode((prev) => (prev === "image" ? "procedural" : prev));
      });
    return () => {
      cancelled = true;
    };
  }, [sim]);

  useEffect(() => {
    sim.setFactors(factors);
  }, [factors, sim]);

  useEffect(() => {
    sim.setHighlightStage(highlightStage);
  }, [highlightStage, sim]);

  useEffect(() => {
    sim.setStarCount(starCount);
  }, [starCount, sim]);

  useEffect(() => {
    sim.setBulgeRadius(bulgeRadius);
  }, [bulgeRadius, sim]);

  useEffect(() => {
    sim.setZoom(zoom);
  }, [zoom, sim]);

  useEffect(() => {
    sim.setDetectRadius(detectRadius);
  }, [detectRadius, sim]);

  useEffect(() => {
    sim.setArmTightness(armTightness);
  }, [armTightness, sim]);

  useEffect(() => {
    sim.setLayoutMode(layoutMode);
  }, [layoutMode, sim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const el = canvas;

    function canvasPoint(event: PointerEvent): { x: number; y: number } {
      const rect = el.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * el.width,
        y: ((event.clientY - rect.top) / rect.height) * el.height
      };
    }

    function onPointerDown(event: PointerEvent): void {
      const p = canvasPoint(event);
      if (!sim.hitTestEarth(p.x, p.y)) {
        return;
      }
      draggingEarthRef.current = true;
      el.setPointerCapture(event.pointerId);
      el.style.cursor = "grabbing";
      // Earth-centered zoom keeps Earth at its world coords on screen, so drag in screen space.
      sim.setEarthPosition(p.x, p.y);
      event.preventDefault();
    }

    function onPointerMove(event: PointerEvent): void {
      const p = canvasPoint(event);
      if (draggingEarthRef.current) {
        sim.setEarthPosition(p.x, p.y);
        return;
      }
      el.style.cursor = sim.hitTestEarth(p.x, p.y) ? "grab" : "default";
    }

    function onPointerUp(event: PointerEvent): void {
      if (!draggingEarthRef.current) {
        return;
      }
      draggingEarthRef.current = false;
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      const p = canvasPoint(event);
      el.style.cursor = sim.hitTestEarth(p.x, p.y) ? "grab" : "default";
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [sim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const plotCanvas = detectPlotRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const plotCtx = plotCanvas?.getContext("2d") ?? null;

    let last = performance.now();
    let raf = 0;
    const tick = (time: number): void => {
      const dt = (time - last) / 1000;
      last = time;
      if (running && !paused) {
        sim.step(dt);
      }
      const snapshot = sim.getSnapshot();
      renderDrakeGalaxy(ctx, snapshot, {
        dimBelowHighlight: dimBelow,
        twinkle: twinkle && !reducedMotion
      });
      if (plotCtx && plotCanvas) {
        renderDetectablePdfPlot(plotCtx, plotCanvas.width, plotCanvas.height, snapshot.detectable);
      }
      setClassicN(snapshot.classicN);
      setActiveCount(snapshot.counts.active);
      setCountsText(
        [
          `planets ${snapshot.counts.withPlanets}`,
          `habitable ${snapshot.counts.habitable}`,
          `life ${snapshot.counts.withLife}`,
          `intelligent ${snapshot.counts.intelligent}`,
          `comm ${snapshot.counts.communicating}`,
          `active ${snapshot.counts.active}`,
          `bulge ${snapshot.counts.inBulge}`
        ].join(" · ")
      );
      setDetectText(
        snapshot.detectable.categories
          .map((c) => `${c.label} ${c.count}`)
          .join(" · ")
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, paused, dimBelow, twinkle, reducedMotion, sim]);

  function patchFactor<K extends keyof DrakeFactors>(key: K, value: number): void {
    setFactors((prev) => ({ ...prev, [key]: value }));
  }

  function applyPreset(id: DrakePresetId): void {
    const preset = DRAKE_PRESETS.find((p) => p.id === id);
    if (!preset) {
      return;
    }
    setFactors({ ...preset.factors });
  }

  function onReset(): void {
    sim.reset();
    setFactors({ ...DEFAULT_FACTORS });
    setHighlightStage("active");
    setBulgeRadius(DEFAULT_BULGE_RADIUS);
    setZoom(DEFAULT_ZOOM);
    setDetectRadius(DEFAULT_DETECT_RADIUS);
    setArmTightness(DEFAULT_ARM_TIGHTNESS);
    setLayoutMode("image");
    setDimBelow(false);
    setPaused(false);
    setRunning(true);
    host?.onResult?.({ event: "reset" });
  }

  return (
    <div className="gravity-layout drake-layout">
      <ControlCard
        title="Drake Equation Galaxy"
        subtitle="Scrub each factor and watch how many stars stay habitable (blue) or inhabited/active (green)."
      >
        <div className="control-grid">
          <div className="drake-n-panel control-span-2">
            <div className="drake-n-label">N = R★ · fₚ · nₑ · fₗ · fᵢ · f_c · L</div>
            <div className="drake-n-value">{formatClassicN(classicN)}</div>
            <div className="drake-n-sub">
              Map sample active now: <strong>{activeCount.toLocaleString()}</strong>
            </div>
          </div>

          <p className="gravity-scenario-note control-span-2">
            Illustrative model only. Blue = habitable, green = inhabited/active. The warm central
            bulge is treated as largely uninhabitable. Drag Earth (Sun) to move the detection
            horizon; the cyan ellipse feeds the PDF panel.
          </p>

          <label className="control-span-2">
            <span className="slider-label">
              <span>Galaxy zoom (on Earth)</span>
              <strong>{zoom.toFixed(1)}×</strong>
            </span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
            <span className="gravity-distance-hints">
              Zooms toward Earth so the detection horizon stays centered.
            </span>
          </label>

          <div className="drake-presets control-span-2" role="group" aria-label="Drake presets">
            {DRAKE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="drake-preset"
                title={preset.blurb}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="control-span-2">
            Galaxy layout
            <select
              value={layoutMode}
              onChange={(event) => setLayoutMode(event.target.value as DrakeLayoutMode)}
            >
              <option value="procedural">Procedural spiral</option>
              <option value="image" disabled={imageStatus === "error"}>
                {imageStatus === "loading"
                  ? "NASA image (loading…)"
                  : imageStatus === "error"
                    ? "NASA image (unavailable)"
                    : "NASA image sample"}
              </option>
            </select>
            <span className="gravity-distance-hints">
              {layoutMode === "image"
                ? `Stars are sampled from image brightness (${GALAXY_IMAGE_CREDIT}). Not a star catalog.`
                : "Synthetic 4-arm disk. Switch to NASA image to sample from a public-domain artist's impression."}
            </span>
          </label>

          {FACTOR_META.map((meta) => {
            if (meta.key === "L") {
              const logMin = Math.log10(meta.min);
              const logMax = Math.log10(meta.max);
              const logVal = Math.log10(Math.max(factors.L, meta.min));
              const slider = ((logVal - logMin) / (logMax - logMin)) * 100;
              return (
                <label key={meta.key} className="control-span-2" title={meta.hint}>
                  <span className="slider-label">
                    <span>{meta.label}</span>
                    <strong>{meta.format(factors.L)}</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={slider}
                    onChange={(event) => {
                      const t = Number(event.target.value) / 100;
                      const next = 10 ** (logMin + t * (logMax - logMin));
                      patchFactor("L", next);
                    }}
                  />
                </label>
              );
            }
            return (
              <label key={meta.key} className="control-span-2" title={meta.hint}>
                <span className="slider-label">
                  <span>{meta.label}</span>
                  <strong>{meta.format(factors[meta.key])}</strong>
                </span>
                <input
                  type="range"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={factors[meta.key]}
                  onChange={(event) => patchFactor(meta.key, Number(event.target.value))}
                />
              </label>
            );
          })}

          <label className="control-span-2">
            <span className="slider-label">
              <span>Stars in map sample</span>
              <strong>{starCount.toLocaleString()}</strong>
            </span>
            <input
              type="range"
              min={2000}
              max={16000}
              step={500}
              value={starCount}
              onChange={(event) => setStarCount(Number(event.target.value))}
            />
          </label>

          <label className="control-span-2">
            <span className="slider-label">
              <span>Spiral arm tightness</span>
              <strong>{armTightness.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={MIN_ARM_TIGHTNESS}
              max={MAX_ARM_TIGHTNESS}
              step={0.05}
              value={armTightness}
              disabled={layoutMode === "image"}
              onChange={(event) => setArmTightness(Number(event.target.value))}
            />
            <span className="gravity-distance-hints">
              {layoutMode === "image"
                ? "Arm tightness applies only to the procedural spiral layout."
                : "Higher winds the logarithmic arms more tightly (and slightly narrows them)."}
            </span>
          </label>

          <label className="control-span-2">
            <span className="slider-label">
              <span>Hostile central bulge size</span>
              <strong>{Math.round(bulgeRadius)}</strong>
            </span>
            <input
              type="range"
              min={MIN_BULGE_RADIUS}
              max={MAX_BULGE_RADIUS}
              step={1}
              value={bulgeRadius}
              onChange={(event) => setBulgeRadius(Number(event.target.value))}
            />
            <span className="gravity-distance-hints">
              Stars inside the bulge cannot become habitable/green (galactic habitable zone cue).
            </span>
          </label>

          <label className="control-span-2">
            <span className="slider-label">
              <span>Detectable radius from Earth</span>
              <strong>{Math.round(detectRadius)}</strong>
            </span>
            <input
              type="range"
              min={MIN_DETECT_RADIUS}
              max={MAX_DETECT_RADIUS}
              step={1}
              value={detectRadius}
              onChange={(event) => setDetectRadius(Number(event.target.value))}
            />
            <span className="gravity-distance-hints">
              Only worlds inside this horizon count as “detectable” in the PDF panel.
            </span>
          </label>

          <label className="control-span-2">
            Focus stage
            <select
              value={highlightStage}
              onChange={(event) => setHighlightStage(event.target.value as DrakeStage)}
            >
              {STAGE_OPTIONS.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox control-span-2">
            <input
              type="checkbox"
              checked={dimBelow}
              onChange={(event) => setDimBelow(event.target.checked)}
            />
            Dim stars below focus stage
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={twinkle}
              onChange={(event) => setTwinkle(event.target.checked)}
              disabled={reducedMotion}
            />
            Twinkle active worlds
          </label>

          <div className="button-row control-span-2">
            <button type="button" onClick={() => { setRunning(true); setPaused(false); }}>
              Start
            </button>
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              disabled={!running}
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" onClick={() => sim.reseed()}>
              Reseed galaxy
            </button>
            <button type="button" onClick={onReset}>
              Reset
            </button>
          </div>

          <div className="stats control-span-2">
            <div className="drake-counts">{countsText}</div>
            <div className="drake-counts drake-detect-counts">Detectable: {detectText}</div>
          </div>
        </div>
      </ControlCard>

      <div className="drake-visual-column">
        <div className="canvas-shell card">
          <div className="gravity-canvas-frame">
            <canvas
              ref={canvasRef}
              width={900}
              height={620}
              style={{ touchAction: "none" }}
              aria-label="Drake galaxy map. Drag Earth to move the detection horizon."
            />
            <div className="gravity-canvas-toolbar" role="toolbar" aria-label="Drake playback">
              <button type="button" onClick={() => { setRunning(true); setPaused(false); }}>
                Start
              </button>
              <button type="button" onClick={() => setPaused((v) => !v)} disabled={!running}>
                {paused ? "Resume" : "Pause"}
              </button>
              <button type="button" onClick={() => sim.reseed()}>
                Reseed
              </button>
              <button type="button" onClick={onReset}>
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="canvas-shell card drake-detect-plot">
          <p className="drake-detect-plot-caption">
            Detectable PDF inside Earth’s horizon: category fractions among stars in range, plus
            distance distribution of habitable+ worlds. Illustrative sample only — not a survey
            prediction.
          </p>
          <canvas
            ref={detectPlotRef}
            width={DETECT_PLOT_W}
            height={DETECT_PLOT_H}
            aria-label="Detectable worlds PDF within detection radius"
          />
        </div>
      </div>
    </div>
  );
}
