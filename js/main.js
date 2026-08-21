import { geocodeZip, fetchWeather } from './api.js';
import { interpolateHourly } from './interpolate.js';
import { computeWBGT, findBestWindow } from './wbgt.js';
import { renderResults, showError, minutesToHHMM } from './ui.js';
import { renderTimeline } from './timeline.js';

const form = document.getElementById('form');
const resultsEl = document.getElementById('results');
const chartEl = document.getElementById('chart');
const errorEl = document.getElementById('error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  resultsEl.innerHTML = '';
  chartEl.innerHTML = '';
  const zip = form.zip.value.trim();
  const runLengthMin = parseInt(form.runlen.value, 10);
  const shaded = form.shaded.checked;
  const dateISO = form.date.value; // 'YYYY-MM-DD'
  try {
    const { lat, lon, name } = await geocodeZip(zip);
    const raw = await fetchWeather(lat, lon, dateISO);
    const minute = interpolateHourly(raw);
    const wbgtPerMin = computeWBGT(minute, { shaded });
    const window = findBestWindow(wbgtPerMin, runLengthMin);
    renderResults(resultsEl, { window, wbgtPerMin, runLengthMin, shaded });
    renderTimeline(chartEl, { minute, wbgtPerMin, window, shaded, placeName: name });
  } catch (err) {
    showError(errorEl, err.message || 'Something went wrong fetching weather.');
  }
});
