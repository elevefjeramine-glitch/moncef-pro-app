// Vérifie la cohérence des dictionnaires de traductions (src/utils/i18n.tsx).
//
//   node scripts/check-i18n.mjs          → rapport lisible, exit 1 si clés manquantes
//   node scripts/check-i18n.mjs --json   → sortie machine (CI)
//
// Le fichier est écrit ainsi :
//   export const translations = { fr: { a: "A", ... }, en: { ... }, ... };
//   export const t = (lang, key) => translations[lang]?.[key] || translations['fr'][key] || key;
//
// Pas de regex pour délimiter les blocs : les chaînes contiennent des accolades
// ET des apostrophes ("L'Admin"), ce qui casse tout parseur naïf. Le tokenizer ne
// considère un guillemet comme OUVERTURE de chaîne que s'il n'est pas déjà à
// l'intérieur d'une chaîne — c'est ce qui distingue l'apostrophe de L'Admin d'un
// vrai début de chaîne.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N = path.join(ROOT, 'src/utils/i18n.tsx');
const SRC = path.join(ROOT, 'src');
const REF = 'fr';

const txt = fs.readFileSync(I18N, 'utf8');

function makeScanner(s) {
  return function scan(start) {
    let depth = 0;
    let i = start;
    let q = null;
    while (i < s.length) {
      const c = s[i];
      if (q) {
        if (c === '\\') { i += 2; continue; }
        if (c === q) q = null;
      } else {
        if (c === '"' || c === "'" || c === '`') q = c;
        else if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) return i;
        }
      }
      i++;
    }
    return -1;
  };
}

// Clés d'un dictionnaire : `mot:` ou `"mot":` au niveau 1 du bloc. Tout ce qui
// est entre guillemets est sauté (ce sont des valeurs, jamais des clés).
function keysOf(body) {
  const keys = new Set();
  let depth = 0;
  let q = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) {
      if (c === '\\') { i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (depth === 0 && /[A-Za-z_]/.test(c)) {
      // délimiteur réel = premier caractère non-espace avant la clé
      let j = i - 1;
      while (j >= 0 && /[ \t\r]/.test(body[j])) j--;
      const prev = j < 0 ? ',' : body[j];
      if (/[{,\n]/.test(prev)) {
        const m = /^([A-Za-z_]\w*)\s*:/.exec(body.slice(i));
        if (m) {
          keys.add(m[1]);
          i += m[0].length - 1;
        }
      }
    }
  }
  return keys;
}

function extractLangs(src) {
  const out = new Map();
  const scan = makeScanner(src);
  const decl = /export\s+const\s+translations\s*=\s*\{/.exec(src);
  if (!decl) return out;
  const open = src.indexOf('{', decl.index + decl[0].length - 1);
  const close = scan(open);
  const body = src.slice(open + 1, close);
  const subscan = makeScanner(body);
  const re = /(?:^|[,\n])\s*['"]?([A-Za-z_]\w*)['"]?\s*:\s*\{/g;
  let m;
  while ((m = re.exec(body))) {
    const o = body.indexOf('{', m.index + m[0].length - 1);
    const c = subscan(o);
    if (c < 0) continue;
    const keys = keysOf(body.slice(o + 1, c));
    if (keys.size > 5) out.set(m[1], keys);
    re.lastIndex = c;
  }
  return out;
}

const langs = extractLangs(txt);
if (!langs.size) {
  console.error('❌ Aucun dictionnaire de langue détecté — le format de src/utils/i18n.tsx a changé, adapter ce script.');
  process.exit(2);
}
if (!langs.has(REF)) {
  console.error(`❌ Le dictionnaire de référence '${REF}' est absent (${[...langs.keys()].join(', ')}).`);
  process.exit(2);
}

const ref = langs.get(REF);
const report = [];
for (const [name, keys] of langs) {
  report.push({
    lang: name,
    count: keys.size,
    missing: [...ref].filter((k) => !keys.has(k)),
    extra: [...keys].filter((k) => !ref.has(k)),
  });
}

// Clés définies mais jamais lues via t(lang, 'cle') dans le code.
const used = new Set();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p);
    } else if (/\.(ts|tsx|js|jsx)$/.test(e.name) && p !== I18N) {
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/\bt\(\s*[^,()]*,\s*['"]([A-Za-z_]\w*)['"]/g)) used.add(m[1]);
    }
  }
})(SRC);
const dead = [...ref].filter((k) => !used.has(k));
const totalMissing = report.reduce((a, r) => a + r.missing.length, 0);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ref: REF, refCount: ref.size, langs: report, dead }, null, 2));
} else {
  console.log(`Référence : ${REF} (${ref.size} clés) — ${langs.size} langues : ${[...langs.keys()].join(', ')}\n`);
  for (const r of report) {
    console.log(`${r.missing.length ? '⚠️ ' : '✅ '}${r.lang.padEnd(4)} ${String(r.count).padStart(4)} clés | manquantes ${String(r.missing.length).padStart(3)} | en trop ${String(r.extra.length).padStart(3)}`);
    if (r.missing.length) console.log(`      manque : ${r.missing.slice(0, 15).join(', ')}${r.missing.length > 15 ? `, … +${r.missing.length - 15}` : ''}`);
    if (r.extra.length) console.log(`      en trop : ${r.extra.slice(0, 10).join(', ')}`);
  }
  console.log(`\nClés jamais utilisées via t() dans src/ : ${dead.length}${dead.length ? ' (définies mais lues nulle part — certaines peuvent être affichées en dur)' : ''}`);
  if (dead.length) console.log(`  ${dead.slice(0, 40).join(', ')}${dead.length > 40 ? `, … +${dead.length - 40}` : ''}`);
  console.log(`\nTotal clés manquantes : ${totalMissing}`);
}
process.exit(totalMissing ? 1 : 0);
