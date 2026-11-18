// Generates the Bay One logo variants as SVG. Run: node make-logo.js
// Mark: a garage-bay arch with a bold "1" inside (Bay One), in the app's blue→lavender gradient.
const fs = require('fs');

const defs = (id) => `
  <defs>
    <linearGradient id="${id}-tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#20242C"/><stop offset="1" stop-color="#0B0C0F"/>
    </linearGradient>
    <linearGradient id="${id}-mark" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#9DBBFF"/><stop offset="0.55" stop-color="#7EA6FF"/><stop offset="1" stop-color="#B49DFF"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="0.5" cy="0.62" r="0.5">
      <stop offset="0" stop-color="#7EA6FF" stop-opacity="0.28"/><stop offset="1" stop-color="#7EA6FF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>`;

/** The mark on a 1024 grid, scaled by s around the centre. */
const mark = (id, { s = 1, mono = false } = {}) => {
  const stroke = mono ? '#FFFFFF' : `url(#${id}-mark)`;
  const one = mono ? '#FFFFFF' : '#F4F6FA';
  return `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">
    ${mono ? '' : `<ellipse cx="512" cy="600" rx="300" ry="250" fill="url(#${id}-glow)"/>`}
    <path d="M 262 770 V 500 A 250 250 0 0 1 762 500 V 770" fill="none" stroke="${stroke}" stroke-width="88" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 432 470 L 524 404 V 700" fill="none" stroke="${one}" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 352 778 H 672" fill="none" stroke="${mono ? '#FFFFFF' : '#8EA9FF'}" stroke-width="36" stroke-linecap="round" opacity="${mono ? 0.9 : 0.5}"/>
  </g>`;
};

const svg = (w, h, body, id = 'a') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1024 1024">${defs(id)}${body}</svg>`;

const tile = (id, rx = 228) =>
  `<rect width="1024" height="1024" rx="${rx}" fill="url(#${id}-tile)"/><rect width="1024" height="1024" rx="${rx}" fill="url(#${id}-sheen)"/>` +
  `<rect x="6" y="6" width="1012" height="1012" rx="${rx - 6}" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="12"/>`;

const out = {
  // Rounded tile for web, favicon and stores' previews.
  'logo-tile.svg': svg(1024, 1024, tile('t') + mark('t', { s: 0.86 }), 't'),
  // iOS / store icon: full bleed square (the OS applies its own mask).
  'icon.svg': svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#i-tile)"/><rect width="1024" height="1024" fill="url(#i-sheen)"/>` + mark('i', { s: 0.86 }), 'i'),
  // Android adaptive icon layers: mark inside the 66 % safe zone; background is the graphite gradient.
  'android-foreground.svg': svg(1024, 1024, mark('f', { s: 0.62 }), 'f'),
  'android-background.svg': svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#b-tile)"/>`, 'b'),
  'android-monochrome.svg': svg(1024, 1024, mark('m', { s: 0.62, mono: true }), 'm'),
  // Splash: the mark alone on the app background.
  'splash.svg': svg(1024, 1024, mark('s', { s: 1 }), 's'),
  // Favicon: heavier tile radius reads better at 16–32 px.
  'favicon.svg': svg(1024, 1024, tile('v', 260) + mark('v', { s: 0.92 }), 'v'),
};
for (const [name, content] of Object.entries(out)) fs.writeFileSync(name, content);
console.log(Object.keys(out).join('\n'));
