# Weather Log

Open-source, privacy-first weather app built on [Open-Meteo](https://open-meteo.com). It keeps a full history of every city you follow, on the device, and works fully offline.

- **No location access, no account, no trackers, no Google services.** Everything stays on the device. See [PRIVACY.md](PRIVACY.md).
- **Online mode (default):** forecasts, air quality, pollen, marine data and the historical archive from Open-Meteo, logged day by day.
- **Offline mode:** a switch on the setup screen and in Settings. The app makes no network requests; you add cities by name and coordinates and log the weather yourself. In online mode without a connection the same manual entry is offered.
- 24 languages, backup and restore, charts that open full screen.

Get it on [F-Droid](https://f-droid.org/packages/nl.delaparraservices.apps.weather/) (once published) or from the [GitHub releases](https://github.com/foxoffire33/privacy-weather-app/releases).

Stack: React 19 · Vite · TypeScript · Mantine 9 · Zustand 5 (slices, `useShallow`) · [Motion](https://motion.dev) for animation and gestures · IndexedDB (`idb-keyval`) · official `openmeteo` SDK. Packaged for Android with Capacitor 7.

## Run

Requires Node 20.19 or newer.

```bash
npm ci
npm run dev
```

Contributions: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Structure

```
src/
  main.tsx · App.tsx              Entry with Mantine providers and HashRouter; routes in App.tsx
  theme.ts                        Mantine theme and component defaults
  styles/global.css               App-wide layout CSS
  stores/                         Data layer: entity cache, Zustand stores, IndexedDB persistence, Suspense resources (see stores/README.md)
    api/                          Pure Open-Meteo calls and variable lists
  screens/                        Onboarding · Home (pager) · Cities · Search · History · Hourly · DayView · Settings · CityPage
  components/                     Shared UI: city/ and day/ sections, charts/, history/, skeletons, icons
  utils/                          Pure helpers: formatting, weather insights and labels, scales, stats, chart series
  native/                         Device side effects: app icon, orientation, home-screen widgets
  backup/                         Backup import validation
  i18n/                           t() and the 24 locale files
  types/                          App types
```

## Data rules

- IndexedDB is the source of truth. Views read from the stores first and download only what is not cached.
- Loading uses React Suspense with Mantine `Skeleton` fallbacks, and only when nothing is cached. Refreshes run in the background.
- Data, drafts and side effects live in stores. Components keep only open/closed flags and gesture state.
- Stored values are metric. Units are applied only when formatting.
- The first followed city is the default city; the home pager opens on it.

## History

- **Log**: each forecast refresh writes today's record (max/min, precipitation, wind, weather code).
- **Fill gaps**: when the app was closed, the missed days (up to 92) are filled from `past_days` and tagged `filled`.
- **Archive**: "this day in other years" and any-date lookup use the Historical Weather API (1940 to about 5 days ago).
- **vs average**: today's high compared with the 1991–2020 mean for the same calendar day, computed once per city from the archive.

## Data shown

Forecast API: current conditions, 15-minute rain nowcast (next 2 h), 7-day hourly and daily forecast. That covers temperature and feels-like, humidity, dew point, rain, showers, snowfall, snow depth, precipitation probability and hours, cloud cover by layer, visibility, wind and gusts with direction, UV (actual and clear-sky), sunrise, sunset, daylight and sunshine duration, pressure with trend, thunderstorm potential (CAPE), freezing level, solar radiation and evapotranspiration.
Air Quality API: European and US AQI, PM2.5, PM10, NO₂, O₃, SO₂, CO, dust, aerosol optical depth, and pollen (alder, birch, grass, mugwort, olive, ragweed; Europe only).
Marine API (coastal cities only): wave height, direction and period, swell, sea temperature.
All variable lists live in `src/stores/api/variables.ts`.

## API key

Keyless by default (free for non-commercial use). If you add a key in Settings, the `customer-*` hosts are used. A custom forecast server URL supports self-hosted Open-Meteo.

## Android (Capacitor)

The Android project is in `android/` (app ID `nl.delaparraservices.apps.weather`, config in `capacitor.config.ts`).

```bash
npm run cap:sync   # build the web app and copy it into android/
npm run cap:open   # open in Android Studio, then Run
```

To get an installable APK without Android Studio, push this project to GitHub. The **Android APK** workflow (`.github/workflows/android-apk.yml`) builds `app-debug.apk` for every published release and attaches it to the release and install it on the phone (allow installing from unknown sources).

The launcher icon follows the accent colour: the manifest has one launcher alias per accent and `AppIconPlugin` enables the matching one when the app goes to the background (a custom colour gets the nearest of green, red and blue). The accent is also saved in SharedPreferences (`app_icon` / `accent_color`) for native widgets.

Privacy: the app never requests location; don't add the geolocation plugin. For snapshots while the app is closed, use a background runner. IndexedDB persists inside the Android WebView.

## F-Droid

The build recipe is [`fdroid/nl.delaparraservices.apps.weather.yml`](fdroid/nl.delaparraservices.apps.weather.yml), store texts, screenshots and changelogs are in [`fastlane/metadata/android/`](fastlane/metadata/android). The Android build has no Google Play Services, Firebase or other proprietary dependencies, and dependency metadata is left out of the APK as F-Droid requires.

Releases are picked up by F-Droid from `vX.Y.Z` tags. Release with `npm version patch|minor|major` and `git push --follow-tags`; see [`fdroid/README.md`](fdroid/README.md) for the one-time submission.

### Build a release APK from source

```bash
npm ci
npm run cap:sync
cd android && ./gradlew assembleRelease
```

## Support

Weather Log is free and has no ads. If you find it useful you can [sponsor the developer on GitHub](https://github.com/sponsors/foxoffire33).

Developer: [delaparra-services.nl](https://delaparra-services.nl) · info@delaparra-services.nl · [github.com/foxoffire33](https://github.com/foxoffire33)

## License

GPL-3.0-or-later, see [LICENSE](LICENSE). If you distribute a modified version, you must publish its source under the same license.

Weather data by Open-Meteo.com (CC BY 4.0).
