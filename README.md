# Bay One

A personal garage and mechanic assistant for iOS, Android and web, built with Expo (React Native) and three.js.

## Features

- **Garage**: add vehicles by VIN (NHTSA decoder, US market) or by hand. Each one is shown on a 3D turntable.
- **Photo wrap (offline)**: photograph the side of your car (front and rear optional) and tap the two wheel centres. On the device, Bay One:
  - separates the car from the background,
  - fits the 3D body to the silhouette (roofline, overhangs, sill height, wheel size),
  - samples the paint colour,
  - projects the photos onto the model.

  Nothing is uploaded. A `.glb` upload remains available for exact models.
- **Odometer**:
  - every reading from fill-ups, services, manual entries and GPS drives goes into a log;
  - a least-squares fit gives your daily distance, which drives "due in ≈ N days" estimates;
  - optional reminder notifications plus an in-app banner;
  - a GPS drive recorder: on iOS/Android with "Always" location access a background task keeps counting with the screen off. Elsewhere it records in the foreground.
- **Fuel**: fill-up log, full-to-full consumption, spend and cost per distance.
- **Service**: schedule with distance and time intervals, due/overdue state, service history.
- **Parts**: parts list with status, shop links and price history. With the proxy configured, **Check price** reads the price from the shop page.
- **Docs**: a document folder per vehicle, stored on the device.
- **Intel**:
  - NHTSA recalls and research shortcuts;
  - with the proxy configured, collects YouTube videos, Reddit threads, web/forum results and NHTSA owner complaints, cached for offline reading.
- **Mechanic**: chat with your own API key (Claude, OpenAI, or any OpenAI-compatible endpoint). The vehicle record is sent as context.
- **Backup**: JSON export and restore.

## Privacy

All records, photos and documents are stored on the device (IndexedDB on web; AsyncStorage and the app document directory on iOS/Android). There is no account. The app makes network requests only to:
- the NHTSA public APIs,
- the AI provider you configure,
- your own data proxy, which receives only make/model/year, an optional topic and part URLs,
- links you open.

## Data proxy (Cloudflare Worker)

Deployed at https://bay-one-proxy.tiny-violet-c3ae.workers.dev and used by default. It accepts browser requests only from the app's origins (`ALLOWED_ORIGINS` in `worker/wrangler.toml`). Without any keys it provides YouTube results, Wikipedia, NHTSA complaints, shop prices, PDF downloads (`/file`) and readable page text (`/page`). In the app, manuals and forum threads are found with Claude web search using the owner's own key.

`worker/` holds a stateless relay. It exists because browsers block cross-origin requests to Reddit, YouTube, search APIs and shops, and because those API keys must not ship inside the app.

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put APP_TOKEN            # any long random string; also enter it in the app
npx wrangler secret put YOUTUBE_API_KEY      # optional: video results
npx wrangler secret put BRAVE_API_KEY        # optional: forum/blog/manual results
npx wrangler secret put REDDIT_CLIENT_ID     # optional: Reddit blocks anonymous requests from Cloudflare
npx wrangler secret put REDDIT_CLIENT_SECRET
npx wrangler deploy
npm test                                     # parser unit tests
```

Then, in the app, go to Setup → Data proxy and enter the `*.workers.dev` URL and the token.

| Endpoint | Source | Needs |
|---|---|---|
| `GET /health` | – | – |
| `GET /research?make&model&year[&topic]` | Reddit, YouTube Data API, Brave Search, NHTSA complaints | keys above (complaints need none) |
| `GET /product?url=` | shop page: schema.org JSON-LD, product meta tags, microdata | – |

## Develop

```bash
npm install
npx expo start          # w for web; native features need a development build (see below)
npm run typecheck
npm run lint
```

GPS background recording, the camera and notifications need a development build (`npx expo run:ios|android` or `eas build --profile development`); Expo Go does not include background location.

## Status

- Tested in Chromium on the web build:
  - add a vehicle;
  - photo wrap from an uploaded photo;
  - a GPS drive with simulated positions;
  - proxy connection and research collection against a local `wrangler dev`.
- iOS and Android builds have not been run yet.
- The silhouette fit needs reasonable contrast between the car and its background. With a weak result the app keeps the standard body shape and still wraps the photo.
