// Explicit reviewed source delta; preserves the immutable Stage44/48 evidence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
// Stage50: exact reviewed delta over the unchanged Stage49 evidence packet.
// Both source blobs and file digests must validate before historical replay.
const stage50Delta = [
  {
    "path": "src/i18n/webuiRuSchemaText.ts",
    "beforeBlob": "5151522c9457bb51d6c98eada799f7fc30fc8ebb",
    "afterBlob": "ea7e624b5c08f17dc2c2b30e00b17397d86db058",
    "before": "460f2b7a14c83491719aa5544efc2752b6a773bb637b984db5dd486f3dc14431",
    "after": "9086234b659ac40b925c01632406eec52f3a9461f2a72a7869cecfb55a85da35",
    "reason": "Exact Stage50 49-slot display-only overlay; historical dispatcher preserved."
  },
  {
    "path": "src/components/lists/useDynamicList.ts",
    "beforeBlob": "4ba63d54f2182606a2f0c4ac2fbe6333b1b6f1e2",
    "afterBlob": "4ef012484c9a9f2b9b49846d2f1b7bc1dce9aabe",
    "before": "fdd121bf47b1bc5f7321674718984bd27bd67cb4f15ccb353836d8bc9af194ed",
    "after": "10fbb2694f852864c75125b43d2f4384af0aae0e024c9851d1bb581b9c91c521",
    "reason": "Use the structured x:Log diagnostic; other error paths unchanged."
  },
  {
    "path": "src/components/lists/DynamicList.tsx",
    "beforeBlob": "aaf0724b11286fd4c4f60aa20feaa58ea61a3d75",
    "afterBlob": "56c7a9df7a398614ed31c59feea3d0f46e0f21dc",
    "before": "de2c204ead567cf6c83a251c8abae66e061ec8334eebf706a00f94678c0a60b0",
    "after": "2449be95ede03765439d0b511ac7949843b44f3ca1889ae3cd7f4b3eb8cc1e02",
    "reason": "Use the structured x:Log diagnostic; other error paths unchanged."
  },
  {
    "path": "scripts/check-schema-locale.mjs",
    "beforeBlob": "cac806cc01d1ba3f7f0fa31fa6523f871ad63193",
    "afterBlob": "0d69ea8a563a5c2d61c39cab5b3fce8cf19fcdb2",
    "before": "5be84fb6bd11c1bc1f1490c8045c2948c4f3ba36a2a80f394632896034f890bc",
    "after": "7749edcc5c0a2ca5b7c052b87c880af7aee7a78a97b9747ca3bfb64c4bb32787",
    "reason": "Retain Stage49 replay and enforce Stage50 regression contracts."
  },
  {
    "path": "scripts/check-webuiRu-stage49.mjs",
    "beforeBlob": "2331349df6c164d5084f881f85c404834bdc8f72",
    "afterBlob": "606f36d50c8c9a4bceee512be91517aaac169d50",
    "before": "5f19d6b5040d199953d30a5fbdb2da505b37db825458c51acbb90631f5ceae5e",
    "after": "b0814ac43dd93661fcef08e2fdb1b5324abd246ea07492d151f3ba80c3751cd0",
    "reason": "Retain Stage49 replay and enforce Stage50 regression contracts."
  },
  {
    "path": "scripts/check-webuiRu-stage49-components.mjs",
    "beforeBlob": "ee88abfbd21fe399348374b698a6d95355ddea68",
    "afterBlob": "63636c7997a5b7a55c1c770d55e816233aa717dc",
    "before": "05cc91ffe3964cf2fa0b5ca988a7b7c163b849d94509f8ef6d4d0624f594f0a7",
    "after": "0ca79e7ddf35c06d2cc2f2ee2944eb3b89d592ae27a36d44c89887e82d9f9304",
    "reason": "Retain Stage49 replay and enforce Stage50 regression contracts."
  }
];
function undoStage50Digest(file, current) {
  const entry = stage50Delta.find(e => e.path === file);
  if (!entry) return current;
  assert.equal(current, entry.after, 'Unreviewed Stage50 file drift: ' + file);
  return entry.before;
}
const packetDigest = '2a8f1ceea2f45d1bdab89f8a6a90e6d8c03a236b2ce518dfe39760fffc9b95c5';
export function loadWebuiRuStage49Review(root) {
  const bytes = fs.readFileSync(path.join(root, 'scripts/data/webuiRu-stage49-review.json'));
  assert.equal(digest(bytes), packetDigest, 'Изменилась ведомость этапа 49: требуется повторное ревью');
  return JSON.parse(bytes);
}
export function historicalSourceFor49(root, actual) {
  const packet = loadWebuiRuStage49Review(root);
  const historical = { ...actual };
  for (const entry of stage50Delta.filter(e => e.path.startsWith('src/'))) {
    assert.equal(historical[entry.path], entry.afterBlob, 'Unreviewed Stage50 source drift: ' + entry.path);
    historical[entry.path] = entry.beforeBlob;
  }
  for (const entry of packet.sourceDelta) {
    assert.equal(historical[entry.path], entry.after, 'Непроверенное изменение исходника: ' + entry.path);
    assert.ok(entry.reason);
    if (entry.before === null) delete historical[entry.path];
    else historical[entry.path] = entry.before;
  }
  return historical;
}
export function historicalDigestFor49(root, file, current) {
  current = undoStage50Digest(file, current);
  const entry = loadWebuiRuStage49Review(root).fileDelta.find(e => e.path === file);
  if (!entry) return current;
  assert.equal(current, entry.after, 'Непроверенное изменение файла: ' + file);
  return entry.before;
}
export function verifyWebuiRuStage49Files(root) {
  const packet = loadWebuiRuStage49Review(root);
  for (const entry of stage50Delta) {
    assert.ok(entry.reason);
    assert.equal(digest(fs.readFileSync(path.join(root,entry.path))),entry.after,'Unreviewed Stage50 file drift: '+entry.path);
  }
  const seen = new Set();
  for (const entry of packet.fileDelta) {
    assert.ok(!seen.has(entry.path) && entry.reason, entry.path);
    seen.add(entry.path);
    assert.equal(undoStage50Digest(entry.path,digest(fs.readFileSync(path.join(root,entry.path)))),entry.after,
      'Непроверенное изменение файла этапа 49: '+entry.path);
  }
  return packet;
}
