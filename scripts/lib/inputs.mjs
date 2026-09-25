/** Fails early with a readable message when pipeline input files are missing. */
import fs from 'node:fs';

export function requireInputs(inputs) {
  const missing = Object.entries(inputs).filter(([, path]) => !path || !fs.existsSync(path));
  if (!missing.length) return;
  const lines = missing.map(([name, path]) => `  - ${name}: ${path || '(шлях не вказано)'}`);
  console.error(`Бракує вхідних файлів:\n${lines.join('\n')}\n\nДив. розділ «Перебудова словника» в README.md.`
    + ' Якщо оригінальних списків NGSL немає, список слів можна отримати з поточних даних: npm run wordlist:from-data');
  process.exit(1);
}
