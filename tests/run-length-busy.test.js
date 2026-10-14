import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

// Busy/validity interplay: while a search is in flight the submit button stays
// disabled even for a valid total, and when the flight ends the button reflects
// the CURRENT field validity instead of blindly re-enabling. A deferred weather
// response makes the mid-flight window deterministic.

function fakeHourly() {
  const time = Array.from({ length: 24 }, (_, h) => '2026-08-31T' + String(h).padStart(2, '0') + ':00');
  const temperature_2m = new Array(24).fill(18);
  const relative_humidity_2m = new Array(24).fill(60);
  const wind_speed_10m = new Array(24).fill(2);
  const cloud_cover = new Array(24).fill(20);
  const shortwave_radiation = new Array(24).fill(100);
  const precipitation_probability = new Array(24).fill(0);
  return { time, temperature_2m, relative_humidity_2m, wind_speed_10m, cloud_cover, shortwave_radiation, precipitation_probability };
}

let resolveWeather;

beforeAll(() => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  global.document = dom.window.document;
  global.window = dom.window;
  const form = document.getElementById('form');
  form.zipcode = document.getElementById('zipcode');
  form['duration-h'] = document.getElementById('duration-h');
  form['duration-m'] = document.getElementById('duration-m');
  form.toggle = document.getElementById('toggle');
  form.session = document.getElementById('session');
  form.date = document.getElementById('date');
  const weatherGate = new Promise((resolve) => { resolveWeather = resolve; });
  global.fetch = async (url) => {
    if (String(url).includes('geocoding-api')) {
      return { ok: true, json: async () => ({ results: [{ latitude: 37.7, longitude: -122.4, name: 'San Francisco' }] }) };
    }
    if (String(url).includes('air-quality-api')) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    await weatherGate;
    return { ok: true, json: async () => ({ hourly: fakeHourly() }) };
  };
});

describe('busy state does not fight live validity', () => {
  it('mid-flight edits keep submit disabled; finish reflects current validity', async () => {
    await import('../js/main.js');
    const form = document.getElementById('form');
    const h = document.getElementById('duration-h');
    const m = document.getElementById('duration-m');
    const btn = document.querySelector('#form button[type="submit"]');
    const hint = document.getElementById('duration-hint');
    document.getElementById('zipcode').value = '94107';
    h.value = '1';
    m.value = '0';
    m.dispatchEvent(new global.window.Event('input', { bubbles: true }));
    expect(btn.disabled).toBe(false);
    form.dispatchEvent(new global.window.Event('submit', { cancelable: true, bubbles: true }));
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    // Mid-flight valid edit must NOT re-enable the button.
    h.value = '2';
    h.dispatchEvent(new global.window.Event('input', { bubbles: true }));
    expect(btn.disabled).toBe(true);
    // Mid-flight invalid edit shows the hint while busy.
    h.value = '0';
    h.dispatchEvent(new global.window.Event('input', { bubbles: true }));
    expect(btn.disabled).toBe(true);
    expect(hint.hidden).toBe(false);
    // Finish the flight: the button reflects the current (invalid) validity.
    resolveWeather();
    await new Promise((r) => setTimeout(r, 50));
    expect(btn.getAttribute('aria-busy')).toBe('false');
    expect(btn.disabled).toBe(true);
    expect(hint.hidden).toBe(false);
    expect(btn.textContent).toContain('Find my best run window');
  });
});
