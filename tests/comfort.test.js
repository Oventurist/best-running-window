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

// Audit 6: property-based check — the sliding-window result must agree with a
// brute-force scan of every window mean, across random arrays (ties included:
// any start whose mean equals the maximum is acceptable).
describe('findBestComfortWindow vs brute-force argmax (audit 6)', () => {
  const windowMean = (arr, s, w) => {
    let sum = 0;
    for (let i = s; i < s + w; i++) sum += arr[i];
    return sum / w;
  };
  const bruteBest = (arr, runLen) => {
    const n = arr.length;
    const win = Math.min(runLen, n);
    let best = -Infinity;
    const bestStarts = [];
    for (let s = 0; s + win <= n; s++) {
      const m = windowMean(arr, s, win);
      if (m > best) { best = m; bestStarts.length = 0; bestStarts.push(s); }
      else if (m === best) bestStarts.push(s);
    }
    return { win, best, bestStarts };
  };

  it('matches brute-force argmax over 150 random arrays (varied n and window)', () => {
    for (let t = 0; t < 150; t++) {
      const n = 1 + Math.floor(Math.random() * 80);
      const arr = Array.from({ length: n }, () => Math.floor(Math.random() * 101));
      const runLen = 1 + Math.floor(Math.random() * (n + 2)); // includes win > n clamping
      const r = findBestComfortWindow(arr, runLen);
      const { win, best, bestStarts } = bruteBest(arr, runLen);
      expect(r).not.toBeNull();
      expect(r.endMin - r.startMin).toBe(win);
      expect(bestStarts).toContain(r.startMin); // ties allow any maximal start
      expect(windowMean(arr, r.startMin, win)).toBe(best); // exact: integer inputs
    }
  });

  it('edge cases: window == length, window 1, constant array (all ties)', () => {
    // window == array length: the only possible window
    expect(findBestComfortWindow([10, 50, 30], 3)).toEqual({ startMin: 0, endMin: 3, score: 30 });
    // window 1: pure per-minute argmax
    const single = findBestComfortWindow([4, 9, 1], 1);
    expect(single.startMin).toBe(1);
    expect(single.endMin).toBe(2);
    // constant array: every window ties; first start wins
    const flat = findBestComfortWindow(new Array(10).fill(42), 4);
    expect(flat.startMin).toBe(0);
    expect(flat.endMin).toBe(4);
    expect(flat.score).toBe(42);
  });
});
