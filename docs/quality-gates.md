# Quality gates and support matrix

## Automated acceptance

- `npm run lint` — zero warnings/errors.
- `npm run build` — complete TypeScript checking and production Vite build.
- `npm run test` — unit tests.
- `npm run test:coverage` — selected persistence/backup/core files; minimum overall 75% branches, 80% statements, 80% functions, 85% lines; backup must exceed 85% branches. Raise these numbers as fault-path tests are added.
- `npm run test:e2e` — required mobile Chromium (430×900) and desktop Chromium (1440×900) configurations, including axe WCAG 2.2 AA automated scans of important screens.

Android WebView on the supported target SDK is the primary distribution environment. Firefox and WebKit are not presently a supported test matrix and must not be claimed tested. Platform capabilities and installation/backup behavior require a physical-device release checklist.

## Manual WCAG 2.2 AA checklist

Check in the actual Android app and supported desktop browser:

- [ ] All controls reachable and operable by keyboard, without traps.
- [ ] Focus indicators visible and not entirely obscured when dialogs/headers appear.
- [ ] TalkBack and desktop screen-reader semantics, names, ordering and dynamic error announcements.
- [ ] Touch targets meet WCAG 2.2 size/spacing criteria.
- [ ] 200% text enlargement and 400% zoom/reflow without loss of essential controls.
- [ ] Reduced-motion preference and gesture alternatives.
- [ ] Storage quota, import failure, failed deletion and hydration recovery flows announced and navigable.

Automated axe checks find only part of the accessibility problem; an all-green CI run is not a WCAG certificate.

## Privacy and release checklist

- [ ] Android cloud backup and device-to-device transfer rules checked on the minimum and current supported OS versions.
- [ ] Uninstall and reinstall tested, including whether local records persist unexpectedly.
- [ ] Signed release APK certificate verified against the previously trusted signing identity.
- [ ] Release checksum and GitHub attestation validated.
- [ ] GitHub environment release secrets and branch protection/security settings reviewed by a maintainer.
- [ ] No location, API credentials or raw request URL appears in exported diagnostics.
- [ ] Time-to-interactive and long-session memory/radar cache behavior measured against a recorded baseline.
