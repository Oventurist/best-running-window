import { describe, it, expect } from 'vitest';
import { renderTimeline } from '../js/timeline.js';

// jsdom-free: renderTimeline only writes el.innerHTML, so a stub works.
const stub = () => ({ innerHTML: '' });

describe('timeline smoothing', () => {
  it('both lines render as bezier curves (C commands) with no polyline L', () => {
    const el = stub();
    const n = 1440;
    const minute = {
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
