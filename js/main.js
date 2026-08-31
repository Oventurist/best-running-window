import { geocodeZip, fetchWeather, fetchAirQuality } from './api.js';
import { interpolateHourly, interpolateSeries } from './interpolate.js';
import { computeWBGT } from './wbgt.js';
import { computeComfortIndex, findBestComfortWindow, SESSION_LABELS } from './comfort.js';
import { renderResults, showError } from './ui.js';
import { renderTimeline } from './timeline.js';

const form = document.getElementById('form');
const resultsEl = document.getElementById('results');
const chartEl = document.getElementById('chart');
const errorEl = document.getElementById('error');
const dateInput = document.getElementById('date');

// Open the native date picker on click/focus so the user doesn't have to use arrow keys.
const openPicker = () => {
  try { if (typeof dateInput.showPicker === 'function') dateInput.showPicker(); } catch (_) { /* ignore */ }
};
dateInput.addEventListener('click', openPicker);
dateInput.addEventListener('focus', openPicker);

// Default the date to today (local timezone) so the user doesn't have to pick it.
(function setDefaultDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  dateInput.value = `${y}-${m}-${d}`;
})();

// Session-type help popover toggle.
const helpBtn = document.getElementById('session-help');
const helpPop = document.getElementById('session-help-pop');
if (helpBtn && helpPop) {
  const toggleHelp = () => {
    const open = helpPop.classList.toggle('hidden') === false;
    helpBtn.setAttribute('aria-expanded', String(open));
  };
  helpBtn.addEventListener('click', (e) => { e.preventDefault(); toggleHelp(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !helpPop.classList.contains('hidden')) {
      helpPop.classList.add('hidden');
      helpBtn.setAttribute('aria-expanded', 'false');
      helpBtn.focus();
    }
  });
  // close when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!helpPop.classList.contains('hidden') && !helpPop.contains(e.target) && e.target !== helpBtn) {
      helpPop.classList.add('hidden');
      helpBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  resultsEl.innerHTML = '';
  chartEl.innerHTML = '';
  resultsEl.hidden = true;
  chartEl.hidden = true;
  const zip = form.zipcode.value.trim();
  const h = parseInt(form['duration-h'].value, 10) || 0;
  const m = parseInt(form['duration-m'].value, 10) || 0;
  const runLengthMin = h * 60 + m;
  if (!(runLengthMin >= 1 && runLengthMin <= 600)) {
    showError(errorEl, 'Enter a run length between 1 minute and 10 hours.');
    return;
  }
  const shaded = form.toggle.checked;
  const sessionType = form.session.value || 'easy';
  const dateISO = form.date.value; // 'YYYY-MM-DD'
  try {
    const { lat, lon, name } = await geocodeZip(zip);
    const raw = await fetchWeather(lat, lon, dateISO);
    // Air quality is best-effort; if it fails, comfort index drops that factor.
    let aqiPerMin = null;
    try {
      const air = await fetchAirQuality(lat, lon, dateISO);
      aqiPerMin = interpolateSeries(air.time, air.us_aqi);
    } catch (_) { aqiPerMin = null; }
    const minute = interpolateHourly(raw);
    const wbgtPerMin = computeWBGT(minute, { shaded });
    const comfortPerMin = computeComfortIndex({
      wbgtPerMin,
      tempPerMinC: minute.temperature_2m,
      windPerMinMs: minute.wind_speed_10m,
      precipPerMinPct: minute.precipitation_probability,
      aqiPerMin,
      sessionType
    });
    const window = findBestComfortWindow(comfortPerMin, runLengthMin);
    // mean WBGT across the chosen window for the stats readout
    let meanWBGT = 0;
    for (let i = window.startMin; i < window.endMin; i++) meanWBGT += wbgtPerMin[i];
    meanWBGT /= (window.endMin - window.startMin);
    window.meanWBGT = meanWBGT;
    renderResults(resultsEl, {
      window, comfortPerMin, wbgtPerMin, runLengthMin, shaded,
      sessionType, sessionLabel: SESSION_LABELS[sessionType], aqiAvailable: aqiPerMin !== null
    });
    renderTimeline(chartEl, {
      minute, wbgtPerMin, comfortPerMin, window, shaded, placeName: name, sessionType
    });
    resultsEl.hidden = false;
    chartEl.hidden = false;
  } catch (err) {
    showError(errorEl, err.message || 'Something went wrong fetching weather.');
  }
});
