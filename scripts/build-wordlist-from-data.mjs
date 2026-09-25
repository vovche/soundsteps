#!/usr/bin/env node
/**
 * Recreates the school word list from the words already in data/phonetic-lexicon.json.
 * Use it to refresh Wiktionary/Wikidata data when the original NGSL-GR/NDL/NAWL files are not at hand.
 *
 * Usage: node scripts/build-wordlist-from-data.mjs [output.csv]   (default: sources/school-wordlist.csv)
 */
import fs from 'node:fs';
import path from 'node:path';
import { readJSON } from './lib/json-data.mjs';

const outputPath = process.argv[2] || 'sources/school-wordlist.csv';
const words = Object.keys(readJSON('data/phonetic-lexicon.json')).filter(word => /^[a-z]+$/.test(word));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `Word\n${words.join('\n')}\n`);
console.log(`Wrote ${words.length} words from data/phonetic-lexicon.json to ${outputPath}.`);
