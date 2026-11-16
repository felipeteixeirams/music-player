import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mapDeezerTrack } from '../api/_deezer';
import { COVER_PLACEHOLDER } from '../api/_coverFallback';

test('INV-MEDIA-04: a capa padrão é um desenho embutido (data URI), sem pedir nada a terceiros', () => {
  assert.ok(COVER_PLACEHOLDER.startsWith('data:image/svg+xml'));
  // The SVG namespace is an identifier, not an address the picture loads from
  const drawing = decodeURIComponent(COVER_PLACEHOLDER).replace(/xmlns="[^"]*"/g, '');
  assert.ok(!/https?:/i.test(drawing), 'sem endereço externo no desenho');
  for (const file of ['api/_deezer.ts', 'api/_itunes.ts', 'src/components/TrackCarousel.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /unsplash/i, `${file} não usa foto externa`);
  }
});

test('INV-MEDIA-04: uma faixa sem capa no catálogo recebe o desenho padrão, não uma foto externa', () => {
  const track = mapDeezerTrack({ id: 42, title: 'Sem Capa', duration: 180, preview: '', artist: { name: 'Artista' }, album: { title: 'Álbum' } });
  assert.ok(track);
  assert.equal(track.coverUrl, COVER_PLACEHOLDER);
});
