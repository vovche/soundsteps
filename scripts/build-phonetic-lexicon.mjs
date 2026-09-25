#!/usr/bin/env node
/**
 * Builds the embedded ESL lexicon used by index.html.
 *
 * Input 1: combined NGSL-GR/NDL/NAWL school lexicon CSV.
 * Input 2: the ESM index from words/cmu-pronouncing-dictionary.
 * Input 3: public-domain written syllable divisions (semicolon-separated).
 * Input 4: LibreOffice-compatible en_US hyphenation patterns (fallback only).
 *
 * Usage:
 *   node scripts/build-phonetic-lexicon.mjs NGSL.csv cmudict-index.js syllables.txt hyph_en_US.dic index.html
 */
import fs from 'node:fs';

const [ngslPath, cmuPath, writtenPath, hyphenPath, htmlPath] = process.argv.slice(2);
if (![ngslPath, cmuPath, writtenPath, hyphenPath, htmlPath].every(Boolean)) {
  throw new Error('Expected paths: NGSL.csv cmudict-index.js syllables.txt hyph_en_US.dic index.html');
}

const ngslLines = fs.readFileSync(ngslPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const headers = ngslLines[0].split(',').map(value => value.trim().toLowerCase());
const wordColumn = Math.max(0, headers.findIndex(value => value === 'word' || value === 'lemma'));
const words = ngslLines.slice(1).map(line => line.split(',')[wordColumn]?.trim().toLowerCase()).filter(word => /^[a-z]+$/.test(word));
if (words.length < 3000 || new Set(words).size !== words.length) {
  throw new Error(`Expected at least 3000 unique simple lemmas; received ${words.length}`);
}

const cmuSource = fs.readFileSync(cmuPath, 'utf8');
const declaration = cmuSource.indexOf('export const dictionary =');
const objectStart = cmuSource.indexOf('{', declaration);
const objectEnd = cmuSource.lastIndexOf('\n}') + 2;
if (declaration < 0 || objectStart < 0 || objectEnd < 2) throw new Error('Unknown CMU dictionary format');
// The downloaded upstream file contains one object literal and no executable expressions.
const cmu = Function(`"use strict"; return (${cmuSource.slice(objectStart, objectEnd)});`)();

const writtenSyllables = new Map();
for (const line of fs.readFileSync(writtenPath, 'utf8').trim().split(/\r?\n/)) {
  const parts = line.trim().toLowerCase().split(';').filter(Boolean);
  const word = parts.join('');
  if (/^[a-z]+$/.test(word)) writtenSyllables.set(word, parts);
}

const patternBuckets = new Map();
for (const rawLine of fs.readFileSync(hyphenPath, 'utf8').split(/\r?\n/)) {
  const token = rawLine.trim();
  if (!token || /^(UTF-8|LEFTHYPHENMIN|RIGHTHYPHENMIN|NEXTLEVEL)/.test(token) || token.includes('/')) continue;
  const letters = token.replace(/\d/g, '');
  if (!letters) continue;
  const values = Array(letters.length + 1).fill(0);
  let letterIndex = 0;
  for (const char of token) {
    if (/\d/.test(char)) values[letterIndex] = Number(char);
    else letterIndex++;
  }
  const bucket = patternBuckets.get(letters[0]) || [];
  bucket.push({ letters, values });
  patternBuckets.set(letters[0], bucket);
}

const vowel = char => /[aeiouy]/.test(char || '');
const protectedPairs = new Set(['ch','sh','th','ph','wh','ck','ng','qu','ee','oo','ea','ai','ay','oa','oi','oy','au','aw','ew']);
const onsets = new Set(['ch','sh','th','ph','wh','qu','tr','dr','br','cr','fr','gr','pr','st','sp','sk','sl','sm','sn','sw']);
const prefixes = ['anti','auto','inter','over','under','trans','super','pre','pro','con','com','dis','mis','non','out','sub','un','re'];
const suffixes = ['ability','ibility','ation','ition','ology','fully','less','ment','ness','ship','able','ible','ally','ical','tion','sion','ture','ity','ive','ous','ing','est','er','ly','al'];

function texBreaks(word) {
  const padded = `.${word}.`;
  const weights = Array(padded.length + 1).fill(0);
  for (let start = 0; start < padded.length; start++) {
    for (const pattern of patternBuckets.get(padded[start]) || []) {
      if (!padded.startsWith(pattern.letters, start)) continue;
      pattern.values.forEach((value, offset) => {
        weights[start + offset] = Math.max(weights[start + offset], value);
      });
    }
  }
  const breaks = new Set();
  for (let position = 2; position <= word.length - 2; position++) {
    if (weights[position + 1] % 2 === 1) breaks.add(position);
  }
  return breaks;
}

function heuristicBreaks(word) {
  const breaks = new Set();
  for (let i = 1; i < word.length - 1; i++) {
    if (!vowel(word[i - 1]) || vowel(word[i])) continue;
    let nextVowel = i + 1;
    while (nextVowel < word.length && !vowel(word[nextVowel])) nextVowel++;
    if (nextVowel >= word.length) continue;
    const cluster = word.slice(i, nextVowel);
    const cut = onsets.has(cluster) ? i : (nextVowel - i > 1 ? i + 1 : i);
    if (cut > 0 && cut < word.length) breaks.add(cut);
  }
  return breaks;
}

function stressPattern(phones) {
  return (phones.match(/[012]/g) || []).join('');
}

function splitToSyllableCount(word, count) {
  if (count <= 1) return [word];
  const tex = texBreaks(word);
  const heuristic = heuristicBreaks(word);
  const boundaryScore = position => {
    let score = 0;
    if (tex.has(position)) score += 110;
    if (heuristic.has(position)) score += 65;
    if (vowel(word[position - 1]) && vowel(word[position])) score += 28;
    if (prefixes.some(prefix => position === prefix.length && word.startsWith(prefix))) score += 32;
    if (suffixes.some(suffix => position === word.length - suffix.length && word.endsWith(suffix))) score += 32;
    if (protectedPairs.has(word.slice(position - 1, position + 1))) score -= 120;
    if (position === 1 && !/[ai]/.test(word[0])) score -= 28;
    return score;
  };
  const segmentScore = segment => vowel(segment) || /[aeiouy]/.test(segment) ? 0 : -90;

  // Dynamic programming: choose exactly count - 1 written boundaries.
  const dp = Array.from({ length: count + 1 }, () => Array(word.length + 1).fill(null));
  dp[0][0] = { score: 0, cuts: [] };
  for (let parts = 1; parts <= count; parts++) {
    for (let end = parts; end <= word.length; end++) {
      for (let start = parts - 1; start < end; start++) {
        const previous = dp[parts - 1][start];
        if (!previous) continue;
        const isFinal = parts === count;
        if (isFinal !== (end === word.length)) continue;
        const score = previous.score + segmentScore(word.slice(start, end)) + (end < word.length ? boundaryScore(end) : 0);
        if (!dp[parts][end] || score > dp[parts][end].score) {
          dp[parts][end] = { score, cuts: end < word.length ? [...previous.cuts, end] : previous.cuts };
        }
      }
    }
  }
  const cuts = dp[count][word.length]?.cuts;
  if (!cuts || cuts.length !== count - 1) return [word];
  const parts = [];
  let start = 0;
  for (const cut of cuts) { parts.push(word.slice(start, cut)); start = cut; }
  parts.push(word.slice(start));
  return parts;
}

const entries = {};
const pronunciations = {};
let writtenCount = 0;
const manualPronunciations = {
  quadrillion: { parts: ['quad','ril','lion'], stress: '010', ipa: 'kwɑˈdrɪljən' },
  factorial: { parts: ['fac','to','ri','al'], stress: '0100', ipa: 'fækˈtɔriəl' },
  postgraduate: { parts: ['post','grad','u','ate'], stress: '2100', ipa: 'ˌpoʊstˈɡrædʒuət' }
};

const ipaMap = {
  AA:'ɑ', AE:'æ', AH:'ʌ', AO:'ɔ', AW:'aʊ', AY:'aɪ', EH:'ɛ', ER:'ɝ', EY:'eɪ',
  IH:'ɪ', IY:'i', OW:'oʊ', OY:'ɔɪ', UH:'ʊ', UW:'u',
  B:'b', CH:'tʃ', D:'d', DH:'ð', F:'f', G:'ɡ', HH:'h', JH:'dʒ', K:'k', L:'l',
  M:'m', N:'n', NG:'ŋ', P:'p', R:'r', S:'s', SH:'ʃ', T:'t', TH:'θ', V:'v',
  W:'w', Y:'j', Z:'z', ZH:'ʒ'
};

function phonesToIPA(phones) {
  const source = String(phones || '').split(/\s+/).filter(Boolean);
  const vowelCodes = new Set(['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW']);
  const bases = source.map(phone => phone.replace(/[012]$/, ''));
  const vowelIndexes = bases.map((base, index) => vowelCodes.has(base) ? index : -1).filter(index => index >= 0);
  const onsetClusters = new Set(['P,Y','B,Y','F,Y','V,Y','K,Y','G,Y','H,Y','M,Y','N,Y','S,K','S,P','S,T','S,K,R','S,P,R','S,T,R','K,R','G,R','P,R','B,R','T,R','D,R','F,R','TH,R','SH,R','K,L','G,L','P,L','B,L','F,L','S,L','S,M','S,N','S,W']);
  const markers = new Map();
  if (vowelIndexes.length > 1) vowelIndexes.forEach((vowelIndex, syllableIndex) => {
    const stress = source[vowelIndex].match(/[12]$/)?.[0];
    if (!stress) return;
    const previousVowel = syllableIndex ? vowelIndexes[syllableIndex - 1] : -1;
    const cluster = bases.slice(previousVowel + 1, vowelIndex);
    let onsetLength = cluster.length ? 1 : 0;
    for (const length of [3, 2]) {
      if (cluster.length >= length && onsetClusters.has(cluster.slice(-length).join(','))) { onsetLength = length; break; }
    }
    markers.set(vowelIndex - onsetLength, stress === '1' ? 'ˈ' : 'ˌ');
  });
  return source.map((phone, index) => {
    const stress = phone.match(/[012]$/)?.[0];
    const base = bases[index];
    let value = ipaMap[base] || base.toLowerCase();
    if (base === 'AH' && stress === '0') value = 'ə';
    if (base === 'ER' && stress === '0') value = 'ɚ';
    return `${markers.get(index) || ''}${value}`;
  }).join('');
}

const spellingRules = [
  [/tion/, 'tion зазвичай передає /ʃən/'], [/sion/, 'sion часто передає /ʒən/ або /ʃən/'],
  [/tch/, 'tch передає звук /tʃ/'], [/dge/, 'dge передає звук /dʒ/'],
  [/ph/, 'ph читається як /f/'], [/th/, 'th передає /θ/ або /ð/'],
  [/sh/, 'sh передає /ʃ/'], [/ch/, 'ch найчастіше передає /tʃ/, але іноді /k/ або /ʃ/'],
  [/igh/, 'igh зазвичай читається /aɪ/'], [/eigh/, 'eigh часто читається /eɪ/'],
  [/kn/, 'на початку kn літера k не вимовляється'], [/wr/, 'на початку wr літера w не вимовляється'],
  [/mb$/, 'у кінцевому mb літера b часто не вимовляється'], [/gh/, 'gh має змінну вимову й часто є німим'],
  [/qu/, 'qu зазвичай передає /kw/'], [/ee/, 'ee часто передає довгий /iː/'],
  [/ea/, 'ea часто передає /iː/, але має винятки'], [/oo/, 'oo передає /uː/ або /ʊ/'],
  [/oa/, 'oa часто передає /oʊ/'], [/ai/, 'ai часто передає /eɪ/'],
  [/ay/, 'ay наприкінці складу часто передає /eɪ/'], [/oi/, 'oi передає /ɔɪ/'],
  [/oy/, 'oy передає /ɔɪ/'], [/ck/, 'ck після короткого голосного передає /k/'],
  [/c(?=[eiy])/, 'c перед e, i або y часто читається /s/'], [/g(?=[eiy])/, 'g перед e, i або y часто читається /dʒ/'],
  [/e$/, 'кінцева e часто не має окремого звука']
];

function spellingHints(word, parts) {
  const hints = [];
  for (const [pattern, hint] of spellingRules) {
    if (pattern.test(word) && !hints.includes(hint)) hints.push(hint);
    if (hints.length === 2) break;
  }
  if (parts.length > 1) hints.push(`Запам’ятай частинами: ${parts.join(' · ')}`);
  return hints.slice(0, 3);
}
for (const word of words) {
  const phones = cmu[word];
  const manual = manualPronunciations[word];
  if (!phones && !manual) throw new Error(`CMUdict has no primary pronunciation for NGSL lemma: ${word}`);
  const stress = manual?.stress || stressPattern(phones);
  const written = writtenSyllables.get(word);
  const parts = written || manual?.parts || splitToSyllableCount(word, stress.length);
  if (written) writtenCount++;
  if (!parts.length || parts.join('') !== word) throw new Error(`Invalid split for ${word}`);
  entries[word] = `${parts.join('|')}/${stress}`;
  pronunciations[word] = [manual?.ipa || phonesToIPA(phones), spellingHints(word, parts)];
}

const rows = Object.entries(entries).map(([word, value]) => `${JSON.stringify(word)}:${JSON.stringify(value)}`);
const lexicon = `const PHONETIC_LEXICON = {${rows.join(',')}};`;
const pronunciationData = `const PRONUNCIATION_DATA = ${JSON.stringify(pronunciations)};`;
const startMarker = '/* PHONETIC_LEXICON_START */';
const endMarker = '/* PHONETIC_LEXICON_END */';
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker);
if (start < 0 || end < start) throw new Error('Lexicon markers not found in HTML');
const updated = `${html.slice(0, start + startMarker.length)}\n      ${lexicon}\n      ${pronunciationData}\n      ${html.slice(end)}`;
fs.writeFileSync(htmlPath, updated);
console.log(`Embedded ${Object.keys(entries).length} NGSL-GR/CMU entries (${writtenCount} written-dictionary splits, ${words.length - writtenCount} phonetic fallbacks; ${Buffer.byteLength(lexicon)} bytes).`);
