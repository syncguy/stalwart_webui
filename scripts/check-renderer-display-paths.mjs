#!/usr/bin/env node
// Stage15 source-only regression guard for known renderer paths bypassing i18n.
// Does not mount React, execute browser interactions or prove coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const must = (source, text, owner) =>
  assert.ok(source.includes(text), `${owner}: expected display-only path missing: ${text}`);

const fieldValue = read('src/components/values/FieldValue.tsx');
for (const fragment of [
  'const display = useSchemaText();',
  'display(`variant/${objectName}/${typeName}/label`, typeLabel)',
  'display(`variant/${objectName}/${value}/label`, label)',
  'display(`form/${entry.formKey}/field/${entry.key}`, entry.label)',
  'display(`field/${entry.formKey}/${entry.key}/description`, entry.field.description)',
  'value={entry.value}',
  'value={data[formField.name]}',
]) {
  // The last expression is in DynamicView, not nested FieldValue.
  if (fragment === 'value={data[formField.name]}') continue;
  must(fieldValue, fragment, 'FieldValue');
}
assert.equal(fieldValue.includes('label={entry.label}'), false, 'Raw embedded label bypass returned');
assert.equal(fieldValue.includes('description={entry.field?.description}'), false, 'Raw embedded description bypass returned');

const fieldRow = read('src/components/forms/FieldRow.tsx');
const sections = read('src/components/forms/FormSections.tsx');
for (const subkey of ['keyLabel', 'valueLabel', 'placeholder']) {
  must(fieldRow, '/field/${formField.name}/' + subkey, 'FieldRow');
  must(sections, '/field/${formField.name}/' + subkey, 'FormSections');
}
must(fieldRow, 'formField: formFieldDisplay', 'FieldRow');
must(sections, 'formField={{', 'FormSections');
must(fieldRow, 'value,', 'FieldRow');
must(sections, 'value={data[formField.name]}', 'FormSections');
const form = read('src/components/forms/DynamicForm.tsx');
must(form, 'display(`form/${subtitleKey}/subtitle`, subtitle)', 'DynamicForm');
must(form, '{localizedSubtitle}', 'DynamicForm');
assert.equal(form.includes('>{subtitle}</p>'), false, 'Raw form subtitle bypass returned');

const rowActions = read('src/components/lists/RowActions.tsx');
const massBar = read('src/components/lists/MassActionBar.tsx');
const list = read('src/components/lists/DynamicList.tsx');
const identity = read('src/components/lists/listActions.ts');
must(rowActions, 'display(`list/${listKey}/itemAction/${entry.key}/label`, entry.action.label)', 'RowActions');
must(massBar, 'display(`list/${listKey}/massAction/${key}/label`, action.label)', 'MassActionBar');
must(massBar, 'onSelect={() => onSelect(action, key)}', 'MassActionBar');
must(list, 'display(`list/${listKey}/massAction/${actionKey}/label`, action.label)', 'DynamicList mass confirm');
must(list, 'display(`list/${listKey}/itemAction/${entry.key}/label`, action.label)', 'DynamicList item confirm');
must(list, 'runMassAction(action, {', 'DynamicList JMAP');
must(list, 'runItemAction(action, id)', 'DynamicList JMAP');
must(list, 'onSelect={confirmMassAction}', 'DynamicList');
must(identity, 'const base = actionIdentity(action)', 'Action identity');
must(identity, 'action: T', 'Action raw reference');
assert.equal(rowActions.includes('{entry.action.label}'), false, 'Raw mutation action bypass returned');
assert.equal(massBar.includes('{action.label}'), false, 'Raw mass action bypass returned');

const chart = read('src/features/dashboard/components/DashboardChart.tsx');
for (const component of ['Line', 'Area', 'Bar']) {
  const block = chart.match(new RegExp('<' + component + '\\s[\\s\\S]*?\\/>'))?.[0];
  assert.ok(block, `${component} series missing`);
  must(block, 'dataKey={key}', component + ' raw dataKey');
  must(block, 'name={name}', component + ' localized tooltip name');
}
must(chart, 'point[series.label] = seriesValues[s][i]', 'Raw metrics');
must(chart, 'display(`dashboard/${dashboardId}/item/${itemIndex}/series/${index}/label`, original)', 'Chart translation');
must(read('src/components/ui/chart.tsx'), "{entry.name ?? ''}", 'Chart tooltip');

const catalog = JSON.parse(read('src/i18n/schema/ru.json')).entries;
for (const slot of [
  'variant/x:Account/User/label',
  'form/x:Role/field/description/placeholder',
  'form/x:Email/EmailDefaults/field/defaultFolders/keyLabel',
]) {
  assert.ok(catalog[slot]?.ru !== catalog[slot]?.original, `Missing established example: ${slot}`);
}
const guard = read('src/i18n/schemaText.ts');
must(guard, 'original', 'Guard source');
must(guard, 'schemaHash', 'Guard schema');

console.log('Stage15 source display-path checks PASS: nested values, variant badges, captions, actions, forms, Area/Line/Bar; browser/runtime NOT TESTED.');
