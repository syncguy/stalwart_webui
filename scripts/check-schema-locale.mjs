#!/usr/bin/env node
// Focused, dependency-locked test of the actual schemaText.ts module.
// Does not fetch a server schema, run a browser, or access the network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const catalog = JSON.parse(fs.readFileSync('src/i18n/schema/ru.json', 'utf8'));
const { entries, meta } = catalog;
assert.match(meta.source, /^syncguy\/stalwart@win2008r2:[a-f0-9]{40}$/);
assert.deepEqual(
  [...meta.schemaHashes].sort(),
  [
    'Pryc909aTNRr_k6uwZLvZNs74YaPQv-PXQ38t2K7VlY',
    'fyG-0rY0Q0Zq2PwUyaVPqnGT0nyS7AYK5SCmreTDZXs',
  ].sort(),
);
assert.ok(Object.keys(entries).length >= 50, 'Domains catalog is unexpectedly incomplete');
for (const [slot, value] of Object.entries(entries)) {
  assert.ok(slot.includes('/') && typeof value.original === 'string' && value.original.length);
  assert.ok(typeof value.ru === 'string' && value.ru.length);
  for (const match of value.original.matchAll(/{{[^{}]+}}|%\{[^{}]+}|\{(?:version|algorithm|date-[^{}]+)}/g)) {
    assert.ok(value.ru.includes(match[0]), `Missing placeholder in ${slot}: ${match[0]}`);
  }
}

// Verify against selected literal slots from the two source-verified built-in server schemas.
const sample = {
  'layout/Management': 'Management',
  'nav/container/Management/Domains': 'Domains',
  'nav/link/Management/x:Domain': 'Domains',
  'list/x:Domain/title': 'Domains',
  'list/x:Domain/subtitle': 'Manage email domains and their DNS, DKIM, and TLS certificate settings',
  'list/x:Domain/column/name': 'Domain Name',
  'list/x:Domain/filter/text': 'Text',
  'form/x:Domain/section/section-0': 'Domain',
  'form/x:Domain/section/section-1': 'Email',
  'form/x:Domain/field/name': 'Domain Name',
  'form/x:Domain/field/aliases': 'Aliases',
  'form/x:Domain/field/enable': 'Enabled',
  'field/x:Domain/name/description': 'Domain name',
};
for (const [slot, original] of Object.entries(sample)) {
  assert.equal(entries[slot]?.original, original, `Source text mismatch: ${slot}`);
}

// Execute the TypeScript implementation itself, not a copied logic approximation.
const source = fs.readFileSync('src/i18n/schemaText.ts', 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
});
const exports = {};
vm.runInNewContext(outputText, {
  exports,
  URL,
  require: (specifier) => {
    assert.equal(specifier, './schema/ru.json');
    return catalog;
  },
}, { filename: 'schemaText.ts' });
const { schemaText, extractSchemaHash } = exports;
assert.equal(typeof schemaText, 'function');
assert.equal(typeof extractSchemaHash, 'function');

for (const hash of meta.schemaHashes) {
  assert.equal(schemaText(hash, 'ru', 'nav/link/Management/x:Domain', 'Domains'), 'Домены');
  assert.equal(schemaText(hash, 'ru_RU', 'list/x:Domain/title', 'Domains'), 'Домены');
  assert.equal(schemaText(hash, 'en', 'list/x:Domain/title', 'Domains'), 'Domains');
  assert.equal(schemaText(hash, 'ru', 'list/x:Domain/title', 'Unexpected upstream title'), 'Unexpected upstream title');
  assert.equal(schemaText(hash, 'ru', 'unknown/slot', 'Untouched'), 'Untouched');
}
assert.equal(schemaText(null, 'ru', 'list/x:Domain/title', 'Domains'), 'Domains');
assert.equal(schemaText('unknown-hash', 'ru', 'list/x:Domain/title', 'Domains'), 'Domains');
assert.equal(
  extractSchemaHash('https://mail.example.test/api/schema/' + meta.schemaHashes[0], 'https://mail.example.test'),
  meta.schemaHashes[0],
);
assert.equal(
  extractSchemaHash('https://attacker.example.test/api/schema/' + meta.schemaHashes[0], 'https://mail.example.test'),
  null,
);
assert.equal(extractSchemaHash('https://mail.example.test/api/schema', 'https://mail.example.test'), null);
assert.equal(extractSchemaHash('not a url', 'https://mail.example.test'), null);

// Render-branch contract: sortable and non-sortable headers use the same
// display-only label. Sorting must still use the raw column.name identifier.
const headerSource = fs.readFileSync('src/components/lists/ColumnHeader.tsx', 'utf8');
assert.match(headerSource, /if \(!sortable\) \{[\s\S]*?\{label\}/);
const sortableBranch = headerSource.slice(headerSource.indexOf('  const hint ='));
assert.match(sortableBranch, /onClick=\{\(\) => onSort\(column\.name\)\}/);
assert.match(sortableBranch, /\{label\}\s*\{direction ===/);
assert.doesNotMatch(sortableBranch, /\{column\.label\}/);

// Shallow DOM-independent contract: lookup cannot mutate a schema or functional identifiers.
const sourceSchema = Object.freeze({
  layouts: Object.freeze([Object.freeze({ name: 'Management', viewName: 'x:Domain' })]),
  chart: Object.freeze({ series: Object.freeze([Object.freeze({ label: 'Inbound' }), Object.freeze({ label: 'Incoming' })]) }),
  form: Object.freeze({ name: 'example.org', dirty: true }),
});
schemaText(meta.schemaHashes[0], 'ru', 'layout/Management', sourceSchema.layouts[0].name);
assert.equal(sourceSchema.layouts[0].name, 'Management');
assert.equal(sourceSchema.layouts[0].viewName, 'x:Domain');
assert.equal(sourceSchema.form.dirty, true);
assert.deepEqual(sourceSchema.chart.series.map((s) => s.label), ['Inbound', 'Incoming']);

console.log(`Schema locale check passed: ${Object.keys(entries).length} contextual slots, two pinned variants, safe fallbacks, preserved identifiers.`);
