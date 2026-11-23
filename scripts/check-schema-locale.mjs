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
assert.ok(Object.keys(entries).length >= 1300, 'Schema display catalog unexpectedly lost translated contexts');
assert.deepEqual(
  meta.sources,
  [
    { file: 'schema_oss.json.gz', blobSha: '3d41ba6b3126648b1c1603b32ad26d60111f4420' },
    { file: 'schema.json.gz', blobSha: 'a7224968446b0935b245a22ce832e9ad2a6fb49a' },
  ],
);

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
  'nav/link/Management/x:Account/User': 'Accounts',
  'nav/link/Settings/x:NetworkListener': 'Listeners',
  'nav/container/Management/Directory': 'Directory',
  'list/x:Account/User/title': 'Accounts',
  'list/x:Account/Group/title': 'Groups',
  'list/x:QueuedMessage/title': 'Queued Messages',
  'list/x:NetworkListener/column/implicitTls': 'Implicit TLS',
  'form/x:NetworkListener/section/section-0': 'Listener settings',
  'form/Mailbox/section/section-0': 'Mailbox',
  'form/x:MailingList/field/recipients': 'Recipients',
  'enum/IndexType/email/label': 'Email',
  'variant/x:SpamDnsblServer/Domain/label': 'Domain',
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

// Check representative contexts against the real translation resolver for both server versions.
for (const hash of meta.schemaHashes) {
  for (const [slot, english, russian] of [
    ['nav/link/Management/x:Account/User', 'Accounts', 'Учётные записи'],
    ['list/x:Account/Group/title', 'Groups', 'Группы'],
    ['list/x:QueuedMessage/title', 'Queued Messages', 'Сообщения в очереди'],
    ['form/x:NetworkListener/section/section-0', 'Listener settings', 'Настройки слушателя'],
    ['form/Mailbox/section/section-0', 'Mailbox', 'Почтовый ящик'],
    ['enum/IndexType/email/label', 'Email', 'Почта'],
  ]) {
    assert.equal(schemaText(hash, 'ru', slot, english), russian);
    assert.equal(schemaText(hash, 'en', slot, english), english);
    assert.equal(schemaText(hash, 'ru', slot, english + ' changed'), english + ' changed');
  }
}

const listSource = fs.readFileSync('src/components/lists/DynamicList.tsx', 'utf8');
assert.match(listSource, /Object\.hasOwn\(schema\.lists, viewName\) \? viewName : objectName/);
assert.match(listSource, /const title = display\(`list\/\$\{listKey\}\/title`, list\.title\)/);
assert.match(listSource, /listKey=\{listKey\}/);

const filterSource = fs.readFileSync('src/components/lists/FilterFields.tsx', 'utf8');
assert.match(filterSource, /display\(`enum\/\$\{filter\.enumName\}\/\$\{v\.name\}\/label`, v\.label\)/);
assert.match(filterSource, /value: v\.name/);

const variantSource = fs.readFileSync('src/components/forms/VariantSelect.tsx', 'utf8');
assert.match(variantSource, /display\(`variant\/\$\{variantScope\}\/\$\{v\.name\}\/label`, v\.label\)/);
assert.match(variantSource, /onChange\(v\.name\)/);

const localeSource = fs.readFileSync('src/i18n/index.ts', 'utf8');
assert.ok(
  localeSource.indexOf('setDisplayLanguage(initialLocale)') < localeSource.indexOf('i18n.use(initReactI18next).init('),
  'Locale must initialize schema display BEFORE the first schema fetch',
);
assert.match(localeSource, /localStorage\.setItem\(LOCALE_STORAGE_KEY, lang\)/);
const topBar = fs.readFileSync('src/components/layout/TopBar.tsx', 'utf8');
assert.match(topBar, /DropdownMenuRadioGroup value=\{activeLanguage\} onValueChange=\{setLocale\}/);
assert.match(topBar, /DropdownMenuRadioItem value="ru"/);
assert.match(topBar, /DropdownMenuRadioItem value="en"/);
const storeSource = fs.readFileSync('src/stores/schemaStore.ts', 'utf8');
const languageSwitch = storeSource.slice(storeSource.indexOf('  setDisplayLanguage: (language) => {'));
assert.match(languageSwitch, /set\(\{ displayLanguage: language, searchIndex \}\)/);
assert.doesNotMatch(languageSwitch, /setSchema\(/);

// Stage 4: nested Domain objects keep raw identifiers and preserve selector variables.
const nestedDomainSamples = [
  ['variant/x:SubAddressing/Enabled/label', 'Enable sub-addressing', 'Включить дополнительную адресацию'],
  ['variant/x:SubAddressing/Custom/label', 'Enable custom sub-addressing', 'Включить собственные правила дополнительной адресации'],
  ['variant/x:SubAddressing/Disabled/label', 'Disable sub-addressing', 'Отключить дополнительную адресацию'],
  ['variant/x:DkimManagement/Automatic/label', 'Automatic DKIM management', 'Автоматическое управление DKIM'],
  ['variant/x:DkimManagement/Manual/label', 'Manual DKIM management', 'Ручное управление DKIM'],
  ['variant/x:CertificateManagement/Automatic/label', 'ACME TLS certificate management', 'Управление сертификатами TLS через ACME'],
  ['variant/x:DnsManagement/Automatic/label', 'Automatic DNS management', 'Автоматическое управление DNS'],
  ['form/x:DkimManagementProperties/field/algorithms', 'Signing Algorithms', 'Алгоритмы подписи'],
  ['form/x:DkimManagementProperties/field/selectorTemplate', 'Selector Template', 'Шаблон селектора'],
  ['form/x:DkimManagementProperties/field/rotateAfter', 'Rotate After', 'Период ротации ключей'],
  ['form/x:SubAddressingCustom/field/customRule', 'Custom Rule Expression', 'Выражение пользовательского правила'],
  ['field/x:DkimManagementProperties/algorithms/description', 'List of signing algorithms to use when generating new DKIM keys', 'Алгоритмы подписи, используемые для генерации новых ключей DKIM'],
  ['field/x:Domain/directoryId/description', 'Identifier for the directory where accounts for this domain are stored, or null to use the internal directory', 'Идентификатор каталога с учётными записями домена. Если не указан, используется внутренний каталог.'],
];
for (const hash of meta.schemaHashes) {
  for (const [slot, original, translated] of nestedDomainSamples) {
    assert.equal(entries[slot]?.original, original);
    assert.equal(schemaText(hash, 'ru', slot, original), translated);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' changed'), original + ' changed');
  }
  const template = entries['field/x:DkimManagementProperties/selectorTemplate/description'];
  assert.ok(template, 'Missing selector documentation');
  assert.equal(schemaText(hash, 'ru', 'field/x:DkimManagementProperties/selectorTemplate/description', template.original), template.ru);
  for (const marker of ['{algorithm}', '{hash}', '{version}', '{date-<fmt>}', '{date-%Y%m%d}', '{epoch}', '{random}']) {
    assert.ok(template.original.includes(marker) && template.ru.includes(marker), 'Missing selector variable: ' + marker);
  }
}
const embeddedSource = fs.readFileSync('src/components/forms/widgets/EmbeddedObjectWidget.tsx', 'utf8');
assert.match(embeddedSource, /variantScope=\{objectName\}/);
assert.match(embeddedSource, /formKey=\{resolved\.schemaName \?\? undefined\}/);
assert.match(embeddedSource, /onChange=\{changeVariant\}/);
const nestedFieldSource = fs.readFileSync('src/components/forms/FieldRow.tsx', 'utf8');
assert.match(nestedFieldSource, /const label = formKey \? display\(/);
assert.match(nestedFieldSource, /const description = formKey\s*\? display\(/);
assert.doesNotMatch(nestedFieldSource, /formKey && topLevel \? display/);
const stableVariantSource = fs.readFileSync('src/components/forms/VariantSelect.tsx', 'utf8');
assert.match(stableVariantSource, /const segmented = isSegmented\(variants\)/);
assert.match(stableVariantSource, /onChange\(v\.name\)/);
assert.match(stableVariantSource, /value=\{v\.name\}/);

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
