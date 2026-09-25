import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createAnalyzer } = require('../src/analyzer.js');

export const analyzer = createAnalyzer({
  PHONETIC_LEXICON: require('../data/phonetic-lexicon.json'),
  DICTIONARY_CARDS: require('../data/dictionary-cards.json')
});

/** Tags one sentence and returns its role groups as "[S my brother] [V feeds] …" (punctuation omitted). */
export function roles(sentence) {
  const tokens = analyzer.tokenize(sentence, 0);
  analyzer.autoTag(tokens);
  const groups = [];
  for (const token of tokens.filter(t => t.word)) {
    const role = token.role || 'X';
    const last = groups.at(-1);
    if (last?.role === role) last.words.push(token.text);
    else groups.push({ role, words: [token.text] });
  }
  return groups.map(group => `[${group.role} ${group.words.join(' ')}]`).join(' ');
}
