import type { LiveRadioGroup } from '../types/music';

/**
 * Live radio stations, a fixed list: the community directory these came from (radio-browser.info) fails
 * intermittently and has many dead entries, so the first screen never depends on it. Each stream was checked on
 * 2026-10-25 to answer with continuous audio over HTTPS; `tests/api/integrations.live.test.ts` probes them
 * again on demand. Formats follow each station's name and directory tags, not a listening check. Stations
 * change addresses or go off the air: when the live test reports one, replace it. More stations, by style, are
 * asked of the directory on demand (`api/_radioBrowser.ts`) and shown below this list when it answers.
 */
export const LIVE_RADIO_GROUPS: LiveRadioGroup[] = [
  {
    id: 'pop',
    name: 'Pop e hits',
    stations: [
      { id: 'mix-fm', name: 'Mix FM', location: 'São Paulo, SP', streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/MIXFM_SAOPAULOAAC.aac' },
      { id: 'transamerica', name: 'Transamérica', location: 'São Paulo, SP', streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RT_SPAAC.aac' },
      { id: 'energia-97', name: 'Energia 97', location: 'São Paulo, SP', streamUrl: 'https://streaming.inweb.com.br/energia' },
      { id: 'metropolitana-pop', name: 'Metropolitana Pop', location: 'São Paulo, SP', streamUrl: 'https://ice.fabricahost.com.br/metrosppop' },
      { id: 'cidade-102-9', name: 'Cidade 102.9', location: 'Rio de Janeiro, RJ', streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIOCIDADEAAC.aac' }
    ]
  },
  {
    id: 'rock',
    name: 'Rock',
    stations: [
      { id: '89-fm-a-radio-rock', name: '89 FM A Rádio Rock', location: 'São Paulo, SP', streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO_89FM_ADP.aac?dist=site-89fm' },
      { id: 'kiss-fm', name: 'Kiss FM', location: 'São Paulo, SP', streamUrl: 'https://26593.live.streamtheworld.com/RADIO_KISSFM_ADP.aac' }
    ]
  },
  {
    id: 'mpb-classicos',
    name: 'MPB e clássicos',
    stations: [
      { id: 'antena-1', name: 'Antena 1', location: 'São Paulo, SP', streamUrl: 'https://antenaone.crossradio.com.br/stream/1;' },
      { id: 'alpha-fm', name: 'Alpha FM', location: 'São Paulo, SP', streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO_ALPHAFM_ADP.aac' },
      { id: 'jb-fm-99-9', name: 'JB FM 99.9', location: 'Rio de Janeiro, RJ', streamUrl: 'https://26573.live.streamtheworld.com/JBFMAAC.aac?1771934687401' },
      { id: 'metropolitana-mpb', name: 'Metropolitana MPB', location: 'São Paulo, SP', streamUrl: 'https://ice.fabricahost.com.br/metropolitanampb' },
      { id: 'roberto-carlos', name: 'Roberto Carlos', location: 'Rio de Janeiro, RJ', streamUrl: 'https://stream.zeno.fm/erbpkq1cz55vv' }
    ]
  },
  {
    id: 'sertanejo',
    name: 'Sertanejo',
    stations: [
      { id: 'metropolitana-sertanejo', name: 'Metropolitana Sertanejo', location: 'São Paulo, SP', streamUrl: 'https://ice.fabricahost.com.br/metrospsertanejo' },
      { id: 'bh-fm-102-1', name: 'BH FM 102.1', location: 'Belo Horizonte, MG', streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/BHFMAAC.aac' },
      { id: 'buteco-sertanejo', name: 'Buteco Sertanejo', location: 'São Paulo, SP', streamUrl: 'https://stream.zeno.fm/6kumndewqbruv' },
      { id: 'classicos-sertanejos', name: 'Clássicos Sertanejos', location: 'Brasil', streamUrl: 'https://cast.mgtradio.net/radio/8000/aac' }
    ]
  },
  {
    id: 'samba-forro',
    name: 'Samba, pagode e forró',
    stations: [
      { id: 'geracao-samba-e-pagode', name: 'Geração Samba e Pagode', location: 'São Paulo, SP', streamUrl: 'https://stream.geracaoradios.com.br/listen/samba/radio' },
      { id: 'clube-fm-105-5', name: 'Clube FM 105.5', location: 'Brasília, DF', streamUrl: 'https://8157.brasilstream.com.br/stream' },
      { id: 'ze-ramalho', name: 'Zé Ramalho', location: 'Paraíba', streamUrl: 'https://stream.zeno.fm/qnx6k0pfmxhvv' }
    ]
  },
  {
    id: 'jazz-soul',
    name: 'Jazz e soul',
    stations: [
      { id: 'nova-instrumental', name: 'Nova Instrumental', location: 'Brasil', streamUrl: 'https://streaming.radioempresabrasil.com.br/proxy/novainstrumental/stream' },
      { id: 'soul-one', name: 'Soul One', location: 'São Paulo, SP', streamUrl: 'https://stream.soulone.com.br/listen/soulone/externo' }
    ]
  },
  {
    id: 'noticias',
    name: 'Notícias e esporte',
    stations: [
      { id: 'cbn-sao-paulo', name: 'CBN São Paulo', location: 'São Paulo, SP', streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBN_SPAAC.aac' },
      { id: 'bandnews-fm', name: 'BandNews FM', location: 'São Paulo, SP', streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/BANDNEWSFM_SPAAC_SC' },
      { id: 'itatiaia', name: 'Itatiaia', location: 'Belo Horizonte, MG', streamUrl: 'https://8903.brasilstream.com.br/stream' },
      { id: 'radio-globo', name: 'Rádio Globo', location: 'Rio de Janeiro, RJ', streamUrl: 'https://26583.live.streamtheworld.com:443/RADIO_GLOBO_RJAAC.aac?dist=radioscombr' }
    ]
  }
];

export const LIVE_STATIONS = LIVE_RADIO_GROUPS.flatMap((group) => group.stations);
