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

// cToF now lives in util.js (audit 2.3); import binds it for local use and the
// re-export keeps the existing import path working.
import { cToF } from './util.js';
export { cToF };

// Pure window→stats math. Reused for the initial render AND every live
// drag/keyboard step so there is a single source of truth.
export function summarizeWindow(comfortPerMin, wbgtPerMin, startMin, lengthMin) {
  const endMin = Math.min(startMin + lengthMin, comfortPerMin.length);
  const n = Math.max(1, endMin - startMin);
  let meanComfort = 0, meanWBGT = 0;
  for (let i = startMin; i < endMin; i++) {
    meanComfort += comfortPerMin[i];
    meanWBGT += wbgtPerMin[i];
  }
  return {
    startMin,
    endMin,
    score: Math.round(meanComfort / n),
    meanWBGT: meanWBGT / n
  };
}

// One star-rating renderer shared by the initial render and every drag/keyboard
// step, so the visible format never jumps and the aria-label never goes stale.
// "N of 5" belongs in the aria-label; the glyphs are the visible text.
export function renderStars(score) {
  const stars = Math.max(1, Math.min(5, Math.round(score / 20))); // 1..5
  return { ariaLabel: `${stars} of 5`, text: '★'.repeat(stars) + '☆'.repeat(5 - stars) };
}

// Update only the dynamic stat nodes in place (no full re-render) so dragging
// the window band feels real-time instead of flickering on every pixel.
export function updateWindowStats(el, { window, wbgtPerMin, comfortPerMin, lengthMin }) {
  const s = summarizeWindow(comfortPerMin, wbgtPerMin, window.startMin, lengthMin);
  window.startMin = s.startMin;
  window.endMin = s.endMin;
  window.score = s.score;
  window.meanWBGT = s.meanWBGT;
  const rating = s.score >= 80 ? 'Excellent' : s.score >= 60 ? 'Good' : s.score >= 40 ? 'Fair' : 'Poor';
  const stars = renderStars(s.score);
  const set = (id, txt) => {
    const node = el.querySelector('#' + id);
    if (node) node.textContent = txt;
  };
  set('res-time', `${minutesToHHMM(s.startMin)} – ${minutesToHHMM(s.endMin)}`);
  set('res-comfort', `${s.score}/100 ${rating}`);
  const starsNode = el.querySelector('#res-stars');
  if (starsNode) {
    starsNode.setAttribute('aria-label', stars.ariaLabel);
    starsNode.textContent = stars.text;
  }
  set('res-wbgt', `${cToF(s.meanWBGT).toFixed(1)}°F`);
  return window;
}

export function renderResults(el, { window, comfortPerMin, wbgtPerMin, runLengthMin, shaded, sessionType: _sessionType, sessionLabel, aqiAvailable, place }) {
  const minW = Math.min(...wbgtPerMin);
  const maxW = Math.max(...wbgtPerMin);
  const s = summarizeWindow(comfortPerMin, wbgtPerMin, window.startMin, window.endMin - window.startMin);
  window.score = s.score;
  window.meanWBGT = s.meanWBGT;
  const stars = renderStars(s.score); // shared with updateWindowStats (review fix 2)
  const rating = s.score >= 80 ? 'Excellent' : s.score >= 60 ? 'Good' : s.score >= 40 ? 'Fair' : 'Poor';
  el.innerHTML = `
    <div class="result-headline">
      <span class="result-label">Best window${sessionLabel ? ` · ${sessionLabel}` : ''}</span>
      <span class="result-time" id="res-time">${minutesToHHMM(window.startMin)} – ${minutesToHHMM(window.endMin)}</span>
    </div>
    <div class="result-stats">
      <div><span class="stat">Run length</span><strong>${formatRunLength(runLengthMin)}</strong></div>
      <div><span class="stat">Comfort score</span><strong id="res-comfort">${s.score}/100 ${rating}</strong></div>
      <div><span class="stat">Heat-stress rank</span><strong id="res-stars" aria-label="${stars.ariaLabel}">${stars.text}</strong></div>
      <div><span class="stat">Avg WBGT</span><strong id="res-wbgt">${cToF(s.meanWBGT).toFixed(1)}°F</strong></div>
      <div><span class="stat">Day WBGT range</span><strong>${cToF(minW).toFixed(1)}–${cToF(maxW).toFixed(1)}°F</strong></div>
      <div><span class="stat">Route</span><strong>${shaded ? 'Shaded' : 'Open sun'}</strong></div>
    </div>
    <p class="disclaimer">Comfort blends temperature, heat/humidity (WBGT), wind, rain chance${aqiAvailable ? ', and air quality' : ''} for a ${sessionLabel || 'training'} session — higher score = better window. It is not a heart-rate prediction; pair with your own perceived effort.</p>
  `;
  // API-derived strings must not pass through innerHTML (review fix 5):
  // inject the resolved place via textContent after the template render.
  if (place) {
    const p = document.createElement('p');
    p.className = 'result-place';
    const strong = document.createElement('strong');
    strong.id = 'res-place';
    strong.textContent = place;
    p.append('Forecast for ', strong, ' — double-check this is the right place.');
    const stats = el.querySelector('.result-stats');
    if (stats && stats.parentNode) stats.parentNode.insertBefore(p, stats);
  }
}

// Re-show the error in a way screen readers re-announce (audit 4.2): the node
// is recreated so the role="alert" fires again, then scrolled into view.
export function showError(el, msg) {
  el.hidden = true;
  const fresh = el.cloneNode(false);
  fresh.textContent = msg;
  fresh.hidden = false;
  el.parentNode.replaceChild(fresh, el);
  if (typeof fresh.scrollIntoView === 'function') {
    fresh.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return fresh;
}
