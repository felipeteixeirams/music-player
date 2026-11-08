import assert from 'node:assert/strict';
import test from 'node:test';
import { dayBefore, summarizeDays } from '../api/_appDays';
import { saoPauloDayOf } from '../src/utils/appDays';

test('INV-ADMIN-03: dayBefore volta dias pelo calendário, inclusive por mês e ano', () => {
  assert.equal(dayBefore('2026-11-08', 1), '2026-11-07');
  assert.equal(dayBefore('2026-03-01', 1), '2026-02-28');
  assert.equal(dayBefore('2026-01-01', 1), '2025-12-31');
  assert.equal(dayBefore('2026-11-08', 0), '2026-11-08');
});

test('INV-ADMIN-03: summarizeDays conta dias distintos em 7 e 30 dias, a última vez e a sequência', () => {
  const today = '2026-11-08';
  const days = ['2026-11-08', '2026-11-07', '2026-11-07', '2026-11-06', '2026-11-02', '2026-10-20', '2026-09-01'];
  const summary = summarizeDays(days, today);
  assert.equal(summary.days7, 4, 'dias 8, 7, 6 e 2 de novembro (a janela de 7 dias vai de 2 a 8; a repetição do dia 7 conta uma vez)');
  assert.equal(summary.days30, 5, 'a janela de 30 dias vai de 10 de outubro a 8 de novembro: entram 20 de outubro, mas não 1 de setembro');
  assert.equal(summary.last, '2026-11-08');
  assert.equal(summary.streak, 3, 'de 8 para trás: 8, 7, 6; o 5 falta, então para');
});

test('INV-ADMIN-03: a sequência começa ontem quando hoje ainda não tem abertura, e dias futuros são ignorados', () => {
  const summary = summarizeDays(['2026-11-07', '2026-11-06', '2026-11-09'], '2026-11-08');
  assert.equal(summary.streak, 2);
  assert.equal(summary.last, '2026-11-07', 'o dia futuro não conta');
  assert.equal(summary.days7, 2);
});

test('INV-ADMIN-03: sem nenhum dia, o resumo é zerado e não quebra', () => {
  assert.deepEqual(summarizeDays([], '2026-11-08'), { days7: 0, days30: 0, last: null, streak: 0 });
  assert.deepEqual(summarizeDays(['não é data', '2026-13-40'], '2026-11-08').days30, 0);
});

test('INV-ADMIN-03: o dia gravado pelo app é o dia de São Paulo, não o do fuso do aparelho', () => {
  // 02:30 UTC de 8 de novembro é 23:30 de 7 de novembro em São Paulo
  assert.equal(saoPauloDayOf(Date.parse('2026-11-08T02:30:00Z')), '2026-11-07');
  assert.equal(saoPauloDayOf(Date.parse('2026-11-08T15:00:00Z')), '2026-11-08');
});
