import { describe, it, expect } from 'vitest';
import { renderTimeline } from '../js/timeline.js';

// jsdom-free: renderTimeline only writes el.innerHTML, so a stub works.
const stub = () => ({ innerHTML: '' });

describe('timeline smoothing', () => {
  it('both lines render as bezier curves (C commands) with no polyline L', () => {
    const el = stub();
    const n = 1440;
    const minute = {
      time: Array.from({ length: 24 }, (_, h) => `2026-08-31T${String(h).padStart(2, '0')}:00`),
      temperature_2m: Array.from({ length: n }, (_, i) => 15 + 10 * Math.sin(i / 100)),
      relative_humidity_2m: new Array(n).fill(60),
      wind_speed_10m: new Array(n).fill(2),
      cloud_cover: new Array(n).fill(20),
      shortwave_radiation: new Array(n).fill(0)
    };
    const wbgt = minute.temperature_2m.map((t) => t * 0.9);
    // sharp cliff comfort series
    const comfort = Array.from({ length: n }, (_, i) => (i < 700 ? 90 : 20));
    renderTimeline(el, { minute, wbgtPerMin: wbgt, comfortPerMin: comfort, window: { startMin: 300, endMin: 345 }, shaded: false, placeName: 'T' });
    const svg = el.innerHTML;
    expect(svg).toMatch(/C[\d.]+,[\d.]+\s[\d.]+,[\d.]+\s[\d.]+,[\d.]+/); // curve cmd present
    // no straight-segment L commands in the smoothed paths
    expect(svg).not.toMatch(/<path d="[^"]*\sL[\d.]+,[\d.]+/);
    expect(svg).toContain('shape-rendering="geometricPrecision"');
  });
});

// Audit 1.1: partial-day forecast — interpolate a 6-hour array starting at
// 13:00 (what Open-Meteo returns when queried in the afternoon) and verify
// the window-find plus the axis labels derived from actual data times.
describe('partial-day forecast (audit 1.1)', () => {
  it('interpolates a 6-hour afternoon array, finds the best window, and labels ticks from data times', async () => {
    const { interpolateHourly } = await import('../js/interpolate.js');
    const { findBestComfortWindow } = await import('../js/comfort.js');
    const { renderTimeline } = await import('../js/timeline.js');

    const startHour = 13;
    const hourly = {
      time: Array.from({ length: 6 }, (_, h) => `2026-08-30T${String(startHour + h).padStart(2, '0')}:00`),
      temperature_2m: [30, 31, 32, 32, 30, 28],
      relative_humidity_2m: [60, 62, 65, 65, 60, 55],
      wind_speed_10m: [2, 2, 3, 3, 2, 2],
      cloud_cover: [20, 20, 10, 10, 30, 40],
      shortwave_radiation: [800, 700, 400, 100, 0, 0],
      precipitation_probability: [10, 10, 20, 20, 10, 5]
    };
    const minute = interpolateHourly(hourly);
    expect(minute.temperature_2m).toHaveLength((6 - 1) * 60 + 1); // 301 minutes
    expect(minute.time).toEqual(hourly.time);

    const wbgt = minute.temperature_2m.map((t) => t * 0.9);
    const comfort = wbgt.map((w) => Math.max(0, 100 - 4 * (w - 10)));
    const best = findBestComfortWindow(comfort, 60);
    // Comfort rises monotonically over the final cooldown (temp falls from
    // 30°C at min 240 to 28°C at min 300), so the best 60-min window is the
    // last valid one: 301 - 60 = start 241, end 301.
    expect(best.startMin).toBe(241);
    expect(best.endMin).toBe(301);

    const el = stub();
    renderTimeline(el, { minute, wbgtPerMin: wbgt, comfortPerMin: comfort, window: best, shaded: false, placeName: 'Testville' });
    // Title reflects a partial afternoon day, not a 24-hour assumption.
    expect(el.innerHTML).toContain('Remaining hours today');
    expect(el.innerHTML).not.toContain('24-hour');
    // Ticks are labeled from the actual data times (13:00 … 18:00), positioned
    // by their real minute offset — not by an assumed 00:00–24:00 axis.
    expect(el.innerHTML).toContain('>13:00<');
    expect(el.innerHTML).toContain('>18:00<');
    expect(el.innerHTML).not.toContain('>00:00<');
    expect(el.innerHTML).not.toContain('>06:00<');
  });
});
