import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roles } from './helpers.mjs';

// Expected SVOMPT markup for typical A1–B1 school sentences.
const cases = [
  ['Every Saturday, my younger brother carefully feeds the ducks near our house.',
    '[T Every Saturday] [S my younger brother] [M carefully] [V feeds] [O the ducks] [P near our house]'],
  ['After breakfast, we often walk to the quiet park together.',
    '[T After breakfast] [S we] [T often] [V walk] [P to the quiet park] [M together]'],
  ['Last week, he brought some fresh bread for them.',
    '[T Last week] [S he] [V brought] [O some fresh bread for them]'],
  // -ing/-ed nouns are not verbs
  ['Every morning, my sister reads a book.', '[T Every morning] [S my sister] [V reads] [O a book]'],
  // verb found via -s fallback / verb list, not the plural noun
  ['His parents enjoy long walks in the forest.', '[S His parents] [V enjoy] [O long walks] [P in the forest]'],
  // "to" + verb is an infinitive, not a place
  ['I want to play football after school.', '[S I] [V want] [O to play football] [T after school]'],
  // on/at + time are T
  ['We met on Monday at 7 o\'clock.', '[S We] [V met] [T on Monday at o\'clock]'],
  ['They live in a small house in May.', '[S They] [V live] [P in a small house] [T in May]'],
  // -ly words that are not manner adverbs
  ['The bird can fly very high.', '[S The bird] [V can fly] [O very high]'],
  ['I\'m reading a friendly letter.', '[S I\'m] [V reading] [O a friendly letter]'],
  ['She speaks English quickly and clearly.', '[S She] [V speaks] [O English] [M quickly and clearly]'],
  // questions, negation, contractions
  ['Do you like apples?', '[V Do] [S you] [V like] [O apples]'],
  ['Where does she live?', '[P Where] [V does] [S she] [V live]'],
  ['Who lives here?', '[S Who] [V lives] [P here]'],
  ['He doesn’t like milk.', '[S He] [V doesn’t like] [O milk]'],
  ['Tom and Anna have not finished their homework yet.', '[S Tom and Anna] [V have not finished] [O their homework] [T yet]'],
  ['It\'s cold today.', '[S It\'s] [O cold] [T today]'],
  // phrases stop at the verb, time adverbs and time determiners
  ['At school we learn English every day.', '[P At school] [S we] [V learn] [O English] [T every day]'],
  ['My mum is cooking dinner in the kitchen now.', '[S My mum] [V is cooking] [O dinner] [P in the kitchen] [T now]'],
  ['Anna and I went to the cinema last Friday.', '[S Anna and I] [V went] [P to the cinema] [T last Friday]'],
  ['Two days ago, they visited their grandmother.', '[T Two days ago] [S they] [V visited] [O their grandmother]'],
  ['She usually goes to school by bus.', '[S She] [T usually] [V goes] [P to school] [M by bus]'],
  ['I was born in May.', '[S I] [V was born] [T in May]'],
  ['Open your books, please.', '[V Open] [O your books] [X please]']
];

for (const [sentence, expected] of cases) {
  test(sentence, () => assert.equal(roles(sentence), expected));
}
