// Training-Run Comfort Index.
// Replaces "min WBGT" with a per-minute 0-100 comfort score that reshapes by
// session type and folds in temp, wind, precip, and air quality.
// Weights are literature-derived constants (no user tuning). See spec doc.

import { cToF as C_TO_F } from './util.js';

// Session-type weights for each factor. Sum to 1.0 per tier.
export const SESSION_WEIGHTS = {
  easy:      { temp: 0.30, heat: 0.25, wind: 0.10, precip: 0.15, aqi: 0.20 },
  tempo:     { temp: 0.30, heat: 0.30, wind: 0.10, precip: 0.15, aqi: 0.15 },
  intervals: { temp: 0.25, heat: 0.35, wind: 0.15, precip: 0.15, aqi: 0.10 },
  long:      { temp: 0.30, heat: 0.28, wind: 0.10, precip: 0.15, aqi: 0.17 }
};

export const SESSION_LABELS = {
  easy: 'Easy',
  tempo: 'Tempo',
  intervals: 'Intervals',
  long: 'Long'
};

// Temperature sub-score: gaussian peak ~55F. Same warm-side penalty for all tiers
// (hot is hot). Cold-side width widens for harder sessions (they generate more
// metabolic heat, so cold bothers them less). Peaks: easy coolest-tolerant,
// intervals most cold-tolerant.
function tempScoreF(f, type) {
  const peak = 55;
  const warmW = 12; // sharp warm penalty, same for all
  const coldW = type === 'intervals' ? 22 : type === 'tempo' ? 16 : type === 'long' ? 13 : 10;
  const d = f - peak;
  const w = d >= 0 ? warmW : coldW;
  const z = d / w;
  return Math.exp(-(z * z));
}

// Heat (WBGT in F) sub-score: lower is better; sharper penalty at high intensity.
function heatScoreF(wf, type) {
  const limit = type === 'intervals' ? 78 : type === 'tempo' ? 80 : 82; // F
  if (wf <= 60) return 1;
  const span = limit - 60;
  return Math.max(0, 1 - (wf - 60) / span);
}

// Wind (m/s) sub-score: calm best; penalize > ~6.7 m/s (~15 mph), harder for intervals.
function windScore(ms, type) {
  const mph = ms * 2.237;
  if (mph <= 6) return 1;
  const cap = type === 'intervals' ? 22 : 28; // mph where it hits 0
  return Math.max(0, 1 - (mph - 6) / (cap - 6));
}

// Precipitation probability (%) sub-score.
function precipScore(pct) {
  if (pct <= 10) return 1;
  return Math.max(0, 1 - (pct - 10) / 60);
}

// US AQI sub-score. >100 unhealthy; leniency for easy/long (longer exposure but
// Easy sessions are lower intensity so we still penalize, just slightly softer).
function aqiScore(usAqi, type) {
  if (usAqi == null) return null; // no data -> drop this factor
  if (usAqi <= 50) return 1;
  const cap = type === 'easy' || type === 'long' ? 160 : 140;
  return Math.max(0, 1 - (usAqi - 50) / (cap - 50));
}

// Compute per-minute comfort index array (0-100).
// Inputs are parallel arrays at 1-min resolution.
export function computeComfortIndex({
  wbgtPerMin, tempPerMinC, windPerMinMs, precipPerMinPct, aqiPerMin, sessionType
}) {
  const type = SESSION_WEIGHTS[sessionType] ? sessionType : 'easy';
  const w = SESSION_WEIGHTS[type];
  const n = wbgtPerMin.length;
  const out = new Array(n);
  let aqiAvailable = false;
  for (let i = 0; i < n; i++) {
    const f = C_TO_F(tempPerMinC[i]);
    const wf = C_TO_F(wbgtPerMin[i]);
    const sTemp = tempScoreF(f, type);
    const sHeat = heatScoreF(wf, type);
    const sWind = windScore(windPerMinMs[i], type);
    const sPrecip = precipScore(precipPerMinPct ? precipPerMinPct[i] : 0);
    const sAqi = aqiScore(aqiPerMin ? aqiPerMin[i] : null, type);
    let weights = { ...w };
    if (sAqi == null) {
      // renormalize without aqi
      const { aqi, ...rest } = w;
      const sum = Object.values(rest).reduce((a, b) => a + b, 0);
      const renorm = {};
      for (const k of Object.keys(rest)) renorm[k] = rest[k] / sum;
      weights = renorm;
      out[i] = Math.round(
        100 * (
          renorm.temp * sTemp +
          renorm.heat * sHeat +
          renorm.wind * sWind +
          renorm.precip * sPrecip
        )
      );
    } else {
      out[i] = Math.round(
        100 * (w.temp * sTemp + w.heat * sHeat + w.wind * sWind + w.precip * sPrecip + w.aqi * sAqi)
      );
    }
  }
  return out;
}

// Best window = argmax mean comfort over runLengthMin sliding window.
export function findBestComfortWindow(comfortPerMin, runLengthMin) {
  const n = comfortPerMin.length;
  if (n === 0 || runLengthMin <= 0) return null;
  const win = Math.min(runLengthMin, n);
  let bestStart = 0;
  let bestScore = -Infinity;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += comfortPerMin[i];
    if (i >= win) sum -= comfortPerMin[i - win];
    if (i >= win - 1) {
      const mean = sum / win;
      if (mean > bestScore) {
        bestScore = mean;
        bestStart = i - win + 1;
      }
    }
  }
  return { startMin: bestStart, endMin: bestStart + win, score: Math.round(bestScore) };
}
