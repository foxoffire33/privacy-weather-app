# Contributing

Issues and pull requests are welcome at https://github.com/foxoffire33/privacy-weather-app.

## Setup

Node 20.19 or newer (CI uses Node 22).

```bash
npm ci
npm run dev
```

## Before opening a pull request

```bash
npm run lint
npx tsc -b
npm run build
node scripts/i18n-check.mjs
```

All four must pass. Don't disable lint rules or add suppression comments; fix the cause.

## Project rules

The full list is in [`CLAUDE.md`](CLAUDE.md) and [`src/stores/README.md`](src/stores/README.md). In short:

- Mantine components only, no raw HTML elements in JSX.
- Data, drafts and side effects live in stores (`src/stores`); components keep only open/closed and gesture state.
- Types live in types files (`src/types/`, `src/stores/**/types.ts`).
- No comments in source files.
- IndexedDB is the source of truth: read the stores first and download only what is missing.
- Every user-facing string goes through `t()` and exists in all 24 locales in `src/i18n/locales/`.
- Every feature must also work in offline mode, where the app makes no network requests.
- Never add location access, analytics, or proprietary libraries (Google Play Services, Firebase, ...):
  the app must stay buildable by F-Droid.

## Translations

Add or fix strings in `src/i18n/locales/<code>.json`, then run `node scripts/i18n-check.mjs`.
Store texts for F-Droid live in `fastlane/metadata/android/<locale>/`.

## License

By contributing you agree that your work is released under the GPL-3.0-or-later license of this project.
