export const CURRENT_VARS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m', 'is_day',
  'precipitation', 'rain', 'showers', 'snowfall', 'weather_code', 'cloud_cover',
  'pressure_msl', 'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'visibility', 'uv_index',
] as const;

export const HOURLY_VARS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m',
  'precipitation_probability', 'precipitation', 'rain', 'showers', 'snowfall', 'snow_depth',
  'weather_code', 'pressure_msl', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
  'visibility', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'uv_index', 'is_day',
  'cape', 'freezing_level_height',
] as const;

export const DAILY_VARS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min',
  'sunrise', 'sunset', 'daylight_duration', 'sunshine_duration', 'uv_index_max', 'uv_index_clear_sky_max',
  'precipitation_sum', 'rain_sum', 'showers_sum', 'snowfall_sum', 'precipitation_hours', 'precipitation_probability_max',
  'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
  'shortwave_radiation_sum', 'et0_fao_evapotranspiration',
] as const;

export const AIR_VARS = [
  'european_aqi', 'us_aqi', 'pm10', 'pm2_5', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone',
  'dust', 'aerosol_optical_depth',
  'alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen',
] as const;

export const MARINE_VARS = [
  'wave_height', 'wave_direction', 'wave_period', 'swell_wave_height', 'sea_surface_temperature',
] as const;

export const ARCHIVE_VARS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'wind_speed_10m_max',
] as const;

export const LOG_ARCHIVE_VARS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min',
  'precipitation_sum', 'snowfall_sum', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'sunshine_duration',
] as const;

export const LOG_FORECAST_VARS = [...LOG_ARCHIVE_VARS, 'uv_index_max'] as const;

export const ARCHIVE_HOURLY_VARS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m',
  'precipitation', 'rain', 'snowfall', 'snow_depth', 'weather_code', 'pressure_msl',
  'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
] as const;

export const ARCHIVE_DAY_DAILY_VARS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min',
  'sunrise', 'sunset', 'daylight_duration', 'sunshine_duration',
  'precipitation_sum', 'rain_sum', 'snowfall_sum', 'precipitation_hours',
  'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
  'shortwave_radiation_sum', 'et0_fao_evapotranspiration',
] as const;

export type { AirVar, CurrentVar, DailyVar, HourlyVar, MarineVar } from './types';
