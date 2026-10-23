import { Category, Track } from '../types/music';

// Generated authentic album artwork paths
import queenBohemianCover from '../assets/images/queen_bohemian_cover_1792718482100.jpg';
import dragonsBelieverCover from '../assets/images/dragons_believer_cover_1792718482527.jpg';
import queenOperaCover from '../assets/images/queen_opera_cover_1792718483819.jpg';
import dragonsRadioactiveCover from '../assets/images/dragons_radioactive_cover_1792718483059.jpg';
import lofiRainCover from '../assets/images/lofi_rain_cover_1792718582802.jpg';
import synthwaveNeonCover from '../assets/images/synthwave_neon_cover_1792718582649.jpg';

export const CATEGORIES: Category[] = [
  {
    id: 'classic-rock',
    name: 'Classic Rock',
    description: 'Hinos atemporais que moldaram a história do rock mundial',
    gradient: 'from-amber-600/30 to-red-900/30',
    accentColor: '#f59e0b'
  },
  {
    id: 'alternative-pop',
    name: 'Alternative Pop',
    description: 'Batidas épicas, guitarras modernas e refrões poderosos',
    gradient: 'from-purple-600/30 to-pink-900/30',
    accentColor: '#ec4899'
  },
  {
    id: 'lofi-chill',
    name: 'Lofi Chill',
    description: 'Texturas sonoras suaves, vinil e batidas relaxantes para foco',
    gradient: 'from-blue-600/30 to-indigo-900/30',
    accentColor: '#3b82f6'
  },
  {
    id: 'synthwave',
    name: 'Synthwave & Retrowave',
    description: 'Sintetizadores analógicos dos anos 80 e estética futurista',
    gradient: 'from-fuchsia-600/30 to-cyan-900/30',
    accentColor: '#06b6d4'
  }
];

export const TRACKS: Track[] = [
  {
    id: 'queen-bohemian-rhapsody',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    duration: 354, // 5:54
    coverUrl: queenBohemianCover,
    style: 'Classic Rock',
    categoryId: 'classic-rock',
    releaseYear: 1975,
    sources: {
      localUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=epic-hollywood-trailer-9489.mp3',
      youtubeId: 'fJ9rUzIMcZQ'
    },
    lyrics: [
      'Is this the real life? Is this just fantasy?',
      'Caught in a landslide, no escape from reality',
      'Open your eyes, look up to the skies and see',
      'I\'m just a poor boy, I need no sympathy',
      'Because I\'m easy come, easy go, little high, little low',
      'Any way the wind blows doesn\'t really matter to me, to me...',
      'Mama, just killed a man...',
      'Put a gun against his head, pulled my trigger, now he\'s dead',
      'Mama, life had just begun',
      'But now I\'ve gone and thrown it all away',
      'Mama, ooh, didn\'t mean to make you cry',
      'If I\'m not back again this time tomorrow',
      'Carry on, carry on as if nothing really matters...'
    ]
  },
  {
    id: 'imagine-dragons-believer',
    title: 'Believer',
    artist: 'Imagine Dragons',
    album: 'Evolve',
    duration: 204, // 3:24
    coverUrl: dragonsBelieverCover,
    style: 'Alternative Pop',
    categoryId: 'alternative-pop',
    releaseYear: 2017,
    sources: {
      localUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=energetic-rock-guitar-riff-10928.mp3',
      youtubeId: '7wtfhZwyrcc'
    },
    lyrics: [
      'First things first, I\'ma say all the words inside my head',
      'I\'m fired up and tired of the way that things have been, oh-ooh',
      'The way that things have been, oh-ooh',
      'Second things second, don\'t you tell me what you think that I could be',
      'I\'m the one at the sail, I\'m the master of my sea, oh-ooh',
      'The master of my sea, oh-ooh',
      'Pain! You made me a, you made me a believer, believer',
      'Pain! You break me down and build me up, believer, believer',
      'Pain! Oh, let the bullets fly, oh, let them rain',
      'My life, my love, my drive, it came from...',
      'Pain! You made me a, you made me a believer, believer'
    ]
  },
  {
    id: 'queen-dont-stop-me-now',
    title: 'Don\'t Stop Me Now',
    artist: 'Queen',
    album: 'Jazz',
    duration: 209, // 3:29
    coverUrl: queenOperaCover,
    style: 'Classic Rock',
    categoryId: 'classic-rock',
    releaseYear: 1978,
    sources: {
      localUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=energetic-rock-guitar-riff-10928.mp3',
      youtubeId: 'HgzGwKwLmgM'
    },
    lyrics: [
      'Tonight I\'m gonna have myself a real good time',
      'I feel alive and the world I\'ll turn it inside out, yeah',
      'And floating around in ecstasy',
      'So don\'t stop me now, don\'t stop me',
      '\'Cause I\'m having a good time, having a good time',
      'I\'m a shooting star leaping through the sky like a tiger',
      'Defying the laws of gravity',
      'I\'m a racing car passing by like Lady Godiva',
      'I\'m gonna go, go, go, there\'s no stopping me!',
      'I\'m burnin\' through the sky, yeah, 200 degrees',
      'That\'s why they call me Mister Fahrenheit',
      'I\'m traveling at the speed of light',
      'I wanna make a supersonic man out of you!'
    ]
  },
  {
    id: 'imagine-dragons-radioactive',
    title: 'Radioactive',
    artist: 'Imagine Dragons',
    album: 'Night Visions',
    duration: 187, // 3:07
    coverUrl: dragonsRadioactiveCover,
    style: 'Alternative Pop',
    categoryId: 'alternative-pop',
    releaseYear: 2012,
    sources: {
      localUrl: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=modern-vlog-10023.mp3',
      youtubeId: 'ktvTqvkJC60'
    },
    lyrics: [
      'I\'m waking up to ash and dust',
      'I wipe my brow and I sweat my rust',
      'I\'m breathing in the chemicals',
      'I\'m breaking in, shaping up, then checking out on the prison bus',
      'This is it, the apocalypse, whoa',
      'I\'m waking up, I feel it in my bones',
      'Enough to make my systems blow',
      'Welcome to the new age, to the new age',
      'Welcome to the new age, to the new age',
      'Whoa, oh, oh, oh, oh, whoa, oh, oh, oh, I\'m radioactive, radioactive',
      'Whoa, oh, oh, oh, oh, whoa, oh, oh, oh, I\'m radioactive, radioactive'
    ]
  },
  {
    id: 'lofi-midnight-drift',
    title: 'Midnight Rain Drift',
    artist: 'Aura Lofi Collective',
    album: 'Nocturnal Whispers',
    duration: 165, // 2:45
    coverUrl: lofiRainCover,
    style: 'Lofi Chill',
    categoryId: 'lofi-chill',
    releaseYear: 2024,
    sources: {
      localUrl: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_db6591201e.mp3?filename=lofi-study-112191.mp3',
      youtubeId: 'jfKfPfyJRdk'
    },
    lyrics: [
      '[Instrumental Beats - Warm Vinyl Crackle & Rhodes Piano]',
      'Soft raindrops against the midnight window pane',
      'Warm tea vapor rising slowly into the shadows',
      'Gentle bassline pulsating with the city rhythm',
      'A quiet space for mindful thought and calm breathing...'
    ]
  },
  {
    id: 'synthwave-cybernetic-horizon',
    title: 'Cybernetic Horizon',
    artist: 'Astro-Dreams',
    album: 'Neon Faith',
    duration: 218, // 3:38
    coverUrl: synthwaveNeonCover,
    style: 'Synthwave',
    categoryId: 'synthwave',
    releaseYear: 2024,
    sources: {
      localUrl: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=synthwave-80s-110045.mp3',
      youtubeId: '4xDzrJKXOOY'
    },
    lyrics: [
      '[Analog Synthesizer Arpeggios & Gated Reverb Drums]',
      'Cruising down the electric neon expressway',
      'Grid lines stretching into the violet sunset',
      'Digital dreams etched in starlight and chrome',
      'Tomorrow arrives in pulses of light and pure energy...'
    ]
  }
];

// Helper to look up tracks and categories
export function getTrackById(id: string): Track | undefined {
  return TRACKS.find((track) => track.id === id);
}

export function getTracksByCategory(categoryId: string): Track[] {
  return TRACKS.filter((track) => track.categoryId === categoryId);
}

export function getTracksByStyle(style: string): Track[] {
  return TRACKS.filter((track) => track.style.toLowerCase() === style.toLowerCase());
}
