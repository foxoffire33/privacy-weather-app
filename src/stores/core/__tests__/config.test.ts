import { afterEach, describe, expect, it } from 'vitest';

import { OFFLINE, configureDataLayer, onlineSignal } from '../config';

describe('onlineSignal', () => {
  afterEach(() => { configureDataLayer({ offline: false }); });

  it('stays live while the app is online', () => {
    const live = onlineSignal();
    expect(live.signal.aborted).toBe(false);
    live.dispose();
  });

  it('aborts with the caller reason when the caller aborts', () => {
    const caller = new AbortController();
    const live = onlineSignal(caller.signal);
    expect(live.signal.aborted).toBe(false);
    caller.abort(new Error('stopped'));
    expect(live.signal.aborted).toBe(true);
    expect(live.signal.reason).toBe(caller.signal.reason);
    live.dispose();
  });

  it('aborts with the offline reason when the app goes offline', () => {
    const caller = new AbortController();
    const live = onlineSignal(caller.signal);
    expect(live.signal.aborted).toBe(false);
    configureDataLayer({ offline: true });
    expect(live.signal.aborted).toBe(true);
    expect(live.signal.reason).toEqual(new Error(OFFLINE));
    live.dispose();
  });

  it('propagates an already-aborted caller signal immediately', () => {
    const caller = new AbortController();
    caller.abort(new Error('early'));
    const live = onlineSignal(caller.signal);
    expect(live.signal.aborted).toBe(true);
    expect(live.signal.reason).toBe(caller.signal.reason);
  });

  it('stops reacting to the sources after dispose', () => {
    const caller = new AbortController();
    const live = onlineSignal(caller.signal);
    live.dispose();
    caller.abort(new Error('late'));
    configureDataLayer({ offline: true });
    expect(live.signal.aborted).toBe(false);
  });
});
