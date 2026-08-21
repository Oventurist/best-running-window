import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';

beforeAll(() => {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="r"></div><div id="c"></div></body>');
  global.document = dom.window.document;
  global.window = dom.window;
});

describe('ui render', () => {
  it('renderResults shows window time, WBGT, and strain rank', async () => {
    const { renderResults } = await import('../js/ui.js');
    const el = document.getElementById('r');
    const wbgt = [10, 20, 30]; // min 10, max 30
    renderResults(el, {
      window: { startMin: 150, endMin: 195, meanWBGT: 12 },
      wbgtPerMin: wbgt,
      runLengthMin: 45,
      shaded: false
    });
    expect(el.innerHTML).toContain('02:30'); // 150 min
    expect(el.innerHTML).toContain('03:15'); // 195 min
    expect(el.innerHTML).toContain('53.6°F'); // avg WBGT (12°C -> 53.6°F)
    expect(el.innerHTML).toContain('Open sun');
    expect(el.innerHTML).toMatch(/★|☆/); // star rank present
    expect(el.innerHTML).toContain('does not predict BPM'); // honest disclaimer
  });

  it('renderTimeline draws SVG with highlighted band at window', async () => {
    const { renderTimeline } = await import('../js/timeline.js');
    const el = document.getElementById('c');
    const minute = {
      temperature_2m: Array.from({ length: 1440 }, (_, i) => 15 + 10 * Math.sin(i / 100)),
      relative_humidity_2m: new Array(1440).fill(60),
      wind_speed_10m: new Array(1440).fill(2),
      cloud_cover: new Array(1440).fill(20),
      shortwave_radiation: new Array(1440).fill(0)
    };
    const wbgt = minute.temperature_2m.map((t) => t * 0.9);
    renderTimeline(el, { minute, wbgtPerMin: wbgt, window: { startMin: 300, endMin: 345 }, shaded: false, placeName: 'Testville' });
    const svg = el.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-label')).toContain('highlighted');
    // two boundary lines + one band rect = 3 mint elements
    const amberEls = [...svg.querySelectorAll('[stroke="#2DD4BF"], [fill="#2DD4BF"]')];
    expect(amberEls.length).toBeGreaterThanOrEqual(3);
    expect(el.innerHTML).toContain('Testville');
  });
});
