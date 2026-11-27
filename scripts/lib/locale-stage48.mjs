// Stage48: reviewed upstream source delta, independently replayed pinned-schema report.
// Historical Stage44 packet, source chain and catalogues are not rewritten.
import assert from 'node:assert/strict';
import { historicalSourceFor49, historicalDigestFor49 } from './webuiRu-stage49-review.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
const packetSha256 = 'e06dba7434508fa3ed63eeefa887aa4e97794f3ebb9a7dd15dc5baad2a038a5c';

export function loadStage48Packet(root) {
  const raw = fs.readFileSync(path.join(root, 'scripts/data/stage48-upstream-review.json'));
  assert.equal(digest(raw), packetSha256, 'Stage48 evidence changed: reopen review');
  return JSON.parse(raw);
}

export function validateStage48(root, inputs, stage44, stage47Source, actualSource, packet) {
  const read = p => fs.readFileSync(path.join(root, p));
  actualSource = historicalSourceFor49(root, actualSource);
  const reviewedDigest = p => historicalDigestFor49(root, p, digest(read(p)));
  assert.equal(packet.stage, 48);
  assert.equal(packet.historicalLedgerSha256, digest(read('scripts/data/stage44-final-review.json')));
  assert.equal(packet.manifestSha256, stage44.manifestSha256);
  assert.deepEqual(inputs.pins.map(p => p.schemaHash).sort(), [...stage44.schemaHashes].sort());
  for (const pin of inputs.pins) {
    assert.equal(inputs.resolver.resolveObject(pin.data, 'x:MailRule'), null);
    assert.ok(!JSON.stringify(pin.data).includes('MailRule'), 'MailRule schema drift: reopen Stage49');
  }

  // Add only the reviewed paths to the complete historical inventory.
  const expected = { ...stage47Source };
  const changed = new Set();
  for (const d of packet.sourceDelta) {
    assert.ok(!changed.has(d.path) && d.reason);
    changed.add(d.path);
    assert.equal(expected[d.path] ?? null, d.before, 'Historical source changed: reopen stage44 ' + d.path);
    assert.equal(actualSource[d.path], d.after, 'Stage48 renderer drift: ' + d.path);
    expected[d.path] = d.after;
  }
  assert.equal(changed.size, 16);
  assert.deepEqual(actualSource, expected, 'Renderer source inventory changed: reopen stage44/48 paths and exclusions');

  for (const [p, h] of Object.entries(packet.clientCatalogues)) {
    assert.equal(stage44.clientCatalogSha256[p], h.before, 'Historical client catalogue pin changed');
    assert.equal(reviewedDigest(p), h.after, 'Stage48 client catalogue changed: reopen review');
  }
  for (const a of packet.adapterDelta) {
    assert.ok(changed.has(a.path) || Object.hasOwn(packet.clientCatalogues, a.path));
    assert.equal(reviewedDigest(a.path), a.after);
    assert.equal(inputs.policy.adapterSources[a.path], a.after);
  }

  // Exact re-review census from the original 828-row ledger.
  const affected = stage44.rows.filter(r => r.sourceFiles.some(p => changed.has(p)));
  assert.equal(affected.length, packet.affected.unique);
  assert.equal(affected.reduce((n,r) => n + r.bindings.length, 0), packet.affected.bindings);
  const seen = new Set();
  for (const group of packet.affected.groups) {
    const rows = affected.filter(r => r.sourceFiles.includes(group.file));
    assert.deepEqual(rows.map(r => r.id).sort(), group.ids);
    assert.equal(rows.reduce((n,r) => n + r.bindings.length, 0), group.bindings);
    for (const r of rows) {
      assert.ok(!seen.has(r.id)); seen.add(r.id);
      if (group.historical !== 'mixed') assert.equal(r.recommendedClassification, group.historical);
      if (group.file.endsWith('/summary.ts')) {
        const [category, name] = r.slot.split('/');
        assert.equal(category, 'enum');
        assert.ok(!packet.enumNames.includes(name), 'New enum consumer requires review: ' + r.slot);
      }
    }
  }
  assert.equal(seen.size, affected.length);

  // Recheck that raw enum-name arguments in the changed summary are the exact
  // reviewed finite set, not a newly open generic enum consumer.
  const summary = read('src/features/mailRules/summary.ts').toString('utf8');
  const names = [...new Set([...summary.matchAll(/\b(?:enumLabel|operatorTest)\([^,]+,\s*'([^']+)'/g)].map(m => m[1]))].sort();
  assert.deepEqual(names, packet.enumNames);
  return { stage: 48, baseline: packet.baseline, upstream: packet.upstream,
    affectedRows: affected.length, affectedBindings: packet.affected.bindings,
    reviewedGroups: packet.affected.groups.map(g => ({ file: g.file, rows: g.ids.length, bindings: g.bindings, reason: g.reason })),
    sourceDelta: packet.sourceDelta, client: packet.client, pinnedSchemaReportReplay: 'required' };
}

// Compare the complete schema report, not just the classification counts.
// A new path or changed usage must be reviewed explicitly rather than hidden.
export function verifyStage48SchemaReplay(report, previous, packet) {
  for (const [name, actual] of [['classification', report], ['stage43-classification', previous]]) {
    for (const [field, hash] of Object.entries(packet.reports[name].schemaHashes)) {
      assert.equal(digest(JSON.stringify(actual[field])), hash, 'Stage48 pinned schema replay changed: ' + name + '/' + field);
    }
  }
}
