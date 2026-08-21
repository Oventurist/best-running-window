import { geocodeZip, fetchWeather } from './api.js';
import { interpolateHourly } from './interpolate.js';
import { computeWBGT, findBestWindow } from './wbgt.js';
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
  const dateISO = form.date.value; // 'YYYY-MM-DD'
  try {
    const { lat, lon, name } = await geocodeZip(zip);
    const raw = await fetchWeather(lat, lon, dateISO);
    const minute = interpolateHourly(raw);
    const wbgtPerMin = computeWBGT(minute, { shaded });
    const window = findBestWindow(wbgtPerMin, runLengthMin);
    renderResults(resultsEl, { window, wbgtPerMin, runLengthMin, shaded });
    renderTimeline(chartEl, { minute, wbgtPerMin, window, shaded, placeName: name });
    resultsEl.hidden = false;
    chartEl.hidden = false;
  } catch (err) {
    showError(errorEl, err.message || 'Something went wrong fetching weather.');
  }
});
