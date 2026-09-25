/** Shared clean-up for Ukrainian translation lists taken from Wiktionary, Wikidata and manual sources. */

const stripAccents = value => value.normalize('NFD').replace(/[̀́]/g, '').normalize('NFC');
const hasCyrillic = value => /[А-Яа-яЄєІіЇїҐґ]/.test(value);

/**
 * Returns a cleaned, de-duplicated list of translations:
 * - drops values without Cyrillic letters ("Read", "IN") and disambiguation titles ("Tomorrow (пісня …)");
 * - drops bare affixes ("-ати") unless nothing else is left;
 * - drops capitalised values when lowercase ones exist (encyclopedia titles such as "Двокрилі");
 * - merges case/stress variants ("Субота", "субота", "субо́та"), preferring the lowercase, stressed form.
 */
export function cleanTranslations(values, limit = 8) {
  const candidates = values
    .map(value => String(value || '').trim().replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter(value => hasCyrillic(value) && !value.includes('('));
  const words = candidates.filter(value => !/^-|-$/.test(value));
  const pool = words.length ? words : candidates;

  const byKey = new Map();
  for (const value of pool) {
    const key = stripAccents(value).toLowerCase();
    const current = byKey.get(key);
    if (!current) { byKey.set(key, value); continue; }
    const score = item => (item === item.toLowerCase() ? 2 : 0) + (item !== stripAccents(item) ? 1 : 0);
    if (score(value) > score(current)) byKey.set(key, value);
  }
  let result = [...byKey.values()];
  // Capitalised values next to lowercase ones are almost always encyclopedia titles ("Он", "ІТ", "Двокрилі").
  if (result.some(value => value[0] === value[0].toLowerCase())) result = result.filter(value => value[0] === value[0].toLowerCase());
  return result.slice(0, limit);
}
