#!/usr/bin/env node
/** Fetch source-backed Ukrainian labels via exact English Wikipedia sitelinks in Wikidata. */
import fs from 'node:fs';

const [wordListPath, outputPath] = process.argv.slice(2);
if (!wordListPath || !outputPath) throw new Error('Usage: node fetch-wikidata-labels.mjs words.csv output.tsv');
const lines = fs.readFileSync(wordListPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const words = lines.slice(1).map(line => line.split(',')[0].trim().toLowerCase()).filter(word => /^[a-z]+$/.test(word));
const chunks = [];
for (let i = 0; i < words.length; i += 40) chunks.push(words.slice(i, i + 40));

async function fetchChunk(chunk, attempt = 1) {
  const params = new URLSearchParams({
    action:'wbgetentities', format:'json', sites:'enwiki', titles:chunk.map(word => word[0].toUpperCase() + word.slice(1)).join('|'),
    props:'labels|sitelinks', languages:'uk', languagefallback:'0', sitefilter:'enwiki|ukwiki', redirects:'yes'
  });
  const response = await fetch(`https://www.wikidata.org/w/api.php?${params}`, {
    headers:{ 'User-Agent':'SoundSteps-ESL/1.0 (offline educational lexicon builder)' }
  });
  if (!response.ok) {
    if (attempt < 7 && response.status >= 429) {
      await new Promise(resolve => setTimeout(resolve, attempt * attempt * 1200));
      return fetchChunk(chunk, attempt + 1);
    }
    throw new Error(`Wikidata API ${response.status}`);
  }
  return response.json();
}

const labels = new Map();
let cursor = 0;
let finished = 0;
async function worker() {
  while (cursor < chunks.length) {
    const index = cursor++;
    const data = await fetchChunk(chunks[index]);
    for (const entity of Object.values(data.entities || {})) {
      const enTitle = entity.sitelinks?.enwiki?.title?.toLowerCase();
      const uk = entity.labels?.uk?.value || entity.sitelinks?.ukwiki?.title;
      if (enTitle && uk) labels.set(enTitle, uk.replace(/\s*\(значення\)\s*$/, ''));
    }
    finished++;
    process.stdout.write(`\rFetched labels ${Math.min(finished * 40, words.length)}/${words.length}`);
    await new Promise(resolve => setTimeout(resolve, 120));
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
fs.writeFileSync(outputPath, [...labels].map(([en, uk]) => `${uk}\t${en}`).join('\n') + '\n');
console.log(`\nSaved ${labels.size} Ukrainian labels.`);
