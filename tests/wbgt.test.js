import { describe, it, expect } from 'vitest';
import { saturationVaporPressure, naturalWetBulb, blackGlobe, computeWBGT, findBestWindow } from '../js/wbgt.js';

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

  it('computeWBGT returns one value per minute', () => {
    const md = {
      temperature_2m: [25, 25], relative_humidity_2m: [60, 60],
      wind_speed_10m: [2, 2], cloud_cover: [0, 0], shortwave_radiation: [0, 0]
    };
    const out = computeWBGT(md, { shaded: true });
    expect(out.length).toBe(2);
    expect(out[0]).toBeGreaterThan(0);
  });

  it('findBestWindow finds minimum mean over a flat plateau at edges', () => {
    // 10 minutes: WBGT descends then flat — lowest window should start at 0
    const wbgt = [10, 10, 10, 12, 12, 12, 12, 12, 12, 12];
    const r = findBestWindow(wbgt, 3);
    expect(r.startMin).toBe(0);
    expect(r.endMin).toBe(3);
    expect(r.meanWBGT).toBeCloseTo(10, 5);
  });

  it('findBestWindow picks the true minimum plateau', () => {
    const wbgt = [20, 20, 5, 5, 5, 5, 20, 20];
    const r = findBestWindow(wbgt, 4);
    expect(r.startMin).toBe(2);
    expect(r.meanWBGT).toBeCloseTo(5, 5);
  });
});
