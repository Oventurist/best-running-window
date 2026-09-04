// Linear interpolation of hourly arrays to 1-minute resolution.
// Input arrays are hourly samples; output has (hours-1)*60 + 1 points.
export function interpolateHourly(hourly) {
  const n = hourly.temperature_2m.length;
  if (n === 0) return { ...hourly, tMin: [] };
  const gaps = n - 1;
  const total = gaps * 60 + 1;
  // precipitation_probability must ride along (audit 1.2) — rain chance feeds
  // the comfort model per minute; dropping it silently zeroed precip scores.
  const keys = ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'cloud_cover', 'shortwave_radiation', 'precipitation_probability'];
  if (n === 1) {
    const out = { tMin: [0] };
    // Keep ISO timestamps so a single-hour forecast still gets the dynamic
    // title/ticks from audit 1.1.
    if (hourly.time) out.time = hourly.time;
    for (const key of keys) if (hourly[key]) out[key] = [...hourly[key]];
    return out;
  }
  const out = { tMin: [] };
  // ISO timestamps ride along (audit 1.1): tick labels and titles are derived
  // from actual data times, not an assumed 00:00–24:00 axis.
  if (hourly.time) out.time = hourly.time;
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

// Generic linear interpolation of a single hourly series to 1-minute resolution.
// Used for non-weather series (e.g. air-quality us_aqi) that don't share the
// fixed weather key set in interpolateHourly.
export function interpolateSeries(hourlyTime, values) {
  const n = hourlyTime.length;
  if (!values || n === 0) return [];
  if (n === 1) return [values[0]];
  const gaps = n - 1;
  const total = gaps * 60 + 1;
  const out = new Array(total);
  for (let k = 0; k < total; k++) {
    const pos = k / 60;
    const i = Math.min(Math.floor(pos), gaps - 1);
    const frac = pos - i;
    const va = values[i], vb = values[i + 1];
    out[k] = va + (vb - va) * frac;
  }
  return out;
}
