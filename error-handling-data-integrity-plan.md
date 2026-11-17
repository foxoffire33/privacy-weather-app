# Error Handling & Data Integrity — Implementation Plan

**Source report:** [`weather-log-error-handling-data-integrity-report.md`](https://github.com/foxoffire33/privacy-weather/blob/main/api.academy/database/sql/weather-log-error-handling-data-integrity-report.md)
*(local path: `/home/reinier/IdeaProjects/api.academy/database/sql/weather-log-error-handling-data-integrity-report.md`)*

**App:** `privacy-weather` (report baseline: 0.3.7)
**Plan created:** 2026-11-16 21:31 UTC
**Context note:** the `privacy-weather-app-0.3.7.zip` was downloaded to a random folder instead of Downloads (user's mistake, apologized) — this does **not** affect the plan, because the source tree is already in the workspace and every report-referenced path (`src/stores/core/idb.ts`, `src/backup/backup.ts`, …) resolves. If the zip ever needs to be unpacked or moved, ask and it will be handled.

**Goal (from report §1):** Raise error-handling and data-integrity engineering toward a defensible 10/10: failures are observable, operations have explicit outcomes, user data is not silently discarded, concurrent operations have defined ordering, and critical behavior is covered by automated tests. Target = *no silent loss, explicit failure states, recoverability, bounded retries, tested consistency guarantees*.

---

## Coding conventions (standing rules — apply to all sessions)

1. **One `try` per function, multiple `catch`, one `finally`.** Never multiple try-catch blocks in one function. A single `try` wraps the risky code; consecutive `catch` clauses distinguish the different exception types (rethrow from a clause that does not own the error); all cleanup goes in one `finally`. Steps that each need independent fault tolerance get their own small helper function with its own single `try`.
2. **No comments in code.** No inline annotations on the code.
3. **Long explanations live in the docs, not in code.** Behavior that needs explaining goes in the relevant README/doc file. In code at most a short one-line JSDoc-style comment, only where truly necessary.

*(Also persisted in `.claude/skills/review-learnings/SKILL.md` rules 15–17 and `.remember/now.md`.)*

---

## How to use this file (crash recovery)

1. This file is the **single source of truth** for progress. If the server crashes/restarts, read it first — do **not** rebuild context from memory.
2. Read **Current progress** (below) to see where you left off, then work the **Next task**.
3. At the end of every session: check off completed tasks, update **Current progress**, and append a new row to the **Session log** table at the bottom (one row per session, with UTC timestamp, what was completed, the next task, and any notes/crashes).
4. Task IDs are stable (`T1.1`, `T2.2`, …) so the log can reference them precisely.
5. Do not mark a task complete without its acceptance criteria passing.

---

## Current progress

| Field | Value |
|---|---|
| Status | **Milestone 2 in progress** — T2.2 done, 27 tests green |
| Completed tasks | **9 / 26** (T1.1–T1.7, T2.1, T2.2) |
| In progress | none |
| Next task | **T2.3** |
| Last session | 6 — 2026-11-17, see session log |

*T2.3: `onlineSignal()` in `config.ts` returns a scoped `{ signal, dispose }` (CombinedSignal) — propagate already-aborted input immediately, propagate the first later abort, `dispose()` removes listeners from every source; disposed in `finally` around the complete request including retries and body parsing (report §8).*

---

## Task list

### Milestone 1 — Stop silent data loss (P0)
Exit gate: P0 tests pass; no critical write or clear can fail silently.

- [x] **T1.1 — Add typed storage errors to `idb.ts`** *(report §3)*
  - Add `StorageErrorCode` union (`'unavailable' | 'open-failed' | 'blocked' | 'read-failed' | 'write-failed' | 'quota-exceeded' | 'transaction-aborted' | 'corrupt-data'`) and `StorageError` class (name = `'StorageError'`, keep original as `cause`).
  - Map `QuotaExceededError`, `AbortError`, `InvalidStateError` and other DOM exceptions into the taxonomy — do **not** flatten everything into `write-failed`; preserve distinctions.
  - **Done when:** taxonomy exists and is used; quota errors remain identifiable.

- [x] **T1.2 — Explicit read semantics in `idb.ts`** *(report §3)*
  - `get`: return `undefined` **only** when the key genuinely does not exist; reject on storage failure.
  - `getAll` / `recordsRange`: return `[]` **only** when the transaction succeeds and contains no rows; reject on failure.
  - `database()` open failure rejects instead of returning `null`.
  - **Done when:** a missing key is distinguishable from a failed read; a failed range query rejects instead of `[]`.

- [x] **T1.3 — Transaction completion contract helper** *(report §3)*
  - Single helper to create and await IDB transactions. Attach `complete`, `abort`, `error` handlers **immediately** after creation.
  - Synchronous exceptions while queuing requests reject the promise and abort the transaction where possible.
  - Do **not** `await` unrelated async work between transaction creation and request queuing (transactions can go inactive between event-loop tasks).
  - Writes (`put`/`delete`) resolve only after `complete`; reject on `error`/`abort`.
  - **Done when:** a write resolves only after transaction completion; transaction-abort behavior is tested.

- [x] **T1.4 — Reliable debounced persistence coordinator in `persistStorage.ts`** *(report §4)*
  - Replace fire-and-forget + `.catch(() => null)` with a per-key write coordinator: `Map<string, PendingWriteState>` with `revision` (monotonic), newest `value`, `attempts`, debounce `timer`, `flushing`, `lastError`, and a flush promise callers/tests can await.
  - On failure: keep the newest desired value queued; bounded exponential backoff **with jitter** for transient errors; do **not** retry permanent errors indefinitely; publish a persistence error state; a later successful write clears the error.
  - Supersession rule: an older revision completing in flight must **not** mark a newer revision as persisted; retry the newest value.
  - **Done when:** failed writes remain queued; latest value wins when writes overlap; a failed write is visible to the app; a later retry recovers without reloading; tests cover failure, retry, supersession, flush.

- [x] **T1.5 — Awaitable `flushPersistedState()`** *(report §4)*
  - Add `flushPersistedState(name?: string): Promise<void>` — flush one key or all pending; **reject** if any requested write is still not persisted.
  - Use it in tests, before backup export, and in user-initiated operations requiring durable state. Do not rely on `pagehide` as the only persistence guarantee.
  - Document the Zustand `PersistStorage.setItem` contract explicitly: does it mean *queued* or *committed*? For critical user-owned data expose a separate awaited persistence operation; UI must not report "saved" merely because a debounce was scheduled.
  - **Done when:** API exists with documented semantics; critical UI actions report saved only after commit.

- [x] **T1.6 — Serialize `clearRecords()` with writes** *(report §5)*
  - Route delete-by-prefix through the **same serialized mutation queue** as record puts (not a separate path).
  - Ordering contract for a prefix: writes submitted **before** `clearRecords(prefix)` are removed from pending; the clear commits after all earlier mutations; writes submitted **after** the clear are allowed to persist; a failed clear rejects and stays visible.
  - Execute the prefix deletion in a read-write transaction; resolve only after transaction completion.
  - Remove the `.catch(() => null)` swallow on `recordsDeletePrefix`.
  - **Done when:** all 5 scheduling tests pass — (1) put→clear→flush absent; (2) flush begins→clear→flush completes→clear completes → absent; (3) clear→new put→clear completes→put flushes → new record exists; (4) clear fails → error surfaced, UI does not claim cleared; (5) multiple prefix clears don't interfere.

- [x] **T1.7 — Milestone 1 exit-gate tests (fake-indexeddb)** *(report §3, §5, §14)*
  - Deterministic tests with `fake-indexeddb` + fake timers covering: DB open failure → explicit storage error; blocked upgrade → observable blocked state, no false success; missing key → explicit not-found; transaction abort → rejected read/write; quota exceeded → pending value retained + quota error exposed; put→clear ordering schedules from T1.6.
  - **Gate:** all P0 cases pass. No critical write or clear fails silently.

### Milestone 2 — Deterministic async behavior (P1)
Exit gate: cancellation, retry and partial-failure tests pass; no request is marked successful when required work failed.

- [x] **T2.1 — Bounded, observable record flush retries in `recordSync.ts`** *(report §6)*
  - Track attempt count per batch/key; bounded exponential backoff with jitter (do **not** retry at fixed 250 ms forever — that creates a tight failure loop when storage is full/unavailable).
  - Stop automatic retries for permanent errors (invalid DB state) until database is reopened or the user retries.
  - Expose pending record count and last error.
  - `flushRecords()` rejects when its requested batch fails, instead of resolving as success.
  - Add a separate best-effort lifecycle flush for `pagehide`; do not treat it as proof of persistence.
  - Preserve "newer write wins" behavior.
  - **Done when:** repeated failure cannot continue invisibly; retry policy is bounded and observable.

- [x] **T2.2 — Radar: handle all settled results** *(report §7)*
  - In `src/stores/radarStore.ts`, inspect the third `Promise.allSettled()` result (`loadModel`) — it is currently ignored.
  - Name results by resource (avoid the misleading `radar` variable for `loadFrames`).
  - Introduce `RadarLoadResult` discriminated union: `{ status: 'success'; land; frames; model? } | { status: 'partial'; land; frames; optionalErrors: { model? } } | { status: 'error'; errors }`.
  - Policy: land map + radar frames required; model rain optional → partial state with explicit "model layer unavailable", never silent success.
  - Retry can reload only the failed optional layer where practical.
  - **Done when:** required-resource failure → error state; optional failure → partial state; failed model never reported as successful.

- [ ] **T2.3 — Dispose combined abort listeners (`config.ts`)** *(report §8)*
  - `onlineSignal()` should return a scoped `{ signal, dispose }` (`CombinedSignal`): immediately propagate already-aborted input; propagate the first later abort; `dispose()` removes listeners from **every** source.
  - Dispose in a `finally` block around the complete request — including retries and body parsing.
  - If `AbortSignal.any()` is adopted, do not add listeners to the combined signal unless removed in `finally`. Verify Android WebView compatibility baseline first.
  - **Done when:** long-running sessions no longer accumulate listeners; online/offline still propagates correctly.

- [ ] **T2.4 — `client.ts`: sleep cleanup + retry policy** *(report §8)*
  - Fix `sleep()` so both normal completion **and** abort remove the listener and clear the timer (use the guarded pattern: `throwIfAborted()` up front, `cleanup()` in both resolve and reject paths, final `signal.aborted` check closing the race).
  - Retry policy: retry network errors and explicitly retryable HTTP statuses (429/503); respect `Retry-After`; **do not** retry user cancellation or validation/schema errors; bounded exponential backoff with jitter; add a request timeout distinct from user cancellation; preserve error type and status code for UI decisions; avoid retrying non-idempotent operations without an idempotency strategy.
  - **Done when:** listener leak gone; user aborts during backoff stop retries immediately; timeout distinguishable from cancellation; 429 `Retry-After` yields correct bounded delay.

- [ ] **T2.5 — Explicit hydration outcomes** *(report §9)*
  - Return `HydrationResult` discriminated union (`{ status: 'hydrated' } | { status: 'timeout' }`); `waitForHydration()` resolves explicitly on timeout instead of indistinguishably.
  - Subscribe to Zustand's hydration error callback where available and preserve the error; a failed read must not silently initialize defaults and overwrite user's previous settings.
  - Always clean up timer and subscription on either outcome.
  - Define a late-hydration merge policy so a late completion cannot unexpectedly overwrite newer user edits.
  - **Done when:** hydration success distinguishable from timeout; storage read failure distinguishable from empty storage; no leaked subscription.

### Milestone 3 — Data validation and recovery (P1)
Exit gate: invalid or incompatible data cannot silently overwrite valid user data.

- [ ] **T3.1 — Runtime validation of persisted settings (Zod)** *(report §10)*
  - Replace the `as Partial<SettingsState>` cast in `settingsStore.ts` with a Zod schema validating each field; apply defaults only to missing/invalid fields per an explicit policy; record a recoverable validation error.
  - Validate server URLs: protocol + URL shape; reject unsupported schemes. Keep API keys out of logs/diagnostics.
  - **Done when:** corrupt persisted settings produce a validation error + recovery path, not silent defaults.

- [ ] **T3.2 — Backup version validation + migrations** *(report §10)*
  - `src/backup/backup.ts` currently always returns `version: 1` — require a supported version; reject unknown future versions with a clear message; add explicit version migrations.
  - **Done when:** a future-version backup is rejected without changing live state.

- [ ] **T3.3 — Backup field validation** *(report §10)*
  - Validate real calendar dates (not just regex format); latitude `[-90, 90]`, longitude `[-180, 180]`; numeric ranges (e.g. snapshot interval); enforce maximum import byte size and sensible limits on cities/history records; detect duplicate city IDs and invalid references.
  - Report skipped invalid records instead of silently dropping them.
  - **Done when:** invalid coordinates/dates are rejected or explicitly reported as skipped.

- [ ] **T3.4 — Atomic two-stage backup import** *(report §10)*
  - Stage 1: parse and validate the **complete** backup into a temporary, fully validated backup model — before any mutation of live stores.
  - Stage 2: commit the import in one coordinated operation with rollback or a recoverable snapshot; if atomicity across object stores is required, put the relevant object stores in one IndexedDB read-write transaction — with **no unrelated `await`** inside that transaction.
  - **Done when:** invariant holds — invalid backup data cannot partially mutate live application state.

- [ ] **T3.5 — Storage durability & quota status** *(report §15, §16)*
  - Request persistent storage via `navigator.storage.persist()` where supported; treat denial as a normal outcome.
  - Use `navigator.storage.estimate()` to detect low storage headroom and show a warning; keep disposable response caches separately identifiable so they can be pruned before user data.
  - Consider `durability: 'strict'` for transactions containing irreplaceable user-owned data where supported; keep relaxed durability for reconstructible cache data; do **not** rely on non-standard `readwriteflush`.
  - Provide a tested export/restore path for user-owned history; tell users browser/device storage can still be lost and recommend periodic exports.
  - **Done when:** quota scenario verified; export/restore round trip tested; user messaging accurate.

- [ ] **T3.6 — Backup round-trip + corrupted-input tests** *(report §16)*
  - Test export/import round trips and corrupted input (future version, invalid coords/dates, oversized input, duplicates) — all rejected or explicitly reported, never partially applied.

### Milestone 4 — Long-session stability and production verification (P2)
Exit gate: all invariants pass in CI and critical scenarios verified on supported runtime targets.

- [ ] **T4.1 — Bound `inflight.ts` settled state** *(report §11)*
  - Add a bounded LRU or TTL policy for `settled` (it retains every completed key indefinitely); keep active requests in `running`; retain settled promises only for the lifecycle the Suspense/query design actually consumes; never evict while an active consumer relies on it.
  - **Done when:** memory stays bounded over many unique request keys (test in §14 matrix).

- [ ] **T4.2 — Bound `recordSync.ts` bookkeeping** *(report §11)*
  - Establish exactly which callers rely on `changedSinceStart()`; replace global historical bookkeeping (`touched`, `clearedPrefixes`) with scoped hydration generations or bounded per-prefix state; clear entries when the corresponding restore/hydration lifecycle ends. Do **not** clear on a timer while a restore is in progress.
  - **Done when:** no unbounded growth; restore correctness intact.

- [ ] **T4.3 — Separate cache failures from user-data failures** *(report §12)*
  - Make `cachedJson()`'s best-effort cache policy intentional and observable: cache read failure → diagnostic + network fetch; cache write failure → return valid network response + record the cache persistence failure; user-history write failure → do not claim saved; settings write failure → recoverable warning.
  - Fix `fetchedAt`: capture the timestamp **after** the response has been fetched and validated, not before the network request.
  - **Done when:** cache failure cannot corrupt or block user-owned data.

- [ ] **T4.4 — Application-wide error model + UI behavior** *(report §13)*
  - Define `AppErrorCode` taxonomy (`'network.offline' | 'network.timeout' | 'network.http' | 'network.invalid-response' | 'storage.unavailable' | 'storage.quota-exceeded' | … | 'unknown'`).
  - Every error carries: stable code, safe user-facing message key, retryability, optional HTTP status, optional storage operation/key category (never the secret value), original `cause`, correlation/operation ID where useful.
  - Implement the UI table: offline state (not an unexpected error), retry affordances, "Not saved" + retry for user-data writes, quota explanation with cache cleanup/export offer, backup invalid → explain + no mutation, cancellation → no toast. Never log API keys, credential-bearing URLs, or personal data.
  - **Done when:** every critical failure has a stable code, safe message, and observable state.

- [ ] **T4.5 — Privacy-preserving diagnostics/metrics** *(report §16)*
  - Add metrics/diagnostics that do not expose personal data; opt-in or local-by-default diagnostics.

- [ ] **T4.6 — Browser + Android WebView integration tests** *(report §14, §16)*
  - Run a smaller set of tests in real browser/WebView environments (fakes can't reproduce every transaction lifecycle); cover the §14 test matrix rows not already covered by unit tests (API abort-during-backoff, 429 Retry-After, radar partial, backup size limits, memory bounds).

- [ ] **T4.7 — Real-device storage failure + low-quota scenarios** *(report §16)*
  - Run storage-failure and low-quota scenarios on supported real devices/Android WebView.

- [ ] **T4.8 — Document recovery & backup guarantees; 10/10 scorecard** *(report §17)*
  - Document recovery and backup guarantees; adopt the §17 release scorecard (error visibility, persistence, ordering, atomicity, recovery, validation, cancellation, resilience, testing, operations) as the release gate: do not call data integrity 10/10 until P0 items are fixed, all data-integrity invariants are automated, and real-browser/device tests cover storage failure and concurrency.

---

## Session log

*Append one row per session at the end of this file. On resume after a crash, read the last row — the "Next task" column says exactly where to continue.*

| # | UTC time | Status | Completed (tasks) | Next task | Notes |
|---|---|---|---|---|---|
| 1 | 2026-11-16 21:31 | Plan created; report read in full; implementation not started | 0 / 26 | **T1.1** | Server restarted mid-session before implementation began — nothing lost; report read, plan written, this log started. User apologized for downloading the app zip to a random folder instead of Downloads (no impact: source tree already in workspace). |
| 2 | 2026-11-16 22:59 | Branch `claude/data-integrity-plan` created; T1.1 committed (9ef18c7); T1.2 edits made, uncommitted; standing code-style rules added (one-try rule, no comments, docs-not-code) | 1 / 26 | **T1.2** (finish: refactor hydrateAll per one-try rule, strip added comments, fix `hit` possibly-undefined in client.ts, doc the read policy in stores/README.md, then tsc+lint+commit) | Rules persisted in `.claude/skills/review-learnings/SKILL.md` (15–17) and `.remember/now.md`. Refactor of already-changed files in progress. |
| 3 | 2026-11-16 (later) | T1.2 finished + committed (6d99ca2: hydrateAll refactored to one-try via bootStep helper, comments stripped, `isAbsent` type guard added to guards, README rule 11/12); T1.3 committed (baa953f: withTransaction helper, write rejects when IDB absent); T1.4 committed (47bf61b: per-key write coordinator — revisions, serialized chain, bounded jittered backoff, read-failed gate, persistenceStatus); T1.5 committed (1a391bf: flushPersistedState, backup export awaits it, README rule 11); T1.6 committed (de362e7: clearRecords queued on the write chain, failures reject + noteStorageFault) | 6 / 26 | **T1.7** (test infra: vitest + fake-indexeddb + fake timers; P0 suite incl. the 5 clearRecords scheduling tests) | All code passes tsc, eslint, vite build. Lint gotchas hit this session: eqeqeq (no `!= null` → use isAbsent guard), prefer-promise-reject-errors, promise-function-async, no-unnecessary-condition, unicorn rules (no-useless-undefined, no-negated-condition, prefer-spread vs no-useless-spread), no-await-in-loop + no-unnecessary-condition forbid `while (true)` → use bounded recursion. `yarn.lock` is pre-existing untracked — do not commit it. |
| 4 | 2026-11-17 00:05 | T1.7 committed (a534716): vitest 5.1.0 + fake-indexeddb 6.2.8 devDeps, `test` script, 15 P0 tests across idb/persistStorage/recordSync — all passing. Testing exposed two real bugs, both fixed in the same commit: (a) `openDb` did not wrap a synchronous `indexedDB.open` throw (raw DOMException escaped the taxonomy); (b) the blocked-upgrade listener read `request.error`, which the spec forbids outside the error state — it crashed instead of rejecting. Also added `retryPersistedState()` (manual recovery path) and an error `code` to `PersistenceStatus`. **MILESTONE 1 COMPLETE — P0 exit gate passed.** | 7 / 26 | **T2.1** (bounded, observable record flush retries in recordSync.ts) | ESLint gotchas for tests: `no-unsafe-type-assertion` + `objectLiteralTypeAssertions: 'never'` + `ban-ts-comment` (all @ts-* banned) → NO stubs with casts, no escape hatches; use real fake-indexeddb failure modes (spy-throws, real second-connection block) and `vi.fn()` mocks. `require-await` + `promise-function-async` together: mock impls of `() => Promise<void>` must be `async` with a real `await` (or throw synchronously with inferred `never`). `consistent-type-imports` bans `typeof import('…')` annotations → `import type * as X` + `typeof X`. |
| 5 | 2026-11-17 00:35 | T2.1 committed (d24d9a5): bounded, observable record flush retries in recordSync.ts — requeue keeps newer-wins + clear-drop, typed StorageError recorded in module state, bounded jittered backoff (8 attempts, 250 ms base, 30 s cap) for transient codes only, permanent codes stop auto-retry (manual `flushRecords()` or a new write recovers), `recordSyncStatus()` pull getter (pending/attempts/code/lastError), `flushRecords()` rejects on batch failure, pagehide/visibility flush best-effort via `onRecordFault` hook wired in the stores barrel into `noteStorageFault`; `RETRYABLE_WRITE_CODES` moved to idb.ts (shared); README rule 14; 4 new tests (19 total) — all green (tsc/eslint/build/tests). | 8 / 26 | **T2.2** (radar `Promise.allSettled`: handle the ignored `loadModel` result; `RadarLoadResult` union; required land+frames vs optional model) | Gotchas this session: `@typescript-eslint/require-await` exempts async fns that RETURN a promise (empirically verified — `flushRecords` returns `chain.then(...)` and passes) but flags async fns returning nothing; mock impls throwing synchronously must have inferred `never` return (an explicit `: void` annotation breaks the `Promise<void>` mock signature); `let x: T | null;` WITHOUT initializer + null-check in a later closure is the CFA-safe pattern (an `= null` initializer narrows to `never` in the other closure). |
| 6 | 2026-11-17 12:05 | T2.2 committed (fdaff2e): radar load settles ALL three allSettled results — new pure `src/stores/factory/radarLoad.ts` with `RadarLoadResult` union (success/partial/error, per report §7 shape) + `settleRadarLoad` + `radarQueryAfter` (settlement → QueryState); `QueryStatus` gained `'partial'`; loaders renamed to data-returning `landData`/`framesData`/`modelData`, `load()` writes every fulfilled part via `applyResults` (a failed required resource no longer discards the others) and settles the query through `radarQueryAfter`; failed model → `'partial'` (never `'success'`) with `optionalErrors.model` in the query error; `'partial'` is not fresh, so the 5-min refresh re-attempts and only the stale model layer is re-fetched; radar banner shows the model error via new `staleNote` prop (`staleState` helper extracted to keep RadarContent under the complexity cap); 8 new tests (27 total) — all green (tsc/eslint/build/tests). | 9 / 26 | **T2.3** (config.ts `onlineSignal()` → scoped `{ signal, dispose }` CombinedSignal; dispose in `finally` around the whole request) | TS narrowing trap found the hard way: code AFTER a plain `if (x.status === 'rejected') { push; }` (no return/throw) is NOT narrowed — the branch's exit type re-enters the merge; trailing narrowing only works when the matching branch terminates (return/throw) or via else. Restructure such settles as early-terminating branches. Also: import-x/order case-insensitive puts `./factories/radar` BEFORE `./factory/...` ('i' < 'y'); `max-params: 4` and `complexity: 15` are enforced — extract helpers. |
