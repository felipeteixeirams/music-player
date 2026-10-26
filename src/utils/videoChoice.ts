/** Which YouTube video the user picked for a track ("Outra versão"), kept on the device. */
export const VIDEO_CHOICE_KEY = 'aurastream_video_choice';

/** Oldest choices are forgotten past this many tracks. */
const MAX_CHOICES = 300;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Track id -> video id, ignoring anything stored that is not that shape. */
export function loadChoices(storage: ReadStorage): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(VIDEO_CHOICE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string' && VIDEO_ID.test(entry[1])
      )
    );
  } catch {
    return {};
  }
}

/** Saves the choice, as the most recent; storage that refuses (private mode, full) is not an error. */
export function rememberChoice(storage: WriteStorage, trackId: string, videoId: string): void {
  try {
    const choices = loadChoices(storage);
    delete choices[trackId];
    choices[trackId] = videoId;
    const entries = Object.entries(choices);
    storage.setItem(VIDEO_CHOICE_KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_CHOICES))));
  } catch {
    // The choice only lasts for this session then
  }
}

/** The candidates with the user's pick first (added when the search no longer returns it), without repeats. */
export function orderVersions(ids: string[], chosen?: string): string[] {
  const ordered = chosen ? [chosen, ...ids] : ids;
  return ordered.filter((id, index) => ordered.indexOf(id) === index);
}

/** The version after `index`, wrapping around to the first. */
export function nextVersionIndex(index: number, length: number): number {
  return length > 0 ? (index + 1) % length : 0;
}
