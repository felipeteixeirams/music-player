/**
 * The rule that gives a track the Deezer did not match its iTunes artwork (INV-CAT-07). Kept apart from the build
 * script so the tests can check it without running the whole catalog build.
 */

/** The comparison the catalog uses for names: no accents, no case, no punctuation. */
export const sameName = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * The artwork (250 px) of the first iTunes song with the same artist and a title that starts the same way as the track's
 * (12 characters). A song by another artist is never taken, and a song without artwork is skipped. `null` when none fits.
 */
export function pickItunesCover(results, title, artist) {
  const want = sameName(title).slice(0, 12);
  const hit = (results ?? []).find(
    (song) => sameName(song.artistName) === sameName(artist) && sameName(song.trackName).startsWith(want) && song.artworkUrl100
  );
  return hit ? hit.artworkUrl100.replace('100x100bb', '250x250bb') : null;
}
