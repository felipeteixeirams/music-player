/**
 * The queue after the track at `from` moves to `to`. Only what comes after the playing track can move (`minIndex` is the
 * first movable position, the one after the current track): the same list comes back for anything else.
 */
export function moveQueueItem<T>(list: readonly T[], from: number, to: number, minIndex: number): readonly T[] {
  const valid = (index: number) => Number.isInteger(index) && index >= minIndex && index < list.length;
  if (from === to || !valid(from) || !valid(to)) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The queue with `item` right after the playing one (`current` is its position; -1 or past the end when nothing is playing,
 * and then it goes to the end). Tocar a seguir (INV-PLAY-28).
 */
export function queueWithNext<T>(list: readonly T[], current: number, item: T): T[] {
  const at = current >= 0 && current < list.length ? current + 1 : list.length;
  return [...list.slice(0, at), item, ...list.slice(at)];
}

/** The queue with `item` at its end (Adicionar à fila, INV-PLAY-28). */
export function queueWithAppended<T>(list: readonly T[], item: T): T[] {
  return [...list, item];
}
