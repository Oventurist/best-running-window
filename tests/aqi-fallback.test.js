import { describe, it, expect, beforeAll, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

// Audit 6: AQI-failure fallback — the air-quality endpoint failing must not
// break the search; main.js proceeds with aqiPerMin = null and still renders
// results + chart, with the disclaimer noting air quality was unavailable.

function fakeHourly() {
  const time = Array.from({ length: 8 }, (_, h) => `2026-08-31T${String(h).padStart(2, '0')}:00`);
  return {
    time,
    temperature_2m: [10, 11, 12, 13, 14, 13, 12, 11],
    relative_humidity_2m: new Array(8).fill(60),
    wind_speed_10m: new Array(8).fill(2),
    cloud_cover: new Array(8).fill(20),
    shortwave_radiation: new Array(8).fill(0),
    precipitation_probability: new Array(8).fill(0)
  };
}

beforeAll(() => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  global.document = dom.window.document;
  global.window = dom.window;
  global.Event = dom.window.Event;
  // jsdom shim: named form-control access (form.zipcode etc.)
  const form = document.getElementById('form');
  form.zipcode = document.getElementById('zipcode');
  form['duration-h'] = document.getElementById('duration-h');
  form['duration-m'] = document.getElementById('duration-m');
  form.toggle = document.getElementById('toggle');
  form.session = document.getElementById('session');
  form.date = document.getElementById('date');

  // Geocode + weather succeed; the air-quality endpoint 500s every time.
  global.fetch = async (url) => {
    if (String(url).includes('geocoding-api')) {
      return { ok: true, json: async () => ({ results: [{ latitude: 37.7, longitude: -122.4, name: 'San Francisco' }] }) };
    }
    if (String(url).includes('air-quality-api')) {
      return { ok: false, status: 500 };
    }
    return { ok: true, json: async () => ({ hourly: fakeHourly() }) };
  };
});

describe('AQI failure fallback (audit 6)', () => {
  it('search still completes with aqiPerMin = null when air quality fails', async () => {
    await import('../js/main.js');
    const form = document.getElementById('form');
    document.getElementById('zipcode').value = '94107';
    document.getElementById('duration-h').value = '1';
    document.getElementById('duration-m').value = '0';
    form.dispatchEvent(new global.window.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Results and chart rendered, no error shown.
    const results = document.getElementById('results');
    const chart = document.getElementById('chart');
    const error = document.getElementById('error');
    expect(results.hidden).toBe(false);
    expect(chart.hidden).toBe(false);
    expect(chart.querySelector('#window-band')).not.toBeNull();
    expect(error.hidden).toBe(true);
    // Comfort numbers actually produced (score node populated).
    expect(document.getElementById('res-comfort').textContent).toMatch(/\d+\/100/);
    // Disclaimer reflects the degraded factor set (no air quality).
    expect(results.textContent).not.toContain('and air quality');
    expect(results.textContent).toContain('rain chance');
  });
});

// Review fix 1: a failed search must not leave the shimmering skeleton in
// #results under the error text — the error stands alone.
describe('failed search clears the loading skeleton (review fix 1)', () => {
  it('hides and empties the results area when the API call fails', async () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
    global.document = dom.window.document;
    global.window = dom.window;
    global.Event = dom.window.Event;
    const form = document.getElementById('form');
    form.zipcode = document.getElementById('zipcode');
    form['duration-h'] = document.getElementById('duration-h');
    form['duration-m'] = document.getElementById('duration-m');
    form.toggle = document.getElementById('toggle');
    form.session = document.getElementById('session');
    form.date = document.getElementById('date');

    // Weather endpoint fails for this search.
    global.fetch = async (url) => {
      if (String(url).includes('geocoding-api')) {
        return { ok: true, json: async () => ({ results: [{ latitude: 37.7, longitude: -122.4, name: 'San Francisco' }] }) };
      }
      return { ok: false, status: 503 };
    };

    // main.js is module-cached from the test above; reset so the submit
    // listener binds to THIS JSDOM's document.
    vi.resetModules();
    await import('../js/main.js');
    document.getElementById('zipcode').value = '94107';
    form.dispatchEvent(new global.window.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));

    const results = document.getElementById('results');
    const chart = document.getElementById('chart');
    const error = document.getElementById('error');
    // Skeleton gone: results area empty and hidden, error stands alone.
    expect(results.hidden).toBe(true);
    expect(results.innerHTML).not.toContain('skeleton');
    expect(results.textContent.trim()).toBe('');
    expect(chart.hidden).toBe(true);
    // Friendly error is the only visible trace of the failure.
    expect(error.hidden).toBe(false);
    expect(error.textContent).not.toMatch(/503/);
    expect(error.textContent).toMatch(/couldn't load the forecast/i);
    // Submit button restored after the busy state.
    expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
  });
});
