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

6. **Choose the promise for `use()` as: running request, then last settled, then `READY`.** Use
   `latest(key)` when the view may need to wait, `lastSettled(key)` when it must not (background fills).
   Never let a "requested already" flag skip a request that is still running. *From PR #9: leaving
   History during a download and coming back rendered empty charts instead of waiting.*

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
