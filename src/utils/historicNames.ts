/**
 * Names of the historic compilations (CDs). The generator (scripts/build-historic-compilations.mjs) and the app use the
 * same functions, so a title in the catalog and a search typed by the person reduce to the same series name.
 */

/** Comparable text: no accents, no case, no punctuation, one space between words. */
export function norm(text: string): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft|featuring)\.?\s.*$/, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The series name: the title without the parts that name a volume, an edition or a year, so "Lovy Metal 3",
 * "Lovy Metal, Volume 2" and "Lovy Metal (Internacional)" all reduce to "lovy metal".
 */
export function baseTitle(title: string): string {
  return norm(
    String(title)
      .replace(/^various\s*-\s*/i, '')
      .replace(/\(internacional\)|-\s*internacional\b/gi, ' ')
      .replace(/\b(vol|volume)\.?\s*\d+\b/gi, ' ')
      .replace(/\b(19|20)\d{2}\b/g, ' ')
      .replace(/\b\d+\s*$/g, ' ')
      .replace(/\b(cd|coletanea|colecao)\b/gi, ' ')
  );
}

/**
 * Other names people use for a series, mapped to the name in the catalog (both normalized). Keep this short: every
 * entry is a promise that the search finds that series.
 */
export const SERIES_ALIASES: Record<string, string> = {
  'love metal': 'lovy metal'
};
