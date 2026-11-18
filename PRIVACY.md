# Privacy policy

Weather Log is built so that there is nothing to collect. This page lists everything the app does with data.

## What stays on your device

Everything you put into the app or that it downloads: the cities you follow, the weather log, edits you make,
and your settings. It lives in the app's own storage (IndexedDB in the Android WebView) and is not uploaded by the app.
The Android app disables platform backup; platform-specific device-transfer behavior still needs to be verified on supported devices.
Uninstalling the app normally removes its local storage; *Settings → Delete all history* clears the weather log. *Export* writes a backup file only
where you choose to save or share it.

## What the app never does

- It never asks for or reads your location. You add cities by name or by coordinates.
- No account, no analytics, no crash reporting, no ads, no trackers, no Google Play Services or Firebase.

## Network requests

**Offline mode** (on the setup screen or in Settings): the app makes no network requests at all. You add
cities and log the weather yourself.

**Online mode** (the default): the app talks only to [Open-Meteo](https://open-meteo.com), or to the
forecast server you set in Settings. Open-Meteo is an independent third-party service: it is not run by the
developer of Weather Log, and this policy does not cover it. Open-Meteo is open source
([AGPL-3.0](https://github.com/open-meteo/open-meteo)) and can be self-hosted.

| Service | Sent | When |
| --- | --- | --- |
| Geocoding API | the text you type in city search | while you search |
| Forecast, Air Quality and Marine APIs | the coordinates of cities you follow | on refresh |
| Historical Weather API | coordinates and dates | when filling or looking up past days |

**Radar** (the default *Radar* view in *Next 48 hours*): the app talks to two more independent, open-source
services. Neither is run by the developer of Weather Log, and this policy does not cover them.

- [LibreWXR](https://librewxr.net) ([AGPL-3.0](https://github.com/JoshuaKimsey/LibreWXR)) serves the radar frames
  (EUMETNET OPERA). Its public server `api.librewxr.net` states it keeps no client logs: no IP addresses, user
  agents or request details.
- [OpenFreeMap](https://openfreemap.org) ([source](https://github.com/hyperknot/openfreemap)) serves land and
  water from OpenStreetMap. It is run from the EU (Hungary), has no accounts or cookies, and keeps anonymised logs
  for 7 days; it may use Cloudflare as a CDN. See its [privacy policy](https://openfreemap.org/privacy/).

| Service | Sent | When |
| --- | --- | --- |
| LibreWXR radar | the radar map tiles around a city | while the radar is shown, at most every 5 minutes |
| OpenFreeMap | the map tiles around a city | once per city and zoom level |

The tile numbers reveal the area of the city you look at; like any web server, both see your IP address. Both
servers can be changed in Settings (for example to your own, see [deploy/radar](deploy/radar/README.md)), and
clearing the radar server turns the radar off so nothing is sent.

If you add an Open-Meteo API key, it is sent with these requests. Like any web server, Open-Meteo sees your
IP address. See Open-Meteo's [terms and privacy policy](https://open-meteo.com/en/terms). To avoid this,
point the app at a self-hosted Open-Meteo instance or use offline mode.

The *Donate* and developer links in Settings open in your browser; the app itself sends nothing.

## Contact

Questions: info@delaparra-services.nl · [delaparra-services.nl](https://delaparra-services.nl)
