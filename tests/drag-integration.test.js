import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

// End-to-end test of the drag feature WITHOUT network:
// stub fetch() with deterministic weather, submit the form, then simulate a
// pointer drag on the window band and assert the stats panel updates live.

function fakeHourly() {
  // 24 hourly points. Build a comfort landscape where early morning (00:00–04:00)
  // is best and mid-afternoon (12:00–16:00) is worst, so a drag is observable.
  const time = Array.from({ length: 24 }, (_, h) => `2026-08-31T${String(h).padStart(2, '0')}:00`);
  const temperature_2m = Array.from({ length: 24 }, (_, h) => 8 + 12 * Math.max(0, Math.sin((h - 9) / 24 * 2 * Math.PI))); // °C, peak ~15h
  const relative_humidity_2m = new Array(24).fill(60);
  const wind_speed_10m = new Array(24).fill(2);
  const cloud_cover = new Array(24).fill(20);
  const shortwave_radiation = Array.from({ length: 24 }, (_, h) => Math.max(0, 600 * Math.sin((h - 6) / 12 * Math.PI)));
  const precipitation_probability = new Array(24).fill(0);
  return { time, temperature_2m, relative_humidity_2m, wind_speed_10m, cloud_cover, shortwave_radiation, precipitation_probability };
}

beforeAll(() => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  global.document = dom.window.document;
  global.window = dom.window;
  global.Event = dom.window.Event;
  global.MouseEvent = dom.window.MouseEvent;
  // jsdom lacks SVGPoint CTM math; stub createSVGPoint so clientToMin returns a
  // value derived from the fake clientX we pass (enough to drive the handler).
  dom.window.SVGElement.prototype.setPointerCapture = function () {};
  dom.window.SVGElement.prototype.releasePointerCapture = function () {};
  Object.defineProperty(dom.window.SVGSVGElement.prototype, 'createSVGPoint', {
    configurable: true,
    value: function () {
      return { x: 0, y: 0, matrixTransform: function () { return { x: this.x, y: this.y }; } };
    }
  });
  Object.defineProperty(dom.window.SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: function () { return { inverse: function () { return {}; } }; }
  });
  // jsdom doesn't implement HTMLFormElement named-control access (form.zipcode).
  // Real browsers do; shim it so main.js runs unchanged under jsdom.
  const form = document.getElementById('form');
  form.zipcode = document.getElementById('zipcode');
  form['duration-h'] = document.getElementById('duration-h');
  form['duration-m'] = document.getElementById('duration-m');
  form.toggle = document.getElementById('toggle');
  form.session = document.getElementById('session');
  form.date = document.getElementById('date');

  global.fetch = async (url) => {
    if (String(url).includes('geocoding-api')) {
      return { ok: true, json: async () => ({ results: [{ latitude: 37.7, longitude: -122.4, name: 'San Francisco' }] }) };
    }
    return { ok: true, json: async () => ({ hourly: fakeHourly() }) };
  };
});

describe('drag window band updates stats in real time (end-to-end)', () => {
  it('submitting renders results+chart, and dragging the band recomputes the stats', async () => {
    await import('../js/main.js');
    const form = document.getElementById('form');
    document.getElementById('zipcode').value = '94107';
    document.getElementById('duration-h').value = '1';
    document.getElementById('duration-m').value = '0';
    form.dispatchEvent(new global.window.Event('submit', { cancelable: true, bubbles: true }));

    // let the async fetch + render resolve
    await new Promise((r) => setTimeout(r, 50));

    const results = document.getElementById('results');
    const chart = document.getElementById('chart');
    expect(results.hidden).toBe(false);
    expect(chart.hidden).toBe(false);
    const band = chart.querySelector('#window-band');
    expect(band).not.toBeNull();

    // No phantom second highlight: exactly one band group and no stray static rect.
    expect(chart.querySelectorAll('#window-band').length).toBe(1);
    expect(chart.querySelectorAll('[fill="#2DD4BF"][opacity="0.18"]').length).toBe(1); // only the band-rect

    const beforeTime = document.getElementById('res-time').textContent;
    const beforeComfort = document.getElementById('res-comfort').textContent;

    // Simulate a drag: grab at band, move pointer to a later position.
    // clientToMin maps clientX -> x in viewBox; move to far right (x≈760) => late day.
    const svg = chart.querySelector('svg');
    band.dispatchEvent(new global.window.MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200, pointerId: 1 }));
    band.dispatchEvent(new global.window.MouseEvent('pointermove', { bubbles: true, clientX: 760, clientY: 200, pointerId: 1 }));
    band.dispatchEvent(new global.window.MouseEvent('pointerup', { bubbles: true, clientX: 760, clientY: 200, pointerId: 1 }));

    const afterTime = document.getElementById('res-time').textContent;
    const afterComfort = document.getElementById('res-comfort').textContent;

    // The window moved (time text changed) and stats recomputed live.
    expect(afterTime).not.toBe(beforeTime);
    // The day's worst window is mid/late afternoon here, so comfort should drop.
    expect(afterComfort).not.toBe(beforeComfort);
    // aria-valuenow on the band reflects the new start.
    expect(Number(band.getAttribute('aria-valuenow'))).toBeGreaterThan(0);

    // Reset button snaps the band + stats back to the original best window.
    const resetBtn = chart.querySelector('#window-reset');
    expect(resetBtn).not.toBeNull();
    resetBtn.dispatchEvent(new global.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.getElementById('res-time').textContent).toBe(beforeTime);
    expect(document.getElementById('res-comfort').textContent).toBe(beforeComfort);
    expect(Number(band.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0);
  });
});
