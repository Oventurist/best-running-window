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

  it('adds start/end date when dateISO given', () => {
    const url = buildForecastUrl(40.71, -74.0, '2026-08-21');
    expect(url).toContain('start_date=2026-08-21');
    expect(url).toContain('end_date=2026-08-21');
  });

  it('geocodeZip parses json response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ latitude: 40.7, longitude: -74.0, name: 'New York', country: 'United States', country_code: 'US', admin1: 'New York', feature_code: 'PPL', postcodes: ['10001'] }] })
    });
    const r = await geocodeZip('10001');
    expect(r).toEqual({ lat: 40.7, lon: -74.0, name: 'New York', state: 'New York', country: 'United States' });
    // audit 1.5: request is US-filtered and asks for several candidates
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('country_code=US');
    expect(calledUrl).toContain('count=10');
  });

  it('geocodeZip throws on non-OK response (audit 6 error path)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(geocodeZip('10001')).rejects.toThrow(/geocoding request failed: 500/i);
  });

  it('geocodeZip throws when no results', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    await expect(geocodeZip('00000')).rejects.toThrow(/no matching location/i);
  });

  it('geocodeZip drops non-US hits and prefers the result covering the queried ZIP (audit 1.5)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [
        { latitude: 1, longitude: 2, name: 'Admin Place', country: 'United States', country_code: 'US', admin1: 'State Y', feature_code: 'ADM2' },
        { latitude: 40.7, longitude: -74.0, name: 'New York', country: 'United States', country_code: 'US', admin1: 'New York', feature_code: 'PPL', postcodes: ['10001', '10002'] }
      ] })
    });
    const r = await geocodeZip('10001');
    expect(r.name).toBe('New York');
    expect(r.state).toBe('New York');
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
    const w = await fetchWeather(40.7, -74.0);
    expect(w.temperature_2m).toEqual([20, 19]);
    expect(w.shortwave_radiation).toEqual([0, 0]);
  });

  it('fetchWeather throws on non-OK response (audit 6 error path)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchWeather(40.7, -74.0, '2026-08-21')).rejects.toThrow(/weather request failed: 503/i);
  });
});
