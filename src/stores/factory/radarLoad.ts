import { errorMessage } from '../core/errors';

import { fail } from './queryState';

import type { QueryState } from '../core/types';
import type { LandMap, ModelSet, RadarSet } from '../types';

export interface RadarLoadSettled {
  land: PromiseSettledResult<LandMap>;
  frames: PromiseSettledResult<RadarSet>;
  model: PromiseSettledResult<ModelSet>;
}

export type RadarLoadResult =
  | { status: 'success'; land: LandMap; frames: RadarSet; model?: ModelSet }
  | { status: 'partial'; land: LandMap; frames: RadarSet; optionalErrors: { model?: string } }
  | { status: 'error'; errors: string[] };

export function settleRadarLoad(
  land: PromiseSettledResult<LandMap>,
  frames: PromiseSettledResult<RadarSet>,
  model: PromiseSettledResult<ModelSet>,
): RadarLoadResult {
  if (land.status === 'rejected' || frames.status === 'rejected') {
    const errors: string[] = [];
    if (land.status === 'rejected') {
      errors.push(`land map: ${errorMessage(land.reason)}`);
    }
    if (frames.status === 'rejected') {
      errors.push(`radar frames: ${errorMessage(frames.reason)}`);
    }
    return { status: 'error', errors };
  }
  if (model.status === 'rejected') {
    return { status: 'partial', land: land.value, frames: frames.value, optionalErrors: { model: `model rain: ${errorMessage(model.reason)}` } };
  }
  return { status: 'success', land: land.value, frames: frames.value, model: model.value };
}

export function radarQueryAfter(q: QueryState, result: RadarLoadResult): QueryState {
  if (result.status === 'error') { return fail(q, result.errors.join('; ')); }
  if (result.status === 'partial') { return { status: 'partial', error: result.optionalErrors.model ?? null, lastLoadedAt: result.frames.fetchedAt }; }
  return { status: 'success', error: null, lastLoadedAt: result.frames.fetchedAt };
}
