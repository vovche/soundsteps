/*
 * SoundSteps text analyzer: sentence splitting, tokens, syllables, translations and SVOMPT roles.
 * Pure functions with no DOM access. Inlined into index.html by scripts/build-html.mjs and loaded
 * directly by the Node tests (test/*.test.mjs).
 */
(function (root) {
  'use strict';

  function createAnalyzer({ PHONETIC_LEXICON = {}, DICTIONARY_CARDS = {} } = {}) {
    // Short, context-friendly tooltip translations (including inflected forms such as "feeds" → "годує").
    // They take priority over DICTIONARY_CARDS, whose first senses are often too broad for a tooltip.
    const CURATED_TRANSLATIONS = {
      every: 'кожен', saturday: 'субота', my: 'мій', younger: 'молодший', brother: 'брат', carefully: 'обережно', feeds: 'годує', feed: 'годувати', the: 'означений артикль', ducks: 'качки', near: 'біля', our: 'наш', house: 'будинок', after: 'після', breakfast: 'сніданок', we: 'ми', often: 'часто', walk: 'гуляти / йти', to: 'до', quiet: 'тихий', park: 'парк', together: 'разом', last: 'минулий', week: 'тиждень', he: 'він', brought: 'приніс', some: 'дещо / деякі', fresh: 'свіжий', bread: 'хліб', for: 'для', them: 'їм', i: 'я', you: 'ти / ви', she: 'вона', it: 'воно', they: 'вони', read: 'читати', write: 'писати', school: 'школа', teacher: 'вчитель / вчителька', student: 'учень / учениця', morning: 'ранок', evening: 'вечір', yesterday: 'вчора', today: 'сьогодні', tomorrow: 'завтра', quickly: 'швидко', slowly: 'повільно', always: 'завжди', sometimes: 'іноді', never: 'ніколи', in: 'у / в', on: 'на', at: 'біля / о', under: 'під', behind: 'за', with: 'з', and: 'і', but: 'але', is: 'є', are: 'є', was: 'був / була', were: 'були', has: 'має', have: 'мати', can: 'могти'
    };

    const SYLLABLE_EXCEPTIONS = {
      every: ['ev','er','y'], saturday: ['Sat','ur','day'], younger: ['young','er'], carefully: ['care','ful','ly'], feeds: ['feeds'], ducks: ['ducks'], house: ['house'], breakfast: ['break','fast'], often: ['of','ten'], quiet: ['qui','et'], together: ['to','geth','er'], brought: ['brought'], some: ['some'], fresh: ['fresh'], bread: ['bread'], teacher: ['teach','er'], student: ['stu','dent'], people: ['peo','ple'], family: ['fam','i','ly'], beautiful: ['beau','ti','ful'], interesting: ['in','ter','est','ing'], favourite: ['fa','vour','ite'], different: ['dif','fer','ent'], evening: ['eve','ning'], morning: ['morn','ing'], little: ['lit','tle'], english: ['Eng','lish'], language: ['lan','guage'], school: ['school'], write: ['write'], read: ['read'], walked: ['walked'], watched: ['watched']
    };

    const SUBJECTS = new Set(['i','you','he','she','it','we','they','this','that','these','those','who','everyone','everybody','someone','somebody','nobody','anyone']);
    const AUX = new Set([
      'am','is','are','was','were','be','been','being','do','does','did','have','has','had',
      'can','could','will','would','shall','should','may','might','must','cannot',
      "don't","doesn't","didn't","isn't","aren't","wasn't","weren't","can't","couldn't","won't",
      "wouldn't","shouldn't","haven't","hasn't","hadn't","mustn't"
    ]);
    // Base forms of frequent verbs. Inflected forms are generated below; irregular pasts are listed separately.
    const BASE_VERBS = ('go come walk run read write eat drink play study learn like love hate make take bring feed see watch look help live work ' +
      'speak say tell talk give get buy sell pay find lose keep put set let send spend meet leave stay visit travel fly drive ride swim ' +
      'sing dance draw paint cook clean wash open close start begin finish stop wait want need know think feel hear listen understand ' +
      'remember forget teach sit stand sleep wake grow build break fall win carry catch throw hold wear use try call ask answer ' +
      'show move turn change enjoy prefer hope plan decide agree explain describe choose follow arrive return climb jump laugh cry smile ' +
      'shout sleep rest relax practise practice check fix mend repair borrow lend share spell count collect order print type ' +
      'join invite marry cut hit shut hurt cost fight become seem mean sleep dream fill miss hurry happen belong bake boil fry ' +
      'feed grow plant pick water pull push kick lie lay hide seek shine rise sit lead teach wish worry believe cross drop fetch ' +
      'improve prepare produce protect provide receive reach reduce save serve solve support touch trust visit vote warn ' +
      'add allow appear become bring celebrate compare complete continue create deliver develop discover discuss enter ' +
      'exercise feed hang imagine include introduce invent kiss knock mark mix note notice offer pack pass pray promise ' +
      'rain snow shop skate ski surf taste smell sound train translate paint pour post reply repeat review rush score sew shake ' +
      'shave shower sign sink ski slide smoke sneeze sort speed spill spread steal sting stir stretch sweep swing tear test thank ' +
      'tidy tie trip wander wave weigh whisper wonder wrap yawn yell').split(/\s+/);
    const IRREGULAR_VERBS = {
      be:['was','were','been'], go:['went','gone'], come:['came'], run:['ran'], read:[], write:['wrote','written'], eat:['ate','eaten'],
      drink:['drank','drunk'], make:['made'], take:['took','taken'], bring:['brought'], feed:['fed'], see:['saw','seen'], speak:['spoke','spoken'],
      say:['said'], tell:['told'], give:['gave','given'], get:['got','gotten'], buy:['bought'], sell:['sold'], pay:['paid'], find:['found'],
      lose:['lost'], keep:['kept'], put:[], set:[], let:[], send:['sent'], spend:['spent'], meet:['met'], leave:['left'], fly:['flew','flown'],
      drive:['drove','driven'], ride:['rode','ridden'], swim:['swam','swum'], sing:['sang','sung'], draw:['drew','drawn'], begin:['began','begun'],
      know:['knew','known'], think:['thought'], feel:['felt'], hear:['heard'], understand:['understood'], forget:['forgot','forgotten'],
      teach:['taught'], sit:['sat'], stand:['stood'], sleep:['slept'], wake:['woke','woken'], grow:['grew','grown'], build:['built'],
      break:['broke','broken'], fall:['fell','fallen'], win:['won'], catch:['caught'], throw:['threw','thrown'], hold:['held'], wear:['wore','worn'],
      become:['became'], mean:['meant'], cut:[], hit:[], shut:[], hurt:[], cost:[], fight:['fought'], lie:['lay','lain'], lay:['laid'],
      hide:['hid','hidden'], seek:['sought'], shine:['shone'], rise:['rose','risen'], lead:['led'], lend:['lent'], choose:['chose','chosen'],
      dream:['dreamt'], hang:['hung'], shake:['shook','shaken'], sink:['sank','sunk'], slide:['slid'], spread:[], steal:['stole','stolen'],
      sting:['stung'], sweep:['swept'], swing:['swung'], tear:['tore','torn'], sew:['sewn'], have:['had'], do:['did','done'], bear:['bore','born']
    };
    function verbForms(base) {
      const forms = [base];
      const consonantY = /[^aeiou]y$/.test(base);
      forms.push(consonantY ? base.slice(0, -1) + 'ies' : /(s|x|z|ch|sh|o)$/.test(base) ? base + 'es' : base + 's');
      const doubled = /^[^aeiou]*[aeiou][bdgklmnprt]$/.test(base) ? base + base.at(-1) : null;
      if (base.endsWith('e')) forms.push(base + 'd', base.slice(0, -1) + 'ing');
      else if (consonantY) forms.push(base.slice(0, -1) + 'ied', base + 'ing');
      else forms.push(base + 'ed', base + 'ing');
      if (base.endsWith('ie')) forms.push(base.slice(0, -2) + 'ying');
      if (doubled) forms.push(doubled + 'ed', doubled + 'ing');
      return forms.concat(IRREGULAR_VERBS[base] || []);
    }
    const VERB_FORMS = new Set([...BASE_VERBS, ...Object.keys(IRREGULAR_VERBS)].flatMap(verbForms));
    // Words that look like verb forms (-ed/-ing/-s) but are nouns or adjectives in typical school texts.
    const NON_VERBS = new Set([
      'morning','evening','thing','things','something','nothing','everything','anything','king','ceiling','building','buildings',
      'wedding','pudding','ring','spring','string','wing','sibling','bed','red','shed','sled','hundred','seed','speed','weed',
      'interesting','boring','exciting','amazing','surprising','tiring','relaxing','annoying','frightening','charming','delicious',
      'interested','bored','excited','tired','surprised','scared','worried','married','pleased','crowded','talented',
      'news','bus','gas','yes','glass','class','grass','dress','address','lens','series','species','always','sometimes','perhaps'
    ]);
    const DETERMINERS = new Set([
      'the','a','an','my','your','his','her','its','our','their','this','that','these','those','some','any','every','each','no',
      'many','much','few','several','all','both','either','neither','another','other','whose','which','what',
      'one','two','three','four','five','six','seven','eight','nine','ten','first','second','third','last','next'
    ]);
    const TIME_WORDS = new Set([
      'today','tomorrow','yesterday','tonight','now','then','later','soon','early','late','already','still','yet','ago','recently','lately',
      'always','often','sometimes','never','usually','rarely','seldom','occasionally','ever','once','twice','finally','eventually',
      'daily','weekly','monthly','yearly','hourly','nightly','morning','afternoon','evening','night','day','days','week','weeks','weekend',
      'month','months','year','years','hour','hours','minute','minutes','moment','o\'clock','noon','midnight','summer','winter','spring',
      'autumn','season','holidays','christmas','easter','birthday',
      'monday','tuesday','wednesday','thursday','friday','saturday','sunday','mondays','tuesdays','wednesdays','thursdays','fridays',
      'saturdays','sundays','january','february','march','april','may','june','july','august','september','october','november','december'
    ]);
    // Determiners that turn a following time noun into a time phrase: "every day", "last week", "next summer".
    const TIME_DETERMINERS = new Set(['every','each','last','next','this','that','all','one','some']);
    // Words that are ambiguous in TIME_WORDS and only count as time when they follow a time determiner or preposition.
    const WEAK_TIME_WORDS = new Set(['may','march','spring','day','days','moment','second','fall']);
    const PLACE_PREPS = new Set(['in','at','on','near','inside','outside','under','above','behind','beside','between','around','to','from','into','onto','across','through','along','over','past','towards','toward','opposite']);
    const TIME_PREPS = new Set(['after','before','during','since','until','till']);
    const MANNER_WORDS = new Set(['together','alone','well','badly','fast','hard','loudly','quietly']);
    // Common -ly words that are not adverbs of manner.
    const LY_NOT_MANNER = new Set([
      'only','family','july','fly','reply','apply','supply','ugly','holy','friendly','lovely','lonely','silly','jelly','belly','italy',
      'rely','likely','unlikely','curly','oily','bully','lily','ally','assembly','butterfly','firefly','anomaly','rally','tally','costly',
      'deadly','elderly','lively','chilly','hilly','smelly','woolly','jolly','early','daily','weekly','monthly','yearly','hourly','nightly',
      'really','nearly','hardly','simply','exactly','especially','probably','certainly','actually','totally','completely','absolutely'
    ]);
    const SUBJECT_CONTRACTION = /^(i|you|he|she|it|we|they|there|that|what|who|where|here)'(m|re|s|ve|ll|d)$/;
    // Time adverbs that stand on their own and end a prepositional phrase: "in the kitchen now".
    const STANDALONE_TIME = new Set(['today','tomorrow','yesterday','tonight','now','then','later','soon','already','still','yet','always','often','sometimes','never','usually','rarely','seldom','ever','recently','lately']);
    const PLACE_ADVERBS = new Set(['here','there','home','abroad','upstairs','downstairs','outside','inside','outdoors','indoors','everywhere','somewhere','nowhere','anywhere','away','back']);
    const NO_ROLE_WORDS = new Set(['please','hello','hi','yes','thanks','oh','well-done']);
    const WH_ROLES = { where:'P', when:'T', how:'M', what:'O', who:'O', whom:'O', which:'O', why:null };

    const normalize = word => word.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, '');

    function cardKeyFor(word) {
      if (DICTIONARY_CARDS[word]) return word;
      const candidates = [];
      if (word.endsWith('ies')) candidates.push(word.slice(0, -3) + 'y');
      if (word.endsWith('ied')) candidates.push(word.slice(0, -3) + 'y');
      if (word.endsWith('es')) candidates.push(word.slice(0, -1), word.slice(0, -2));
      if (word.endsWith('s')) candidates.push(word.slice(0, -1));
      if (word.endsWith('ed')) {
        const stem = word.slice(0, -2);
        candidates.push(word.slice(0, -1), stem);
        if (stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1));
      }
      if (word.endsWith('ing')) {
        const stem = word.slice(0, -3);
        candidates.push(stem, stem + 'e');
        if (stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1));
        if (stem.endsWith('y')) candidates.push(stem.slice(0, -1) + 'ie');
      }
      return candidates.find(candidate => candidate.length >= 3 && DICTIONARY_CARDS[candidate]) || null;
    }

    function dictionaryTranslation(word) {
      const key = cardKeyFor(word);
      return key ? DICTIONARY_CARDS[key]?.t?.slice(0, 3).join(' / ') || '' : '';
    }

    function dictionaryParts(word) {
      if (SYLLABLE_EXCEPTIONS[word]) return { parts: [...SYLLABLE_EXCEPTIONS[word]], source: 'curated' };
      const entry = PHONETIC_LEXICON[word];
      return entry ? { parts: entry.split('/')[0].split('|'), source: 'dictionary' } : null;
    }

    function derivedInflection(word) {
      const base = candidate => dictionaryParts(candidate);
      const valid = parts => parts?.length && parts.join('') === word ? parts : null;
      const appendToLast = (parts, addition) => [...parts.slice(0, -1), parts.at(-1) + addition];

      // Plural nouns and third-person verbs: walks, watches, studies, uses.
      if (word.endsWith('ies') && word.length > 4) {
        const root = word.slice(0, -3) + 'y';
        const found = base(root);
        if (found) {
          const parts = [...found.parts];
          parts[parts.length - 1] = parts.at(-1).slice(0, -1) + 'ies';
          if (valid(parts)) return parts;
        }
      }
      if (word.endsWith('es') && word.length > 3) {
        const root = word.slice(0, -2);
        const found = base(root);
        if (found) {
          const extraSyllable = /(s|x|z|ch|sh)$/.test(root);
          const parts = extraSyllable ? [...found.parts, 'es'] : appendToLast(found.parts, 'es');
          if (valid(parts)) return parts;
        }
      }
      if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
        const root = word.slice(0, -1);
        const found = base(root);
        if (found) {
          let parts;
          if (/(s|x|z|ch|sh|ce|ge|se|ze)$/.test(root)) {
            parts = [...found.parts];
            if (root.endsWith('e')) parts[parts.length - 1] = parts.at(-1).slice(0, -1);
            parts.push('es');
          } else parts = appendToLast(found.parts, 's');
          if (valid(parts)) return parts;
        }
      }

      // Regular past forms: walked, wanted, loved, studied, stopped.
      if (word.endsWith('ied') && word.length > 4) {
        const root = word.slice(0, -3) + 'y';
        const found = base(root);
        if (found) {
          const parts = [...found.parts];
          parts[parts.length - 1] = parts.at(-1).slice(0, -1) + 'ied';
          if (valid(parts)) return parts;
        }
      }
      if (word.endsWith('ed') && word.length > 3) {
        const candidates = [
          { root: word.slice(0, -1), kind: 'final-e' },
          { root: word.slice(0, -2), kind: 'plain' }
        ];
        const stem = word.slice(0, -2);
        if (stem.length > 2 && stem.at(-1) === stem.at(-2)) candidates.push({ root: stem.slice(0, -1), kind: 'double' });
        for (const candidate of candidates) {
          const found = base(candidate.root);
          if (!found) continue;
          const makesSyllable = /(t|d|te|de)$/.test(candidate.root);
          let parts = [...found.parts];
          if (makesSyllable) {
            if (candidate.kind === 'final-e' && candidate.root.endsWith('e')) {
              parts[parts.length - 1] = parts.at(-1).slice(0, -1);
              parts.push('ed');
            } else parts.push('ed');
          } else {
            const addition = candidate.kind === 'final-e' ? 'd' : candidate.kind === 'double' ? stem.at(-1) + 'ed' : 'ed';
            parts = appendToLast(parts, addition);
          }
          if (valid(parts)) return parts;
        }
      }

      // Present participles and gerunds: going, making, running, lying.
      if (word.endsWith('ing') && word.length > 4) {
        const stem = word.slice(0, -3);
        const candidates = [
          { root: stem, kind: 'plain' },
          { root: stem + 'e', kind: 'drop-e' }
        ];
        if (stem.length > 2 && stem.at(-1) === stem.at(-2)) candidates.push({ root: stem.slice(0, -1), kind: 'double' });
        if (stem.endsWith('y')) candidates.push({ root: stem.slice(0, -1) + 'ie', kind: 'ie-to-y' });
        for (const candidate of candidates) {
          const found = base(candidate.root);
          if (!found) continue;
          let parts = [...found.parts];
          if (candidate.kind === 'drop-e') parts[parts.length - 1] = parts.at(-1).slice(0, -1);
          if (candidate.kind === 'ie-to-y') parts[parts.length - 1] = parts.at(-1).slice(0, -2) + 'y';
          parts.push(candidate.kind === 'double' ? stem.at(-1) + 'ing' : 'ing');
          if (valid(parts)) return parts;
        }
      }
      return null;
    }

    function analyzeSyllables(original) {
      const clean = normalize(original);
      if (!clean) return { parts: [original], source: 'heuristic' };
      const direct = dictionaryParts(clean);
      if (direct) return { parts: preserveCase(original, direct.parts), source: direct.source };
      const derived = derivedInflection(clean);
      if (derived) return { parts: preserveCase(original, derived), source: 'derived' };
      if (clean.length < 4) return { parts: [original], source: 'heuristic' };
      let word = clean;
      const groups = [];
      const vowel = ch => /[aeiouy]/.test(ch);
      let start = 0;
      for (let i = 1; i < word.length - 1; i++) {
        if (vowel(word[i - 1]) && !vowel(word[i])) {
          let nextVowel = i + 1;
          while (nextVowel < word.length && !vowel(word[nextVowel])) nextVowel++;
          if (nextVowel < word.length) {
            let cut = nextVowel - i > 1 ? i + 1 : i;
            const cluster = word.slice(i, nextVowel);
            if (/^(ch|sh|th|ph|wh|ck|ng|qu|tr|dr|br|cr|fr|gr|pr|st|sp|sk|sl|sm|sn|sw)$/.test(cluster)) cut = i;
            if (cut > start) { groups.push(word.slice(start, cut)); start = cut; }
          }
        }
      }
      groups.push(word.slice(start));
      if (groups.length > 1 && groups.at(-1) === 'e' && !/(le|ye)$/.test(word)) groups[groups.length - 2] += groups.pop();
      if (groups.length > 1 && /^(ed|es)$/.test(groups.at(-1)) && !/(ted|ded|ses|zes|ches|shes)$/.test(word)) groups[groups.length - 2] += groups.pop();
      return { parts: preserveCase(original, groups.filter(Boolean)), source: 'heuristic' };
    }

    function preserveCase(original, parts) {
      const joined = parts.join('');
      if (original === original.toUpperCase()) return parts.map(p => p.toUpperCase());
      if (/^[A-Z]/.test(original)) return parts.map((p, i) => i === 0 ? p[0].toUpperCase() + p.slice(1) : p);
      if (joined.length !== original.length) return [original];
      return parts;
    }

    // Titles never end a sentence; other abbreviations end one only when a capital letter follows.
    const TITLE_ABBREVIATIONS = new Set(['mr','mrs','ms','dr','prof','st','mt','jr','sr','sgt','capt','gen','rev']);
    const OTHER_ABBREVIATIONS = new Set(['etc','e.g','i.e','vs','approx','dept','fig','inc','ltd','co','no','a.m','p.m','jan','feb','apr','aug','sep','sept','oct','nov','dec']);

    function splitSentences(text) {
      const clean = text.replace(/\s+/g, ' ').trim();
      if (!clean) return [];
      const result = [];
      const boundary = /[.!?]+["'”’)\]]*(?=\s|$)/g;
      let start = 0, match;
      while ((match = boundary.exec(clean))) {
        const end = match.index + match[0].length;
        const rest = clean.slice(end).trimStart();
        if (match[0][0] === '.' && rest) {
          const previous = (clean.slice(start, match.index).match(/([A-Za-z]+(?:\.[A-Za-z]+)*)$/) || [])[1] || '';
          const lower = previous.toLowerCase();
          if (TITLE_ABBREVIATIONS.has(lower)) continue;
          if (/^[A-Z]$/.test(previous)) continue; // initials: "J. K. Rowling"
          if (OTHER_ABBREVIATIONS.has(lower) && !/^[A-Z"“'‘(]/.test(rest)) continue;
        }
        result.push(clean.slice(start, end).trim());
        start = end;
      }
      if (start < clean.length) result.push(clean.slice(start).trim());
      return result.filter(Boolean);
    }

    function tokenize(sentence, si) {
      const raw = sentence.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*|\d+(?:[.,]\d+)?|[^\sA-Za-z\d]/g) || [];
      return raw.map((text, wi) => {
        const isNumber = /^\d/.test(text);
        const isWord = /^[A-Za-z]/.test(text) || isNumber;
        const analysis = isWord && !isNumber ? analyzeSyllables(text) : { parts: [text], source: null };
        return { id: `${si}-${wi}`, text, word: isWord, number: isNumber, role: null, translation: '', syllableSource: analysis.source, syllables: analysis.parts };
      });
    }

    function partsOfSpeech(word) {
      const key = cardKeyFor(word);
      return key ? DICTIONARY_CARDS[key]?.p || [] : [];
    }

    // Is this word a verb form in this position? `previous` is the preceding word (normalized) or ''.
    function isVerbAt(word, previous) {
      if (AUX.has(word)) return true;
      if (NON_VERBS.has(word) || TIME_WORDS.has(word) || SUBJECTS.has(word) || DETERMINERS.has(word)) return false;
      if (DETERMINERS.has(previous) || PLACE_PREPS.has(previous) && previous !== 'to') return false;
      if (VERB_FORMS.has(word)) return true;
      const pos = partsOfSpeech(word);
      if (!pos.includes('v')) return false;
      // Words that are also nouns/adjectives only count after a subject-like word.
      if (pos.some(p => p === 'n' || p === 'adj')) return SUBJECTS.has(previous);
      return true;
    }

    function findVerb(tokens, wordIndexes, from = 0) {
      const candidates = wordIndexes.filter(i => i >= from);
      const previousWord = i => {
        const position = wordIndexes.indexOf(i);
        return position > 0 ? normalize(tokens[wordIndexes[position - 1]].text) : '';
      };
      let found = candidates.find(i => isVerbAt(normalize(tokens[i].text), previousWord(i)));
      if (found !== undefined) return found;
      // Last resort: an -s word that follows a noun phrase ("The children plays" is rare; "Mum cooks" is common).
      found = candidates.find(i => i > wordIndexes[0] && /[^s]s$/.test(normalize(tokens[i].text))
        && !DETERMINERS.has(previousWord(i)) && !NON_VERBS.has(normalize(tokens[i].text)));
      return found;
    }

    function isMannerAdverb(word) {
      if (MANNER_WORDS.has(word)) return true;
      if (!/[a-z]{2}ly$/.test(word) || LY_NOT_MANNER.has(word) || TIME_WORDS.has(word)) return false;
      const pos = partsOfSpeech(word);
      return !pos.length || pos.includes('adv');
    }

    function isTimeWord(tokens, wordIndexes, n) {
      const word = normalize(tokens[wordIndexes[n]].text);
      if (!TIME_WORDS.has(word)) return false;
      if (!WEAK_TIME_WORDS.has(word)) return true;
      const previous = n > 0 ? normalize(tokens[wordIndexes[n - 1]].text) : '';
      return TIME_DETERMINERS.has(previous) || TIME_PREPS.has(previous) || ['in','on','at'].includes(previous);
    }

    // Returns the index range of a prepositional phrase: from the preposition up to (not including)
    // punctuation, the main verb, a subject pronoun or another preposition.
    function phraseEnd(tokens, start, stopAt) {
      let end = start + 1;
      for (; end < tokens.length; end++) {
        const token = tokens[end];
        if (/^[,;:.!?]$/.test(token.text) || stopAt.has(end)) break;
        const word = token.word ? normalize(token.text) : '';
        if (word && (SUBJECTS.has(word) || STANDALONE_TIME.has(word) || ['every','last','next'].includes(word) || PLACE_PREPS.has(word) || TIME_PREPS.has(word) || word === 'and' || word === 'but')) break;
      }
      return end;
    }

    function paintRange(tokens, start, end, role) {
      for (let i = start; i < end; i++) if (tokens[i].word) tokens[i].role = role;
    }

    function autoTag(tokens) {
      const wordIndexes = tokens.map((t, i) => t.word ? i : -1).filter(i => i >= 0);
      if (!wordIndexes.length) return;
      const words = wordIndexes.map(i => normalize(tokens[i].text));
      const isQuestion = tokens.at(-1)?.text === '?';

      // 1. Find the verb group.
      let verb = findVerb(tokens, wordIndexes);
      const contraction = wordIndexes.find(i => SUBJECT_CONTRACTION.test(normalize(tokens[i].text)));
      if (contraction !== undefined && (verb === undefined || verb > contraction)) {
        // "I'm reading", "It's cold": the contraction holds the subject and the auxiliary.
        const main = findVerb(tokens, wordIndexes, contraction + 1);
        verb = main !== undefined && main - contraction <= 3 ? main : contraction;
      }
      if (verb === undefined) verb = wordIndexes[Math.min(1, wordIndexes.length - 1)];

      const verbGroup = new Set([verb]);
      const subjectIndexes = new Set();
      const whRole = WH_ROLES[words[0]];
      let inverted = false;
      if (isQuestion && AUX.has(normalize(tokens[verb].text)) && verb <= wordIndexes[1]) {
        // Inverted question: (Wh-) AUX SUBJECT MAIN-VERB …  → "Do you like apples?", "Where does she live?"
        const main = findVerb(tokens, wordIndexes, verb + 1);
        const hasSubjectBetween = main !== undefined && wordIndexes.some(i => i > verb && i < main);
        if (hasSubjectBetween) {
          verbGroup.add(main);
          wordIndexes.forEach(i => { if (i > verb && i < main) subjectIndexes.add(i); });
          verb = main;
          inverted = true;
        }
      }
      // Extend the group with following auxiliaries, "not" and verb forms: "has not finished", "can swim".
      let last = verb;
      for (let n = wordIndexes.indexOf(verb) + 1; n < wordIndexes.length && n <= wordIndexes.indexOf(verb) + 3; n++) {
        const i = wordIndexes[n], word = words[n];
        const previous = normalize(tokens[last].text);
        const afterAux = AUX.has(previous) || previous === 'not' || SUBJECT_CONTRACTION.test(previous);
        if (word === 'not' || AUX.has(word) || (afterAux && !NON_VERBS.has(word) && (VERB_FORMS.has(word) || /(ed|ing|en)$/.test(word)))) {
          verbGroup.add(i); last = i;
        } else break;
      }

      // 2. Core roles: subject before the verb, object after it.
      const firstVerb = Math.min(...verbGroup);
      wordIndexes.forEach(i => {
        if (verbGroup.has(i)) tokens[i].role = 'V';
        else if (subjectIndexes.has(i)) tokens[i].role = 'S';
        else if (i < firstVerb) tokens[i].role = 'S';
        else tokens[i].role = 'O';
      });
      // A contraction keeps the subject role: "I'm reading", and "It's cold" (no separate verb to show).
      if (contraction !== undefined && (!verbGroup.has(contraction) || verbGroup.size === 1)) tokens[contraction].role = 'S';
      wordIndexes.forEach((i, n) => { if (NO_ROLE_WORDS.has(words[n])) tokens[i].role = null; });
      if (inverted && whRole !== undefined && wordIndexes[0] < firstVerb) tokens[wordIndexes[0]].role = whRole || null;

      // 3. Adverbials: time, manner and prepositional phrases.
      const stopAt = new Set(verbGroup);
      for (let n = 0; n < wordIndexes.length; n++) {
        const i = wordIndexes[n], word = words[n];
        if (verbGroup.has(i)) continue;
        if (isTimeWord(tokens, wordIndexes, n)) {
          tokens[i].role = 'T';
          const previous = n > 0 ? words[n - 1] : '';
          if (TIME_DETERMINERS.has(previous) && !verbGroup.has(wordIndexes[n - 1])) tokens[wordIndexes[n - 1]].role = 'T';
          if (word === 'ago') paintRange(tokens, wordIndexes[Math.max(0, n - 2)], i, 'T');
        } else if (isMannerAdverb(word)) tokens[i].role = 'M';
        else if (PLACE_ADVERBS.has(word) && i > firstVerb) tokens[i].role = 'P';

        if (TIME_PREPS.has(word)) paintRange(tokens, i, phraseEnd(tokens, i, stopAt), 'T');
        else if (word === 'by' && /^(bus|car|train|bike|bicycle|plane|taxi|boat|ship|tram|metro|underground|foot|hand|phone|email|post|chance|mistake)$/.test(words[n + 1] || '')) {
          paintRange(tokens, i, phraseEnd(tokens, i, stopAt), 'M');
        } else if (PLACE_PREPS.has(word)) {
          const next = words[n + 1] || '';
          // "to" + verb is an infinitive, not a place: "I want to play".
          if (word === 'to' && next && !DETERMINERS.has(next) && (VERB_FORMS.has(next) || (partsOfSpeech(next).includes('v') && !partsOfSpeech(next).includes('n')))) continue;
          const end = phraseEnd(tokens, i, stopAt);
          const phrase = tokens.slice(i + 1, end);
          const isTime = ['in','on','at','from','to','over','past'].includes(word)
            && phrase.some(token => /^\d/.test(token.text) || (token.word && TIME_WORDS.has(normalize(token.text))));
          paintRange(tokens, i, end, isTime ? 'T' : 'P');
        }
      }

      // 4. A leading adverbial separated by a comma: "Every Saturday, …", "After breakfast, …", "In London, …".
      const comma = tokens.findIndex(t => t.text === ',');
      if (comma > 0 && comma < firstVerb) {
        const lead = tokens.slice(0, comma).filter(t => t.word);
        const leadWords = lead.map(t => normalize(t.text));
        if (leadWords.some(w => TIME_WORDS.has(w)) || TIME_PREPS.has(leadWords[0])) lead.forEach(t => { t.role = 'T'; });
        else if (PLACE_PREPS.has(leadWords[0])) lead.forEach(t => { t.role = 'P'; });
      }

      // "and"/"or" between two parts with the same role joins them: "quickly and clearly".
      for (let n = 1; n < wordIndexes.length - 1; n++) {
        if (!['and','or'].includes(words[n])) continue;
        const before = tokens[wordIndexes[n - 1]].role, after = tokens[wordIndexes[n + 1]].role;
        if (before && before === after) tokens[wordIndexes[n]].role = before;
      }

      tokens.forEach(t => { if (t.word) t.translation = defaultTranslation(t.text); });
    }

    function defaultTranslation(word) {
      const normalized = normalize(word);
      return CURATED_TRANSLATIONS[normalized] || dictionaryTranslation(normalized) || '';
    }


    return {
      normalize, cardKeyFor, dictionaryTranslation, defaultTranslation, partsOfSpeech,
      analyzeSyllables, splitSentences, tokenize, autoTag
    };
  }

  if (typeof module === 'object' && module.exports) module.exports = { createAnalyzer };
  else root.SoundStepsAnalyzer = { createAnalyzer };
})(typeof globalThis !== 'undefined' ? globalThis : this);
