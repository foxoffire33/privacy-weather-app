import { describe, expect, it } from 'vitest';

import { radarQueryAfter, settleRadarLoad } from '../radarLoad';

import type { QueryState } from '../../core/types';
import type { LandMap, ModelSet, RadarSet } from '../../types';

const LAND: LandMap = { version: 1, cols: 4, rows: 4, cells: 'abcd' };
const FRAMES: RadarSet = { version: 1, fetchedAt: 1000, frames: [] };
const MODEL: ModelSet = { version: 1, fetchedAt: 2000, frames: [] };
const IDLE: QueryState = { status: 'idle', error: null, lastLoadedAt: null };

const ok = <T>(value: T): PromiseFulfilledResult<T> => ({ status: 'fulfilled', value });
const rejected = (message: string): PromiseRejectedResult => ({ status: 'rejected', reason: new DOMException(message, 'AbortError') });

describe('settleRadarLoad', () => {
  it('is a full success when every resource loads', () => {
    expect(settleRadarLoad(ok(LAND), ok(FRAMES), ok(MODEL))).toEqual({ status: 'success', land: LAND, frames: FRAMES, model: MODEL });
  });

  it('is an error that names the resource when the land map fails', () => {
    expect(settleRadarLoad(rejected('land down'), ok(FRAMES), ok(MODEL))).toEqual({ status: 'error', errors: ['land map: land down'] });
  });

  it('is an error that names the resource when the frames fail', () => {
    expect(settleRadarLoad(ok(LAND), rejected('frames down'), ok(MODEL))).toEqual({ status: 'error', errors: ['radar frames: frames down'] });
  });

  it('reports every required failure', () => {
    const result = settleRadarLoad(rejected('land down'), rejected('frames down'), ok(MODEL));
    expect(result).toEqual({ status: 'error', errors: ['land map: land down', 'radar frames: frames down'] });
  });

  it('is partial when only the optional model fails, keeping the required data', () => {
    expect(settleRadarLoad(ok(LAND), ok(FRAMES), rejected('model down'))).toEqual({
      status: 'partial',
      land: LAND,
      frames: FRAMES,
      optionalErrors: { model: 'model rain: model down' },
    });
  });
});

describe('radarQueryAfter', () => {
  it('is an error state with the joined failures when a required resource failed', () => {
    expect(radarQueryAfter(IDLE, { status: 'error', errors: ['land map: down', 'radar frames: down'] }))
      .toEqual({ status: 'error', error: 'land map: down; radar frames: down', lastLoadedAt: null });
  });

  it('is a partial state carrying the model error and the frames load time', () => {
    expect(radarQueryAfter(IDLE, { status: 'partial', land: LAND, frames: FRAMES, optionalErrors: { model: 'model rain: down' } }))
      .toEqual({ status: 'partial', error: 'model rain: down', lastLoadedAt: 1000 });
  });

  it('is a success state with the frames load time', () => {
    expect(radarQueryAfter(IDLE, { status: 'success', land: LAND, frames: FRAMES, model: MODEL }))
      .toEqual({ status: 'success', error: null, lastLoadedAt: 1000 });
  });
});
