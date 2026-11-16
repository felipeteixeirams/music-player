/**
 * The catalog's cover CDNs (Deezer and Apple). One list for the server's image proxy and the app's fallback to it: a
 * change here reaches both, so they cannot drift apart.
 */
export const COVER_HOST_SUFFIXES = ['.dzcdn.net', '.mzstatic.com'] as const;
