/**
 * The picture shown when a track, album or show has no cover, or its cover does not load (INV-MEDIA-04): a music note on a
 * dark gradient, drawn inline. It asks nobody for anything (no third-party photo) and looks like the app everywhere it
 * shows. The server uses the same one for a catalog item without artwork, so the app and the API cannot drift apart.
 */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a4e"/><stop offset="1" stop-color="#15151f"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#g)"/>
<g fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
<path d="M42 68V30l32-7v38"/>
</g>
<circle cx="34" cy="68" r="8" fill="#ffffff" fill-opacity="0.55"/>
<circle cx="66" cy="61" r="8" fill="#ffffff" fill-opacity="0.55"/>
</svg>`;

export const COVER_PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG.replace(/\n/g, ''))}`;
