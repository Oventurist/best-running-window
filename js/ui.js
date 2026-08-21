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

export function renderResults(el, { window, wbgtPerMin, runLengthMin, shaded }) {
  const minW = Math.min(...wbgtPerMin);
  const maxW = Math.max(...wbgtPerMin);
  const span = (maxW - minW) || 1;
  const rank = Math.round(((maxW - window.meanWBGT) / span) * 100); // 0=bad(=max),100=best(=min)
  const stars = Math.max(1, Math.round(rank / 20)); // 1..5
  el.innerHTML = `
    <div class="result-headline">
      <span class="result-label">Best window</span>
      <span class="result-time">${minutesToHHMM(window.startMin)} – ${minutesToHHMM(window.endMin)}</span>
    </div>
    <div class="result-stats">
      <div><span class="stat">Run length</span><strong>${formatRunLength(runLengthMin)}</strong></div>
      <div><span class="stat">Avg WBGT</span><strong>${cToF(window.meanWBGT).toFixed(1)}°F</strong></div>
      <div><span class="stat">Heat-stress rank</span><strong>${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} (${rank}%)</strong></div>
      <div><span class="stat">Day range</span><strong>${cToF(minW).toFixed(1)}–${cToF(maxW).toFixed(1)}°F</strong></div>
      <div><span class="stat">Route</span><strong>${shaded ? 'Shaded' : 'Open sun'}</strong></div>
    </div>
    <p class="disclaimer">WBGT is a heat-stress index. Lower = lower cardiovascular strain for your effort. Pair with your own baseline heart rate — this app does not predict BPM.</p>
  `;
}

export function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
