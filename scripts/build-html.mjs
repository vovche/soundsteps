#!/usr/bin/env node
/**
 * Builds the single-file, offline index.html from src/index.html:
 *   <script src="../vendor/x.js"></script>   → the script inlined
 *   /* @json data/x.json *\/ {}              → the JSON inlined
 *
 * Usage: node scripts/build-html.mjs [output.html]   (default: index.html)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.resolve(root, process.argv[2] || 'index.html');
let html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');

const safeScript = text => text.replace(/<\/script/gi, '<\\/script');
let scripts = 0, datasets = 0;

html = html.replace(/<script src="\.\.\/((?:vendor|src)\/[\w.\/-]+\.js)"><\/script>/g, (_, file) => {
  scripts++;
  return `<script>${safeScript(fs.readFileSync(path.join(root, file), 'utf8').trim())}</script>`;
});
html = html.replace(/\/\* @json ([\w.\/-]+\.json) \*\/ \{\}/g, (_, file) => {
  datasets++;
  const data = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  return safeScript(JSON.stringify(data));
});
if (/@json |src="\.\.\//.test(html)) throw new Error('Unresolved placeholder left in the output');

fs.writeFileSync(outputPath, html);
console.log(`Built ${path.relative(root, outputPath)}: ${scripts} scripts, ${datasets} datasets, ${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB.`);
