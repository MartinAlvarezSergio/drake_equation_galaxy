import { classifyStar, DISK_RADIUS, DISK_Y_SCALE, GALAXY_CX, GALAXY_CY, stageRank } from "./sim";
import { DrakeSnapshot, DrakeStage } from "./types";

const STAGE_STYLE: Record<
  DrakeStage,
  { fill: string; radius: number; glow?: string }
> = {
  star: { fill: "rgba(220, 225, 240, 0.42)", radius: 1.35 },
  planets: { fill: "rgba(240, 228, 190, 0.7)", radius: 1.6 },
  habitable: { fill: "rgba(110, 185, 255, 0.95)", radius: 2.35, glow: "rgba(90, 160, 255, 0.4)" },
  life: { fill: "rgba(80, 235, 215, 0.96)", radius: 2.55, glow: "rgba(70, 220, 200, 0.35)" },
  intelligent: { fill: "rgba(85, 230, 125, 0.96)", radius: 2.8, glow: "rgba(80, 220, 120, 0.4)" },
  communicating: { fill: "rgba(55, 255, 145, 0.98)", radius: 3.1, glow: "rgba(80, 255, 160, 0.45)" },
  active: { fill: "rgba(190, 255, 145, 1)", radius: 3.5, glow: "rgba(210, 255, 160, 0.55)" }
};

const OUTLINE = "rgba(0, 0, 0, 0.92)";

function fillTextOutlined(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  lineWidth = 3.2
): void {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function strokeOutlined(
  ctx: CanvasRenderingContext2D,
  draw: () => void,
  strokeStyle: string,
  lineWidth: number
): void {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lineWidth + 2.4;
  draw();
  ctx.stroke();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  draw();
  ctx.stroke();
  ctx.restore();
}

function fillCircleOutlined(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const g = ctx.createRadialGradient(GALAXY_CX, GALAXY_CY, 20, GALAXY_CX, GALAXY_CY, 460);
  g.addColorStop(0, "#1a2440");
  g.addColorStop(0.35, "#0e1628");
  g.addColorStop(1, "#05070e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Distant background stars.
  ctx.fillStyle = "rgba(200, 210, 230, 0.25)";
  for (let i = 0; i < 80; i += 1) {
    const x = ((i * 97) % width) + 0.5;
    const y = ((i * 53) % height) + 0.5;
    ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
}

function drawGalaxyImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement): void {
  const rx = DISK_RADIUS;
  const ry = DISK_RADIUS * DISK_Y_SCALE;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(GALAXY_CX, GALAXY_CY, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.4;
  ctx.drawImage(image, GALAXY_CX - rx, GALAXY_CY - ry, rx * 2, ry * 2);
  ctx.globalAlpha = 1;
  // Soft dark wash so overlays stay readable over bright image regions.
  ctx.fillStyle = "rgba(4, 8, 16, 0.28)";
  ctx.fillRect(GALAXY_CX - rx, GALAXY_CY - ry, rx * 2, ry * 2);
  ctx.restore();
}

function drawGalaxyGlow(ctx: CanvasRenderingContext2D, bulgeRadius: number, softDisk: boolean): void {
  if (softDisk) {
    // Disk glow (blueish spiral light).
    const disk = ctx.createRadialGradient(GALAXY_CX, GALAXY_CY, 30, GALAXY_CX, GALAXY_CY, 300);
    disk.addColorStop(0, "rgba(255, 210, 140, 0.16)");
    disk.addColorStop(0.35, "rgba(120, 150, 220, 0.08)");
    disk.addColorStop(1, "rgba(80, 120, 200, 0)");
    ctx.fillStyle = disk;
    ctx.beginPath();
    ctx.ellipse(GALAXY_CX, GALAXY_CY, 300, 190, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Dust lane.
    ctx.save();
    ctx.translate(GALAXY_CX, GALAXY_CY);
    ctx.rotate(-0.28);
    const dust = ctx.createLinearGradient(0, -28, 0, 28);
    dust.addColorStop(0, "rgba(0,0,0,0)");
    dust.addColorStop(0.5, "rgba(12, 10, 18, 0.45)");
    dust.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dust;
    ctx.fillRect(-340, -30, 680, 60);
    ctx.restore();
  }

  // Central bulge (warm, dense, hostile zone cue).
  const bulge = ctx.createRadialGradient(
    GALAXY_CX,
    GALAXY_CY,
    bulgeRadius * 0.15,
    GALAXY_CX,
    GALAXY_CY,
    bulgeRadius * 1.15
  );
  bulge.addColorStop(0, "rgba(255, 200, 120, 0.55)");
  bulge.addColorStop(0.45, "rgba(220, 120, 70, 0.22)");
  bulge.addColorStop(1, "rgba(180, 60, 40, 0)");
  ctx.fillStyle = bulge;
  ctx.beginPath();
  ctx.ellipse(GALAXY_CX, GALAXY_CY, bulgeRadius * 1.05, bulgeRadius * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.setLineDash([4, 5]);
  strokeOutlined(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(GALAXY_CX, GALAXY_CY, bulgeRadius, bulgeRadius * 0.68, 0, 0, Math.PI * 2);
    },
    "rgba(255, 170, 110, 0.95)",
    1.6
  );
  ctx.setLineDash([]);
}

function drawEarth(ctx: CanvasRenderingContext2D, snapshot: DrakeSnapshot): void {
  const { earth, time, detectRadius } = snapshot;
  const pulse = 0.65 + 0.35 * Math.sin(time * 2.4);

  // Detection horizon around Earth (foreshortened like the disk).
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    earth.x,
    earth.y,
    detectRadius,
    detectRadius * 0.62,
    0,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "rgba(90, 170, 255, 0.08)";
  ctx.fill();
  ctx.setLineDash([6, 5]);
  strokeOutlined(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(earth.x, earth.y, detectRadius, detectRadius * 0.62, 0, 0, Math.PI * 2);
    },
    "rgba(140, 220, 255, 0.95)",
    1.8
  );
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  strokeOutlined(
    ctx,
    () => {
      ctx.beginPath();
      ctx.arc(earth.x, earth.y, 11 + pulse * 2, 0, Math.PI * 2);
    },
    `rgba(150, 220, 255, ${0.55 + 0.35 * pulse})`,
    1.8
  );

  fillCircleOutlined(ctx, earth.x, earth.y, 4.6, "#5db7ff");
  fillCircleOutlined(ctx, earth.x - 1.1, earth.y - 0.4, 1.7, "#3f9a57");

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(235, 245, 255, 1)";
  fillTextOutlined(ctx, "Earth (Sun)", earth.x + 12, earth.y - 1, 3.6);
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(210, 230, 255, 1)";
  fillTextOutlined(ctx, `detect r=${Math.round(detectRadius)} · drag me`, earth.x + 12, earth.y + 14, 3.2);
  ctx.restore();
}

function drawLegend(ctx: CanvasRenderingContext2D): void {
  const items: Array<{ stage: DrakeStage; label: string }> = [
    { stage: "star", label: "stars" },
    { stage: "habitable", label: "habitable" },
    { stage: "life", label: "life" },
    { stage: "intelligent", label: "intelligent" },
    { stage: "active", label: "active now" }
  ];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  let x = 14;
  const y = 18;
  for (const item of items) {
    const style = STAGE_STYLE[item.stage];
    fillCircleOutlined(ctx, x, y, 3.8, style.fill);
    ctx.fillStyle = "rgba(240, 245, 255, 1)";
    fillTextOutlined(ctx, item.label, x + 8, y, 3);
    x += ctx.measureText(item.label).width + 28;
  }
  fillCircleOutlined(ctx, x, y, 3.8, "rgba(255, 170, 110, 0.95)");
  ctx.fillStyle = "rgba(240, 245, 255, 1)";
  fillTextOutlined(ctx, "hostile bulge", x + 8, y, 3);
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, snapshot: DrakeSnapshot): void {
  const { width, height, classicN, counts, bulgeRadius, zoom, detectable, layoutMode } = snapshot;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(8, 12, 20, 0.72)";
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  const boxW = 228;
  const boxH = 118;
  const x = width - boxW - 14;
  const y = 12;
  ctx.beginPath();
  roundRect(ctx, x, y, boxW, boxH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(220, 230, 245, 1)";
  fillTextOutlined(ctx, "Classic Drake N", x + 14, y + 22, 3);
  ctx.fillStyle = "#e8fff0";
  ctx.font = "700 28px system-ui, sans-serif";
  fillTextOutlined(ctx, formatN(classicN), x + 14, y + 52, 4);
  ctx.fillStyle = "rgba(220, 235, 250, 1)";
  ctx.font = "600 11px system-ui, sans-serif";
  fillTextOutlined(ctx, `Map active now: ${counts.active.toLocaleString()}`, x + 14, y + 74, 3);
  fillTextOutlined(
    ctx,
    `Bulge stars: ${counts.inBulge.toLocaleString()} · zoom ${zoom.toFixed(1)}×`,
    x + 14,
    y + 92,
    3
  );
  const detActive = detectable.categories.find((c) => c.id === "active")?.count ?? 0;
  fillTextOutlined(
    ctx,
    `Detectable active: ${detActive.toLocaleString()} · ${layoutMode === "image" ? "image" : "procedural"}`,
    x + 14,
    y + 110,
    3
  );

  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(235, 240, 250, 1)";
  ctx.font = "600 12px system-ui, sans-serif";
  const oneIn =
    counts.active > 0 ? Math.round(counts.stars / counts.active) : counts.stars;
  const line =
    counts.active > 0
      ? `In this map ≈ 1 in ${oneIn.toLocaleString()} sampled stars is active now`
      : "In this map: no currently active communicators";
  fillTextOutlined(ctx, line, 14, height - 14, 3.4);
  fillTextOutlined(
    ctx,
    `Hostile bulge radius ${Math.round(bulgeRadius)} px (uninhabitable zone)`,
    14,
    height - 30,
    3.4
  );
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function formatN(n: number): string {
  if (!Number.isFinite(n)) {
    return "—";
  }
  if (n >= 1e6) {
    return n.toExponential(2);
  }
  if (n >= 100) {
    return n.toFixed(0);
  }
  if (n >= 10) {
    return n.toFixed(1);
  }
  if (n >= 1) {
    return n.toFixed(2);
  }
  return n.toExponential(2);
}

export function renderDrakeGalaxy(
  ctx: CanvasRenderingContext2D,
  snapshot: DrakeSnapshot,
  options: { dimBelowHighlight: boolean; twinkle: boolean }
): void {
  const {
    width,
    height,
    stars,
    factors,
    highlightStage,
    time,
    bulgeRadius,
    zoom,
    earth,
    layoutMode,
    galaxyImage
  } = snapshot;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height);

  // Zoom about Earth so the detection horizon stays centered on screen.
  ctx.save();
  ctx.translate(earth.x, earth.y);
  ctx.scale(zoom, zoom);
  ctx.translate(-earth.x, -earth.y);

  const useImage = layoutMode === "image" && galaxyImage !== null;
  if (useImage && galaxyImage) {
    drawGalaxyImage(ctx, galaxyImage);
  }
  drawGalaxyGlow(ctx, bulgeRadius, !useImage);

  const minRank = options.dimBelowHighlight ? stageRank(highlightStage) : 0;

  for (const star of stars) {
    const stage = classifyStar(star, factors, bulgeRadius);
    const rank = stageRank(stage);
    let style = STAGE_STYLE[stage];
    if (options.dimBelowHighlight && rank < minRank) {
      style = STAGE_STYLE.star;
    }

    const inBulge = star.radius <= bulgeRadius;
    let alphaMul = 0.55 + 0.45 * star.brightness;
    if (inBulge && rank < 2) {
      alphaMul *= 0.85;
    }
    if (options.twinkle && (stage === "communicating" || stage === "active")) {
      alphaMul *= 0.72 + 0.28 * Math.sin(time * 3.2 + star.phase);
    }

    if (style.glow && rank >= 4) {
      ctx.beginPath();
      ctx.fillStyle = style.glow;
      ctx.arc(star.x, star.y, style.radius * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = alphaMul;
    ctx.beginPath();
    ctx.fillStyle = inBulge && rank < 2 ? "rgba(255, 190, 140, 0.55)" : style.fill;
    ctx.arc(star.x, star.y, style.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawEarth(ctx, snapshot);
  ctx.restore();

  // Keep HUD/legend screen-fixed.
  drawLegend(ctx);
  drawHud(ctx, snapshot);
}
