import { describe, it, expect } from 'vitest';
import { interpolateHourly, interpolateSeries } from '../js/interpolate.js';

describe('interpolateHourly', () => {
  const base = {
    time: ['2026-08-21T00:00', '2026-08-21T01:00', '2026-08-21T02:00'],
    temperature_2m: [20, 22, 24],
    relative_humidity_2m: [80, 70, 60],
    wind_speed_10m: [3, 4, 5],
    cloud_cover: [10, 30, 50],
    shortwave_radiation: [0, 100, 200]
  };

  it('produces 121 points for 2 hour-gaps (inclusive)', () => {
    const out = interpolateHourly(base);
    // 2 gaps * 60 + 1 = 121
    expect(out.temperature_2m.length).toBe(121);
  });

  it('first and last values equal endpoints', () => {
    const out = interpolateHourly(base);
    expect(out.temperature_2m[0]).toBe(20);
    expect(out.temperature_2m[120]).toBe(24);
  });

  it('midpoint is linear average', () => {
    const out = interpolateHourly(base);
    // minute 60 is exactly the 01:00 sample = 22
    expect(out.temperature_2m[60]).toBe(22);
    // minute 30 is halfway between 20 and 22 = 21
    expect(out.temperature_2m[30]).toBeCloseTo(21, 5);
  });

  it('handles single sample (no interpolation)', () => {
    const single = { ...base, time: ['2026-08-21T00:00'], temperature_2m: [20], relative_humidity_2m: [80], wind_speed_10m: [3], cloud_cover: [10], shortwave_radiation: [0] };
    const out = interpolateHourly(single);
    expect(out.temperature_2m.length).toBe(1);
  });
});

describe('interpolateSeries', () => {
  it('produces 121 points for 3 hourly samples', () => {
    const out = interpolateSeries(['t0', 't1', 't2'], [10, 20, 30]);
    expect(out).toHaveLength(121);
    expect(out[0]).toBe(10);
    expect(out[120]).toBe(30);
    expect(out[60]).toBeCloseTo(20, 5);
    expect(out[30]).toBeCloseTo(15, 5);
  });

  it('returns single value for one sample and [] for empty', () => {
    expect(interpolateSeries(['t0'], [42])).toEqual([42]);
    expect(interpolateSeries([], [])).toEqual([]);
  });
});
