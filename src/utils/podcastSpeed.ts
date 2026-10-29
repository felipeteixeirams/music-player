/** The speeds the player cycles through, from normal: the speed button goes to the next one and wraps. */
export const PODCAST_SPEEDS = [1, 1.25, 1.5, 2, 0.8] as const;
export const PODCAST_SPEED_KEY = 'aurastream_podcast_speed';

export function nextSpeed(current: number): number {
  const index = PODCAST_SPEEDS.findIndex((speed) => speed === current);
  return PODCAST_SPEEDS[(index + 1) % PODCAST_SPEEDS.length];
}

/** The speed the person last chose (a device setting, not an account one); 1 when none or not one of the speeds. */
export function readSpeed(storage: Pick<Storage, 'getItem'> | null): number {
  try {
    const value = Number(storage?.getItem(PODCAST_SPEED_KEY));
    return PODCAST_SPEEDS.some((speed) => speed === value) ? value : 1;
  } catch {
    return 1;
  }
}

export function saveSpeed(storage: Pick<Storage, 'setItem'> | null, speed: number): void {
  try {
    storage?.setItem(PODCAST_SPEED_KEY, String(speed));
  } catch {
    // storage that refuses: the speed lasts for this session
  }
}

/** "1,25×" as shown on the button. */
export const speedLabel = (speed: number): string => `${String(speed).replace('.', ',')}×`;
