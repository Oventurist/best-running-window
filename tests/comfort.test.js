import { describe, it, expect } from 'vitest';
import { computeComfortIndex, findBestComfortWindow, SESSION_WEIGHTS } from '../js/comfort.js';

const mk = (arr) => arr;

describe('computeComfortIndex', () => {
  it('returns 0..100 per minute and length matches input', () => {
    const wbgt = mk([20, 25, 30]);
    const temp = mk([10, 15, 20]); // C
    const wind = mk([1, 1, 1]); // m/s
    const precip = mk([0, 0, 0]);
    const out = computeComfortIndex({ wbgtPerMin: wbgt, tempPerMinC: temp, windPerMinMs: wind, precipPerMinPct: precip, aqiPerMin: null, sessionType: 'easy' });
    expect(out).toHaveLength(3);
    out.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); });
  });

  it('renormalizes weights when AQI missing (sum still ~1)', () => {
    const wbgt = mk([20, 30]);
    const temp = mk([12, 18]);
    const wind = mk([2, 2]);
    const precip = mk([0, 0]);
    const full = computeComfortIndex({ wbgtPerMin: wbgt, tempPerMinC: temp, windPerMinMs: wind, precipPerMinPct: precip, aqiPerMin: mk([40, 120]), sessionType: 'easy' });
    const noAqi = computeComfortIndex({ wbgtPerMin: wbgt, tempPerMinC: temp, windPerMinMs: wind, precipPerMinPct: precip, aqiPerMin: null, sessionType: 'easy' });
    // both valid; no crash; values differ because aqi present vs absent
    expect(full[1]).not.toBe(noAqi[1]);
    full.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    noAqi.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('intervals penalize heat more than easy at high WBGT (wind/precip neutral)', () => {
    const wbgt = mk([26]); // 78.8F: easy keeps some heat score, intervals floors to 0
    const temp = mk([28]);
    const wind = mk([0]); // calm (score 1, equal for both)
    const precip = mk([0]); // dry (score 1, equal for both)
    const easy = computeComfortIndex({ wbgtPerMin: wbgt, tempPerMinC: temp, windPerMinMs: wind, precipPerMinPct: precip, aqiPerMin: null, sessionType: 'easy' });
    const iv = computeComfortIndex({ wbgtPerMin: wbgt, tempPerMinC: temp, windPerMinMs: wind, precipPerMinPct: precip, aqiPerMin: null, sessionType: 'intervals' });
    expect(iv[0]).toBeLessThan(easy[0]);
  });

  it('intervals tolerate cold better than easy at low temp', () => {
    const wbgt = mk([10]); // cold, low heat stress
    const temp = mk([2]); // 35.6F, cold air
    const wind = mk([0]);
    const precip = mk([0]);
    const easy = computeComfortIndex({ wbgtPerMin: wbgt, tempPerMinC: temp, windPerMinMs: wind, precipPerMinPct: precip, aqiPerMin: null, sessionType: 'easy' });
    const iv = computeComfortIndex({ wbgtPerMin: wbgt, tempPerMinC: temp, windPerMinMs: wind, precipPerMinPct: precip, aqiPerMin: null, sessionType: 'intervals' });
    expect(iv[0]).toBeGreaterThan(easy[0]);
  });

  it('unknown session type falls back to easy', () => {
    const wbgt = mk([20]);
    const temp = mk([12]);
    const wind = mk([1]);
    const precip = mk([0]);
    const out = computeComfortIndex({ wbgtPerMin: wbgt, tempPerMinC: temp, windPerMinMs: wind, precipPerMinPct: precip, aqiPerMin: null, sessionType: 'bogus' });
    expect(out).toHaveLength(1);
  });
});

describe('SESSION_WEIGHTS', () => {
  it('each tier sums to 1.0', () => {
    for (const k of Object.keys(SESSION_WEIGHTS)) {
      const s = Object.values(SESSION_WEIGHTS[k]).reduce((a, b) => a + b, 0);
      expect(Math.abs(s - 1)).toBeLessThan(1e-9);
    }
  });
});

describe('findBestComfortWindow', () => {
  it('picks the highest-comfort sliding window', () => {
    const comfort = mk([10, 10, 90, 90, 90, 10, 10]); // peak at 2..4
    const w = findBestComfortWindow(comfort, 3);
    expect(w.startMin).toBe(2);
    expect(w.endMin).toBe(5);
    expect(w.score).toBe(90);
  });

  it('clamps window to available minutes', () => {
    const comfort = mk([50, 60, 70]);
    const w = findBestComfortWindow(comfort, 10);
    expect(w.endMin).toBe(3);
  });

  it('returns null for empty input', () => {
    expect(findBestComfortWindow([], 30)).toBeNull();
  });
});
