# WBGT Formula — Implementation Reference

Actionable WBGT math for a JS engineer. All temperatures in °C, pressure in hPa, wind in m/s, solar flux in W/m².

## 1. Full WBGT equation

```
WBGT = 0.7 · T_nw + 0.2 · T_g + 0.1 · T_a
```

`T_nw` natural (un-aspirated) wet-bulb, `T_g` 150 mm black-globe, `T_a` air (dry-bulb). Weights are fixed by ISO 7243 / ACGIH TLV basis.

## 2. Natural wet-bulb `T_nw` (psychrometric, Magnus)

Saturation vapor pressure (Magnus–Tetens, water):
```
e_s(T) = 6.1078 · exp(17.625 · T / (T + 243.04))   // hPa
```
Actual vapor pressure from air temp + RH:
```
e = e_s(T_a) · RH / 100
```
Natural wet-bulb solves the psychrometric balance for `T_nw`:
```
e = e_s(T_nw) − A · P · (T_a − T_nw)
```
with `A ≈ 0.00066` (ventilated psychrometer constant) and `P` in hPa. `T_nw` is lower than `T_a`; solve by bisection on [−40, T_a] (monotonic). Stull (2011, J. Climate 10.1175/JAMC-D-11-0143.1) also gives a closed-form RH/Ta approximation if you want a no-solve fallback.

## 3. Black-globe `T_g` (NOAA Dimiceli & Piltz 2015)

For solar-exposed outdoor conditions, solve the black-globe energy balance (Dimiceli & Piltz, NWS, weather.gov/media/tsa/pdf/WBGTpaper2.pdf):
```
α·S + ε·σ·T_a⁴  =  h_c·(T_g − T_a) + ε·σ·T_g⁴      // steady state, no sweat term
```
- `α = 0.95` absorptivity, `ε = 0.95` emissivity, `σ = 5.670e-8`.
- `S` = total solar radiation (W/m²); use measured or estimated clear-sky flux.
- Convective coefficient from a sphere (D = 0.15 m) — NOAA uses Bedingfield & Drew / Bird–Stewart–Lightfoot:
  ```
  Re = ρ·v·D / μ ;  Nu = 2 + 0.6·Re^0.5·Pr^(1/3) ;  h_c = Nu·k / D
  ```
  Take `ρ≈1.2`, `μ≈1.8e-5`, `Pr≈0.71`, `k≈0.026`. Solve `T_g` iteratively (fixed-point or Newton); converges in a few steps from `T_g = T_a`.

## 4. Indoor vs. solar-exposed

- **Outdoor / solar-exposed:** use full three-term WBGT with `T_g` from §3 (solar term included).
- **Indoor / shaded:** `T_g ≈ T_a` (negligible radiative gain), so `WBGT ≈ 0.7·T_nw + 0.3·T_a`. ACGIH permits this simplification when solar load is absent.

## 5. Application height

All inputs must be sampled at **head level ≈ 1.1 m** above ground (ISO 7243 measurement height) — not screen height or ground level. Pull `T_a`, RH, wind, and `S` from a 1.1 m sensor/station; globe and wet-bulb are themselves 1.1 m instruments.

## Sources
- ISO 7243 (Hot environments — assessment of heat stress by WBGT); ACGIH TLV basis.
- Dimiceli, C. & Piltz, S. (2015), *Estimation of Black Globe Temperature for Calculation of the WBGT Index*, NOAA/NWS — weather.gov/media/tsa/pdf/WBGTpaper2.pdf.
- Stull, R. (2011), *Wet-Bulb Temperature from Relative Humidity and Air Temperature*, J. Climate, 10.1175/JAMC-D-11-0143.1.
- Reference C implementation: github.com/mdljts/wbgt (`Tglobe()`, `Twb()`).
