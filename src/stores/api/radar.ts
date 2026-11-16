import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles } from 'pmtiles';

import { getConfig } from '../core/config';
import { gridView, LAND_VERSION, landCells, radarCells, tileCover, zoomFor } from '../factories/radar';

import { getBytes, getUrlJson } from './client';
import { radarMapsSchema } from './schemas';

import type { City, GridView, LandMap, MapTileLayers, RadarFrame, RadarFrameRef, TileCover, TilePlacement } from '../types';
import type { VectorTileLayer } from '@mapbox/vector-tile';
import type { RangeResponse, Source } from 'pmtiles';

const RADAR_MAX_ZOOM = 10;
const MAP_MAX_ZOOM = 10;
const COLOR_RAW = 0;
export const MAP_PATH = '/map/basemap.pmtiles';

export class RadarServerMissing extends Error {
  constructor() {
    super('NO_RADAR_SERVER');
  }
}

function server(): string {
  const url = getConfig().radarServer.trim().replace(/\/+$/, '');
  if (url === '') { throw new RadarServerMissing(); }
  return url;
}

export async function fetchRadarFrames(): Promise<RadarFrameRef[]> {
  const json = radarMapsSchema.parse(await getUrlJson(`${server()}/public/weather-maps.json`));
  return [
    ...json.radar.past.map((f) => ({ time: f.time, path: f.path, forecast: false })),
    ...(json.radar.nowcast ?? []).map((f) => ({ time: f.time, path: f.path, forecast: true })),
  ];
}

function canvas(cover: TileCover): OffscreenCanvasRenderingContext2D {
  const ctx = new OffscreenCanvas(cover.width, cover.height).getContext('2d', { willReadFrequently: true });
  if (ctx === null) { throw new Error('No 2D canvas'); }
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

async function drawRadarTile(ctx: OffscreenCanvasRenderingContext2D, url: string, place: TilePlacement): Promise<void> {
  const bytes = await getBytes(url);
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  ctx.drawImage(bitmap, place.left, place.top, place.size, place.size);
  bitmap.close();
}

export async function fetchRadarFrame(city: City, frame: RadarFrameRef): Promise<RadarFrame> {
  const base = server();
  const view = gridView(city.lat, city.lon);
  const cover = tileCover(view, zoomFor(view, RADAR_MAX_ZOOM));
  const ctx = canvas(cover);
  await Promise.all(cover.tiles.map(async (place) => drawRadarTile(
    ctx, `${base}${frame.path}/256/${String(cover.zoom)}/${String(place.x)}/${String(place.y)}/${String(COLOR_RAW)}/0_1.png`, place,
  )));
  const { cells, city: rain } = radarCells(ctx.getImageData(0, 0, cover.width, cover.height).data, view);
  return { time: frame.time, forecast: frame.forecast, cells, cityDbz: rain.dbz, citySnow: rain.snow };
}

function source(url: string): Source {
  return {
    getKey: () => url,
    getBytes: async (offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> => ({
      data: await getBytes(url, { Range: `bytes=${String(offset)}-${String(offset + length - 1)}` }, signal),
    }),
  };
}

const archives = new Map<string, PMTiles>();

function archive(url: string): PMTiles {
  let found = archives.get(url);
  if (found === undefined) {
    found = new PMTiles(source(url));
    archives.set(url, found);
  }
  return found;
}

function tracePolygons(ctx: OffscreenCanvasRenderingContext2D, layer: VectorTileLayer | undefined, place: TilePlacement): void {
  ctx.beginPath();
  if (layer === undefined) { return; }
  for (let i = 0; i < layer.length; i += 1) {
    const feature = layer.feature(i);
    if (feature.type !== 3) { continue; }
    const scale = place.size / feature.extent;
    for (const ring of feature.loadGeometry()) {
      for (const [k, p] of ring.entries()) {
        const px = place.left + p.x * scale;
        const py = place.top + p.y * scale;
        if (k === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
      }
      ctx.closePath();
    }
  }
}

async function mapTile(tiles: PMTiles, zoom: number, place: TilePlacement): Promise<MapTileLayers | null> {
  const tile = await tiles.getZxy(zoom, place.x, place.y);
  if (tile === undefined) { return null; }
  const { layers } = new VectorTile(new PbfReader(new Uint8Array(tile.data)));
  return { place, earth: Object.hasOwn(layers, 'earth') ? layers.earth : undefined, water: Object.hasOwn(layers, 'water') ? layers.water : undefined };
}

export async function fetchLandMap(city: City): Promise<LandMap> {
  const tiles = archive(`${server()}${MAP_PATH}`);
  const header = await tiles.getHeader();
  const view: GridView = gridView(city.lat, city.lon);
  const cover = tileCover(view, zoomFor(view, Math.min(MAP_MAX_ZOOM, header.maxZoom)));
  const ctx = canvas(cover);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cover.width, cover.height);
  const found = await Promise.all(cover.tiles.map(async (place) => mapTile(tiles, cover.zoom, place)));
  for (const tile of found) {
    if (tile === null) { continue; }
    ctx.fillStyle = '#fff';
    if (tile.earth === undefined) {
      ctx.fillRect(tile.place.left, tile.place.top, tile.place.size, tile.place.size);
    } else {
      tracePolygons(ctx, tile.earth, tile.place);
      ctx.fill('evenodd');
    }
    ctx.fillStyle = '#000';
    tracePolygons(ctx, tile.water, tile.place);
    ctx.fill('evenodd');
  }
  return { version: LAND_VERSION, cols: view.cols, rows: view.rows, cells: landCells(ctx.getImageData(0, 0, cover.width, cover.height).data, view) };
}
