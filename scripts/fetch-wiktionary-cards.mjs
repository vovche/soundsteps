#!/usr/bin/env node
/** Fetch compact, source-backed card data for the combined school lexicon from English Wiktionary. */
import fs from 'node:fs';

const [ngslPath, outputPath] = process.argv.slice(2);
if (!ngslPath || !outputPath) throw new Error('Usage: node fetch-wiktionary-cards.mjs NGSL.csv output.json');

const lines = fs.readFileSync(ngslPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const headers = lines[0].split(',').map(value => value.trim().toLowerCase());
const wordColumn = Math.max(0, headers.findIndex(value => value === 'word' || value === 'lemma'));
const words = lines.slice(1).map(line => line.split(',')[wordColumn]?.trim().toLowerCase()).filter(word => /^[a-z]+$/.test(word));
if (words.length < 3000 || new Set(words).size !== words.length) throw new Error('Expected at least 3000 unique simple words');
const chunks = [];
for (let i = 0; i < words.length; i += 40) chunks.push(words.slice(i, i + 40));

const clean = value => String(value || '')
  .replace(/<!--.*?-->/gs, '')
  .replace(/\{\{(?:l|m|mention)\|[^|}]+\|([^|}]+).*?\}\}/g, '$1')
  .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
  .replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/'''?|\{\{|\}\}/g, '')
  .replace(/&nbsp;|\s+/g, ' ')
  .trim();

function englishSection(source) {
  const match = /^==English==\s*$/m.exec(source);
  if (!match) return '';
  const rest = source.slice(match.index + match[0].length);
  const next = /^==[^=].*?==\s*$/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function parseCard(source) {
  const english = englishSection(source);
  if (!english) return {};
  const translations = [];
  for (const match of english.matchAll(/\{\{(?:t\+?|tt|t-check)\|uk\|([^|}]+)/g)) {
    const value = clean(match[1]);
    if (value && !translations.includes(value)) translations.push(value);
    if (translations.length >= 6) break;
  }

  const etymologies = [...english.matchAll(/^===Etymology(?: \d+)?===\s*$/gm)];
  let etymology = '';
  if (etymologies[0]) {
    const start = etymologies[0].index + etymologies[0][0].length;
    const rest = english.slice(start);
    const next = /^===[^=].*?===\s*$/m.exec(rest);
    etymology = next ? rest.slice(0, next.index) : rest;
  }

  // Keep all machine-readable relations from Wiktionary's own etymology templates.
  // This is deliberately extractive: the builder does not invent an etymology.
  const origins = [];
  const addOrigin = value => {
    if (!value?.length || origins.some(item => JSON.stringify(item) === JSON.stringify(value))) return;
    origins.push(value);
  };
  for (const match of etymology.matchAll(/\{\{(inh\+?|bor\+?|der\+?|lbor|slbor)\|en\|([^|}]+)(?:\|([^|}]+))?/gi)) {
    addOrigin([match[1].replace('+','').toLowerCase(), clean(match[2]), clean(match[3])]);
    if (origins.length >= 8) break;
  }
  for (const match of etymology.matchAll(/\{\{(compound|com|prefix|suffix|affix|confix|blend)\|en\|([^}]+)/gi)) {
    const kind = match[1].toLowerCase() === 'com' ? 'compound' : match[1].toLowerCase();
    const terms = match[2].split('|').filter(value => value && !value.includes('=')).map(clean).filter(Boolean).slice(0, 6);
    if (terms.length) addOrigin([kind, ...terms]);
    if (origins.length >= 8) break;
  }
  for (const match of etymology.matchAll(/\{\{(clipping|back-form|abbreviation|initialism|acronym)\|en\|([^}]+)/gi)) {
    const terms = match[2].split('|').filter(value => value && !value.includes('=')).map(clean).filter(Boolean).slice(0, 4);
    if (terms.length) addOrigin([match[1].toLowerCase(), ...terms]);
    if (origins.length >= 8) break;
  }
  if (!origins.length) {
    const mentioned = [...etymology.matchAll(/\{\{(?:l|m|mention)\|([^|}]+)\|([^|}]+)/gi)].slice(0, 5);
    for (const match of mentioned) addOrigin(['ref', clean(match[1]), clean(match[2])]);
  }
  if (!origins.length && /\b(?:unknown|uncertain)\b/i.test(etymology)) addOrigin(['unknown']);
  if (!origins.length && /onomatopoe/i.test(etymology)) addOrigin(['onom']);

  const cognates = [];
  for (const match of etymology.matchAll(/\{\{cog\|uk\|([^|}]+)/gi)) {
    const value = clean(match[1]);
    if (value && !cognates.includes(value)) cognates.push(value);
    if (cognates.length >= 4) break;
  }

  const posMap = { Noun:'n', Verb:'v', Adjective:'adj', Adverb:'adv', Pronoun:'pron', Preposition:'prep', Conjunction:'conj', Determiner:'det', Article:'art', Interjection:'int', Numeral:'num', Particle:'part' };
  const parts = [];
  for (const match of english.matchAll(/^={3,5}(Noun|Verb|Adjective|Adverb|Pronoun|Preposition|Conjunction|Determiner|Article|Interjection|Numeral|Particle)={3,5}\s*$/gm)) {
    const value = posMap[match[1]];
    if (!parts.includes(value)) parts.push(value);
  }

  const ipaCount = (english.match(/\{\{IPA\|en\|/g) || []).length;
  const card = {};
  if (translations.length) card.t = translations;
  if (origins.length) {
    card.o = origins[0];
    if (origins.length > 1) card.et = origins;
  }
  if (cognates.length) card.c = cognates;
  if (parts.length) card.p = parts;
  if (ipaCount > 1) card.a = ipaCount;
  if (etymologies.length > 1) card.e = etymologies.length;
  return card;
}

async function fetchChunk(chunk, attempt = 1) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
    rvprop: 'content', rvslots: 'main', redirects: '1', titles: chunk.join('|')
  });
  const response = await fetch(`https://en.wiktionary.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'SoundSteps-ESL/1.0 (offline educational lexicon builder)' }
  });
  if (!response.ok) {
    if (attempt < 9 && response.status >= 429) {
      await new Promise(resolve => setTimeout(resolve, Math.min(30000, attempt * attempt * 1800)));
      return fetchChunk(chunk, attempt + 1);
    }
    throw new Error(`Wiktionary API ${response.status}`);
  }
  return response.json();
}

const cards = {};
let cursor = 0;
async function worker() {
  while (cursor < chunks.length) {
    const index = cursor++;
    const data = await fetchChunk(chunks[index]);
    for (const page of data.query?.pages || []) {
      const word = page.title?.toLowerCase();
      const source = page.revisions?.[0]?.slots?.main?.content || '';
      if (word && words.includes(word)) cards[word] = parseCard(source);
    }
    await new Promise(resolve => setTimeout(resolve, 450));
    process.stdout.write(`\rFetched ${Math.min((index + 1) * 40, words.length)}/${words.length}`);
  }
}

await worker();
for (const word of words) if (!cards[word]) cards[word] = {};
fs.writeFileSync(outputPath, JSON.stringify(cards));
const translationCount = Object.values(cards).filter(card => card.t?.length).length;
const etymologyCount = Object.values(cards).filter(card => card.o).length;
const cognateCount = Object.values(cards).filter(card => card.c?.length).length;
console.log(`\nSaved ${words.length} cards: ${translationCount} translations, ${etymologyCount} source-extracted etymologies, ${cognateCount} Ukrainian cognates.`);
