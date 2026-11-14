#!/usr/bin/env node
// Checks every translation in src/i18n/locales against en.json: same keys, same
// {placeholders}, the plural forms each language needs, and lists of the same length.
//   node scripts/i18n-check.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');
const en = JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8'));
const isPlural = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'other' in v && 'one' in v;
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

let problems = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json').sort()) {
  const lang = file.replace('.json', '');
  const tr = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const needed = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
  const errs = [];
  const walk = (a, b, path) => {
    if (b === undefined) return errs.push(`missing ${path}`);
    if (typeof a === 'string') {
      if (typeof b !== 'string' || !b.trim()) return errs.push(`empty or wrong type: ${path}`);
      if (vars(a) !== vars(b)) errs.push(`placeholders differ at ${path}: {${vars(a)}} vs {${vars(b)}}`);
    } else if (Array.isArray(a)) {
      if (!Array.isArray(b) || b.length !== a.length) return errs.push(`list length differs at ${path}`);
      a.forEach((item, i) => walk(item, b[i], `${path}[${i}]`));
    } else if (isPlural(a)) {
      for (const cat of needed) if (typeof b[cat] !== 'string' || !b[cat].trim()) errs.push(`plural "${cat}" missing or empty at ${path}`);
      for (const [cat, v] of Object.entries(b)) if (vars(v).replace('count,', '').replace('count', '') !== vars(a.other).replace('count,', '').replace('count', '')) errs.push(`placeholders differ at ${path}.${cat}`);
    } else {
      for (const k of Object.keys(a)) walk(a[k], b?.[k], path ? `${path}.${k}` : k);
      for (const k of Object.keys(b ?? {})) if (!(k in a)) errs.push(`extra key ${path ? `${path}.` : ''}${k}`);
    }
  };
  walk(en, tr, '');
  if (errs.length) {
    problems += errs.length;
    console.log(`${lang}: ${errs.length} problem(s)`);
    for (const e of errs.slice(0, 20)) console.log(`  - ${e}`);
  } else console.log(`${lang}: ok`);
}
process.exit(problems ? 1 : 0);
