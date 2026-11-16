# Radar server (optional, self-hosted in the EU)

By default the app uses the public servers: `https://api.librewxr.net` for radar frames and
`https://tiles.openfreemap.org/planet` for land and water. This guide is for running both parts yourself
instead, on one HTTPS server inside the EU. Then set *Settings → Radar server* to `https://radar.example.eu`
and *Settings → Map server* to `https://radar.example.eu/map/basemap.pmtiles`. The server serves two things,
both open source:

| Path | What | Software | Data |
| --- | --- | --- | --- |
| `/public/weather-maps.json`, `/v2/radar/...` | Radar frames: the past 2 hours in 10-minute steps and a 60-minute forecast | [LibreWXR](https://github.com/JoshuaKimsey/LibreWXR) (AGPL-3.0) | EUMETNET OPERA (European weather services), ICON-EU |
| `/map/basemap.pmtiles` | Land and water around each city | one static [PMTiles](https://github.com/protomaps/PMTiles) file (BSD) | OpenStreetMap (ODbL) via [Protomaps](https://protomaps.com) |

The app sends this server only the radar and map tiles around a followed city. Nothing else, no API key,
no device data. The server below keeps no access logs.

## 1. A server in the EU

Any VPS in an EU data centre with Docker works, for example Hetzner (Germany, Finland) or Scaleway (France).
LibreWXR's defaults expect a large machine; for Europe only, 4 cores and 8 GB are a reasonable start
(lower `LIBREWXR_WORKERS` and the memory limits in its `.env`). Point a domain at it, for example
`radar.example.eu`.

## 2. LibreWXR, Europe only

```
git clone https://github.com/JoshuaKimsey/LibreWXR.git
cd LibreWXR
cp .env.example .env
```

In `.env`:

```
LIBREWXR_ENABLED_REGIONS=EUROPE
LIBREWXR_PUBLIC_URL=https://radar.example.eu
LIBREWXR_SATELLITE_ENABLED=false
LIBREWXR_ALERTS_ENABLED=false
```

Keep `LIBREWXR_REGIONAL_NWP_ENABLED` on: the 60-minute forecast blends radar into ICON-EU. Then
`docker compose pull && docker compose up -d`, and note the host port its compose file publishes.

The app requests colour scheme `0` with smoothing off and snow on (`/0/0_1.png`) at zoom 6 to 11, and
decodes grey `1..127` as rain (`dBZ = grey - 32`) and `129..255` as snow (`dBZ = grey - 160`).

## 3. The map file

Cut Europe out of a daily Protomaps build, up to zoom 10 (the app never asks for more):

```
pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles basemap.pmtiles --bbox=-25,34,45,72 --maxzoom=10
```

Put `basemap.pmtiles` in `/srv/map/` on the server. Re-cut it now and then; land and water rarely change.
The app keeps the map of each city on the device after the first load.

## 4. Caddy in front

[Caddy](https://caddyserver.com) gets the TLS certificate, serves the map file with range requests, proxies
LibreWXR and adds the CORS headers the app needs. Use the [`Caddyfile`](./Caddyfile) here:

```
RADAR_DOMAIN=radar.example.eu LIBREWXR_UPSTREAM=127.0.0.1:<port> caddy run --config Caddyfile
```

## 5. In the app

Settings → *Radar server* → `https://radar.example.eu`, and *Map server* →
`https://radar.example.eu/map/basemap.pmtiles`. Open a city: *Next 48 hours* shows Radar first.

Check from a browser: `https://radar.example.eu/public/weather-maps.json` lists frames, and
`curl -sI -H 'Range: bytes=0-126' https://radar.example.eu/map/basemap.pmtiles` answers `206`.
