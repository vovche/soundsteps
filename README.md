# SoundSteps

SoundSteps допомагає вчителю англійської зробити аркуш для читання з будь-якого тексту. Редактор працює офлайн, в одному HTML-файлі. На аркуші видно:

- **кольорові склади** в кожному слові;
- **члени речення за схемою SVOMPT** (Subject, Verb, Object, Manner, Place, Time) з питаннями англійською та/або українською;
- **переклад при наведенні** і **словникову картку** слова: склади з наголосом, IPA, переклади, частини мови, етимологія, споріднені українські слова.

Автоматичну розмітку можна виправити вручну. Готовий аркуш друкується, зберігається як HTML або поширюється посиланням чи QR-кодом, а учень відкриває його в режимі перегляду.

## Як користуватися

Зберіть файл і відкрийте `index.html` у браузері. Сервер не потрібен:

```bash
npm run build   # src/index.html + data/*.json + vendor/*.js → index.html
```

`index.html` генерується і в git не зберігається. Для розробки можна відкрити й `src/index.html` напряму: застосунок працюватиме, але без вбудованих словників.

- **Текст** — вставте англійський текст і натисніть «Оновити розмітку».
- **Ручне редагування** — клік вибирає слово, Shift+клік вибирає діапазон, далі призначте роль або введіть переклад. Подвійний клік відкриває словникову картку.
- **Поширення** — «Поділитися» записує текст, налаштування й ручні правки в адресу після `#lesson=`. На сервер ці дані не надсилаються. Для посилання, яке працюватиме на телефонах учнів, сторінка має бути опублікована, наприклад на GitHub Pages. Коли файл відкрито локально, адресу публікації треба вказати у вікні поширення.
- **Чернетка** зберігається в `localStorage` браузера.

## Структура

| Шлях | Призначення |
| --- | --- |
| `src/index.html` | Інтерфейс: розмітка, стилі й логіка редактора з заглушками для даних |
| `src/analyzer.js` | Аналіз тексту без DOM: речення, склади, переклади, розмітка SVOMPT |
| `data/*.json` | Словникові дані, по одному слову на рядок, щоб diff було зручно читати |
| `vendor/` | Сторонні бібліотеки, які вбудовуються в збірку |
| `scripts/build-html.mjs` | Збирає офлайновий `index.html`: вбудовує `vendor/*.js` і `data/*.json` |
| `index.html` | Результат збірки (у `.gitignore`) |
| `test/` | Тести (`node:test`) |
| `scripts/` | Конвеєр, що будує словникові дані з відкритих джерел |
| `scripts/lib/` | Спільні модулі конвеєра (очищення перекладів, ручні переклади) |
| `sources/` | Завантажені вхідні файли конвеєра (не в git, див. нижче) |

## Тести

```bash
npm test
```

`test/svompt.test.mjs` містить набір речень з очікуваною розміткою SVOMPT. Якщо змінюєте правила в `src/analyzer.js`, додайте туди речення, яке показує зміну.

## Перебудова словника

Потрібен Node.js 22+. Вхідні файли покладіть у `sources/`:

| Файл | Джерело |
| --- | --- |
| `NGSL-GR.csv` | NGSL-GR 1.0 (New General Service List for Graded Readers), newgeneralservicelist.com; використовується топ-3000 |
| `NDL.csv` | NDL 1.1 (New Dolch List), там само |
| `NAWL.txt` | NAWL 1.2 (New Academic Word List), там само; одне слово на рядок |
| `cmudict-index.js` | `index.js` з npm-пакета [`cmu-pronouncing-dictionary`](https://www.npmjs.com/package/cmu-pronouncing-dictionary) |
| `syllables.txt` | Поділ на склади з public-domain словника (Webster, Project Gutenberg): `syl;la;ble` на рядок. Точне джерело файлу ще треба задокументувати |
| `hyph_en_US.dic` | Шаблони переносів en_US з LibreOffice (запасний варіант) |

Потім виконайте команди по черзі:

```bash
npm run wordlist          # sources/school-wordlist.csv
npm run fetch:wiktionary  # sources/wiktionary-cards.json (English Wiktionary API, кілька хвилин)
npm run fetch:wikidata    # sources/wikidata-uk.tsv (Wikidata API)
npm run lexicon           # склади, наголоси, IPA → data/phonetic-lexicon.json, data/pronunciation.json
npm run cards             # переклади, частини мови, етимологія → data/dictionary-cards.json
npm run build             # index.html
```

`build-dictionary-cards.mjs` зберігає переклади, які вже є в `data/dictionary-cards.json`, і доповнює їх ручними (`MANUAL`, `scripts/lib/manual-translations-extra.mjs`). Мітки Wikidata беруться лише тоді, коли інших перекладів немає. Усі списки проходять через `scripts/lib/translations.mjs`, який відкидає латиницю, назви статей і дублікати.

## Джерела даних і ліцензії

- **NGSL-GR, NDL, NAWL** — Charles Browne, Brent Culligan та співавтори; CC BY-SA 4.0 (перевірте умови на сайті списків).
- **CMU Pronouncing Dictionary** — Carnegie Mellon University; BSD-подібна ліцензія.
- **English Wiktionary** — переклади, частини мови й етимологія; CC BY-SA 4.0.
- **Wikidata** — українські мітки; CC0.
- **qrcode-generator 1.4.4** — Kazuhiko Arase; MIT, `vendor/qrcode-generator.min.js`.

Словникові дані походять з Wiktionary і списків NGSL (CC BY-SA 4.0), тому при поширенні `index.html` разом із цими даними потрібно зберегти атрибуцію й поширювати **дані** на умовах CC BY-SA 4.0. Атрибуція вже є в інтерфейсі («Дані: …» і підвал словникової картки). Ліцензію для власного коду ще не обрано.
