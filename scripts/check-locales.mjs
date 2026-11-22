/*
 * SPDX-FileCopyrightText: 2026 Stalwart WebUI RU contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * No external dependencies. Validates the Russian catalogue against en.json.
 */
import { readFileSync } from 'node:fs';

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
