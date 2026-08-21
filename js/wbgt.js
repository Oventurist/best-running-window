// WBGT compute engine. All temps °C, pressure hPa, wind m/s, solar W/m².

export function saturationVaporPressure(T) {
  // Magnus–Tetens (water), hPa
  return 6.1078 * Math.exp((17.625 * T) / (T + 243.04));
}

export function naturalWetBulb(Ta, RH, P) {
  // Solve e = es(Tnw) - A*P*(Ta - Tnw) for Tnw via bisection on [-40, Ta]
  const e = saturationVaporPressure(Ta) * (RH / 100);
  const A = 0.00066;
  let lo = -40, hi = Ta;
  const f = (Tnw) => saturationVaporPressure(Tnw) - A * P * (Ta - Tnw) - e;
  // f is monotonic increasing in Tnw; f(lo) < 0, f(hi) > 0
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function blackGlobe(Ta, RH, wind, solar, shaded) {
  if (shaded) return Ta; // ACGIH indoor/shaded simplification
  // NOAA Dimiceli & Piltz 2015 steady-state energy balance, sphere D=0.15m
  const alpha = 0.95, eps = 0.95, sigma = 5.670e-8;
  const rho = 1.2, mu = 1.8e-5, Pr = 0.71, k = 0.026, D = 0.15;
  const solveTg = (Tg) => {
    const Re = (rho * Math.max(wind, 0.1) * D) / mu;
    const Nu = 2 + 0.6 * Math.pow(Re, 0.5) * Math.pow(Pr, 1 / 3);
    const hc = (Nu * k) / D;
    // alpha*S + eps*sigma*Ta^4 = hc*(Tg - Ta) + eps*sigma*Tg^4
    return alpha * solar + eps * sigma * Math.pow(Ta + 273.15, 4)
         - hc * (Tg - Ta) - eps * sigma * Math.pow(Tg + 273.15, 4);
  };
  let lo = Ta - 30, hi = Ta + 30;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (solveTg(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function computeWBGT(md, { shaded = false } = {}) {
  const n = md.temperature_2m.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const Ta = md.temperature_2m[i];
    const RH = md.relative_humidity_2m[i];
    const wind = md.wind_speed_10m[i];
    const solar = md.shortwave_radiation[i];
    const P = 1013; // sea-level standard; acceptable for 1.1m head-level estimate
    const Tnw = naturalWetBulb(Ta, RH, P);
    const Tg = blackGlobe(Ta, RH, wind, solar, shaded);
    out[i] = 0.7 * Tnw + 0.2 * Tg + 0.1 * Ta;
  }
  return out;
}

export function findBestWindow(wbgt, runLengthMin) {
  const n = wbgt.length;
  const L = Math.min(runLengthMin, n);
  let bestStart = 0, bestMean = Infinity;
  const windows = [];
  for (let s = 0; s + L <= n; s++) {
    let sum = 0;
    for (let j = s; j < s + L; j++) sum += wbgt[j];
    const mean = sum / L;
    windows.push({ start: s, mean });
    if (mean < bestMean) { bestMean = mean; bestStart = s; }
  }
  return { startMin: bestStart, endMin: bestStart + L, meanWBGT: bestMean, allWindows: windows };
}
