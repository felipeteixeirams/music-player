/** Apple-like system colors; a station without a logo gets one of them, always the same for the same station. */
const PALETTE = ['#fa243c', '#ff9f0a', '#30b0c7', '#5e5ce6', '#bf5af2', '#34c759', '#ff375f', '#0a84ff'];

/** Words that say little about which station it is. */
const FILLER = new Set(['a', 'e', 'o', 'de', 'da', 'do', 'fm', 'radio', 'rádio']);

/** A dial frequency ("102.9"): many stations share the digits, so it does not tell them apart. */
const isFrequency = (word: string) => /^\d+[.,]\d+$/.test(word);

export function stationColor(seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Two letters (or a number) that stand for the station on its tile: "Mix FM" gives "MI", "Antena 1" gives "A1", "Cidade 102.9" gives "CI". */
export function stationInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const meaningful = words.filter((word) => !FILLER.has(word.toLowerCase()) && !isFrequency(word));
  const pool = meaningful.length > 0 ? meaningful : words;
  if (pool.length === 0) return '·';
  if (pool.length === 1) return pool[0].slice(0, 2).toUpperCase();
  return (pool[0][0] + pool[1][0]).toUpperCase();
}
