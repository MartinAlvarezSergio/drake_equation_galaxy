import { DetectablePdf } from "./types";

const PAD_L = 52;
const PAD_R = 16;
const PAD_T = 14;
const PAD_B = 28;

const CATEGORY_COLORS: Record<string, string> = {
  habitable: "rgba(110, 185, 255, 0.88)",
  life: "rgba(80, 235, 215, 0.88)",
  intelligent: "rgba(85, 230, 125, 0.88)",
  communicating: "rgba(55, 255, 145, 0.88)",
  active: "rgba(190, 255, 145, 0.95)"
};

/**
 * Two-panel teaching plot:
 * 1) Category PDF of Drake stages inside the Earth detection horizon
 * 2) Radial distance PDF of detectable (habitable+) worlds from Earth
 */
export function renderDetectablePdfPlot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: DetectablePdf
): void {
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#070a14");
  bg.addColorStop(1, "#0c1220");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const plotW = width - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const catH = plotH * 0.46;
  const gap = 14;
  const histTop = PAD_T + catH + gap;
  const histH = plotH - catH - gap;

  ctx.fillStyle = "rgba(210, 220, 240, 0.92)";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Detectable-stage PDF within horizon", PAD_L, PAD_T);

  ctx.fillStyle = "rgba(170, 185, 210, 0.75)";
  ctx.font = "500 10px system-ui, sans-serif";
  ctx.fillText(
    `${data.starsInHorizon.toLocaleString()} stars inside r ≤ ${Math.round(data.detectRadius)} px from Earth`,
    PAD_L,
    PAD_T + 16
  );

  const categories = data.categories;
  const nCat = categories.length;
  const denom = Math.max(1, data.starsInHorizon);
  let maxPdf = 0;
  for (const c of categories) {
    maxPdf = Math.max(maxPdf, c.count / denom);
  }
  if (maxPdf < 1e-12) {
    maxPdf = 1;
  }

  const barTop = PAD_T + 34;
  const barAreaH = catH - 34;
  const gapX = 10;
  const barW = (plotW - gapX * (nCat - 1)) / Math.max(1, nCat);

  for (let i = 0; i < nCat; i += 1) {
    const c = categories[i];
    const pdf = c.count / denom;
    const bh = (pdf / maxPdf) * (barAreaH - 22);
    const x = PAD_L + i * (barW + gapX);
    const y = barTop + (barAreaH - 22) - bh;

    ctx.fillStyle = "rgba(40, 55, 80, 0.55)";
    ctx.fillRect(x, barTop, barW, barAreaH - 22);

    ctx.fillStyle = CATEGORY_COLORS[c.id] ?? "rgba(160, 190, 255, 0.8)";
    ctx.fillRect(x, y, barW, Math.max(bh, pdf > 0 ? 2 : 0));

    ctx.fillStyle = "rgba(220, 230, 245, 0.9)";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(c.count), x + barW / 2, y - 12);

    ctx.fillStyle = "rgba(180, 195, 215, 0.85)";
    ctx.font = "500 10px system-ui, sans-serif";
    ctx.fillText(c.label, x + barW / 2, barTop + barAreaH - 8);

    ctx.fillStyle = "rgba(150, 170, 195, 0.7)";
    ctx.font = "500 9px system-ui, sans-serif";
    ctx.fillText(`${(pdf * 100).toFixed(2)}%`, x + barW / 2, barTop + barAreaH + 4);
  }

  // Radial distance PDF of habitable+ worlds inside the horizon.
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(210, 220, 240, 0.92)";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText("PDF of distance from Earth (habitable+)", PAD_L, histTop);

  const habitablePlus = categories.find((c) => c.id === "habitable")?.count ?? 0;
  const binTotal = data.radialBins.reduce((a, b) => a + b, 0);
  ctx.fillStyle = "rgba(170, 185, 210, 0.75)";
  ctx.font = "500 10px system-ui, sans-serif";
  ctx.fillText(
    `${habitablePlus.toLocaleString()} habitable+ · ${binTotal.toLocaleString()} in histogram`,
    PAD_L,
    histTop + 16
  );

  const histBodyTop = histTop + 34;
  const histBodyH = histH - 48;
  const nBins = data.radialBins.length;

  if (binTotal === 0 || nBins === 0) {
    ctx.fillStyle = "rgba(160, 175, 200, 0.7)";
    ctx.font = "500 11px system-ui, sans-serif";
    ctx.fillText("No habitable worlds inside the detection horizon yet.", PAD_L, histBodyTop + 24);
    return;
  }

  let maxRadialPdf = 0;
  for (const count of data.radialBins) {
    maxRadialPdf = Math.max(maxRadialPdf, count / binTotal);
  }
  if (maxRadialPdf < 1e-12) {
    maxRadialPdf = 1;
  }

  ctx.strokeStyle = "rgba(90, 120, 170, 0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i += 1) {
    const ly = histBodyTop + (i / 3) * histBodyH;
    ctx.beginPath();
    ctx.moveTo(PAD_L, ly);
    ctx.lineTo(PAD_L + plotW, ly);
    ctx.stroke();
  }

  const binGap = 1;
  const bw = (plotW - binGap * (nBins - 1)) / nBins;
  for (let i = 0; i < nBins; i += 1) {
    const pdf = data.radialBins[i] / binTotal;
    const bh = (pdf / maxRadialPdf) * histBodyH * 0.92;
    const x = PAD_L + i * (bw + binGap);
    const y = histBodyTop + histBodyH - bh;
    ctx.fillStyle = "rgba(110, 185, 255, 0.78)";
    ctx.fillRect(x, y, bw, bh);
  }

  ctx.fillStyle = "rgba(170, 185, 210, 0.8)";
  ctx.font = "500 10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("0", PAD_L, histBodyTop + histBodyH + 14);
  ctx.textAlign = "right";
  ctx.fillText(`r_detect = ${Math.round(data.detectRadius)}`, PAD_L + plotW, histBodyTop + histBodyH + 14);
  ctx.textAlign = "center";
  ctx.fillText("distance from Earth →", PAD_L + plotW / 2, height - 10);
}
