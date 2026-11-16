import { sortedCopy } from '../core/sort';

import type { CityRain, GridView, RadarCells, RadarGrid, RadarLevel, TileCover, TilePlacement } from '../types';

export const LAND_VERSION = 2;
export const RADAR_SET_VERSION = 2;
export const VISIBLE_COLS = 46;
export const VISIBLE_ROWS = 40;
export const RADAR_GRID: RadarGrid = { cols: VISIBLE_COLS * 2, rows: VISIBLE_ROWS * 2, cellMeters: 800 };
export const SAMPLES = 4;
export const RADAR_CELLS = [200, 400, 800, 1600, 3200] as const;
export const DEFAULT_RADAR_CELL = 800;

const TILE = 256;
const EARTH_MPP = 156_543.034;
const CLUTTER_DBZ = 15;
const MODERATE_DBZ = 30;
const HEAVY_DBZ = 40;
const RAIN_TOP = 127;
const SNOW_FROM = 129;

export function gridView(lat: number, lon: number, cellMeters: number = RADAR_GRID.cellMeters): GridView {
  return { ...RADAR_GRID, cellMeters, lat, lon };
}

export function sourceId(radarServer: string, mapServer: string): string {
  let hash = 5381;
  for (const ch of `${radarServer.trim()}|${mapServer.trim()}`) { hash = Math.imul(hash, 33) ^ (ch.codePointAt(0) ?? 0); }
  return (hash >>> 0).toString(36);
}

export function radarKey(cityId: string, cellMeters: number, source: string): string {
  return `${cityId}:${String(cellMeters)}:${source}`;
}

export function cellOfKey(key: string, fallback: number): number {
  const cell = Number(key.split(':').at(-2));
  return Number.isFinite(cell) && cell > 0 ? cell : fallback;
}

export function nearestCells(cell: number): number[] {
  return sortedCopy(RADAR_CELLS, (a, b) => Math.abs(Math.log(a / cell)) - Math.abs(Math.log(b / cell)));
}

function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH_MPP * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

export function zoomFor(view: GridView, maxZoom: number): number {
  const wanted = Math.log2((EARTH_MPP * Math.cos((view.lat * Math.PI) / 180) * SAMPLES) / view.cellMeters);
  return Math.max(0, Math.min(maxZoom, Math.ceil(wanted)));
}

function worldPoint(lat: number, lon: number, zoom: number): [number, number] {
  const size = TILE * 2 ** zoom;
  const phi = (lat * Math.PI) / 180;
  const x = ((lon + 180) / 360) * size;
  const y = ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * size;
  return [x, y];
}

export function tileCover(view: GridView, zoom: number): TileCover {
  const width = view.cols * SAMPLES;
  const height = view.rows * SAMPLES;
  const mpp = metersPerPixel(view.lat, zoom);
  const spanX = (view.cols * view.cellMeters) / mpp;
  const spanY = (view.rows * view.cellMeters) / mpp;
  const [cx, cy] = worldPoint(view.lat, view.lon, zoom);
  const x0 = cx - spanX / 2;
  const y0 = cy - spanY / 2;
  const scale = width / spanX;
  const last = 2 ** zoom - 1;
  const tiles: TilePlacement[] = [];
  for (let ty = Math.max(0, Math.floor(y0 / TILE)); ty <= Math.min(last, Math.floor((y0 + spanY) / TILE)); ty += 1) {
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + spanX) / TILE); tx += 1) {
      tiles.push({ x: ((tx % (last + 1)) + last + 1) % (last + 1), y: ty, left: (tx * TILE - x0) * scale, top: (ty * TILE - y0) * scale, size: TILE * scale });
    }
  }
  return { zoom, width, height, tiles };
}

export function levelOf(dbz: number | null): RadarLevel {
  if (dbz === null || dbz < CLUTTER_DBZ) { return 0; }
  if (dbz < MODERATE_DBZ) { return 1; }
  return dbz < HEAVY_DBZ ? 2 : 3;
}

export function rainRate(dbz: number): number {
  return (10 ** (dbz / 10) / 200) ** (1 / 1.6);
}

function decode(r: number, alpha: number): { dbz: number; snow: boolean } | null {
  if (alpha === 0 || r === 0 || r === 128) { return null; }
  if (r <= RAIN_TOP) { return { dbz: r - 32, snow: false }; }
  return r >= SNOW_FROM ? { dbz: r - 160, snow: true } : null;
}

function cellRain(rgba: Uint8ClampedArray, width: number, col: number, row: number): CityRain {
  let z = 0;
  let snowZ = 0;
  for (let dy = 0; dy < SAMPLES; dy += 1) {
    for (let dx = 0; dx < SAMPLES; dx += 1) {
      const i = ((row * SAMPLES + dy) * width + col * SAMPLES + dx) * 4;
      const hit = decode(rgba[i] ?? 0, rgba[i + 3] ?? 0);
      if (hit !== null && hit.dbz >= CLUTTER_DBZ) {
        const linear = 10 ** (hit.dbz / 10);
        z += linear;
        if (hit.snow) { snowZ += linear; }
      }
    }
  }
  if (z === 0) { return { dbz: null, snow: false }; }
  return { dbz: 10 * Math.log10(z / (SAMPLES * SAMPLES)), snow: snowZ * 2 > z };
}

export function radarCells(rgba: Uint8ClampedArray, view: GridView): RadarCells {
  const width = view.cols * SAMPLES;
  let cells = '';
  for (let row = 0; row < view.rows; row += 1) {
    for (let col = 0; col < view.cols; col += 1) {
      cells += String(levelOf(cellRain(rgba, width, col, row).dbz));
    }
  }
  return { cells, city: cellRain(rgba, width, Math.floor(view.cols / 2), Math.floor(view.rows / 2)) };
}

export function landCells(rgba: Uint8ClampedArray, view: GridView): string {
  const width = view.cols * SAMPLES;
  let cells = '';
  for (let row = 0; row < view.rows; row += 1) {
    for (let col = 0; col < view.cols; col += 1) {
      let land = 0;
      for (let dy = 0; dy < SAMPLES; dy += 1) {
        for (let dx = 0; dx < SAMPLES; dx += 1) {
          land += (rgba[((row * SAMPLES + dy) * width + col * SAMPLES + dx) * 4] ?? 0) > 127 ? 1 : 0;
        }
      }
      cells += land * 2 >= SAMPLES * SAMPLES ? '1' : '0';
    }
  }
  return cells;
}
