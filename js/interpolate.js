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
