/*
 * SPDX-FileCopyrightText: 2026 Stalwart WebUI RU contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * No external dependencies. Validates the Russian catalogue against en.json.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8'));
const ru = JSON.parse(readFileSync(new URL('../src/i18n/ru.json', import.meta.url), 'utf8'));

function flatten(node, prefix = '', result = {}) {
  for (const [key, value] of Object.entries(node)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result[fullKey] = value;
    else if (value !== null && typeof value === 'object' && !Array.isArray(value)) flatten(value, fullKey, result);
    else throw new Error(`Unsupported catalogue value: ${fullKey}`);
  }
  return result;
}

function markers(text) {
  return [...text.matchAll(/{{\s*[^{}]+\s*}}/g)].map((match) => match[0]).sort().join('|');
}
function tags(text) {
  return [...text.matchAll(/<\/?[A-Za-z][^>]*>/g)].map((match) => match[0]).sort().join('|');
}

const source = flatten(en);
const target = flatten(ru);
const errors = [];
// Keep fork-owned client keys in one top-level namespace. The pin is the
// upstream en.json Git blob at WebUI 2.1.0 (1a595c2121a2b70bbb1b6d23cad64524ead9575c).
// Change it only as part of a reviewed upstream upgrade.
const upstreamEn = { ...en };
delete upstreamEn.webuiRu;
const upstreamBytes = Buffer.from(JSON.stringify(upstreamEn, null, 2) + '\n', 'utf8');
const upstreamBlob = createHash('sha1').update('blob ' + upstreamBytes.length + '\0').update(upstreamBytes).digest('hex');
if (upstreamBlob !== '3f8e0e4c64b113677da8b51ebee8e7dae0f59cad') {
  errors.push('English catalogue outside webuiRu differs from the pinned upstream blob; review the upstream pin or move fork keys under webuiRu.');
}
const legacyForkKeys = [
  "actions.updateAppsScopeWarning",
  "actions.negativeCacheExplanation",
  "field.selectPermissions",
  "list.showingRange",
  "interfaceLanguage",
  "logs.noTracersConfigured"
];
for (const key of legacyForkKeys) {
  if (!Object.hasOwn(source, 'webuiRu.' + key) || !Object.hasOwn(target, 'webuiRu.' + key)) {
    errors.push('Missing migrated fork key: webuiRu.' + key);
  }
}
// Guard against direct references to the old names in active TypeScript source.
function checkLegacyReferences(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) checkLegacyReferences(path);
    else if (/\.tsx?$/.test(entry.name)) {
      const code = readFileSync(path, 'utf8');
      for (const key of legacyForkKeys) {
        if (code.includes("'" + key + "'") || code.includes('"' + key + '"') || code.includes('`' + key + '`')) {
          errors.push('Legacy fork key reference: ' + path + ': ' + key);
        }
      }
    }
  }
}
checkLegacyReferences(fileURLToPath(new URL('../src/', import.meta.url)));

const keys = Object.keys(source);
const pluralStems = keys
  .filter((key) => key.endsWith('_one') && Object.hasOwn(source, `${key.slice(0, -4)}_other`))
  .map((key) => key.slice(0, -4));

for (const key of keys) {
  if (!Object.hasOwn(target, key)) {
    errors.push(`Missing: ${key}`);
    continue;
  }
  if (markers(source[key]) !== markers(target[key])) errors.push(`Interpolation mismatch: ${key}`);
  if (tags(source[key]) !== tags(target[key])) errors.push(`HTML tag mismatch: ${key}`);
  if (!target[key].trim()) errors.push(`Empty translation: ${key}`);
}

const allowedExtra = new Set(pluralStems.flatMap((stem) => [`${stem}_few`, `${stem}_many`]));
for (const key of Object.keys(target)) {
  if (!Object.hasOwn(source, key) && !allowedExtra.has(key)) errors.push(`Unexpected key: ${key}`);
}
for (const stem of pluralStems) {
  for (const suffix of ['few', 'many']) {
    const key = `${stem}_${suffix}`;
    if (!Object.hasOwn(target, key)) {
      errors.push(`Missing Russian plural form: ${key}`);
      continue;
    }
    if (markers(target[key]) !== markers(source[`${stem}_other`])) {
      errors.push(`Plural interpolation mismatch: ${key}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  const original = keys.length;
  const extras = Object.keys(target).length - original;
  console.log(`Locale check passed: ${original} source strings, ${extras} Russian plural forms, matching placeholders and markup.`);
}
