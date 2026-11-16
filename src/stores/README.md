# The data layer

`src/stores` is a self-contained data layer: Zustand stores over a normalized entity cache,
persisted to IndexedDB, fed by typed Open-Meteo endpoint functions.

```
 React  ──reads──▶  selectors / store hooks
                       │ join ids → entities
 stores/*  (query state: ids, dates, status)
     │ calls                         ▲ upsert
 api/*  (typed endpoint fns) ──▶ entities/  (normalized cache: byId)
     │                               │ persist
 core/config (key · host)        core/idb  (IndexedDB: wl-storesv2)
```

| Folder | Holds |
| --- | --- |
| `core/` | config, IndexedDB wrapper, persist storage, errors, date helpers, shared primitives |
| `types/` | the read shapes: cities, forecasts, logged days, settings, the backup file |
| `entities/` | the normalized cache (`useEntityCache`), the entity-name → type registry, read selectors |
| `api/` | pure typed endpoint functions and the mappers into entities — **no cache side effects** |
| `factory/` | query-state reducers |
| `*-store.ts` | one Zustand store per domain, with their state contracts in `store-types.ts` |
| `weather-sync.ts` | the commands that span domains |
| `selectors.ts` | joined read hooks — what screens subscribe to |
| `hydration.ts` | `hydrateAll()` — awaits rehydration of every persisted store |
| `migrate-legacy.ts` | one-time import of the pre-split `open-weather-log` key |

## The rules

**1. One source of truth per entity.** Every source of a day — the daily refresh, a range
download, opening that day in full — `upsert`s into `entities/cache` keyed `${cityId}:${date}`.
Stores keep **ids and status only**; `selectors.ts` joins them back to live entities.

**2. `api/*` never touches the entity cache.** Endpoint functions fetch Open-Meteo JSON
(`api/client.ts`), validate it with Zod (`api/schemas.ts`) and build our objects with the pure
factories in `factories/`. They may read and write the raw response cache (`responses` object
store, keyed by the request without the API key, each kind with its own age), never the entity
cache: the store that called them owns the upsert. They run in a worker (`api/worker.ts` via
Comlink, `api/remote.ts` picks worker or direct); stores import `api/remote`, never `api/openMeteo`.
A factory change that alters the objects bumps `FACTORY_VERSION`; stored objects with an older
version are shown, then rebuilt in the background.

**3. A mapper omits what its source cannot measure.** The cache folds an incoming record over
the stored one and skips `undefined`, so a field the source has no instrument for must be left
absent, never set to `null`. `null` is a reading — the station had no value that day — and
overwrites. This is why importing five years of archive data does not strip the UV index off
the recent end of it: ERA5 has no UV at all, so `fromRangeRow` leaves it `undefined`.

**4. A logged day outranks a downloaded one.** `FOLD_RULES.dayRecord` never lets `source` fall
from `log` back to `filled`. The log is the app's own record of what it saw.

**5. Persistence is per record.** Anything that grows with use (entities, forecasts, log dates,
day data) lives as one IndexedDB record per key in the `records` store (`entity:dayRecord:<city>:<date>`,
`forecast:<city>`, `log:<city>`, `day:<city>:<date>`). Changes go through `core/recordSync.ts`:
`putRecord` / `deleteRecord` (or `persistMap` for a keyed map in a store) mark keys dirty, and one
relaxed transaction writes only those keys every 250 ms and on `pagehide`. Never write a whole
growing store as one value: IndexedDB clones it on the main thread. Small settings-like stores
keep Zustand `persist` with `idbStorage`, registered in `PERSISTED` in `hydration.ts`.

**5a. Hydration has two phases.** `hydrateAll()` (the splash waits for it) restores settings,
cities, forecasts, log dates and the last 120 days. `whenHistoryReady()` restores older days in
decade chunks, yielding between reads, and commits them in one update; the app starts it after
first paint, and screens that need old days (`History`, `DayView`) suspend on `useHistoryReady()`.
Restores run inside `restore()` so they are not written back.

**6. Loading and error state goes through `factory/query-state`** — `begin` / `succeed` /
`fail`, read with `isLoading` / `isFresh`. No per-store loading booleans.

**7. A selector returns a stable reference.** Anything a component subscribes to must be the
same object between renders when nothing changed — a store field, a primitive derived from one,
or a `useMemo` over them. A fallback that builds a value (`?? initialQueryState()`) makes every
render a new snapshot, and React re-renders until it gives up: that is how the history screen
came back blank. Use the shared frozen `IDLE_QUERY`, and `useShallow` for a projected object.

**8. No UI concerns in the layer.** Record the failure in a `QueryState` and let the screen
render it. A message the user should read in their own language is reported as a code
(`NO_ARCHIVE_DATA`) and translated by the screen.

**9. The layer never imports app modules.** What it needs of the user's choices — the API key
and the host override — the host pushes in through `configureDataLayer` (`core/config.ts`);
`settings-store` does that on every change. Reach for `getConfig()`, never an app import.

**10. Commands that span domains live in `weather-sync.ts`.** No store imports another.
A refresh measures the gap, fetches, logs what came back and makes sure the normals exist — in
that order, in one readable place.

## What this layer deliberately does not have

- **No realtime.** Open-Meteo does not push; data arrives when the app asks.
- **No optimistic writes.** Every write is local — there is no server to roll back against.
- **No pagination factory.** Nothing here is a cursor list; the log is a sorted date array.
- **No HTTP library.** `api/client.ts` is a small `fetch` wrapper with retries and backoff; every
  call goes through `getConfig().fetch ?? fetch` and the offline `AbortSignal`.

## Privacy

No device location is ever read: a city is added by name search only. Nothing leaves the device
except the Open-Meteo requests themselves, and the API key is never written to a backup.
