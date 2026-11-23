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

// Stage 5: source-verified, view-specific Accounts, Actions, tenant and trace labels.
const stage5Samples = [
  ['list/x:Action/title', 'Actions', 'Действия'],
  ['list/x:Action/subtitle', 'Execute server management actions', 'Выполнение административных действий на сервере'],
  ['variant/x:Action/UpdateApps/label', 'Application Management: Update applications', 'Управление приложениями: Обновить приложение'],
  ['variant/x:Action/PauseMtaQueue/label', 'MTA: Pause queue processing', 'MTA: Приостановить обработку очереди'],
  ['nav/container/Management/Emails/History', 'History', 'История'],
  ['list/x:Trace/InboundDelivery/title', 'Inbound Delivery Attempts', 'Попытки входящей доставки'],
  ['list/x:Trace/OutboundDelivery/title', 'Outbound Delivery Attempts', 'Попытки исходящей доставки'],
  ['list/x:Trace/OutboundDelivery/column/timestamp', 'Date', 'Дата'],
  ['list/x:Tenant/title', 'Tenants', 'Арендаторы'],
  ['form/x:Tenant/section/section-2', 'Quotas', 'Квоты'],
  ['form/x:UserAccount/section/section-0', 'User Account', 'Учётная запись пользователя'],
  ['form/x:UserAccount/section/section-2', 'Groups & Roles', 'Группы и роли'],
  ['form/x:GroupAccount/section/section-1', 'Roles & Permissions', 'Роли и права доступа'],
  ['form/x:UserAccount/field/name', 'Username', 'Имя пользователя'],
  ['form/x:GroupAccount/field/aliases', 'Email Aliases', 'Почтовые псевдонимы'],
  ['field/x:MailingList/recipients/description', 'List of email addresses that are members of the mailing list', 'Почтовые адреса участников списка рассылки'],
  ['field/x:Role/enabledPermissions/description', 'List of permissions that are explicitly enabled.', 'Права, явно разрешённые этой ролью.'],
  ['field/x:OAuthClient/scopes/description', 'Scopes the client may request. When empty, the client can only request sign-in (openid).', 'Области доступа, запрашиваемые клиентом. Если список пуст, доступен только вход (openid).'],
  ['variant/x:Account/User/label', 'User account', 'Учётная запись пользователя'],
];
for (const hash of meta.schemaHashes) {
  for (const [slot, original, russian] of stage5Samples) {
    assert.equal(entries[slot]?.original, original, 'Source label mismatch: ' + slot);
    assert.equal(schemaText(hash, 'ru', slot, original), russian);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' new'), original + ' new');
  }
}

// Execute the pure form display selector; schema IDs and section offsets are untouched.
const formCtxTs = fs.readFileSync('src/i18n/schemaFormContext.ts', 'utf8');
const formCtxJs = ts.transpileModule(formCtxTs, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const formCtxExports = {};
vm.runInNewContext(formCtxJs, { exports: formCtxExports }, { filename: 'schemaFormContext.ts' });
const ctx = (section, base, variant, parentCount) =>
  JSON.parse(JSON.stringify(formCtxExports.sectionDisplayContext(section, base, variant, parentCount)));
assert.deepEqual(ctx('section-0', 'x:Account', 'x:UserAccount', 1), {
  formKey: 'x:Account', sectionKey: 'section-0',
});
assert.deepEqual(ctx('section-1', 'x:Account', 'x:UserAccount', 1), {
  formKey: 'x:UserAccount', sectionKey: 'section-0',
});
assert.deepEqual(ctx('section-3', 'x:Account', 'x:GroupAccount', 1), {
  formKey: 'x:GroupAccount', sectionKey: 'section-2',
});
assert.deepEqual(ctx('section-2', 'x:DkimSignature', 'x:Dkim1Signature', 1), {
  formKey: 'x:Dkim1Signature', sectionKey: 'section-1',
});
assert.deepEqual(ctx('section-2', 'x:OAuthClient', 'x:OAuthClient', 0), {
  formKey: 'x:OAuthClient', sectionKey: 'section-2',
});
assert.deepEqual(ctx('section-1', 'x:Domain', undefined, 0), {
  formKey: 'x:Domain', sectionKey: 'section-1',
});

// Wiring is display-only: routes and event payloads retain raw names and IDs.
const dynamicFormStage5 = fs.readFileSync('src/components/forms/DynamicForm.tsx', 'utf8');
const formSectionsStage5 = fs.readFileSync('src/components/forms/FormSections.tsx', 'utf8');
assert.ok(dynamicFormStage5.includes('variantFormKey={variantFormKey}'));
assert.ok(dynamicFormStage5.includes('parentSectionCount={parentSectionCount}'));
assert.ok(formSectionsStage5.includes('sectionDisplayContext(section.key, formKey, variantFormKey, parentSectionCount)'));
assert.ok(formSectionsStage5.includes('formKey={context.formKey}'));
const actionsStage5 = fs.readFileSync('src/features/actions/ActionPage.tsx', 'utf8');
assert.ok(actionsStage5.includes('splitActionLabel(actionLabel(entry.variant)).name'));
assert.ok(actionsStage5.includes('buildActionPayload(pending.name, null, {})'));
assert.ok(actionsStage5.includes('hasPermission('));
assert.ok(actionsStage5.includes('setMutation.mutateAsync({ create: { [CREATE_ID]: payload } })'));
const actionFormStage5 = fs.readFileSync('src/features/actions/components/ActionForm.tsx', 'utf8');
assert.ok(actionFormStage5.includes('formKey={variant.schemaName}'));
const actionResultStage5 = fs.readFileSync('src/features/actions/components/ActionResult.tsx', 'utf8');
assert.ok(actionResultStage5.includes('variant/x:Action/'));

// Stage 6: exact original server labels for nested account contexts.
const stage6Samples = [
  ['variant/x:UserRoles/User/label', 'User role', 'Роль пользователя'],
  ['variant/x:UserRoles/Admin/label', 'Administrator role', 'Роль администратора'],
  ['variant/x:UserRoles/Custom/label', 'Custom role', 'Пользовательская роль'],
  ['variant/x:Roles/Default/label', 'Default role', 'Роль по умолчанию'],
  ['variant/x:Permissions/Inherit/label', 'Inherited permissions', 'Унаследованные права'],
  ['variant/x:Permissions/Merge/label', 'Permissions are combined with inherited permissions', 'Объединить с унаследованными правами'],
  ['variant/x:Permissions/Replace/label', 'Permissions replace all inherited permissions', 'Заменить унаследованные права'],
  ['variant/x:Credential/Password/label', 'Password for authenticating to the account', 'Пароль для входа в учётную запись'],
  ['form/x:EmailAlias/field/name', 'Local Part', 'Имя до знака @'],
  ['form/x:EmailAlias/field/domainId', 'Domain', 'Домен'],
  ['form/x:EmailAlias/field/enable', 'Enabled', 'Включён'],
  ['field/x:EmailAlias/name/description', 'The local part of the email alias (the part before the @ symbol)', 'Часть почтового адреса до знака @'],
  ['field/x:EmailAlias/domainId/description', 'Identifier for the domain of the email alias (the part after the @ symbol).', 'Домен почтового псевдонима — часть адреса после знака @.'],
  ['form/x:PermissionsList/field/enabledPermissions', 'Enabled Permissions', 'Разрешённые права'],
  ['form/x:CustomRoles/field/roleIds', 'Roles', 'Роли'],
  ['form/x:SecondaryCredential/field/permissions', 'Permissions', 'Права доступа'],
  ['form/x:EncryptionSettings/field/headerProtection', 'Header Protection', 'Защита заголовков'],
];
for (const hash of meta.schemaHashes) {
  for (const [slot, original, translated] of stage6Samples) {
    assert.equal(entries[slot]?.original, original, 'Source mismatch at ' + slot);
    assert.equal(schemaText(hash, 'ru', slot, original), translated);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' v2'), original + ' v2');
  }
}
const enUi = JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'));
const ruUi = JSON.parse(fs.readFileSync('src/i18n/ru.json', 'utf8'));
assert.match(enUi.actions.updateAppsScopeWarning, /all configured web applications/);
assert.match(ruUi.actions.updateAppsScopeWarning, /все настроенные веб-приложения/);
const actionWithWarning = fs.readFileSync('src/features/actions/ActionPage.tsx', 'utf8');
assert.ok(actionWithWarning.includes("pending?.name === 'UpdateApps'"));
assert.ok(actionWithWarning.includes("actions.updateAppsScopeWarning"));
assert.ok(actionWithWarning.includes('buildActionPayload(pending.name, null, {})'));

const sourceNestedRow = fs.readFileSync('src/components/forms/FieldRow.tsx', 'utf8');
assert.ok(sourceNestedRow.includes('formField: { ...formField, label }'));
assert.ok(sourceNestedRow.includes('formKey ? display('));
const sourceObjectList = fs.readFileSync('src/components/forms/widgets/ObjectListWidget.tsx', 'utf8');
assert.ok(sourceObjectList.includes('variant/${type.objectName}/${variant}/label'));
assert.ok(sourceObjectList.includes('summaryLabel ?? itemLabel'));
assert.ok(sourceObjectList.includes('onChange({ ...items, [key]: v })'));

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
