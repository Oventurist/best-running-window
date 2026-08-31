export function renderTimeline(el, { minute, wbgtPerMin, comfortPerMin, window, shaded, placeName, sessionType, onWindowChange }) {
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
      const cp1y = p1[1] + (p2[1] - p1[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const comfortPts = smoothSeries(score, 15).map((v, i) => [x(i), yC(v)]);
  const tempPts = smoothSeries(tempsF, 15).map((v, i) => [x(i), yT(v)]);
  const comfortPath = smoothPath(comfortPts);
  const tempPath = smoothPath(tempPts);
  const xs = x(window.startMin), xe = x(window.endMin);
  const winLen = window.endMin - window.startMin;

  // Best window at render time — used by the reset button (captured before any
  // drag mutates window.startMin / window.endMin).
  const bestStart = window.startMin;
  const bestEnd = window.endMin;

  el.innerHTML = `
    <h2 class="chart-title">24-hour running-comfort timeline${placeName ? ` — ${placeName}` : ''}</h2>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="24-hour temperature and running-comfort timeline with best run window highlighted" preserveAspectRatio="xMidYMid meet">
      <path d="${comfortPath}" fill="none" stroke="#2DD4BF" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" shape-rendering="geometricPrecision" />
      <path d="${tempPath}" fill="none" stroke="#020617" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" shape-rendering="geometricPrecision" />
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#c6c6cd" />
      ${[0, 6, 12, 18, 24].map((h) => {
        const i = Math.min(n - 1, h * 60);
        return `<text x="${x(i).toFixed(1)}" y="${H - pad + 18}" font-size="11" fill="#45464d" text-anchor="middle">${String(h).padStart(2,'0')}:00</text>`;
      }).join('')}
      <g id="window-band" class="window-band" role="slider" tabindex="0"
         aria-label="Best run window. Drag to choose a different start time, or use arrow keys."
         aria-valuemin="0" aria-valuemax="${Math.max(0, n - winLen)}" aria-valuenow="${window.startMin}">
        <rect class="band-hit" x="${(xs - 6).toFixed(1)}" y="${pad}" width="${(xe - xs + 12).toFixed(1)}" height="${H - 2 * pad}" fill="transparent" />
        <rect id="band-rect" x="${xs.toFixed(1)}" y="${pad}" width="${(xe - xs).toFixed(1)}" height="${H - 2 * pad}" fill="#2DD4BF" opacity="0.18" />
        <line id="band-line-start" x1="${xs.toFixed(1)}" y1="${pad}" x2="${xs.toFixed(1)}" y2="${H - pad}" stroke="#2DD4BF" stroke-width="2" />
        <line id="band-line-end" x1="${xe.toFixed(1)}" y1="${pad}" x2="${xe.toFixed(1)}" y2="${H - pad}" stroke="#2DD4BF" stroke-width="2" />
      </g>
    </svg>
    <div class="chart-legend" aria-hidden="false">
      <span class="legend-item"><span class="legend-swatch legend-swatch--mint"></span> Running comfort <span class="legend-note">(higher = better)</span></span>
      <span class="legend-item"><span class="legend-swatch legend-swatch--navy"></span> Temperature (°F)</span>
      <span class="legend-item"><span class="legend-swatch legend-swatch--band"></span> Best run window <span class="legend-note">— drag to explore</span></span>
    </div>
    <div class="chart-actions">
      <button type="button" id="window-reset" class="window-reset-btn">
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0; font-size: 18px;">restart_alt</span>
        Reset to best window
      </button>
    </div>
  `;

  // ---- Drag / keyboard interaction on the window band ----
  const svg = el.querySelector && el.querySelector('svg');
  const band = el.querySelector && el.querySelector('#window-band');
  if (!svg || !band || typeof svg.setPointerCapture !== 'function') return;

  const bandRect = band.querySelector('#band-rect');
  const lineStart = band.querySelector('#band-line-start');
  const lineEnd = band.querySelector('#band-line-end');
  const hit = band.querySelector('.band-hit');
  const pxPerMin = (W - 2 * pad) / (n - 1);

  const moveBand = (s, e) => {
    const sStr = s.toFixed(1), eStr = e.toFixed(1);
    bandRect.setAttribute('x', sStr);
    bandRect.setAttribute('width', (e - s).toFixed(1));
    lineStart.setAttribute('x1', sStr);
    lineStart.setAttribute('x2', sStr);
    lineEnd.setAttribute('x1', eStr);
    lineEnd.setAttribute('x2', eStr);
    hit.setAttribute('x', (s - 6).toFixed(1));
    hit.setAttribute('width', (e - s + 12).toFixed(1));
  };

  const clientToMin = (clientX, clientY) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const loc = pt.matrixTransform(ctm.inverse());
    const i = Math.round((loc.x - pad) / (W - 2 * pad) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  };

  const emitChange = () => {
    band.setAttribute('aria-valuenow', String(window.startMin));
    if (typeof onWindowChange === 'function') onWindowChange(window.startMin);
  };

  // Snap the band back to the original best window (e.g. after exploring).
  const resetBand = () => {
    window.startMin = bestStart;
    window.endMin = bestEnd;
    moveBand(x(bestStart), x(bestEnd));
    emitChange();
  };
  const resetBtn = el.querySelector('#window-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => { e.preventDefault(); resetBand(); });
  }

  let dragging = false;
  let grabOffsetMin = 0;

  band.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { band.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    dragging = true;
    const min = clientToMin(e.clientX, e.clientY);
    grabOffsetMin = (min == null ? 0 : min) - window.startMin;
    band.classList.add('is-dragging');
  });

  band.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const min = clientToMin(e.clientX, e.clientY);
    if (min == null) return;
    let newStart = Math.round(min - grabOffsetMin);
    const win = window.endMin - window.startMin;
    newStart = Math.max(0, Math.min(n - win, newStart));
    if (newStart === window.startMin) return;
    window.startMin = newStart;
    window.endMin = newStart + win;
    moveBand(x(newStart), x(newStart + win));
    emitChange();
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    band.classList.remove('is-dragging');
    try { band.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  };
  band.addEventListener('pointerup', endDrag);
  band.addEventListener('pointercancel', endDrag);

  band.addEventListener('keydown', (e) => {
    const win = window.endMin - window.startMin;
    let handled = true;
    if (e.key === 'ArrowLeft') window.startMin = Math.max(0, window.startMin - 1);
    else if (e.key === 'ArrowRight') window.startMin = Math.min(n - win, window.startMin + 1);
    else if (e.key === 'Home') window.startMin = 0;
    else if (e.key === 'End') window.startMin = n - win;
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    window.endMin = window.startMin + win;
    moveBand(x(window.startMin), x(window.endMin));
    emitChange();
  });
}
