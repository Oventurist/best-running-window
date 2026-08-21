# Design Spec: Best Running Window Web App

## Purpose
A web app that, given a **date**, **US zip code**, and **run length** (minutes), finds the
minute-resolution window on that day where environmental heat stress is lowest — i.e., the window
where a runner's heart rate for a given effort will be lowest. Results are visualized on a 24-hour
timeline.

## Status of the core question: weather metrics → heart rate
**Verified:** WBGT (Wet-Bulb Globe Temperature) is the correct proxy. It is a heat-stress *index*,
not a direct heart-rate predictor. During exercise the heart must supply both working muscle and skin;
as core temp rises, cutaneous vasodilation + skin blood flow compete with muscle for cardiac output,
raising HR to maintain output (CO = SV × HR). ACSM shows EHI incidence "rises as WBGT rises"
[8]. NIOSH pairs WBGT screening with physiological monitoring because the index cannot predict an
individual's absolute bpm [4]. **Conclusion:** we rank run windows by WBGT; the lowest-WBGT window
= lowest cardiovascular strain for a given effort. The runner pairs this with their own baseline HR.
We do NOT fabricate absolute BPM numbers.

## Scientific foundation (source-grounded)

### WBGT formula  `[ISO 7243 / ACGIH; see pieces/wbgt_formula.md]`
```
WBGT = 0.7 · T_nw + 0.2 · T_g + 0.1 · T_a
```
- `T_nw` = natural wet-bulb temperature (°C), via Magnus–Tetens psychrometrics:
  - `e_s(T) = 6.1078 · exp(17.625 · T / (T + 243.04))`  [hPa]
  - `e = e_s(T_a) · RH / 100`
  - Solve `e = e_s(T_nw) − 0.00066 · P · (T_a − T_nw)` by bisection on [−40, T_a]. (Stull 2011
    closed-form approximation available as a no-solve fallback.)
- `T_g` = 150 mm black-globe temperature (°C), via NOAA Dimiceli & Piltz 2015 energy balance:
  - `α·S + ε·σ·T_a⁴ = h_c·(T_g − T_a) + ε·σ·T_g⁴`
  - `α=ε=0.95`, `σ=5.670e-8`, `S`=solar radiation (W/m²)
  - Convective coefficient (sphere D=0.15 m): `Re = ρ·v·D/μ`; `Nu = 2 + 0.6·Re^0.5·Pr^(1/3)`; `h_c = Nu·k/D`
  - Solve T_g iteratively (fixed-point, start T_g = T_a).
- Indoor/shaded simplification: `T_g ≈ T_a`, so `WBGT ≈ 0.7·T_nw + 0.3·T_a`.

### Weather data (source-grounded)  `[see free-weather-api-comparison.md]`
**Chosen provider: Open-Meteo** — the only free weather API that provides surface solar/global
radiation (GHI) alongside temperature, humidity, wind, and cloud cover, with zip-code geocoding
and no API key.
- Geocoding API: `https://geocoding-api.open-meteo.com/v1/search?name={zip}&count=1&format=json`
- Forecast API: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,shortwave_radiation`
- 15-minute resolution available over US; free tier: 10,000 calls/day, no auth.
- Fallback for GHI: astronomical clear-sky model (Liu & Jordan / UNESCO). `Kc = (1 − 0.75·(N/8))^3.4` cloud modulation (HAL-00835902v1). [see pieces/solar_radiation_calc.md]

### Interpolation to 1-minute resolution
- Linear interpolation between hourly (or 15-min) sampled values for temperature, humidity, wind.
- GHI: linearly interpolate API hourly values; if GHI unavailable, compute astronomically per minute.

### Window extraction (nearest minute)
- For run length L (minutes), slide window over 1,440-minute timeline: for each start m ∈ [0, 1440−L],
  compute `mean(WBGT[m..m+L])`. Return the start/end minutes of the global minimum.
- Tie-break: earliest lowest window.
- If no full 24h forecast, limit search to available hours.

## Architecture (proposed)
**Client-only static site. No backend.**
- `index.html`, `css/`, `js/`
- All WBGT math + interpolation + window search run in the browser.
- Open-Meteo called via fetch() (browser CORS is supported).
- Deploy: GitHub Pages (free, static). No server cost, no keys to manage.

**Why no React/Next.js:** keeps it ultra-light, zero build cost, trivially hosted. A single `index.html`
with vanilla JS suffices for this compute load. If the user prefers a framework, revisit.

## Components
1. **Input form** — date picker (defaults to current date or a selectable day), zip code input,
   run-length (minutes, integer), "shaded route" toggle.
2. **Compute engine (js/wbgt.js)** — fetch weather, interpolate to 1-min, compute WBGT per minute,
   slide window, return best window + per-minute WBGT array.
3. **Results summary** — best window start–end time, "cardiovascular strain score" (rank of that
   window's WBGT relative to the day's min/max, as a percentile or star rating), and the day's min/max
   WBGT for context.
4. **24-hour timeline chart (js/timeline.js)** — SVG multi-series chart showing temperature,
   humidity %, wind, and GHI across the day, with the ideal window highlighted as a colored band
   and the WBGT curve overlaid.
5. **Shaded-route toggle** — when "shaded" is on, use the indoor/shaded WBGT approximation
   (T_g ≈ T_a, lower values). This materially changes the window since direct sun raises globe temp.

## UI Design (from ui-ux-pro-max)
- **Pattern:** Minimal single-column, large centered CTA, lots of whitespace, mobile-first.
- **Style:** Vibrant & block-based — sky blue (#0284C7) + sun amber (#F59E0B) accent.
- **Typography:** Inter (swiss/functional/neutral).
- **Accessibility:** 4.5:1 contrast, visible focus states, `prefers-reduced-motion`, semantic HTML.
- **Color palette tokens:**
  - primary: #0284C7, accent: #F59E0B, background: #F0F9FF, foreground: #0F172A
  - muted: #EFF7FB, border: #E0F0F8
  - light/dark capable.

## Scope boundaries (YAGNI)
- No account/login. No persistent history (localStorage optional).
- No "share" feature. No email.
- Only US zip codes (Open-Meteo geocoding supports global, but we keep scope to US + zip).
- No real-time streaming — forecast snapshot.
- The app does NOT predict bpm. It ranks heat stress.

## Limitations & honesty
- WBGT is environment-only; absolute HR needs personal physiology we don't collect.
- Hourly→minute linear interpolation won't capture sudden micro-fronts; acceptable for ranking.
- Cloud cover is a forecast; solar is API-provided or astronomically estimated.
- GHI from Open-Meteo is hourly; interpolation smooths it.

## Success criteria
- User enters zip + run length → app renders a 24h chart within ~3s, highlights the best window.
- WBGT values are computed (not fabricated) from real fetched data.
- Shaded/sun toggle visibly changes the suggested window.

## Open questions for user (to resolve in spec review)
- Q1: Vanilla JS vs. a framework (React/Next)? → **proposed vanilla JS**
- Q2: GitHub Pages deployment target? → **proposed yes**
- Q3: Display "cardiovascular strain rank" (percentile/star) alongside WBGT? → **proposed yes**
- Q4: Include "shaded route" toggle (uses T_g ≈ T_a)? → **proposed yes**

---
*Spec authored 2026-08-20. References in `research-wbgt-heart-rate-running/`.*