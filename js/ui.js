export function minutesToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatRunLength(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const cToF = (c) => c * 9 / 5 + 32;

export function renderResults(el, { window, comfortPerMin, wbgtPerMin, runLengthMin, shaded, sessionType, sessionLabel, aqiAvailable }) {
  const minW = Math.min(...wbgtPerMin);
  const maxW = Math.max(...wbgtPerMin);
  const score = window.score; // 0..100 comfort
  const stars = Math.max(1, Math.min(5, Math.round(score / 20))); // 1..5
  const rating = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';
  el.innerHTML = `
    <div class="result-headline">
      <span class="result-label">Best window${sessionLabel ? ` · ${sessionLabel}` : ''}</span>
      <span class="result-time">${minutesToHHMM(window.startMin)} – ${minutesToHHMM(window.endMin)}</span>
    </div>
    <div class="result-stats">
      <div><span class="stat">Run length</span><strong>${formatRunLength(runLengthMin)}</strong></div>
      <div><span class="stat">Comfort score</span><strong>${score}/100 ${rating}</strong></div>
      <div><span class="stat">Heat-stress rank</span><strong>${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</strong></div>
      <div><span class="stat">Avg WBGT</span><strong>${cToF(window.meanWBGT).toFixed(1)}°F</strong></div>
      <div><span class="stat">Day WBGT range</span><strong>${cToF(minW).toFixed(1)}–${cToF(maxW).toFixed(1)}°F</strong></div>
      <div><span class="stat">Route</span><strong>${shaded ? 'Shaded' : 'Open sun'}</strong></div>
    </div>
    <p class="disclaimer">Comfort blends temperature, heat/humidity (WBGT), wind, rain chance${aqiAvailable ? ', and air quality' : ''} for a ${sessionLabel || 'training'} session — higher score = better window. It is not a heart-rate prediction; pair with your own perceived effort.</p>
  `;
}

export function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
