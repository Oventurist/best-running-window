import { describe, it, expect } from 'vitest';
import { saturationVaporPressure, naturalWetBulb, blackGlobe, computeWBGT } from '../js/wbgt.js';

describe('wbgt core', () => {
  it('saturationVaporPressure positive and rising', () => {
    expect(saturationVaporPressure(20)).toBeGreaterThan(0);
    expect(saturationVaporPressure(30)).toBeGreaterThan(saturationVaporPressure(20));
  });

  it('naturalWetBulb < air temp', () => {
    const nw = naturalWetBulb(30, 60, 1013);
    expect(nw).toBeLessThan(30);
    expect(nw).toBeGreaterThan(0);
  });

  it('shaded blackGlobe stays near air temp; sun raises it', () => {
    const shaded = blackGlobe(30, 60, 2, 0, true);
    const sun = blackGlobe(30, 60, 2, 800, false);
    expect(shaded).toBeLessThan(sun);
    expect(shaded).toBeCloseTo(30, 0);
  });

  // Audit 6 sanity bounds: shaded globe reads exactly air temperature, and
  // any positive solar load heats the unshaded globe above air temperature.
  it('blackGlobe sanity: shaded Tg == Ta; unshaded Tg > Ta when solar > 0 (audit 6)', () => {
    const shaded = blackGlobe(28, 55, 3, 500, true);
    expect(shaded).toBe(28); // shaded branch returns Ta verbatim
    for (const solar of [200, 600, 1000]) {
      expect(blackGlobe(28, 55, 3, solar, false)).toBeGreaterThan(28);
    }
  });

  it('computeWBGT returns one value per minute', () => {
    const md = {
      temperature_2m: [25, 25], relative_humidity_2m: [60, 60],
      wind_speed_10m: [2, 2], cloud_cover: [0, 0], shortwave_radiation: [0, 0]
    };
    const out = computeWBGT(md, { shaded: true });
    expect(out.length).toBe(2);
    expect(out[0]).toBeGreaterThan(0);
  });
});
// (findBestWindow tests removed with the dead function — audit 2.1.)
