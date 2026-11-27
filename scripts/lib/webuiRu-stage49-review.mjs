// Explicit reviewed source delta; preserves the immutable Stage44/48 evidence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const packetDigest = '2a8f1ceea2f45d1bdab89f8a6a90e6d8c03a236b2ce518dfe39760fffc9b95c5';
export function loadWebuiRuStage49Review(root) {
  const bytes = fs.readFileSync(path.join(root, 'scripts/data/webuiRu-stage49-review.json'));
  assert.equal(digest(bytes), packetDigest, 'Изменилась ведомость этапа 49: требуется повторное ревью');
  return JSON.parse(bytes);
}
export function historicalSourceFor49(root, actual) {
  const packet = loadWebuiRuStage49Review(root);
  const historical = { ...actual };
  for (const entry of packet.sourceDelta) {
    assert.equal(actual[entry.path], entry.after, 'Непроверенное изменение исходника: ' + entry.path);
    assert.ok(entry.reason);
    if (entry.before === null) delete historical[entry.path];
    else historical[entry.path] = entry.before;
  }
  return historical;
}
export function historicalDigestFor49(root, file, current) {
  const entry = loadWebuiRuStage49Review(root).fileDelta.find(e => e.path === file);
  if (!entry) return current;
  assert.equal(current, entry.after, 'Непроверенное изменение файла: ' + file);
  return entry.before;
}
export function verifyWebuiRuStage49Files(root) {
  const packet = loadWebuiRuStage49Review(root);
  const seen = new Set();
  for (const entry of packet.fileDelta) {
    assert.ok(!seen.has(entry.path) && entry.reason, entry.path);
    seen.add(entry.path);
    assert.equal(digest(fs.readFileSync(path.join(root,entry.path))),entry.after,
      'Непроверенное изменение файла этапа 49: '+entry.path);
  }
  return packet;
}
