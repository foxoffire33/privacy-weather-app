import { classify } from '../core/appError';

import { fail } from './queryState';

import type { AppError } from '../core/appError';
import type { QueryState } from '../core/types';
import type { LandMap, ModelSet, RadarSet } from '../types';

export interface RadarLoadSettled {
  land: PromiseSettledResult<LandMap>;
  frames: PromiseSettledResult<RadarSet>;
  model: PromiseSettledResult<ModelSet>;
}

export type RadarLoadResult =
  | { status: 'success'; land: LandMap; frames: RadarSet; model?: ModelSet }
  | { status: 'partial'; land: LandMap; frames: RadarSet; optionalErrors: { model?: AppError } }
  | { status: 'error'; errors: AppError[] };

export function settleRadarLoad(
  land: PromiseSettledResult<LandMap>,
  frames: PromiseSettledResult<RadarSet>,
  model: PromiseSettledResult<ModelSet>,
): RadarLoadResult {
  if (land.status === 'rejected' || frames.status === 'rejected') {
    const errors: AppError[] = [];
    if (land.status === 'rejected') {
      errors.push(classify(land.reason, 'radar:land'));
    }
    if (frames.status === 'rejected') {
      errors.push(classify(frames.reason, 'radar:frames'));
    }
    return { status: 'error', errors };
  }
  if (model.status === 'rejected') {
    return { status: 'partial', land: land.value, frames: frames.value, optionalErrors: { model: classify(model.reason, 'radar:model') } };
  }
  return { status: 'success', land: land.value, frames: frames.value, model: model.value };
}

export function radarQueryAfter(q: QueryState, result: RadarLoadResult): QueryState {
  if (result.status === 'error') {
    if (result.errors.length === 0) { return q; }
    return fail(q, result.errors[0]);
  }
  if (result.status === 'partial') { return { status: 'partial', error: result.optionalErrors.model ?? null, lastLoadedAt: result.frames.fetchedAt }; }
  return { status: 'success', error: null, lastLoadedAt: result.frames.fetchedAt };
}
