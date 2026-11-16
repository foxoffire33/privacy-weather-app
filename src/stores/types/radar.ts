import type { VectorTileLayer } from '@mapbox/vector-tile';

export type RadarLevel = 0 | 1 | 2 | 3;

export interface RadarFrameRef {
  time: number;
  path: string;
  forecast: boolean;
}

export interface RadarFrame {
  time: number;
  forecast: boolean;
  cells: string;
  cityDbz: number | null;
  citySnow: boolean;
}

export interface RadarSet {
  version: number;
  fetchedAt: number;
  frames: RadarFrame[];
}

export interface LandMap {
  version: number;
  cols: number;
  rows: number;
  cells: string;
}

export interface RadarGrid {
  cols: number;
  rows: number;
  cellMeters: number;
}

export interface GridView extends RadarGrid {
  lat: number;
  lon: number;
}

export interface TilePlacement {
  x: number;
  y: number;
  left: number;
  top: number;
  size: number;
}

export interface TileCover {
  zoom: number;
  width: number;
  height: number;
  tiles: TilePlacement[];
}

export interface CityRain {
  dbz: number | null;
  snow: boolean;
}

export interface RadarCells {
  cells: string;
  city: CityRain;
}

export interface MapTileLayers {
  place: TilePlacement;
  earth: VectorTileLayer | undefined;
  water: VectorTileLayer | undefined;
}

export interface MapSource {
  maxZoom: () => Promise<number>;
  tile: (z: number, x: number, y: number) => Promise<ArrayBuffer | null>;
}

export interface TileJson {
  tiles: string[];
  maxzoom: number;
}

export interface ModelFrame {
  time: number;
  cells: string;
  cityMm: number;
}

export interface ModelSet {
  version: number;
  fetchedAt: number;
  frames: ModelFrame[];
}

export interface GeoPoint {
  lat: number;
  lon: number;
}
