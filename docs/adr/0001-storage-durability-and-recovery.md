# ADR 0001 — Durable user data, boot and recovery

Status: Proposed (2026-11-18). See [engineering hardening issue #34](https://github.com/foxoffire33/privacy-weather-app/issues/34).

## Source of truth

IndexedDB records and persisted key-value settings are the source of truth. Zustand mirrors them for interactive rendering, but a UI update alone does not establish a durable commit. Weather response caches are disposable; cities, edits and weather history are not.

Critical user-data mutations use strict durability and wait for the transaction `complete` event. The `strict` setting is a browser durability hint, not protection against all operating-system/hardware failure modes. Cache writes can use relaxed durability.

## Ordering invariants

1. A queued record clear must be sequenced after prior writes and before subsequent writes for that prefix.
2. A failed clear must remain visible and retryable. A post-clear write must not be allowed to resurrect pre-clear data.
3. Backup import prepares a plan, writes KV and records in one transaction, and only then updates the Zustand mirrors.
4. Boot may reach `ready` only after required stores are restored; timeouts and IDB errors must enter `degraded` or `failed` with a user-visible retry path.
5. Invalid user-owned records should be reported/quarantined, not silently replaced. Disposable caches may be discarded.

## Recovery runbook

**Quota:** do not clear user history. Offer cache eviction, retry queued writes, and an exported backup. Confirm pending counts reach zero.

**Corrupt persisted entity:** do not delete it automatically. Preserve the raw IndexedDB entry for forensic recovery, skip unsafe hydration into typed state, and export a privacy-safe error code (not coordinates or history).

**Blocked IDB upgrade:** show the storage-blocked state; request that other tabs/windows close, then retry opening storage.

**Interrupted backup import:** inspect transaction outcome. All records and KV changes must be committed together or not at all; retry only after pending writes are flushed.

**Failed deletion:** do not report permanent success until queued clears have committed. Pending retry/rollback behavior is tracked in issue #34.

## Verification

Unit tests cover transaction aborts, queued writes/clears, retries and importer validation. Browser E2E tests must exercise reload and multi-tab failures on the supported browser matrix. Android backup/restore and device-to-device transfer must be verified separately on supported devices; see `.github/ANDROID_RELEASE.md`.
