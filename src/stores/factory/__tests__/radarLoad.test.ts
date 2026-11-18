import { describe, expect, it } from 'vitest';

import { AppError } from '../../core/appError';
import { radarQueryAfter, settleRadarLoad } from '../radarLoad';

import type { QueryState } from '../../core/types';
import type { LandMap, ModelSet, RadarSet } from '../../types';

const LAND: LandMap = { version: 1, cols: 4, rows: 4, cells: 'abcd' };
const FRAMES: RadarSet = { version: 1, fetchedAt: 1000, frames: [] };
const MODEL: ModelSet = { version: 1, fetchedAt: 2000, frames: [] };
const IDLE: QueryState = { status: 'idle', error: null, lastLoadedAt: null };

const ok = <T>(value: T): PromiseFulfilledResult<T> => ({ status: 'fulfilled', value });
const down = (message: string): { reason: TypeError; settled: PromiseRejectedResult } => {
  const reason = new TypeError(message);
  return { reason, settled: { status: 'rejected', reason } };
};

const classified = (id: string, reason: unknown): AppError =>
  new AppError({ code: 'unknown', messageKey: 'errors.unknown', retryable: false, id, cause: reason });

describe('settleRadarLoad', () => {
  it('is a full success when every resource loads', () => {
    expect(settleRadarLoad(ok(LAND), ok(FRAMES), ok(MODEL))).toEqual({ status: 'success', land: LAND, frames: FRAMES, model: MODEL });
  });

  it('classifies the land map failure with its operation id', () => {
    const land = down('land down');
    expect(settleRadarLoad(land.settled, ok(FRAMES), ok(MODEL))).toEqual({
      status: 'error',
      errors: [classified('radar:land', land.reason)],
    });
  });

  it('classifies the frame failure with its operation id', () => {
    const frames = down('frames down');
    expect(settleRadarLoad(ok(LAND), frames.settled, ok(MODEL))).toEqual({
      status: 'error',
      errors: [classified('radar:frames', frames.reason)],
    });
  });

  it('reports every required failure', () => {
    const land = down('land down');
    const frames = down('frames down');
    expect(settleRadarLoad(land.settled, frames.settled, ok(MODEL))).toEqual({
      status: 'error',
      errors: [classified('radar:land', land.reason), classified('radar:frames', frames.reason)],
    });
  });

  it('is partial when only the optional model fails, keeping the required data', () => {
    const model = down('model down');
    expect(settleRadarLoad(ok(LAND), ok(FRAMES), model.settled)).toEqual({
      status: 'partial',
      land: LAND,
      frames: FRAMES,
      optionalErrors: { model: classified('radar:model', model.reason) },
    });
  });
});

describe('radarQueryAfter', () => {
  it('is an error state carrying the first failure when a required resource failed', () => {
    const error = new AppError({ code: 'unknown', messageKey: 'errors.unknown', retryable: false, id: 'radar:land' });
    expect(radarQueryAfter(IDLE, { status: 'error', errors: [error] }))
      .toEqual({ status: 'error', error, lastLoadedAt: null });
  });

  it('is a partial state carrying the model error and the frames load time', () => {
    const error = new AppError({ code: 'unknown', messageKey: 'errors.unknown', retryable: false, id: 'radar:model' });
    expect(radarQueryAfter(IDLE, { status: 'partial', land: LAND, frames: FRAMES, optionalErrors: { model: error } }))
      .toEqual({ status: 'partial', error, lastLoadedAt: 1000 });
  });

  it('is a success state with the frames load time', () => {
    expect(radarQueryAfter(IDLE, { status: 'success', land: LAND, frames: FRAMES, model: MODEL }))
      .toEqual({ status: 'success', error: null, lastLoadedAt: 1000 });
  });
});
