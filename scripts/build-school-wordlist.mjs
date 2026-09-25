#!/usr/bin/env node
/** Build the union used by SoundSteps: NGSL-GR top 3000 + NDL 1.1 + NAWL 1.2. */
import fs from 'node:fs';
import path from 'node:path';
import { requireInputs } from './lib/inputs.mjs';

const [gradedReaderPath, ndlPath, nawlPath, outputPath] = process.argv.slice(2);
if (![gradedReaderPath, ndlPath, nawlPath, outputPath].every(Boolean)) {
  throw new Error('Usage: node build-school-wordlist.mjs NGSL-GR.csv NDL.csv NAWL.txt output.csv');
}
requireInputs({ 'NGSL-GR': gradedReaderPath, NDL: ndlPath, NAWL: nawlPath });
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const simple = value => String(value || '').trim().toLowerCase().match(/^[a-z]+$/)?.[0] || null;
const gradedReader = fs.readFileSync(gradedReaderPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1)
  .map(line => simple(line.split(',')[1])).filter(Boolean).slice(0, 3000);
const ndl = fs.readFileSync(ndlPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1)
  .map(line => simple(line.split(',')[1])).filter(Boolean);
const nawl = fs.readFileSync(nawlPath, 'utf8').split(/\r?\n/).map(simple).filter(Boolean);

const words = [...new Set([...gradedReader, ...ndl, ...nawl])];
fs.writeFileSync(outputPath, `Word\n${words.join('\n')}\n`);
console.log(`Built ${words.length} unique words: ${gradedReader.length} NGSL-GR core + ${ndl.length} NDL + ${nawl.length} NAWL.`);
