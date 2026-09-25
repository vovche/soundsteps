import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cleanTranslations } from '../scripts/lib/translations.mjs';

test('cleanTranslations drops non-Ukrainian values and encyclopedia titles', () => {
  assert.deepEqual(cleanTranslations(['прочита́ти', 'Read']), ['прочита́ти']);
  assert.deepEqual(cleanTranslations(['Tomorrow (пісня Gouache)', 'завтра']), ['завтра']);
  assert.deepEqual(cleanTranslations(['воно', 'це', 'ІТ']), ['воно', 'це']);
  assert.deepEqual(cleanTranslations(['Субота', 'субота']), ['субота']);
  assert.deepEqual(cleanTranslations(['ранок', 'ра́нок']), ['ра́нок']);
  assert.deepEqual(cleanTranslations(['-ати', '-ти']), ['-ати', '-ти']);
});

test('every dictionary card has at least one Ukrainian translation', () => {
  const cards = createRequire(import.meta.url)('../data/dictionary-cards.json');
  const bad = Object.entries(cards).filter(([, card]) => !card.t?.some(value => /[А-Яа-яЄєІіЇїҐґ]/.test(value)));
  assert.deepEqual(bad.map(([word]) => word), []);
});
