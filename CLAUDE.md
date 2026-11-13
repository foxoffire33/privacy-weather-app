# Weather Log — project rules

Privacy-first Open-Meteo weather app. React 19 + Mantine 9 + Zustand 5, Vite, Capacitor 7 (Android).
The app is about data: historic, present and future.

## Code

- **Mantine components only.** No raw HTML elements in JSX: `Box`, `Text`, `Group`, `Stack`, `SimpleGrid`,
  `UnstyledButton`, `Progress`, `Modal`, `Drawer`, `FileButton`, `ColorSwatch`, ... The one exception is the
  SVG inside `components/Icon.tsx` (Mantine ships no icon set).
- **State and data mutations live in a store.** Components hold local state only for open/closed flags and
  gestures (drag offsets, swipe state). Data, drafts, selections that drive fetches, results and side effects
  belong in `src/storesV2` (data) or `src/store` (view state).
- **Types live in types files, never next to implementation.** App types in `src/types/`, data-layer types in
  the `types.ts` of each `src/storesV2` folder and in `src/storesV2/types/`. Components take a named `Props`
  interface, not an inline object type.
- **No comments in source files.**

## Data

- `src/storesV2` is the data layer; its `README.md` holds the rules (single source of truth per entity,
  pure `api/`, fold semantics, persistence registered in `hydration.ts`, no app imports).
- **IndexedDB is the source of truth.** Read from the stores first; download only what is not cached.
- **Loading uses React Suspense with Mantine `Skeleton` fallbacks**, and only when the data is not cached at
  all. Refreshing cached data happens in the background and never replaces content with a skeleton.
- Pass `use()` a stable promise: the in-flight one from `once()`, then `lastSettled()` for the same key.
- When fetching a day, fetch every attribute the log keeps. Trends are built from the log; missing days are
  downloaded into it.

## UI

- A row of buttons always spans the full width.
- Button text is always one line.
- Charts: solid lines or bars, no gradients, no grid; the selected point is highlighted with the accent
  background used for a selected day. Every chart can open full screen.
- The app is portrait-only; landscape is allowed only while a chart is open full screen.
- Every user-facing string goes through `t()`, in all 24 locales (`node scripts/i18n-check.mjs`).

## Checks

```
npx tsc -b
npm run build
node scripts/i18n-check.mjs
```
