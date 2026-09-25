import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('build-html inlines scripts and data', () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'soundsteps-')), 'index.html');
  execFileSync(process.execPath, ['scripts/build-html.mjs', output], { stdio: 'pipe' });
  const html = fs.readFileSync(output, 'utf8');
  assert.ok(!html.includes('@json'));
  assert.ok(!html.includes('src="../'));
  assert.match(html, /var qrcode=function/);
  assert.match(html, /SoundStepsAnalyzer/);
  assert.match(html, /const DICTIONARY_CARDS = \{"a":/);
});
