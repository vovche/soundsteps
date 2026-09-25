import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzer } from './helpers.mjs';

test('splitSentences keeps titles, initials, decimals and abbreviations together', () => {
  assert.deepEqual(analyzer.splitSentences('Mr. Smith lives in London. He has 3.5 kilos of apples!'),
    ['Mr. Smith lives in London.', 'He has 3.5 kilos of apples!']);
  assert.deepEqual(analyzer.splitSentences('J. K. Rowling wrote it. We like fruit, e.g. apples. Is it true?'),
    ['J. K. Rowling wrote it.', 'We like fruit, e.g. apples.', 'Is it true?']);
  assert.deepEqual(analyzer.splitSentences('"Hello," she said. "Come in."'), ['"Hello," she said.', '"Come in."']);
  assert.deepEqual(analyzer.splitSentences('  '), []);
});

test('normalize maps curly apostrophes', () => {
  assert.equal(analyzer.normalize('Don’t'), "don't");
});

test('syllables come from the lexicon, derived forms and heuristics', () => {
  assert.deepEqual(analyzer.analyzeSyllables('Saturday').parts, ['Sat', 'ur', 'day']);
  assert.equal(analyzer.analyzeSyllables('together').parts.join(''), 'together');
  const derived = analyzer.analyzeSyllables('wanted');
  assert.equal(derived.parts.join(''), 'wanted');
  assert.ok(['dictionary', 'derived'].includes(derived.source));
});

test('cardKeyFor does not strip -s from short words', () => {
  assert.equal(analyzer.cardKeyFor('is'), null);
  assert.equal(analyzer.cardKeyFor('has'), null);
  assert.equal(analyzer.cardKeyFor('ducks'), 'duck');
  assert.equal(analyzer.defaultTranslation('feeds'), 'годує');
});
