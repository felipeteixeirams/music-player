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
