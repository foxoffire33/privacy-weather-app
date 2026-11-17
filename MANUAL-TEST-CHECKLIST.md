# Manual test checklist — real browser & Android WebView

The automated suites cover what can be faked or scripted deterministically:

- **Unit** (`yarn test`, 142 tests): storage failure modes, ordering, hydration, retry policy, backup validation — `fake-indexeddb` + fake timers.
- **Browser e2e** (`yarn test:e2e`, 9 specs in `e2e/`, headless Chromium on the production build): cold-boot onboarding + reload persistence, no-IDB not-saved banner, 429 `Retry-After` honored + persistent rate-limit message, superseded-search abort on the wire, radar partial degradation, backup size/JSON limits + import round trip.

The rows below need a **real disk, a real device, or a real session** — fakes and scripted browsers cannot reproduce them. Run them before claiming the release scorecard (§17 of the error-handling & data-integrity report) and keep the results with the T4.7/T4.8 records.

## Setup

| Target | How |
|---|---|
| Desktop Chromium (real disk) | `yarn build && yarn preview` → open `http://localhost:4173` in a normal Chrome/Chromium profile. |
| Android WebView | `yarn build && yarn cap:sync` → open the `android/` project in Android Studio, run the app on a supported device (WebView-based Capacitor build). |

A "supported device" for this app is any Android device the Capacitor build targets; test at least one low-end device (≤ 3 GB RAM) for the long-session row.

## Scenarios

### 1. Quota exceeded (real disk, either target)

Shrink the storage the browser can use: on desktop, fill the profile's disk (or run Chrome with `--disk-cache-size=0` on a near-full volume); on Android, fill the app's storage via the system UI or a test build that writes dummy files.

1. With headroom low, follow a city and record several days of history.
2. **Expected:** the app never claims a save that did not commit — the "Not saved: local storage is failing." banner (with retry + cache-clear) appears; the Diagnostics screen shows the `quota-exceeded` failure entry and a nonzero record-flush-failure metric; the pending value stays queued (proven by step 4).
3. Free space (delete dummy files / clear other data) and relaunch.
4. **Expected:** the queued write lands on the next launch (the data you added is there), the banner clears, and the diagnostics failure entry for the session is gone.

### 2. Blocked database upgrade

1. Install an older app build (pre-current-schema) on the device, follow at least one city, record one day, close the app.
2. Install the current build over it, launch.
3. **Expected:** the migration runs or the blocked state is **observable** (explicit storage error, never a false success): no crash, no empty app pretending migration succeeded. If blocked, the retry path recovers once the blocking connection is closed (relaunch).

### 3. OS-level storage wipe (Android)

1. Follow a city, record history, export a backup from Settings (verify the file).
2. Clear the app's data via Android settings.
3. **Expected:** cold start shows onboarding (fresh state), no crash, no stale partial state. Importing the backup from step 1 restores the city and history (round trip through the real device).

### 4. Backgrounding mid-write (pagehide flush, Android + desktop)

1. Follow a new city (or add a day to the log).
2. Immediately background the app (home key / switch window) and stay backgrounded ≥ 5 s, then foreground.
3. **Expected:** the city/day survives — the `pagehide`/`visibilitychange` best-effort flush committed it. Repeat 5×; any loss is a defect (record the repro).

### 5. Low storage headroom warning (either target)

1. Get the browser's storage estimate below ~10 MB of headroom (scenario 1 setup).
2. Open Settings → storage block and the Diagnostics screen.
3. **Expected:** the low-headroom variant of the storage line is shown (urges exporting), the "storage can still be lost, export regularly" note is present, and the clear-response-cache action is offered and works (dropped count reported, app keeps working).

### 6. Long session / memory bound (either target, ≥ 2 h, prefer low-end Android)

1. Leave the app open on the home screen.
2. Every few minutes, open the search screen, search a different city name (do not follow it), and go back. Repeat for 100+ unique query names; also visit the radar tab a few times.
3. **Expected:** no visible slowdown, no crash, no unbounded memory growth (check the device's RAM usage for the app process before/during/after); the settled-request cache retains nothing after each request settles (unit-test invariant, verified here under real load).

### 7. Airplane mode / network loss mid-session (either target)

1. With a followed city, enable airplane mode (or unplug Wi-Fi on desktop) and pull to refresh / wait for the 10-minute refresh.
2. **Expected:** the offline state is shown as a state, not an error crash; re-enabling the network recovers the forecast without a relaunch.

### 8. WebView storage quirks (Android only)

1. On a device with aggressive storage management (e.g. a vendor "battery saver" or "app hibernation" feature enabled), run scenarios 1 and 4 again.
2. **Expected:** any storage fault the WebView produces (eviction, quota, transaction abort) is surfaced through the banner + diagnostics — never a silent loss; the app keeps working in degraded mode.

## Sign-off

| Date | Target (model, Android/Chromium version) | Scenarios passed | Notes / defects |
|---|---|---|---|
| | | | |

A scenario only counts as passed if the **expected** column holds for every step. Any failure: file an issue with the repro (device, steps, diagnostics report copied from the Diagnostics screen) and fix before T4.8 sign-off.
