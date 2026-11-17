# Bay One

A personal virtual garage and mechanic assistant for iOS, Android and web, built with Expo (React Native) and three.js.

## What works today

- **Garage**: add vehicles by VIN (NHTSA decoder, US market) or by hand; 3D turntable with a built-in body per type or an uploaded `.glb`.
- **Fuel**: fill-up log, full-to-full consumption, spend and cost per distance.
- **Service**: maintenance schedule with distance and time intervals, due/overdue status, service history.
- **Parts**: parts list with status, shop links and price history.
- **Docs**: per-vehicle document folder stored on the device.
- **Intel**: NHTSA recall lookup (cached offline), pre-filled research searches, saved references.
- **Mechanic**: chat with your own API key (Claude, OpenAI or any OpenAI-compatible endpoint); the vehicle record is sent as context.
- **Backup**: JSON export and restore.

## Data

All records are stored on the device (IndexedDB on web, AsyncStorage and the app document directory on iOS/Android). There is no account and no backend. Network requests are limited to: the NHTSA public APIs, the AI provider you configure, and links you open.

## Not built yet

- Thin CORS proxy for fetching forum, Reddit, YouTube and retailer data automatically.
- Photo-to-3D model generation.
- Photorealistic per-model 3D assets (the built-in bodies are stylised stand-ins).
- Native builds have not been run; only the web build has been tested.

## Develop

```bash
npm install
npx expo start          # press w for web, or scan the QR code with Expo Go / a dev build
npm run typecheck
npm run lint
```
