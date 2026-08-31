export function renderTimeline(el, { minute, wbgtPerMin, comfortPerMin, window, shaded, placeName, sessionType }) {
  const W = 800, H = 320, pad = 40;
  const n = wbgtPerMin.length;
  if (n === 0) { el.innerHTML = ''; return; }
  const cToF = (c) => c * 9 / 5 + 32;
  const tempsF = minute.temperature_2m.map(cToF);
  const x = (i) => pad + (i / (n - 1)) * (W - 2 * pad);
  const tMin = Math.min(...tempsF), tMax = Math.max(...tempsF);
  const yT = (v) => H - pad - ((v - tMin) / (tMax - tMin || 1)) * (H - 2 * pad);

  // Running-comfort score: passed in (session-aware, 0..100). Higher = better.
  // Falls back to WBGT-inverted if comfortPerMin not supplied.
  const score = (comfortPerMin && comfortPerMin.length === n)
    ? comfortPerMin
    : (() => {
        const wMin = Math.min(...wbgtPerMin), wMax = Math.max(...wbgtPerMin);
        const span = (wMax - wMin) || 1;
        return wbgtPerMin.map((w) => 100 * (wMax - w) / span);
      })();
  const yC = (v) => pad + (1 - v / 100) * (H - 2 * pad);
  // Centered moving average to soften threshold-driven cliffs in the plotted
  // series (e.g. comfort drops sharply as temp crosses a band). Only affects the
  // drawn line; the underlying 1-min values still drive the window calc.
  const smoothSeries = (arr, half) => {
    const out = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      let sum = 0, cnt = 0;
      for (let j = i - half; j <= i + half; j++) {
        if (j >= 0 && j < arr.length) { sum += arr[j]; cnt++; }
      }
      out[i] = sum / cnt;
    }
    return out;
  };
  // Smooth a list of [x,y] points into a Catmull-Rom -> cubic Bézier path.
  // Keeps every 1-min sample (no resolution loss) but renders as a curve.
  const smoothPath = (pts) => {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const comfortPts = smoothSeries(score, 15).map((v, i) => [x(i), yC(v)]);
  const tempPts = smoothSeries(tempsF, 5).map((v, i) => [x(i), yT(v)]);
  const comfortPath = smoothPath(comfortPts);
  const tempPath = smoothPath(tempPts);
  const xs = x(window.startMin), xe = x(window.endMin);
  const winLen = window.endMin - window.startMin;

  el.innerHTML = `
    <h2 class="chart-title">24-hour running-comfort timeline${placeName ? ` — ${placeName}` : ''}</h2>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="24-hour temperature and running-comfort timeline with best run window highlighted" preserveAspectRatio="xMidYMid meet">
      <rect x="${xs.toFixed(1)}" y="${pad}" width="${(xe - xs).toFixed(1)}" height="${H - 2 * pad}" fill="#2DD4BF" opacity="0.18" />
      <line x1="${xs.toFixed(1)}" y1="${pad}" x2="${xs.toFixed(1)}" y2="${H - pad}" stroke="#2DD4BF" stroke-width="2" />
      <line x1="${xe.toFixed(1)}" y1="${pad}" x2="${xe.toFixed(1)}" y2="${H - pad}" stroke="#2DD4BF" stroke-width="2" />
      <path d="${comfortPath}" fill="none" stroke="#2DD4BF" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" shape-rendering="geometricPrecision" />
      <path d="${tempPath}" fill="none" stroke="#020617" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" shape-rendering="geometricPrecision" />
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#c6c6cd" />
      ${[0, 6, 12, 18, 24].map((h) => {
        const i = Math.min(n - 1, h * 60);
        return `<text x="${x(i).toFixed(1)}" y="${H - pad + 18}" font-size="11" fill="#45464d" text-anchor="middle">${String(h).padStart(2,'0')}:00</text>`;
      }).join('')}
      <text x="${pad}" y="${pad - 12}" font-size="11" fill="#45464d">Mint line = running comfort (higher = better) · navy = Temp °F · mint band = best ${winLen}-min window</text>
    </svg>
  `;
}
