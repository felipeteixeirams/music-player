/**
 * Deezer's preview addresses are signed (`hdnea=exp=<epoch>~...`) and stop working when the signature expires, about
 * 15 minutes after the list that carried them was made. Everything that keeps a list (the CDN, the phone) outlives that.
 */

/** When the address stops working (epoch seconds); null when it carries no expiry (iTunes, radio streams). */
export function previewExpiresAt(url: string): number | null {
  const match = /[?&]hdnea=[^&]*?exp(?:=|%3D)(\d{9,11})/i.exec(url);
  return match ? Number(match[1]) : null;
}

/** True when the address is expired or about to be (`marginSeconds` is the time to buffer and start playing). */
export function isPreviewStale(url: string, nowSeconds = Date.now() / 1000, marginSeconds = 90): boolean {
  const expires = previewExpiresAt(url);
  return expires !== null && expires - nowSeconds < marginSeconds;
}
