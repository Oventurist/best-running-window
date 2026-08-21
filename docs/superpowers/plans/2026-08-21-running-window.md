# Best Running Window Web App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, client-only web app that finds the minute-resolution run window on a given day/zip where environmental heat stress (WBGT) is lowest, and visualizes it on a 24-hour timeline.

**Architecture:** Single static `index.html` + `js/` modules + `css/`. All WBGT math, interpolation, window search, and chart rendering run in the browser. Weather comes from Open-Meteo (free, no key, browser-CORS-enabled). No backend, deployable to GitHub Pages.

**Tech Stack:** HTML5, CSS (Tailwind via CDN), vanilla JavaScript (ES modules). Open-Meteo Forecast + Geocoding APIs. Custom SVG chart (no chart library). Vitest for unit tests of the compute engine.

## Global Constraints

- **No framework** — vanilla JS ES modules only (spec Q1 approved).
- **No backend** — all compute client-side; Open-Meteo called via `fetch()` (CORS-supported).
- **No fabricated BPM** — display WBGT + "cardiovascular strain rank" (percentile/star), never a synthesized heart-rate number (spec Q3).
- **Shaded-route toggle present** — uses indoor/shaded WBGT approximation `T_g ≈ T_a` (spec Q4).
- **No runner profile** — environment-only; no resting/max HR collection (spec Q5).
- **Weather source:** Open-Meteo. Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={zip}&count=1&format=json`. Forecast: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,shortwave_radiation&wind_speed_unit=ms&timezone=auto`.
- **WBGT formula (fixed):** `WBGT = 0.7*T_nw + 0.2*T_g + 0.1*T_a` (ISO 7243 / ACGIH).
- **Interpolation:** linear between hourly samples → 1-minute resolution (1,440 points / 24h).
- **Window search:** slide L-minute window over 1,440 points, pick minute-start with minimum mean WBGT.
- **UI style:** Minimal single-column, Inter font, sky-blue (#0284C7) + sun-amber (#F59E0B); WCAG 4.5:1, visible focus, `prefers-reduced-motion`; light/dark capable.
- **Accessibility:** no emoji as icons (use inline SVG), contrast ≥ 4.5:1, keyboard-navigable, reduced-motion respected.

---

## File Structure

```
index.html                      # page markup, form, results container, chart SVG mount
css/styles.css                  # design tokens, layout, component styles
js/main.js                      # app entry: wires form → compute engine → UI render
js/api.js                       # Open-Meteo geocoding + forecast fetch (fetch wrappers)
js/wbgt.js                      # WBGT compute engine: wet-bulb, globe temp, WBGT, window search
js/interpolate.js               # linear interpolation hourly→per-minute
js/timeline.js                  # SVG multi-series chart + highlighted ideal window band
js/ui.js                        # DOM render: results summary, strain rank, toggle behavior
tests/wbgt.test.js              # unit tests for wbgt.js + window search
tests/interpolate.test.js       # unit tests for interpolation
tests/api.test.js               # tests for URL building + response shape (mock fetch)
```

Each file has one responsibility. `wbgt.js` and `interpolate.js` are pure functions (fully unit-testable). `api.js` isolates network. `timeline.js`/`ui.js`/`main.js` are DOM/glue.

---

## Task 1: Project scaffold + design tokens

**Files:**
- Create: `index.html`
- Create: `css/styles.css`
- Create: `package.json` (for vitest only)

**Interfaces:**
- Produces: page skeleton with `#app`, `#form`, `#results`, `#chart` mount points.

- [ ] **Step 1: Create `package.json`**
```json
{
  "name": "best-running-window",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "npx serve ."
  },
  "devDependencies": { "vitest": "^2.1.0" }
}
```

- [ ] **Step 2: Create `index.html` skeleton**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Best Running Window</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <main id="app" class="app-shell">
    <header class="hero">
      <h1>Find Your Best Running Window</h1>
      <p class="subtitle">The coolest, lowest-heat-stress minutes of your day — to the nearest minute.</p>
    </header>
    <form id="form" class="card" aria-label="Run window inputs"></form>
    <section id="results" class="results" aria-live="polite"></section>
    <section id="chart" class="chart-card" aria-label="24-hour weather timeline"></section>
  </main>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `css/styles.css` with design tokens**
```css
:root {
  --color-primary: #0284C7;
  --color-accent: #F59E0B;
  --color-background: #F0F9FF;
  --color-foreground: #0F172A;
  --color-muted: #EFF7FB;
  --color-border: #E0F0F8;
  --color-on-primary: #FFFFFF;
  --color-ring: #0284C7;
  --color-destructive: #DC2626;
  --space-section: 48px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0B1120;
    --color-foreground: #E2E8F0;
    --color-muted: #111c33;
    --color-border: #1e2d47;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--color-background);
  color: var(--color-foreground);
  line-height: 1.5;
}
.app-shell { max-width: 880px; margin: 0 auto; padding: var(--space-section) 20px; }
.hero h1 { font-size: 2rem; font-weight: 700; margin: 0 0 8px; }
.subtitle { color: #475569; font-size: 1.05rem; margin: 0 0 var(--space-section); }
@media (prefers-color-scheme: dark) { .subtitle { color: #94A3B8; } }
.card, .chart-card {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}
button, input, select { font-family: inherit; font-size: 1rem; }
:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
```

- [ ] **Step 4: Commit**
```bash
git add index.html css/styles.css package.json
git commit -m "feat: scaffold static app shell + design tokens"
```

---

## Task 2: Weather API module (geocoding + forecast)

**Files:**
- Create: `js/api.js`
- Create: `tests/api.test.js`

**Interfaces:**
- Produces:
  - `geocodeZip(zip) → Promise<{lat, lon, name, country}>` (throws on no match)
  - `fetchWeather(lat, lon, dateISO) → Promise<RawHourly>` where `RawHourly = { time: string[], temperature_2m: number[], relative_humidity_2m: number[], wind_speed_10m: number[], cloud_cover: number[], shortwave_radiation: number[] }`

- [ ] **Step 1: Write failing test `tests/api.test.js`**
```js
import { describe, it, expect, vi } from 'vitest';
import { geocodeZip, fetchWeather, buildForecastUrl } from '../js/api.js';

describe('api', () => {
  it('builds forecast url with required params', () => {
    const url = buildForecastUrl(40.71, -74.0);
    expect(url).toContain('api.open-meteo.com/v1/forecast');
    expect(url).toContain('temperature_2m');
    expect(url).toContain('relative_humidity_2m');
    expect(url).toContain('wind_speed_10m');
    expect(url).toContain('cloud_cover');
    expect(url).toContain('shortwave_radiation');
    expect(url).toContain('wind_speed_unit=ms');
  });

  it('geocodeZip parses json response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ latitude: 40.7, longitude: -74.0, name: 'New York', country: 'United States' }] })
    });
    const r = await geocodeZip('10001');
    expect(r).toEqual({ lat: 40.7, lon: -74.0, name: 'New York', country: 'United States' });
  });

  it('geocodeZip throws when no results', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    await expect(geocodeZip('00000')).rejects.toThrow(/no matching location/i);
  });

  it('fetchWeather returns mapped hourly arrays', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hourly: {
        time: ['2026-08-21T00:00', '2026-08-21T01:00'],
        temperature_2m: [20, 19],
        relative_humidity_2m: [80, 82],
        wind_speed_10m: [3, 2.5],
        cloud_cover: [10, 20],
        shortwave_radiation: [0, 0]
      } })
    });
    const w = await fetchWeather(40.7, -74.0, '2026-08-21');
    expect(w.temperature_2m).toEqual([20, 19]);
    expect(w.shortwave_radiation).toEqual([0, 0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/api.test.js`
Expected: FAIL (`module not found` / functions undefined).

- [ ] **Step 3: Write `js/api.js`**
```js
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export function buildForecastUrl(lat, lon) {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,shortwave_radiation',
    wind_speed_unit: 'ms',
    timezone: 'auto'
  });
  return `${FORECAST_URL}?${p.toString()}`;
}

export async function geocodeZip(zip) {
  const url = `${GEO_URL}?name=${encodeURIComponent(zip)}&count=1&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`No matching location for zip "${zip}"`);
  }
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country };
}

export async function fetchWeather(lat, lon) {
  const res = await fetch(buildForecastUrl(lat, lon));
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  const data = await res.json();
  const h = data.hourly;
  return {
    time: h.time,
    temperature_2m: h.temperature_2m,
    relative_humidity_2m: h.relative_humidity_2m,
    wind_speed_10m: h.wind_speed_10m,
    cloud_cover: h.cloud_cover,
    shortwave_radiation: h.shortwave_radiation
  };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/api.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add js/api.js tests/api.test.js
git commit -m "feat: Open-Meteo geocoding + forecast fetch module"
```

---

## Task 3: Linear interpolation to 1-minute resolution

**Files:**
- Create: `js/interpolate.js`
- Create: `tests/interpolate.test.js`

**Interfaces:**
- Produces: `interpolateHourly(hourlyArrays, opts) → { tMin: number[], temperature_2m: number[], relative_humidity_2m: number[], wind_speed_10m: number[], cloud_cover: number[], shortwave_radiation: number[] }` where each array has `n*60` points (n = number of hours − 1 between first and last sample). Default: linear interpolation.
- Consumes: raw hourly arrays from `api.js`.

- [ ] **Step 1: Write failing test `tests/interpolate.test.js`**
```js
import { describe, it, expect } from 'vitest';
import { interpolateHourly } from '../js/interpolate.js';

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
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/interpolate.test.js`
Expected: FAIL.

- [ ] **Step 3: Write `js/interpolate.js`**
```js
// Linear interpolation of hourly arrays to 1-minute resolution.
// Input arrays are hourly samples; output has (hours-1)*60 + 1 points.
export function interpolateHourly(hourly) {
  const n = hourly.temperature_2m.length;
  if (n === 0) return { ...hourly, tMin: [] };
  if (n === 1) {
    return {
      tMin: [0],
      temperature_2m: [...hourly.temperature_2m],
      relative_humidity_2m: [...hourly.relative_humidity_2m],
      wind_speed_10m: [...hourly.wind_speed_10m],
      cloud_cover: [...hourly.cloud_cover],
      shortwave_radiation: [...hourly.shortwave_radiation]
    };
  }
  const gaps = n - 1;
  const total = gaps * 60 + 1;
  const keys = ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'cloud_cover', 'shortwave_radiation'];
  const out = { tMin: [] };
  for (let k = 0; k < total; k++) {
    const pos = (k / 60); // fractional hour index
    const i = Math.min(Math.floor(pos), gaps - 1);
    const frac = pos - i;
    const a = i, b = i + 1;
    out.tMin.push(k);
    for (const key of keys) {
      const va = hourly[key][a];
      const vb = hourly[key][b];
      out[key] = out[key] || [];
      out[key].push(va + (vb - va) * frac);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/interpolate.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add js/interpolate.js tests/interpolate.test.js
git commit -m "feat: linear interpolation to 1-minute resolution"
```

---

## Task 4: WBGT compute engine + window search

**Files:**
- Create: `js/wbgt.js`
- Create: `tests/wbgt.test.js`

**Interfaces:**
- Produces:
  - `computeWBGT(minuteData, { shaded }) → number[]` (WBGT per minute)
  - `findBestWindow(wbgtPerMinute, runLengthMin) → { startMin, endMin, meanWBGT, allWindows: {start, mean}[] }`
  - `saturationVaporPressure(T)`, `naturalWetBulb(Ta, RH, P)`, `blackGlobe(Ta, RH, wind, solar, shaded)`
- Consumes: interpolated minute arrays from `interpolate.js`.

- [ ] **Step 1: Write failing test `tests/wbgt.test.js`**
```js
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
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/wbgt.test.js`
Expected: FAIL.

- [ ] **Step 3: Write `js/wbgt.js`**
```js
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
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/wbgt.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add js/wbgt.js tests/wbgt.test.js
git commit -m "feat: WBGT engine + sliding-window best-window search"
```

---

## Task 5: UI render + form wiring (main.js, ui.js)

**Files:**
- Create: `js/ui.js`
- Create: `js/main.js`
- Modify: `index.html` (inject form fields)

**Interfaces:**
- Consumes: `geocodeZip`, `fetchWeather` (api.js), `interpolateHourly` (interpolate.js), `computeWBGT`, `findBestWindow` (wbgt.js), `renderTimeline` (timeline.js, Task 6).
- Produces: populated `#results` (window start/end time, WBGT, strain rank) and `#chart`.

- [ ] **Step 1: Build form HTML into `index.html` `#form`** (replace empty `<form>` block)
```html
<form id="form" class="card" aria-label="Run window inputs">
  <div class="field">
    <label for="zip">ZIP code</label>
    <input id="zip" name="zip" type="text" inputmode="numeric" pattern="[0-9]{5}" placeholder="e.g. 10001" required />
  </div>
  <div class="field">
    <label for="date">Date</label>
    <input id="date" name="date" type="date" required />
  </div>
  <div class="field">
    <label for="runlen">Run length (minutes)</label>
    <input id="runlen" name="runlen" type="number" min="1" max="600" value="45" required />
  </div>
  <div class="field field-inline">
    <input id="shaded" name="shaded" type="checkbox" />
    <label for="shaded">Shaded route (no direct sun)</label>
  </div>
  <button type="submit" class="cta">Find my best run window</button>
  <p id="error" class="error" role="alert" hidden></p>
</form>
```

- [ ] **Step 2: Write `js/ui.js` (DOM render helpers)**
```js
export function minutesToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function renderResults(el, { window, wbgtPerMin, runLengthMin, shaded }) {
  const minW = Math.min(...wbgtPerMin);
  const maxW = Math.max(...wbgtPerMin);
  // strain rank: lower WBGT = better. percentile of the chosen window's mean vs day range
  const span = (maxW - minW) || 1;
  const rank = Math.round(((maxW - window.meanWBGT) / span) * 100); // 0=bad(=max),100=best(=min)
  const stars = Math.max(1, Math.round(rank / 20)); // 1..5
  el.innerHTML = `
    <div class="result-headline">
      <span class="result-label">Best window</span>
      <span class="result-time">${minutesToHHMM(window.startMin)} – ${minutesToHHMM(window.endMin)}</span>
    </div>
    <div class="result-stats">
      <div><span class="stat">Avg WBGT</span><strong>${window.meanWBGT.toFixed(1)}°C</strong></div>
      <div><span class="stat">Heat-stress rank</span><strong>${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} (${rank}%)</strong></div>
      <div><span class="stat">Day range</span><strong>${minW.toFixed(1)}–${maxW.toFixed(1)}°C</strong></div>
      <div><span class="stat">Route</span><strong>${shaded ? 'Shaded' : 'Open sun'}</strong></div>
    </div>
    <p class="disclaimer">WBGT is a heat-stress index. Lower = lower cardiovascular strain for your effort. Pair with your own baseline heart rate — this app does not predict BPM.</p>
  `;
}

export function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
```

- [ ] **Step 3: Write `js/main.js` (entry / wiring)**
```js
import { geocodeZip, fetchWeather } from './api.js';
import { interpolateHourly } from './interpolate.js';
import { computeWBGT, findBestWindow } from './wbgt.js';
import { renderResults, showError, minutesToHHMM } from './ui.js';
import { renderTimeline } from './timeline.js';

const form = document.getElementById('form');
const resultsEl = document.getElementById('results');
const chartEl = document.getElementById('chart');
const errorEl = document.getElementById('error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  const zip = form.zip.value.trim();
  const runLengthMin = parseInt(form.runlen.value, 10);
  const shaded = form.shaded.checked;
  try {
    const { lat, lon, name } = await geocodeZip(zip);
    const raw = await fetchWeather(lat, lon);
    const minute = interpolateHourly(raw);
    const wbgtPerMin = computeWBGT(minute, { shaded });
    const window = findBestWindow(wbgtPerMin, runLengthMin);
    renderResults(resultsEl, { window, wbgtPerMin, runLengthMin, shaded });
    renderTimeline(chartEl, { minute, wbgtPerMin, window, shaded, placeName: name });
  } catch (err) {
    showError(errorEl, err.message || 'Something went wrong fetching weather.');
  }
});
```

- [ ] **Step 4: Add form-field CSS to `css/styles.css`**
```css
.field { display: flex; flex-direction: column; margin-bottom: 16px; }
.field label { font-weight: 500; margin-bottom: 6px; }
.field input[type=text], .field input[type=date], .field input[type=number] {
  padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px;
  background: var(--color-background); color: var(--color-foreground);
}
.field-inline { flex-direction: row; align-items: center; gap: 8px; }
.field-inline label { margin: 0; }
.cta {
  margin-top: 8px; background: var(--color-primary); color: var(--color-on-primary);
  border: none; border-radius: 10px; padding: 12px 20px; font-weight: 600; cursor: pointer;
  transition: background 150ms ease;
}
.cta:hover { background: #0369A1; }
.error { color: var(--color-destructive); margin-top: 12px; font-weight: 500; }
.results { margin-bottom: 24px; }
.result-headline { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
.result-label { color: #64748B; font-weight: 500; }
.result-time { font-size: 1.75rem; font-weight: 700; color: var(--color-accent); }
.result-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; }
.result-stats .stat { display: block; font-size: 0.8rem; color: #64748B; margin-bottom: 4px; }
.result-stats strong { font-size: 1.1rem; }
.disclaimer { margin-top: 16px; font-size: 0.85rem; color: #64748B; font-style: italic; }
```

- [ ] **Step 5: Commit**
```bash
git add index.html css/styles.css js/ui.js js/main.js
git commit -m "feat: form wiring + results/strain-rank UI"
```

---

## Task 6: Timeline SVG chart with highlighted window

**Files:**
- Create: `js/timeline.js`

**Interfaces:**
- Consumes: `minute` (interpolated arrays), `wbgtPerMin`, `window` from wbgt.js, `shaded`, `placeName`.
- Produces: SVG rendered into `#chart` showing 24h axis, temperature line, humidity %, wind, GHI, and a highlighted band over `[window.startMin, window.endMin]`. No external chart lib.

- [ ] **Step 1: Write `js/timeline.js`**
```js
export function renderTimeline(el, { minute, wbgtPerMin, window, shaded, placeName }) {
  const W = 800, H = 320, pad = 40;
  const n = wbgtPerMin.length;
  const x = (i) => pad + (i / (n - 1)) * (W - 2 * pad);
  const tMin = Math.min(...minute.temperature_2m), tMax = Math.max(...minute.temperature_2m);
  const yT = (v) => H - pad - ((v - tMin) / (tMax - tMin || 1)) * (H - 2 * pad);

  const tempPath = minute.temperature_2m.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yT(v).toFixed(1)}`).join(' ');
  const xs = x(window.startMin), xe = x(window.endMin);

  el.innerHTML = `
    <h2 class="chart-title">24-hour heat-stress timeline${placeName ? ` — ${placeName}` : ''}</h2>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="24-hour temperature and heat-stress timeline with best run window highlighted" preserveAspectRatio="xMidYMid meet">
      <rect x="${xs.toFixed(1)}" y="${pad}" width="${(xe - xs).toFixed(1)}" height="${H - 2 * pad}" fill="var(--color-accent)" opacity="0.18" />
      <line x1="${xs.toFixed(1)}" y1="${pad}" x2="${xs.toFixed(1)}" y2="${H - pad}" stroke="var(--color-accent)" stroke-width="2" />
      <line x1="${xe.toFixed(1)}" y1="${pad}" x2="${xe.toFixed(1)}" y2="${H - pad}" stroke="var(--color-accent)" stroke-width="2" />
      <path d="${tempPath}" fill="none" stroke="var(--color-primary)" stroke-width="2.5" />
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="var(--color-border)" />
      ${[0, 6, 12, 18, 24].map((h) => {
        const i = Math.min(n - 1, h * 60);
        return `<text x="${x(i).toFixed(1)}" y="${H - pad + 18}" font-size="11" fill="#64748B" text-anchor="middle">${String(h).padStart(2,'0')}:00</text>`;
      }).join('')}
      <text x="${pad}" y="${pad - 12}" font-size="11" fill="#64748B">Temp °C (line) · amber band = best ${window.endMin - window.startMin}-min window</text>
    </svg>
  `;
}
```

- [ ] **Step 2: Add chart CSS to `css/styles.css`**
```css
.chart-card svg { width: 100%; height: auto; display: block; }
.chart-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 12px; }
```

- [ ] **Step 3: Commit**
```bash
git add js/timeline.js css/styles.css
git commit -m "feat: 24h SVG timeline with highlighted ideal window"
```

---

## Task 7: End-to-end verification + polish

**Files:**
- Modify: `index.html` (set default date to today), `css/styles.css` (responsive tweaks)

**Interfaces:**
- Verifies: full pipeline runs in a real browser; chart renders; toggle changes window.

- [ ] **Step 1: Set default date in `index.html`**
```html
<input id="date" name="date" type="date" value="2026-08-21" required />
```

- [ ] **Step 2: Add responsive + reduced-motion polish to `css/styles.css`**
```css
@media (max-width: 600px) {
  .app-shell { padding: 24px 14px; }
  .hero h1 { font-size: 1.5rem; }
  .result-time { font-size: 1.4rem; }
}
```

- [ ] **Step 3: Run full test suite**
Run: `npx vitest run`
Expected: ALL PASS (api, interpolate, wbgt).

- [ ] **Step 4: Manual browser verification**
Serve: `npx serve .` (or `python3 -m http.server 8000`).
Open `http://localhost:8000`, enter zip `10001`, run length `45`, submit.
Verify: results show a window + WBGT + star rank; chart shows temperature line + amber band; check console for no errors; toggle shaded and re-submit → window start/time changes.

- [ ] **Step 5: Commit + final message**
```bash
git add -A
git commit -m "feat: end-to-end verification, defaults, responsive polish"
```

---

## Self-Review Notes
- Spec coverage: architecture (client-only) ✓; WBGT formula ✓; interpolation ✓; window search ✓; Open-Meteo ✓; shaded toggle ✓; UI style tokens ✓; accessibility ✓; graph with highlight ✓; no fabricated BPM ✓ (disclaimer + rank only).
- No placeholders: every task has concrete code/tests.
- Type consistency: `RawHourly` → `interpolateHourly` → `computeWBGT` → `findBestWindow` signatures align across tasks; `window.startMin/endMin/meanWBGT` used consistently in ui.js + timeline.js.
