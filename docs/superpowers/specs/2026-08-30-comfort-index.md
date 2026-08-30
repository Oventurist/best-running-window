# Spec: Training-Run Comfort Index (any session type)

Date: 2026-08-30 | Status: approved

## Problem
Current "best window" = minimize WBGT only. That equals "coldest = best" and
ignores wind, rain, air quality, and — critically — that heat tolerance scales
with training intensity. A recovery jog and a VO2 session are not equally
heat-limited.

## Goal
Replace min-WBGT with a **Running Comfort Index (0–100) per minute** so the
best window = argmax comfort "no matter the weather" and reshapes by session type.

## Inputs (all free, no key)
- Temp, RH, wind, cloud, solar, precipitation_probability → existing forecast endpoint.
- PM2.5 / US AQI → Open-Meteo air-quality endpoint (new fetch, CORS-verified at build).
- Session type → form selector (Easy / Tempo / Intervals / Long). No sliders.

## Model
Per minute, each factor → sub-score in [0,1] via a fixed curve; weighted sum
(rounded 0–100). Weights depend on session type (hardcoded, literature-derived).

| Factor | Curve | Easy | Tempo | Intervals | Long |
|---|---|---|---|---|---|
| Temperature | gaussian peak ~55F, width by tier | 0.30 | 0.30 | 0.25 | 0.30 |
| Heat/WBGT | lower better, sharper penalize at hi intensity | 0.25 | 0.30 | 0.35 | 0.28 |
| Wind | penalize >15mph, sharper for Intervals | 0.10 | 0.10 | 0.15 | 0.10 |
| Precip | penalize any, hardest Intervals | 0.15 | 0.15 | 0.15 | 0.15 |
| AQI | penalize >100, slight leniency Easy/Long | 0.20 | 0.15 | 0.10 | 0.17 |

Cold tolerance: Easy curve peaks warmer-shifted? No — Easy penalizes COLD more
(low metabolic heat). Implemented via temp curve: Easy has lower peak temp + wider
cold tail penalty; Intervals peak ~60F, tolerate cold.

Best window = sliding window of run length maximizing mean comfort index.

## Non-goals (scope discipline)
No user profiles, no sliders, no backend, no accounts. Fallback: if AQI endpoint
fails, drop AQI weight to 0 and renormalize (documented), app still works.

## Verification
- Unit tests: comfort curves, weight table, AQI fallback, argmax reselection.
- 19→~24 tests pass. Live screenshot of chart comfort line (peak at band).
