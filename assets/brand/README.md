# Bay One brand assets

The mark is a garage-bay arch with a "1" inside (Bay One), in the app's blue→lavender gradient on graphite.

- `make-logo.js` generates every SVG variant (`node make-logo.js`).
- PNGs used by the app are rendered from these SVGs with Chromium:
  - `../icon.png` — iOS / store icon (full bleed, 1024)
  - `../android-icon-foreground.png`, `../android-icon-background.png`, `../android-icon-monochrome.png` — Android adaptive icon layers
  - `../splash-icon.png` — splash screen
  - `../favicon.png` — web favicon source (Expo also generates `favicon.ico`)
  - `../../public/icons/*` — web: SVG favicon, Apple touch icon, PWA manifest icons
- In the app the mark is drawn by `src/components/Logo.tsx` with the same geometry.
