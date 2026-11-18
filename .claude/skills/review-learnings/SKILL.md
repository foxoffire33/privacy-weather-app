---
name: review-learnings
description: Conventions distilled from past PR review feedback on this repo. Load before writing, reviewing, or planning any code change here, and follow the rules listed.
---

# Review learnings

Rules learned from review feedback. Each one generalises a concrete bug that was found in review, so the
same class of mistake is not made again. Add to this list when a review finds something generalisable.

## Async work in stores

1. **A superseded run must not write its result.** Any store action that awaits and then writes state
   tags the run with an id kept in the store (`runId`, `pickId`). A newer run, or a reset, bumps the id;
   a completion whose id is no longer current writes nothing. The work itself may finish.
   *From PR #9: a closed add-dates sheet showed another city's result; an earlier backup read
   overwrote a later file pick.*

2. **Clear staged data when a new operation starts that will replace it.** Otherwise a confirm in the
   gap acts on the old data. *From PR #9: "Import selected" imported the previous backup while the new
   file was still being read.*

3. **Every failure that blocks automatic retries needs a manual retry.** Excluding a failed request from
   automatic retries prevents loops, but the user must be able to try again (a "Try again" button that
   clears the failure and restarts the request). *From PR #9: a failed trends download could not be
   retried for the rest of the session.*

## Cache first

4. **Download only contiguous uncached dates.** Build request ranges from runs of dates that are neither
   logged nor cached, and split at every cached date, even if that costs an extra request. Never span a
   cached day to save a request, and count every day exactly once. *From PR #9: merging runs re-downloaded
   a cached day and reported `kept: -1`.*

5. **Suspend only when the view would otherwise be empty.** If any of the data a view shows is cached,
   render it and fill the rest in the background with a non-blocking status line. A Skeleton replaces
   content only when nothing is cached. *From PR #9: one missing day turned 29 cached days of charts into
   skeletons.*

## Suspense

6. **A `use()` consumer must observe an in-flight promise or the fulfilled `READY` marker.** Use
   `latest(key)` for the active request and `READY` when no request is running; do not retain a
   global cache of settled promises or let a "requested already" flag skip a running request.
   *From PR #9 and the PR #33 bounded-memory review.*

## Git

7. **When a change was merged separately and the branch reworked it further, the branch side wins the
   conflict.** Check afterwards that the merged tree equals the branch's intent (`git diff <branch-head>`).

## Lint

8. **A function whose promise is passed to `use()` must not be `async`.** An `async` wrapper returns a new
   promise on every call, so React sees an uncached promise and suspends forever. The
   `promise-function-async` autofix adds `async` to any function typed `Promise<…>`; type these functions
   as `PromiseLike<void>` (`Pending` in `src/stores/core/types.ts`) instead, and check the diff of every
   `eslint --fix` run for new `async` keywords. *From the lint pass after merging full-review.*

9. **Never trust a `Record<string, T>` index to be defined.** Lookups by id or date return `undefined` at
   runtime; type such maps as `Partial<Record<string, T>>` so the compiler and `strict-boolean-expressions`
   see the missing case, rather than rewriting `if (!x)` as a check the type claims is impossible.

## Performance

10. **Load-more must fire once per new intersection.** An effect that calls `showMore()` must not depend on the
    list length: the observer entry stays `isIntersecting` until its next callback, so each render loads
    another page and the whole list renders in one cascade. Memoize long-list rows and keep their callbacks
    stable. *From the history log freeze: 1,200 logged days rendered in one 23-second burst.*

11. **Never mount heavy views while a swipe animates.** Animate screens with `transform`/`opacity` (compositor),
    defer chart-heavy sections (`useDeferredValue`) and mount pager neighbours after the animation completes.
    *From day and city swipes stuttering on Android.*

12. **No `content-visibility` inside the horizontal pager.** Off-screen city pages are skipped, so a
    swipe pays their whole layout and paint at the moment they slide in. Use it only on vertical lists
    (log rows). *From measuring the pager with and without it.*

13. **Libraries flagged `react-hooks/incompatible-library` are out.** The React Compiler lint refuses
    TanStack Virtual's `useVirtualizer`, and suppression is not allowed. Prefer memoized rows plus
    `content-visibility` on rows, or hand-written windowing.

## Persistence

14. **Every Zustand `persist` store over IndexedDB needs `partialize`.** Without it the whole state, actions
    included, is stored; IndexedDB cannot clone a function, the write throws `DataCloneError` and the debounced
    writer swallows it. *From the radar PR: no setting change had been saved since settings moved to IndexedDB.*

## Code style

15. **One `try`, one `catch`, and at most one `finally` per function.** JavaScript supports only one
    `catch` clause per `try`; distinguish error types with checks inside that clause. When separate steps
    need independent fault tolerance, give each step its own small helper function.
    *From user rule, 2026-11-16, clarified in PR #33 review.*

16. **No comments in code.** Do not annotate the code with inline comments; the code and its types should carry
    the meaning. *From user rule, 2026-11-16.*

17. **Long explanations live in the docs, not in code.** If behavior needs explaining, write it in the relevant
    README or doc file. In code, at most a short one-line JSDoc-style comment, and only where truly necessary.
    *From user rule, 2026-11-16.*

## Durable asynchronous changes

18. **Success follows commit, never scheduling.** Await the actual IndexedDB transaction promise through
    every wrapper. Test with asynchronous rejection after the write call returns; a failed batch must remain
    pending and retryable. *From PR #33: a discarded `recordsWrite` promise reported unsaved days as saved.*

19. **Queue writes, deletes, and prefix clears by operation generation.** A flush may consume only
    mutations submitted before its queue boundary. Keep post-clear writes behind the clear, and remove
    generation metadata only if it still belongs to the completed operation. A failed clear remains
    queued; each independent clear needs its own retry schedule. *From PR #33 concurrency review.*

20. **Failed hydration reads block all writes to that store.** Preserve queued edits, track which fields
    were explicitly edited even when their values equal defaults, retry hydration before flushing, and
    write the fully reconciled snapshot after restoration. Recover records independently of unrelated
    persisted-store failures and bound boot-time rehydration. *From PR #33 data-loss review.*

21. **Check stored data before claiming an import or deletion succeeded.** Validate inputs before
    mutation, preserve unrelated existing records, and acknowledge success only after the selected
    changes form one committed durable outcome. Failure-path tests must cover late transaction rejection,
    rollback, and restart. *From PR #33 backup review.*

22. **Every exported backup must be importable without silent truncation.** Enforce the import byte,
    city and per-city day limits on the exporter too. Split large exports into numbered importable
    parts and inform users to retain/import every part. Test the production export action and both
    limit boundaries, including API-key omission. *From PR #33 backup review.*

23. **Privacy guarantees include accidental fallbacks and diagnostic route parameters.** Retain
    supported same-origin weather proxies; never replace an invalid saved nonempty custom server with
    the empty public-server default. Block invalid requests and prompt for correction. Redact city IDs
    and dates from paths copied into diagnostic reports, not just URL queries. *From PR #33 security review.*

24. **Independent asynchronous resources must settle independently.** Publish valid primary radar
    frames without waiting for an optional model. Capture the configured source at the beginning of
    each request and recheck it after awaits; otherwise stale results can be persisted under the wrong
    cache key. For multiple trends windows, retain and clear failure reasons per window. *From PR #33 review.*

25. **Tests must wait for observable outcomes, not fixed delays.** Before a reload, poll actual
    persisted IndexedDB records; verify imported history after restart, and wait until navigation has
    removed stale search results. In quota tests, retry uncommitted writes before relaunching.
    Distinguish verified device scenarios from automated coverage in release documentation.
    *From PR #33 review.*
