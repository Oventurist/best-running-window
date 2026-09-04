import { geocodeZip, fetchWeather, fetchAirQuality } from './api.js';
import { interpolateHourly, interpolateSeries } from './interpolate.js';
import { computeWBGT } from './wbgt.js';
import { computeComfortIndex, findBestComfortWindow, SESSION_LABELS } from './comfort.js';
import { renderResults, updateWindowStats, showError } from './ui.js';
import { renderTimeline } from './timeline.js';

const form = document.getElementById('form');
const resultsEl = document.getElementById('results');
const chartEl = document.getElementById('chart');
// showError replaces the #error node so screen readers re-announce (audit 4.2);
// keep this reference fresh by capturing showError's return value.
let errorEl = document.getElementById('error');
const dateInput = document.getElementById('date');
const submitBtn = form.querySelector('button[type="submit"]');

// Open-Meteo's forecast endpoint serves ~16 days ahead; past dates aren't
// available through it (audit 4.3).
const MAX_FORECAST_DAYS = 16;

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

// Clamp the date picker to the forecast horizon (audit 4.3), computed fresh on
// each load so the page never goes stale on a long-lived tab.
(function clampDateRange() {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  dateInput.min = iso(now);
  dateInput.max = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_FORECAST_DAYS));
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
    errorEl = showError(errorEl, 'Enter a run length between 1 minute and 10 hours.');
    return;
  }
  // Date must sit inside the forecast horizon (audit 4.3): the API serves only
  // today..+16 days; anything else yields empty data or a confusing error.
  const todayISO = toISODate(new Date());
  const maxISO = toISODate(new Date(Date.now() + MAX_FORECAST_DAYS * 86400000));
  const dateISO = form.date.value; // 'YYYY-MM-DD'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || dateISO < todayISO || dateISO > maxISO) {
    errorEl = showError(errorEl, `Pick a date between ${todayISO} and ${maxISO} — that's the range the forecast covers.`);
    return;
  }
  // Busy state (audit 4.1): block double submits and show progress.
  setBusy(true);
  const shaded = form.toggle.checked;
  const sessionType = form.session.value || 'easy';
  try {
    const { lat, lon, name, state } = await geocodeZip(zip);
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
    const place = [name, state].filter(Boolean).join(', ');
    renderResults(resultsEl, {
      window, comfortPerMin, wbgtPerMin, runLengthMin, shaded,
      sessionType, sessionLabel: SESSION_LABELS[sessionType], aqiAvailable: aqiPerMin !== null,
      place
    });
    renderTimeline(chartEl, {
      minute, wbgtPerMin, comfortPerMin, window, shaded, placeName: name, sessionType,
      onWindowChange: (startMin) => {
        window.startMin = startMin;
        // In-place update of the dynamic stat nodes — smooth real-time feel,
        // no full re-render (which would flicker on every drag pixel).
        updateWindowStats(resultsEl, {
          window, wbgtPerMin, comfortPerMin, lengthMin: window.endMin - window.startMin
        });
      }
    });
    resultsEl.hidden = false;
    chartEl.hidden = false;
  } catch (err) {
    // A failed search must not leave the shimmering skeleton under the error
    // text (review fix 1): clear the results area so the error stands alone.
    resultsEl.innerHTML = '';
    resultsEl.hidden = true;
    chartEl.hidden = true;
    errorEl = showError(errorEl, friendlyError(err));
  } finally {
    setBusy(false);
  }
});

// Map API failures to plain-language copy (audit 4.2): raw HTTP statuses from
// api.js never reach the user.
function friendlyError(err) {
  const raw = err && err.message ? err.message : '';
  if (/no matching location/i.test(raw)) {
    return "That ZIP didn't work — try another one.";
  }
  if (/geocoding request failed/i.test(raw)) {
    return "We couldn't look up that ZIP right now. Check it and try again in a moment.";
  }
  if (/weather request failed/i.test(raw)) {
    return "We couldn't load the forecast for that spot. Please try again in a moment.";
  }
  if (/no forecast data/i.test(raw)) {
    return 'No forecast is available for that date. Pick a date within the next 16 days.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return 'Network hiccup — check your connection and try again.';
  }
  return raw || 'Something went wrong fetching weather. Please try again.';
}

// ---- Helpers shared by the submit handler ----

// Local-timezone 'YYYY-MM-DD'.
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Busy state (audit 4.1): disable the submit button with a label change +
// aria-busy, and show a skeleton over the results area while fetching.
function setBusy(busy) {
  if (!submitBtn) return;
  submitBtn.disabled = busy;
  submitBtn.setAttribute('aria-busy', String(busy));
  if (busy) {
    submitBtn.dataset.originalHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Searching…';
  } else if (submitBtn.dataset.originalHtml) {
    submitBtn.innerHTML = submitBtn.dataset.originalHtml;
    delete submitBtn.dataset.originalHtml;
  }
  if (busy) {
    resultsEl.hidden = false;
    resultsEl.innerHTML = `
      <div class="skeleton" aria-hidden="true">
        <div class="skeleton-line skeleton-line--title"></div>
        <div class="skeleton-grid">
          ${'<div class="skeleton-line"></div>'.repeat(6)}
        </div>
      </div>`;
  }
}
