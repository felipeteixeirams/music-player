import type { Track } from '../types/music';

/**
 * Coletâneas históricas lançadas em CD no Brasil (principalmente pela Som Livre, nos anos 90 e 2000). Essas compilações
 * não existem como álbum no catálogo do Deezer e do iTunes, então a lista de faixas é mantida aqui.
 * ATENÇÃO: a lista foi montada de memória, com faixas e artistas que batem com discos reais, e ainda não foi conferida
 * com o encarte de cada CD. Para tocar, cada faixa é buscada pelo título e artista (o id `historic-*` é só uma chave);
 * as capas são endereços fixos do CDN da Deezer.
 */

export interface HistoricCompilation {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  year: number;
  label: string;
  description: string;
  coverUrl: string;
  gradient: string;
  tags: string[];
  tracks: Track[];
}

const buildTrack = (
  id: string,
  title: string,
  artist: string,
  album: string,
  duration: number,
  coverUrl: string
): Track => ({
  id: `historic-${id}`,
  title,
  artist,
  album,
  duration,
  coverUrl,
  style: 'Coletânea Clássica',
  categoryId: 'rock',
  sources: {
    localUrl: '',
    previewUrl: ''
  }
});

export const HISTORIC_COMPILATIONS: HistoricCompilation[] = [
  {
    id: 'lovy-metal',
    title: 'Lovy Metal',
    subtitle: 'As lendárias baladas do Hard Rock e Heavy Metal',
    badge: 'CD Som Livre · 2001',
    year: 2001,
    label: 'Som Livre',
    description: 'A histórica coletânea de power ballads que marcou época no Brasil com os maiores hinos românticos do rock.',
    coverUrl: 'https://cdn-images.dzcdn.net/images/cover/b5685b3ebddf6ed7133cbac215c279b0/500x500-000000-80-0-0.jpg',
    gradient: 'from-amber-600/30 via-red-950/40 to-black',
    tags: [
      'lovy metal',
      'love metal',
      'lovy metal som livre',
      'love metal som livre',
      'cd lovy metal',
      'cd love metal',
      'lovy metal 1',
      'lovy metal 2',
      'lovy metal 3',
      'o melhor de lovy metal'
    ],
    tracks: [
      buildTrack('lm-01', 'Silent Lucidity', 'Queensrÿche', 'Empire', 347, 'https://cdn-images.dzcdn.net/images/cover/b5685b3ebddf6ed7133cbac215c279b0/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-02', 'Still Loving You', 'Scorpions', 'Love at First Sting', 403, 'https://cdn-images.dzcdn.net/images/cover/948018bb2183e9b6b26cbf7e6a3d3c9a/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-03', 'More Than Words', 'Extreme', 'Extreme II: Pornograffitti', 223, 'https://cdn-images.dzcdn.net/images/cover/f80365c8fea06b11a06b738be67a42bf/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-04', 'I Remember You', 'Skid Row', 'Skid Row', 313, 'https://cdn-images.dzcdn.net/images/cover/debc96fbb5aadd5e3cd6ed2c9009b19d/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-05', 'Carrie', 'Europe', 'The Final Countdown', 306, 'https://cdn-images.dzcdn.net/images/cover/04451587e0ff0a9775b8a4c8ca1861bd/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-06', 'To Be With You', 'Mr. Big', 'Lean Into It', 210, 'https://cdn-images.dzcdn.net/images/cover/19852276308f92552ca06add5a75dc0c/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-07', 'Dust in the Wind', 'Kansas', 'Point of Know Return', 206, 'https://cdn-images.dzcdn.net/images/cover/244d3ccecdf95e7117d26e2c7f3d37e0/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-08', 'Every Rose Has Its Thorn', 'Poison', 'Open Up and Say... Ahh!', 260, 'https://cdn-images.dzcdn.net/images/cover/3c49123ff84276581bd237f63c090dac/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-09', 'Is This Love', 'Whitesnake', 'Whitesnake (1987)', 283, 'https://cdn-images.dzcdn.net/images/cover/a31ad1ee3e26552b6cd82d568b299f5b/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-10', 'When I Look Into Your Eyes', 'Firehouse', 'Hold Your Fire', 245, 'https://cdn-images.dzcdn.net/images/cover/566585bce714c1c1bc5bb91d68476d36/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-11', 'When I See You Smile', 'Bad English', 'Bad English', 257, 'https://cdn-images.dzcdn.net/images/cover/851c31de187705bc174ebff933a27375/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-12', 'Heaven', 'Warrant', 'Dirty Rotten Filthy Stinking Rich', 235, 'https://cdn-images.dzcdn.net/images/cover/b4ec4a1a920d792dd7d8d15dc29f0a39/250x250-000000-80-0-0.jpg'),
      buildTrack('lm-13', "Don't Know What You Got (Till It's Gone)", 'Cinderella', 'Long Cold Winter', 355, 'https://cdn-images.dzcdn.net/images/cover/e66b5d3a40f69690c1633afb73cc590c/250x250-000000-80-0-0.jpg')
    ]
  },
  {
    id: 'classic-metal',
    title: 'Classic Metal',
    subtitle: 'Hinos definitivos do Hard Rock e Heavy Metal clássico',
    badge: 'CD Som Livre · 2003',
    year: 2003,
    label: 'Som Livre',
    description: 'Os maiores clássicos de estádio e sucessos enérgicos que definiram as rádios do rock mundial nos anos 70 e 80.',
    coverUrl: 'https://cdn-images.dzcdn.net/images/cover/f27265df605c4bce229b0623e18f179a/500x500-000000-80-0-0.jpg',
    gradient: 'from-blue-600/30 via-indigo-950/40 to-black',
    tags: [
      'classic metal',
      'classic metal som livre',
      'cd classic metal',
      'classic metal vol 1',
      'classic metal vol 2'
    ],
    tracks: [
      buildTrack('cm-01', "Don't Stop Believin'", 'Journey', 'Escape', 249, 'https://cdn-images.dzcdn.net/images/cover/b4ec4a1a920d792dd7d8d15dc29f0a39/250x250-000000-80-0-0.jpg'),
      buildTrack('cm-02', 'The Final Countdown', 'Europe', 'The Final Countdown', 310, 'https://cdn-images.dzcdn.net/images/cover/f27265df605c4bce229b0623e18f179a/250x250-000000-80-0-0.jpg'),
      buildTrack('cm-03', 'Eye of the Tiger', 'Survivor', 'Eye of the Tiger', 245, 'https://cdn-images.dzcdn.net/images/cover/e66b5d3a40f69690c1633afb73cc590c/250x250-000000-80-0-0.jpg'),
      buildTrack('cm-04', 'Rock You Like a Hurricane', 'Scorpions', 'Love at First Sting', 253, 'https://cdn-images.dzcdn.net/images/cover/948018bb2183e9b6b26cbf7e6a3d3c9a/250x250-000000-80-0-0.jpg'),
      buildTrack('cm-05', 'Carry On Wayward Son', 'Kansas', 'Leftoverture', 323, 'https://cdn-images.dzcdn.net/images/cover/244d3ccecdf95e7117d26e2c7f3d37e0/250x250-000000-80-0-0.jpg'),
      buildTrack('cm-06', 'Heat of the Moment', 'Asia', 'Asia', 230, 'https://cdn-images.dzcdn.net/images/cover/19852276308f92552ca06add5a75dc0c/250x250-000000-80-0-0.jpg'),
      buildTrack('cm-07', 'Poison', 'Alice Cooper', 'Trash', 267, 'https://cdn-images.dzcdn.net/images/cover/566585bce714c1c1bc5bb91d68476d36/250x250-000000-80-0-0.jpg'),
      buildTrack('cm-08', 'Cum On Feel the Noize', 'Quiet Riot', 'Metal Health', 287, 'https://cdn-images.dzcdn.net/images/cover/851c31de187705bc174ebff933a27375/250x250-000000-80-0-0.jpg')
    ]
  },
  {
    id: 'good-times',
    title: 'Good Times',
    subtitle: 'Os grandes clássicos românticos e flashbacks',
    badge: 'CD Som Livre · 98 FM',
    year: 1998,
    label: 'Som Livre',
    description: 'A inesquecível série de CDs baseada no programa da rádio 98 FM que embalou as noites românticas de várias gerações.',
    coverUrl: 'https://cdn-images.dzcdn.net/images/cover/153332e88a14255a8c3d5959a5a21882/500x500-000000-80-0-0.jpg',
    gradient: 'from-rose-600/30 via-purple-950/40 to-black',
    tags: [
      'good times',
      'good times som livre',
      'cd good times',
      'good times 98',
      'good times 98 fm',
      'radio good times'
    ],
    tracks: [
      buildTrack('gt-01', 'Lost In Love', 'Air Supply', 'Lost in Love', 234, 'https://cdn-images.dzcdn.net/images/cover/3c49123ff84276581bd237f63c090dac/250x250-000000-80-0-0.jpg'),
      buildTrack('gt-02', 'Just The Way You Are', 'Barry White', 'The Man', 287, 'https://cdn-images.dzcdn.net/images/cover/6e95267f3dddd292222e8b748f64e772/250x250-000000-80-0-0.jpg'),
      buildTrack('gt-03', 'Make It with You', 'Bread', 'On the Waters', 192, 'https://cdn-images.dzcdn.net/images/cover/05849e7461a584ea845918a8c90313ea/250x250-000000-80-0-0.jpg'),
      buildTrack('gt-04', "I'm Not In Love", '10cc', 'The Original Soundtrack', 366, 'https://cdn-images.dzcdn.net/images/cover/881d11fe5b2d92509cfe7d08f7ced70f/250x250-000000-80-0-0.jpg'),
      buildTrack('gt-05', 'Easy', 'Commodores', 'Commodores', 290, 'https://cdn-images.dzcdn.net/images/cover/3c8e66cb596759e815f12848a26c719c/250x250-000000-80-0-0.jpg'),
      buildTrack('gt-06', 'Love Hurts', 'Nazareth', 'Hair of the Dog', 254, 'https://cdn-images.dzcdn.net/images/cover/e4723a0862954e6adad912534f77274d/250x250-000000-80-0-0.jpg'),
      buildTrack('gt-07', 'Africa', 'Toto', 'Toto IV', 296, 'https://cdn-images.dzcdn.net/images/cover/153332e88a14255a8c3d5959a5a21882/250x250-000000-80-0-0.jpg'),
      buildTrack('gt-08', "Hard to Say I'm Sorry", 'Chicago', 'Chicago 16', 305, 'https://cdn-images.dzcdn.net/images/cover/dafda9e0f86905405a02d43d20f0ee8b/250x250-000000-80-0-0.jpg'),
      buildTrack('gt-09', 'Against All Odds (Take a Look at Me Now)', 'Phil Collins', 'Against All Odds', 205, 'https://cdn-images.dzcdn.net/images/cover/d74bc3362822f21125e1bc5778e3cd13/250x250-000000-80-0-0.jpg')
    ]
  },
  {
    id: 'power-ballads',
    title: 'Power Ballads',
    subtitle: 'As maiores baladas românticas da história do Rock',
    badge: 'Coletânea Clássica',
    year: 1999,
    label: 'Som Livre',
    description: 'A seleção definitiva das baladas lentas, solos emocionantes e melodias marcantes que conquistaram as rádios.',
    coverUrl: 'https://cdn-images.dzcdn.net/images/cover/98b6e4c7ed01378305cc9b1946705c1f/500x500-000000-80-0-0.jpg',
    gradient: 'from-emerald-600/30 via-slate-900/40 to-black',
    tags: [
      'power ballads',
      'power ballads som livre',
      'cd power ballads',
      'power ballad',
      'baladas do rock'
    ],
    tracks: [
      buildTrack('pb-01', 'Wind Of Change', 'Scorpions', 'Crazy World', 312, 'https://cdn-images.dzcdn.net/images/cover/98b6e4c7ed01378305cc9b1946705c1f/250x250-000000-80-0-0.jpg'),
      buildTrack('pb-02', 'Here I Go Again', 'Whitesnake', 'Whitesnake (1987)', 275, 'https://cdn-images.dzcdn.net/images/cover/0f3d8eef2379d9b3ffa569128886dc1b/250x250-000000-80-0-0.jpg'),
      buildTrack('pb-03', 'Always', 'Bon Jovi', 'Cross Road', 352, 'https://cdn-images.dzcdn.net/images/cover/f513327c13908b0def56f1fa0ca79789/250x250-000000-80-0-0.jpg'),
      buildTrack('pb-04', "Cryin'", 'Aerosmith', 'Get A Grip', 308, 'https://cdn-images.dzcdn.net/images/cover/04cfb163fee3a6dcf025525eb6b57f44/250x250-000000-80-0-0.jpg'),
      buildTrack('pb-05', 'Still Loving You', 'Scorpions', 'Love at First Sting', 403, 'https://cdn-images.dzcdn.net/images/cover/948018bb2183e9b6b26cbf7e6a3d3c9a/250x250-000000-80-0-0.jpg'),
      buildTrack('pb-06', 'I Remember You', 'Skid Row', 'Skid Row', 313, 'https://cdn-images.dzcdn.net/images/cover/debc96fbb5aadd5e3cd6ed2c9009b19d/250x250-000000-80-0-0.jpg'),
      buildTrack('pb-07', 'Carrie', 'Europe', 'The Final Countdown', 306, 'https://cdn-images.dzcdn.net/images/cover/04451587e0ff0a9775b8a4c8ca1861bd/250x250-000000-80-0-0.jpg')
    ]
  }
];

/**
 * Normaliza um texto para busca sem acentos e em minúsculas.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Procura se o termo pesquisado corresponde a uma das coletâneas históricas em CD.
 */
export function findMatchingCompilation(query: string): HistoricCompilation | null {
  const normalized = normalizeText(query);
  if (!normalized || normalized.length < 4) return null;

  // Busca por correspondência exata ou de frase com a tag
  for (const comp of HISTORIC_COMPILATIONS) {
    for (const tag of comp.tags) {
      const normalizedTag = normalizeText(tag);
      if (
        normalized === normalizedTag ||
        normalized === `cd ${normalizedTag}` ||
        normalized === `${normalizedTag} cd` ||
        normalized === `coletanea ${normalizedTag}` ||
        normalized.startsWith(`${normalizedTag} `) ||
        normalized.endsWith(` ${normalizedTag}`) ||
        normalized.includes(` ${normalizedTag} `)
      ) {
        return comp;
      }
    }
  }

  // Busca genérica por "som livre"
  if (normalized === 'som livre' || normalized === 'cd som livre' || normalized === 'coletaneas som livre') {
    return HISTORIC_COMPILATIONS[0];
  }

  return null;
}
