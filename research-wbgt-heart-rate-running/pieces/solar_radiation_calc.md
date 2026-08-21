# Solar Radiation Calculation (GHI fallback)

Astronomical GHI model for running-heat estimation. **Primary source is Open-Meteo's free `shortwave_radiation` (GHI) field — use this model only when the API lacks radiation or you need minute-resolution estimates.** All formulas JS-ready; angles in degrees unless noted.

## 1. Day-of-year declination (NOAA solcalc)

```js
const N = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000); // day of year, 1..365
const deg = Math.PI / 180;
const decl = 23.45 * Math.sin((360 * (284 + N) / 365) * deg); // solar declination, degrees
```

## 2. Solar zenith / hour angle

Fractional year and equation of time give local apparent time; for a simple model use the hour angle directly:

```js
const lat = 40.0 * deg;            // runner latitude
const H = (solarTimeHours - 12) * 15 * deg; // hour angle (solar noon = 0)
const cosZ = Math.sin(lat) * Math.sin(decl * deg)
           + Math.cos(lat) * Math.cos(decl * deg) * Math.cos(H);
const zenith = Math.acos(Math.max(-1, Math.min(1, cosZ))); // radians
```

When `cosZ <= 0` (sun below horizon) GHI = 0.

## 3. Clear-sky extraterrestrial + surface radiation

Solar constant `G_sc = 1361 W/m²`. Earth–Sun distance correction (optional, <±3.5%):

```js
const distanceCorr = 1 + 0.033 * Math.cos((360 * N / 365) * deg);
const G_ext = G_sc * distanceCorr * cosZ; // extraterrestrial on horizontal, W/m²
```

Liu & Jordan / UNESCO clear-sky model decouples beam (`G_b`) and diffuse (`G_d`):

```js
const G0 = G_sc * distanceCorr;               // extraterrestrial normal
const a0 = 0.4237, a1 = 0.5055, k = 0.2711;   // clear-sky coefficients
const airmass = 1 / Math.max(1e-3, cosZ);
const G_b = G0 * (a0 + a1 * Math.exp(-k * airmass)) * cosZ; // beam on horizontal
const G_d = G0 * (0.2710 - 0.2939 * Math.exp(-k * airmass)) * cosZ; // diffuse
let G_clear = Math.max(0, G_b + G_d);          // clear-sky GHI
```

## 4. Cloud-cover modulation

`N` here = cloud octas (0 clear, 8 overcast). From HAL-00835902v1:

```js
const octas = 4; // from weather API cloud_cover/12.5
const Kc = Math.pow(1 - 0.75 * (octas / 8), 3.4); // clearness due to cloud
let GHI = G_clear * Kc;          // W/m² at this instant
```

## 5. Minute resolution

Loop every 60 s across the run window, recompute `H` from timestamp, `cosZ`, then `GHI`. Aggregate (mean, peak) per km or per 5-min bin for the heart-rate model. **If Open-Meteo returns `shortwave_radiation`, prefer it and skip steps 1–4** — interpolate the hourly value to minute resolution linearly.

## Sources
- NOAA solcalc: gml.noaa.gov/grad/solcalc/solareqns.PDF
- Liu & Jordan (1960); UNESCO clear-sky model; FAO pyWaPOR doc; WMO CIMO Guide
- Cloud factor: HAL paper hal-00835902v1
- GHI fallback data: Open-Meteo (open-meteo.com), `shortwave_radiation`
