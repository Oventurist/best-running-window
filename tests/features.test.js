import { describe, it, expect } from 'vitest';

describe('formatRunLength', () => {
  // import lazily so a failure here doesn't block other suites
  it('formats minutes / hours+minutes', async () => {
    const { formatRunLength } = await import('../js/ui.js');
    expect(formatRunLength(45)).toBe('45m');
    expect(formatRunLength(60)).toBe('1h');
    expect(formatRunLength(90)).toBe('1h 30m');
    expect(formatRunLength(600)).toBe('10h');
  });
});

describe('timeline comfort line', () => {
  it('produces a comfort path and peaks inside the highlighted band', async () => {
    const { renderTimeline } = await import('../js/timeline.js');
    const minute = {
      time: Array.from({ length: 24 }, (_, h) => `2026-08-31T${String(h).padStart(2, '0')}:00`),
      temperature_2m: Array.from({ length: 1440 }, (_, i) => 15 + 10 * Math.sin(i / 120)),
      relative_humidity_2m: new Array(1440).fill(60),
      wind_speed_10m: new Array(1440).fill(2),
      cloud_cover: new Array(1440).fill(20),
      shortwave_radiation: new Array(1440).fill(0)
    };
    const wbgt = minute.temperature_2m.map((t) => t * 0.9);
    const comfort = Array.from({ length: 1440 }, (_, i) => 50 + 30 * Math.sin(i / 120));
    const el = { innerHTML: '' };
    renderTimeline(el, { minute, wbgtPerMin: wbgt, comfortPerMin: comfort, window: { startMin: 300, endMin: 345 }, shaded: false, placeName: 'Testville' });
    // dynamic title derived from data times + comfort path drawn
    expect(el.innerHTML).toContain('Forecast for Aug 31');
    expect(el.innerHTML).toMatch(/M[\d.]+,[\d.]+/); // a path starting at M
    // mint comfort line + navy temp line both present; temp line is dashed so
    // the two lines stay distinguishable without color (audit 5.5)
    expect(el.innerHTML).toContain('stroke="#2DD4BF"');
    expect(el.innerHTML).toContain('stroke-dasharray');
    expect(el.innerHTML).not.toMatch(/stroke="#2DD4BF"[^>]*stroke-dasharray/); // comfort line solid
  });
});
