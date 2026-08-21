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
