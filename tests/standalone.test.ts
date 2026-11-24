// INV-UI-15: só o app instalado no iPhone ou iPad tira viewport-fit=cover; a folga de baixo vira 34 px e some ao digitar.
import assert from 'node:assert/strict';
import test from 'node:test';
import { isEditableTarget, isIosStandalone, startStandalone, viewportWithoutCover, type StandaloneSignals } from '../src/utils/standalone';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15';
const CONTENT = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

const signals = (overrides: Partial<StandaloneSignals>): StandaloneSignals => ({
  userAgent: IPHONE,
  platform: 'iPhone',
  maxTouchPoints: 5,
  displayStandalone: true,
  navigatorStandalone: false,
  ...overrides
});

test('INV-UI-15: só o app instalado em iPhone ou iPad conta como standalone iOS', () => {
  assert.equal(isIosStandalone(signals({})), true);
  assert.equal(isIosStandalone(signals({ displayStandalone: false, navigatorStandalone: true })), true, 'a marca do próprio Safari também vale');
  assert.equal(isIosStandalone(signals({ displayStandalone: false })), false, 'no Safari comum nada muda');
  assert.equal(isIosStandalone(signals({ userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 })), false, 'Android instalado fica como está');
  assert.equal(isIosStandalone(signals({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })), false, 'Mac instalado fica como está');
  assert.equal(
    isIosStandalone(signals({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })),
    true,
    'iPad que pede site de computador também é iOS'
  );
});

test('INV-UI-15: sai só viewport-fit=cover; o zoom continua travado e as outras partes ficam', () => {
  assert.equal(viewportWithoutCover(CONTENT), 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  assert.equal(viewportWithoutCover('width=device-width'), 'width=device-width');
  assert.equal(viewportWithoutCover(''), '');
});

test('INV-UI-15: só campo de texto conta como edição; o resto não', () => {
  const fake = (matchesSelector: boolean) => ({ matches: (selector: string) => matchesSelector && selector.includes('input') });
  assert.equal(isEditableTarget(fake(true) as unknown as EventTarget), true);
  assert.equal(isEditableTarget(fake(false) as unknown as EventTarget), false);
  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget({} as EventTarget), false);
});

/** A document and window with just what startStandalone reads; focus events are fired by hand. */
function fakePage(options: { userAgent: string; platform: string; maxTouchPoints: number; standalone: boolean }) {
  const attributes = new Map<string, string>();
  const html = {
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
    hasAttribute: (name: string) => attributes.has(name)
  };
  const meta = { content: CONTENT, getAttribute: () => meta.content, setAttribute: (_: string, value: string) => (meta.content = value) };
  const listeners = new Map<string, () => void>();
  const doc = {
    documentElement: html,
    activeElement: null as unknown,
    querySelector: () => meta,
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn)
  };
  const win = {
    navigator: { userAgent: options.userAgent, platform: options.platform, maxTouchPoints: options.maxTouchPoints },
    matchMedia: () => ({ matches: options.standalone }),
    setTimeout: (fn: () => void) => fn()
  };
  return { doc, win, html: attributes, meta, listeners };
}

test('INV-UI-15: no iPhone instalado a página marca data-standalone, tira o cover e marca data-editing ao digitar', () => {
  const page = fakePage({ userAgent: IPHONE, platform: 'iPhone', maxTouchPoints: 5, standalone: true });
  startStandalone(page.doc as unknown as Document, page.win as unknown as Window);
  assert.equal(page.html.has('data-standalone'), true);
  assert.equal(page.meta.content, 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');

  page.doc.activeElement = { matches: () => true };
  page.listeners.get('focusin')?.();
  assert.equal(page.html.has('data-editing'), true);

  page.doc.activeElement = null;
  page.listeners.get('focusout')?.();
  assert.equal(page.html.has('data-editing'), false);
});

test('INV-UI-15: no navegador comum o viewport e o html ficam como estão', () => {
  const page = fakePage({ userAgent: IPHONE, platform: 'iPhone', maxTouchPoints: 5, standalone: false });
  startStandalone(page.doc as unknown as Document, page.win as unknown as Window);
  assert.equal(page.html.has('data-standalone'), false);
  assert.equal(page.meta.content, CONTENT);
  assert.equal(page.listeners.size, 0);
});
