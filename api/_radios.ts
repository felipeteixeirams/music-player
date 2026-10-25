/**
 * Radio stations offered in the app: a curated subset of Deezer's. Deezer's own list is noisy (event stations,
 * duplicates, a "Kids Pop" station that plays French rap, a "Brazilian Music" station that is empty), so each
 * station here was checked against what it actually plays. Names are ours; covers come from Deezer. A station
 * Deezer drops is skipped when the list is built, and the live smoke test reports it.
 */
export interface RadioStationConfig {
  id: number;
  name: string;
}

export interface RadioGenreConfig {
  id: string;
  name: string;
  stations: RadioStationConfig[];
}

export const RADIO_GENRES: RadioGenreConfig[] = [
  {
    id: 'brasil',
    name: 'Brasil',
    stations: [
      { id: 35285, name: 'Sertanejo' },
      { id: 39061, name: 'Samba' },
      { id: 39101, name: 'Bossa Nova' },
      { id: 39081, name: 'Axé e Forró' }
    ]
  },
  {
    id: 'pop',
    name: 'Pop',
    stations: [
      { id: 37151, name: 'Pop Hits' },
      { id: 31061, name: 'Pop' },
      { id: 30771, name: 'Indie' },
      { id: 38305, name: 'Anos 80' }
    ]
  },
  {
    id: 'rock',
    name: 'Rock e Metal',
    stations: [
      { id: 37765, name: 'Rock Clássico' },
      { id: 38295, name: 'Anos 70' },
      { id: 37031, name: 'Hard Rock' },
      { id: 30891, name: 'Rock and Roll' },
      { id: 30901, name: 'Metal' }
    ]
  },
  {
    id: 'hip-hop-rb',
    name: 'Hip-hop e R&B',
    stations: [
      { id: 30991, name: 'Hip-hop' },
      { id: 31021, name: 'Rap US' },
      { id: 37101, name: 'Old School Hip Hop' },
      { id: 30881, name: 'R&B' }
    ]
  },
  {
    id: 'soul-funk',
    name: 'Soul e Funk',
    stations: [
      { id: 30861, name: 'Soul' },
      { id: 38445, name: 'Motown' },
      { id: 30831, name: 'Funk' },
      { id: 30841, name: 'Disco' }
    ]
  },
  {
    id: 'eletronica',
    name: 'Eletrônica',
    stations: [
      { id: 30951, name: 'Dance' },
      { id: 30621, name: 'Eletrônica' }
    ]
  },
  {
    id: 'jazz-blues',
    name: 'Jazz e Blues',
    stations: [
      { id: 31031, name: 'Jazz' },
      { id: 31051, name: 'Jazz Vocal' },
      { id: 30921, name: 'Blues' }
    ]
  },
  {
    id: 'mundo',
    name: 'Mais estilos',
    stations: [
      { id: 42282, name: 'Country' },
      { id: 31091, name: 'Reggae' },
      { id: 37051, name: 'Salsa' },
      { id: 30661, name: 'Clássica' },
      { id: 38225, name: 'Foco' }
    ]
  }
];

/** The station behind an id from a query string ("37765"), or null when it is not one of ours. */
export function findRadioStation(value: unknown): RadioStationConfig | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text !== 'string' || !/^\d{1,9}$/.test(text)) return null;
  const id = Number(text);
  for (const genre of RADIO_GENRES) {
    const station = genre.stations.find((candidate) => candidate.id === id);
    if (station) return station;
  }
  return null;
}
