// Garantias da auditoria de desempenho (docs/specs/current/performance-audit.spec.md): INV-PERF-01 a 04.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { budget, JS_GZIP_BUDGET_KB } from '../scripts/check-bundle.mjs';
import { createStallCounter, STALL_THRESHOLD_MS, STALL_WATCH_MS } from '../src/utils/stallWatch';
import { deezerCoverAtSize, DEEZER_COVER_SIZES } from '../src/utils/imageProxy';

const DEEZER = 'https://e-cdns-images.dzcdn.net/images/cover/abc123/500x500-000000-80-0-0.jpg';

test('INV-PERF-01: a capa da Deezer troca de tamanho no caminho e nas outras URLs não', () => {
  assert.equal(deezerCoverAtSize(DEEZER, 250), 'https://e-cdns-images.dzcdn.net/images/cover/abc123/250x250-000000-80-0-0.jpg');
  assert.equal(deezerCoverAtSize(DEEZER, 56), 'https://e-cdns-images.dzcdn.net/images/cover/abc123/56x56-000000-80-0-0.jpg');
  assert.deepEqual([...DEEZER_COVER_SIZES], [56, 120, 250, 500]);
  // Capas da Apple têm outro formato: ficam como estão (sem srcset)
  assert.equal(deezerCoverAtSize('https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg', 250), undefined);
  // Nunca reescreve um endereço que não é da Deezer nem é https
  assert.equal(deezerCoverAtSize('https://evil.example/images/cover/abc/500x500-x.jpg', 250), undefined);
  assert.equal(deezerCoverAtSize('http://e-cdns-images.dzcdn.net/images/cover/abc/500x500-x.jpg', 250), undefined);
  assert.equal(deezerCoverAtSize(undefined, 250), undefined);
});

test('INV-PERF-02: a contagem de travadas só olha o primeiro minuto, com a página visível', () => {
  const counter = createStallCounter(0);
  counter.frame(16, true); // quadro normal
  counter.frame(16 + STALL_THRESHOLD_MS + 30, true); // travou 80 ms
  counter.frame(500, false); // escondida: não conta
  counter.restart(900);
  counter.frame(950, true); // primeiro quadro depois de voltar: 50 ms, não passa do limite
  counter.frame(STALL_WATCH_MS + 5000, true); // depois do primeiro minuto: não conta
  assert.deepEqual(counter.summary(), { count: 1, worstMs: 80 });
});

test('INV-PERF-03: o orçamento de JavaScript do build reprova um bloco acima do limite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'budget-'));
  mkdirSync(join(dir, 'assets'));
  // Texto repetido comprime muito: 2 MB viram poucos kB
  writeFileSync(join(dir, 'assets', 'index-a.js'), 'console.log(1);'.repeat(200_000));
  assert.equal(budget(dir, JS_GZIP_BUDGET_KB).length, 0, 'abaixo do limite passa');
  const problems = budget(dir, 1);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /orçamento de 1 kB/);
});

test('INV-PERF-04: a configuração de cache distingue arquivos com hash dos que mudam a cada deploy', () => {
  const vercel = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'vercel.json'), 'utf8'));
  const headers = vercel.headers as { source: string; headers: { key: string; value: string }[] }[];
  const assets = headers.find((rule) => rule.source === '/assets/(.*)');
  assert.ok(assets, 'os arquivos de /assets têm regra de cache');
  assert.equal(assets.headers[0].value, 'public, max-age=31536000, immutable');
  // A casca, o service worker e version.json pedem revalidação a cada abertura (é assim que um deploy chega)
  for (const path of ['/', '/index.html', '/sw.js', '/version.json']) {
    const rule = headers.find((item) => item.source === path);
    assert.ok(rule, `${path} pede revalidação`);
    assert.equal(rule.headers[0].value, 'no-cache');
  }
  assert.doesNotMatch(assets.source, /index\.html|sw\.js|version\.json/);
});
