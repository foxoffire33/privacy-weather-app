# Privacy policy

Weather Log is built so that there is nothing to collect. This page lists everything the app does with data.

## What stays on your device

Everything you put into the app or that it downloads: the cities you follow, the weather log, edits you make,
and your settings. It lives in the app's own storage (IndexedDB in the Android WebView) and is never uploaded.
Uninstalling the app removes it; *Settings → Delete all history* clears the weather log. *Export* writes a backup file only
where you choose to save or share it.

## What the app never does

- It never asks for or reads your location. You add cities by name or by coordinates.
- No account, no analytics, no crash reporting, no ads, no trackers, no Google Play Services or Firebase.

## Network requests

**Offline mode** (on the setup screen or in Settings): the app makes no network requests at all. You add
cities and log the weather yourself.

**Online mode** (the default): the app talks only to [Open-Meteo](https://open-meteo.com), or to the
forecast server you set in Settings:

| Service | Sent | When |
| --- | --- | --- |
| Geocoding API | the text you type in city search | while you search |
| Forecast, Air Quality and Marine APIs | the coordinates of cities you follow | on refresh |
| Historical Weather API | coordinates and dates | when filling or looking up past days |

If you add an Open-Meteo API key, it is sent with these requests. Like any web server, Open-Meteo sees your
IP address. See Open-Meteo's [terms and privacy policy](https://open-meteo.com/en/terms). To avoid this,
point the app at a self-hosted Open-Meteo instance or use offline mode.

The *Donate* and developer links in Settings open in your browser; the app itself sends nothing.

## Contact

Questions: info@delaparra-services.nl · [delaparra-services.nl](https://delaparra-services.nl)
