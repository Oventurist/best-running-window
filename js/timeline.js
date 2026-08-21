export function renderTimeline(el, { minute, wbgtPerMin, window, shaded, placeName }) {
  const W = 800, H = 320, pad = 40;
  const n = wbgtPerMin.length;
  if (n === 0) { el.innerHTML = ''; return; }
  const cToF = (c) => c * 9 / 5 + 32;
  const tempsF = minute.temperature_2m.map(cToF);
  const x = (i) => pad + (i / (n - 1)) * (W - 2 * pad);
  const tMin = Math.min(...tempsF), tMax = Math.max(...tempsF);
  const yT = (v) => H - pad - ((v - tMin) / (tMax - tMin || 1)) * (H - 2 * pad);

  const tempPath = tempsF.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yT(v).toFixed(1)}`).join(' ');
  const xs = x(window.startMin), xe = x(window.endMin);
  const winLen = window.endMin - window.startMin;

  el.innerHTML = `
    <h2 class="chart-title">24-hour heat-stress timeline${placeName ? ` — ${placeName}` : ''}</h2>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="24-hour temperature and heat-stress timeline with best run window highlighted" preserveAspectRatio="xMidYMid meet">
      <rect x="${xs.toFixed(1)}" y="${pad}" width="${(xe - xs).toFixed(1)}" height="${H - 2 * pad}" fill="#2DD4BF" opacity="0.18" />
      <line x1="${xs.toFixed(1)}" y1="${pad}" x2="${xs.toFixed(1)}" y2="${H - pad}" stroke="#2DD4BF" stroke-width="2" />
      <line x1="${xe.toFixed(1)}" y1="${pad}" x2="${xe.toFixed(1)}" y2="${H - pad}" stroke="#2DD4BF" stroke-width="2" />
      <path d="${tempPath}" fill="none" stroke="#020617" stroke-width="2.5" />
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="var(--color-border)" />
      ${[0, 6, 12, 18, 24].map((h) => {
        const i = Math.min(n - 1, h * 60);
        return `<text x="${x(i).toFixed(1)}" y="${H - pad + 18}" font-size="11" fill="#45464d" text-anchor="middle">${String(h).padStart(2,'0')}:00</text>`;
      }).join('')}
      <text x="${pad}" y="${pad - 12}" font-size="11" fill="#45464d">Temp °F (line) · mint band = best ${winLen}-min window</text>
    </svg>
  `;
}
