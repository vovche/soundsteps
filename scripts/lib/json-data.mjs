/** Reads and writes the lexicon data files in a diff-friendly layout: one top-level entry per line. */
import fs from 'node:fs';

export function readJSON(path, fallback = undefined) {
  if (!fs.existsSync(path)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing data file: ${path}`);
  }
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

export function writeJSONLines(path, object) {
  const keys = Object.keys(object).sort((a, b) => a.localeCompare(b, 'en'));
  const lines = keys.map(key => `${JSON.stringify(key)}:${JSON.stringify(object[key])}`);
  fs.writeFileSync(path, `{\n${lines.join(',\n')}\n}\n`);
}
