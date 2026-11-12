# Weather Log

Open-source weather app built on [Open-Meteo](https://open-meteo.com). It keeps a full history of every city you follow, on the device.

Stack: React 19 · Vite · TypeScript · Mantine 9 · Zustand 5 (slices, `useShallow`) · IndexedDB (`idb-keyval`) · official `openmeteo` SDK. Packaged for Android with Capacitor 7.

## Run

```bash
npm install
npm run dev
```

`preview.html` is a browser-only runner used by the design tool; Vite doesn't use it.

## Structure

```
src/
  theme.ts              Mantine global theme (colors, font, radius, component defaults)
  styles/global.css     Layout-only CSS (stage, pager, hero, rules, glass)
  api/openMeteo.ts      SDK calls: forecast, air quality, archive · JSON geocoding
  store/
    index.ts            Bound store: slices + persist → IndexedDB
    idbStorage.ts       Zustand PersistStorage over idb-keyval (debounced writes)
    types.ts            Slice interfaces, StoreState, SliceCreator
    slices/             settings · cities · forecast · history · search · ui
  screens/              Onboarding · Home (pager) · CityPage · Cities · Search · History · Settings
  components/           Icon · ScreenHeader
```

## Data rules

- Views read state only through `useWeatherStore(useShallow(...))` and call store actions. No component fetches data itself.
- The persisted slices (settings, cities, forecasts, history, normals, archive years) are written to IndexedDB under the key `open-weather-log`. Loading, search and navigation state stay in memory.
- Stored values are metric. Units are applied only when formatting.
- `cities[0]` is the default city; the home pager always opens on it.

## History

- **Log**: each forecast refresh writes today's record (max/min, precipitation, wind, weather code).
- **Fill gaps**: when the app was closed, the missed days (up to 92) are filled from `past_days` and tagged `filled`.
- **Archive**: "this day in other years" and any-date lookup use the Historical Weather API (1940 to about 5 days ago).
- **vs average**: today's high compared with the 1991–2020 mean for the same calendar day, computed once per city from the archive.

## Data shown

Forecast API: current conditions, 15-minute rain nowcast (next 2 h), 7-day hourly and daily forecast. That covers temperature and feels-like, humidity, dew point, rain, showers, snowfall, snow depth, precipitation probability and hours, cloud cover by layer, visibility, wind and gusts with direction, UV (actual and clear-sky), sunrise, sunset, daylight and sunshine duration, pressure with trend, thunderstorm potential (CAPE), freezing level, solar radiation and evapotranspiration.
Air Quality API: European and US AQI, PM2.5, PM10, NO₂, O₃, SO₂, CO, dust, aerosol optical depth, and pollen (alder, birch, grass, mugwort, olive, ragweed; Europe only).
Marine API (coastal cities only): wave height, direction and period, swell, sea temperature.
All variable lists live in `src/api/variables.ts`.

## API key

Keyless by default (free for non-commercial use). If you add a key in Settings, the `customer-*` hosts are used. A custom forecast server URL supports self-hosted Open-Meteo.

## Android (Capacitor)

The Android project is in `android/` (app ID `nl.delaparraservices.apps.weather`, config in `capacitor.config.ts`).

```bash
npm run cap:sync   # build the web app and copy it into android/
npm run cap:open   # open in Android Studio, then Run
```

To get an installable APK without Android Studio, push this project to GitHub. The **Android APK** workflow (`.github/workflows/android-apk.yml`) builds `app-debug.apk` for every published release and attaches it to the release and install it on the phone (allow installing from unknown sources).

Privacy: the app never requests location; don't add the geolocation plugin. For snapshots while the app is closed, use a background runner. IndexedDB persists inside the Android WebView.

## F-Droid

Releases are picked up by F-Droid from `vX.Y.Z` tags. Release with `npm version patch|minor|major` and `git push --follow-tags`; see [`fdroid/README.md`](fdroid/README.md).

## License

GPL-3.0-or-later, see [LICENSE](LICENSE). If you distribute a modified version, you must publish its source under the same license.

Weather data by Open-Meteo.com (CC BY 4.0).
# privacy-weather-app
