import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webuiRuBuildIdentity } from './webuiRu-build-identity.ts';

const version = '2.1.1';
const timestampUtc = '2026-11-26T03:57:00Z';
const sourceSha = '0123456789abcdef0123456789abcdef01234567';
const ci = { GITHUB_ACTIONS: 'true', GITHUB_RUN_NUMBER: '42', GITHUB_RUN_ATTEMPT: '2', GITHUB_SHA: sourceSha, WEBUI_RU_BUILD_TIMESTAMP: timestampUtc };
const now = new Date('2026-11-26T04:01:02.456Z');

test('CI identity, including rerun attempt and full source SHA', () => {
  assert.deepEqual(webuiRuBuildIdentity(version, ci, now), { version, edition: 'ru', timestampUtc, kind: 'ci', runNumber: '42', runAttempt: '2', sourceSha });
});
test('fixed metadata reproduces exact JSON independently of build clock', () => {
  assert.equal(JSON.stringify(webuiRuBuildIdentity(version, ci, now)), JSON.stringify(webuiRuBuildIdentity(version, ci, new Date('2026-12-01T00:00:00Z'))));
});
test('local build never impersonates CI even with stray GitHub environment variables', () => {
  const value = webuiRuBuildIdentity(version, { ...ci, GITHUB_ACTIONS: undefined }, now);
  assert.deepEqual(value, { version, edition: 'ru', timestampUtc, kind: 'local', runNumber: null, runAttempt: null, sourceSha: null });
});
test('local clock is UTC with second precision', () => {
  assert.equal(webuiRuBuildIdentity(version, {}, now).timestampUtc, '2026-11-26T04:01:02Z');
});
test('SOURCE_DATE_EPOCH is accepted as deterministic local input', () => {
  assert.equal(webuiRuBuildIdentity(version, { SOURCE_DATE_EPOCH: '0' }, now).timestampUtc, '1970-01-01T00:00:00Z');
});
test('explicit timestamp has priority over SOURCE_DATE_EPOCH', () => {
  assert.equal(webuiRuBuildIdentity(version, { SOURCE_DATE_EPOCH: '0', WEBUI_RU_BUILD_TIMESTAMP: timestampUtc }, now).timestampUtc, timestampUtc);
});
test('invalid CI metadata fails closed', () => {
  for (const [key, value] of [['GITHUB_RUN_NUMBER','0'],['GITHUB_RUN_ATTEMPT','-1'],['GITHUB_RUN_NUMBER','1x'],['GITHUB_SHA','short'],['GITHUB_SHA',undefined],['GITHUB_RUN_ATTEMPT',undefined]]) {
    assert.throws(() => webuiRuBuildIdentity(version, { ...ci, [key]: value }, now), /Invalid GITHUB_/);
  }
});
test('invalid timestamps or epochs are rejected', () => {
  for (const value of ['2026-02-31T00:00:00Z','2026-11-26T00:00:00+00:00','2026-11-26T00:00:00.000Z','']) assert.throws(() => webuiRuBuildIdentity(version, { WEBUI_RU_BUILD_TIMESTAMP: value }, now));
  for (const value of ['-1','1.5','NaN','99999999999999999999']) assert.throws(() => webuiRuBuildIdentity(version, { SOURCE_DATE_EPOCH: value }, now));
});
test('no secrets or unrelated environment entries can enter metadata', () => {
  assert.deepEqual(webuiRuBuildIdentity(version, { ...ci, GITHUB_TOKEN: 'secret', VITE_ACCESS_TOKEN: 'secret', OTHER: 'secret' }, now), webuiRuBuildIdentity(version, ci, now));
});
