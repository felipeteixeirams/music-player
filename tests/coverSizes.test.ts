import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// INV-MEDIA-03: the small cover images ask for the size they show, so a 36 px thumbnail does not load the 500 px cover
const SMALL = ['MiniPlayer', 'TrackCarousel', 'AddToPlaylistSheet', 'ArtistAlbumActionSheet', 'SmartPlaylistSheet'];

test('INV-MEDIA-03: as capas pequenas passam sizes ao RemoteImage, para o navegador escolher a versão do tamanho certo', () => {
  for (const name of SMALL) {
    const source = readFileSync(`src/components/${name}.tsx`, 'utf8');
    const blocks = source.match(/<RemoteImage[^>]*>/gs) ?? [];
    assert.ok(blocks.length > 0, `${name} tem uma RemoteImage`);
    assert.ok(blocks.some((block) => /\ssizes="[^"]+"/.test(block)), `${name} passa sizes`);
  }
});
