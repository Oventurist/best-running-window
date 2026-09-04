const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export function buildForecastUrl(lat, lon, dateISO) {
  const params = {
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,shortwave_radiation,precipitation_probability',
    wind_speed_unit: 'ms',
    timezone: 'auto'
  };
  if (dateISO) {
    params.start_date = dateISO;
    params.end_date = dateISO;
  }
  const p = new URLSearchParams(params);
  return `${FORECAST_URL}?${p.toString()}`;
}

export async function geocodeZip(zip) {
  // US-only app: filter server-side and sanity-filter client-side (audit 1.5).
  const url = `${GEO_URL}?name=${encodeURIComponent(zip)}&count=10&country_code=US&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);
  const data = await res.json();
  const results = (data.results || []).filter((r) => !r.country_code || r.country_code === 'US');
  if (results.length === 0) {
    throw new Error(`No matching location for zip "${zip}"`);
  }
  // Prefer a result that actually covers the queried ZIP. GeoNames feature
  // codes have no dedicated ZIP class, so "postal entity" is approximated:
  // a place whose postcodes list contains the ZIP ranks first, then PPL
  // (populated-place) codes, then administrative entities.
  const score = (r) => {
    let s = 0;
    if (Array.isArray(r.postcodes) && r.postcodes.includes(zip)) s += 8;
    const fc = typeof r.feature_code === 'string' ? r.feature_code : '';
    if (fc.startsWith('PPL')) s += 4;
    else if (fc.startsWith('ADM')) s += 2;
    return s;
  };
  let best = results[0];
  for (const r of results) {
    if (score(r) > score(best)) best = r;
  }
  return {
    lat: best.latitude,
    lon: best.longitude,
    name: best.name,
    state: best.admin1 || null,
    country: best.country
  };
}

export async function fetchWeather(lat, lon, dateISO) {
  const res = await fetch(buildForecastUrl(lat, lon, dateISO));
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  const data = await res.json();
  const h = data.hourly;
  if (!h || !h.time || h.time.length === 0) {
    throw new Error('No forecast data returned for that date.');
  }
  return {
    time: h.time,
    temperature_2m: h.temperature_2m,
    relative_humidity_2m: h.relative_humidity_2m,
    wind_speed_10m: h.wind_speed_10m,
    cloud_cover: h.cloud_cover,
    shortwave_radiation: h.shortwave_radiation,
    precipitation_probability: h.precipitation_probability
  };
}

const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

export function buildAirQualityUrl(lat, lon, dateISO) {
  const params = {
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'pm2_5,us_aqi',
    timezone: 'auto'
  };
  if (dateISO) {
    params.start_date = dateISO;
    params.end_date = dateISO;
  }
  const p = new URLSearchParams(params);
  return `${AIR_URL}?${p.toString()}`;
}

export async function fetchAirQuality(lat, lon, dateISO) {
  const res = await fetch(buildAirQualityUrl(lat, lon, dateISO));
  if (!res.ok) throw new Error(`Air quality request failed: ${res.status}`);
  const data = await res.json();
  const h = data.hourly;
  if (!h || !h.time || h.time.length === 0) {
    throw new Error('No air quality data returned for that date.');
  }
  return {
    time: h.time,
    pm2_5: h.pm2_5,
    us_aqi: h.us_aqi
  };
}
