import assert from 'node:assert/strict';
import { grammarReviewCandidates } from './lib/webuiRu-grammar-review.mjs';

const entry = (slot, original, editions) => ({
  slot, original,
  locations: editions.map(edition => ({ edition, schemaHash: edition + '-hash', sourcePointer: '/' + slot })),
});
const map = (...rows) => new Map(rows.map(r => [r.slot + '\0' + r.original, r]));
const both = ['enterprise', 'oss'];
const before = map(
  entry('list/x:Stable/singular', 'stable', both),
  entry('list/x:Edition/singular', 'shared', ['enterprise']),
  entry('list/x:Changed/singular', 'prior', both),
);
const after = map(
  entry('list/x:Stable/singular', 'stable', both),
  entry('list/x:Edition/singular', 'shared', both),
  entry('list/x:Changed/singular', 'changed', both),
  entry('list/x:New/singular', 'resource', both),
  entry('list/x:New/plural', 'resources', both),
  entry('object/x:New/description', 'new object', both),
  entry('form/x:New/title', 'new form', both),
);
const rows = grammarReviewCandidates(before, after);
assert.equal(rows.length, 5);
assert.deepEqual(rows.find(r => r.slot === 'list/x:Edition/singular').bindings.map(b => b.edition), ['oss']);
assert.equal(rows.find(r => r.slot === 'list/x:Changed/singular').original, 'changed');
assert.equal(rows.find(r => r.slot === 'list/x:New/plural').status, 'needs-grammar-review');
assert.equal(rows.find(r => r.slot === 'object/x:New/description').status, 'needs-consumer-review');
assert.ok(!rows.some(r => r.slot.includes('Stable') || r.slot.startsWith('form/')));
assert.deepEqual(rows, grammarReviewCandidates(before, new Map([...after].reverse())));
assert.deepEqual(grammarReviewCandidates(after, after), []);
const stableKey='list/x:Stable/singular\0stable';
const consumer={edition:'enterprise',screen:'x:NewView',mode:'create',renderer:'DynamicForm',lookupSlot:'list/x:Stable/singular'};
const consumerRows=grammarReviewCandidates(before,before,new Map(),new Map([[stableKey,[consumer]]]));
assert.equal(consumerRows.length,1);
assert.equal(consumerRows[0].bindings.length,1);
assert.equal(consumerRows[0].bindings[0].edition,'enterprise');
assert.deepEqual(consumerRows[0].newConsumers,[consumer]);
assert.deepEqual(grammarReviewCandidates(before,before,new Map([[stableKey,[consumer]]]),new Map([[stableKey,[consumer]]])),[]);
console.log('Grammar delta collector PASS: new/changed/narrow edition binding, singular/plural, possible description fallback and deterministic output.');
