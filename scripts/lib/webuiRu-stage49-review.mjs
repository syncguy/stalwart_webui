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
// Stage50 second pass: retain the first pass delta for historical evidence.
const stage50SecondDelta = [
  {
    "path": "src/components/layout/Sidebar.tsx",
    "beforeBlob": "4174a4205278b54fbfb0b17fad4f2559ea76d9c2",
    "afterBlob": "d1527f7bf48f416a070d2c71c205d066b1e7cb53",
    "before": "12fdca130b84b4b96326d96ca29321e1ecff9aaff19d610c28f09225941f4129",
    "after": "223427418722acdd2f957834b20a28c11a16f0ea21c5b8225e86de72e7e394eb",
    "reason": "Conditional full-label tooltip and bounded desktop separator; same navigation/ACL semantics."
  },
  {
    "path": "src/components/layout/TopBar.tsx",
    "beforeBlob": "5cb67461ff27b8a7d64be8c76150d68511eb9899",
    "afterBlob": "e72662d0ddcb3260834fa297f6debaf5996172f0",
    "before": "ec3d7d0859ff4fdd107c1d9024d10643aa27c456694a3178ca89acb9d335beae",
    "after": "20ebe193609591f0f2888a8eebc44c84e29a42f74a50106982974b7ae1871d4c",
    "reason": "Synchronize header logo width with sidebar; default preserved."
  },
  {
    "path": "src/i18n/webuiRuSchemaText.ts",
    "beforeBlob": "ea7e624b5c08f17dc2c2b30e00b17397d86db058",
    "afterBlob": "4ce52e7827f02785199334b14a9872c88e568e6e",
    "before": "9086234b659ac40b925c01632406eec52f3a9461f2a72a7869cecfb55a85da35",
    "after": "3897346ef26f3ded3f7837ff9087faf4fcfa834177354ec66db69ea4d19a1d70",
    "reason": "Exact second editorial overlay and scoped action grammar; historical catalogues unchanged."
  },
  {
    "path": "src/pages/AdminPanel.tsx",
    "beforeBlob": "10d6898298bd18292013633e6977a25c5d9c64af",
    "afterBlob": "74486d2ce98cd3666e6b52f0cfde2502ab99f79e",
    "before": "94ab1c5a41c0544078ab0de471aafb5e79c8893ff67275ccddbf6c0fcebea33d",
    "after": "ea2e848ed4e38b43236c5d36210d0056cca539a8e1ea2ce96e56691acf5804ec",
    "reason": "Ephemeral sidebar width; synchronize main content without remounting routes/forms."
  },
  {
    "path": "scripts/check-webuiRu-stage49-components.mjs",
    "beforeBlob": "63636c7997a5b7a55c1c770d55e816233aa717dc",
    "afterBlob": "bb2ffe31185d3c351195422e6a404592735c560d",
    "before": "0ca79e7ddf35c06d2cc2f2ee2944eb3b89d592ae27a36d44c89887e82d9f9304",
    "after": "77b91055bd7055c8494c673c63d3d5a8ebe1de681b7dc89d70bb06b3021619dc",
    "reason": "Preserve first operator pass and verify all pinned bindings for second pass."
  },
  {
    "path": "scripts/lib/locale-stage44.mjs",
    "beforeBlob": "b1ac50df4cb9e2d62bd4f8c6174e923b46ffe668",
    "afterBlob": "2673c2b2a817cf8400b27f10c7654b7576a76221",
    "before": "033972dc8984f34c06bc45a1254ac6f237323eb90669b0e36c2f1bedacf0e78a",
    "after": "589b146eb7c4ef89e5a8a24350fa8ee69349c6e0573303679b10a1e1c62b400e",
    "reason": "Revalidate two exact existing dynamic display call sites after sidebar refactor."
  }
];
// Stage50 third pass: reviewed exact source delta, older ledgers stay immutable.
const stage50ThirdDelta = [
  {
    "path": "src/components/layout/Sidebar.tsx",
    "beforeBlob": "d1527f7bf48f416a070d2c71c205d066b1e7cb53",
    "afterBlob": "a4d73ea26f48dceaa0784420d40ff6f2139b2174",
    "before": "223427418722acdd2f957834b20a28c11a16f0ea21c5b8225e86de72e7e394eb",
    "after": "36a643df9b48d91af7d7f846a4b1c620bc3eec7ff4b6fc6d7f49adf19b448d1e",
    "reason": "Apply reviewed Sieve presentation layer after raw nav tree; existing link/group ACL and actions unchanged."
  },
  {
    "path": "src/components/layout/useLayoutNavigation.ts",
    "beforeBlob": "fae9f30801225813f8ad4bd83e593ee1ff594cdb",
    "afterBlob": "ed9a51b2740160943f4ee13d9c395138d28c3254",
    "before": "d730e2c3d200b3d27f73f71ccd47fdfae4fc5a6a595f472839d93d935e6d65f2",
    "after": "5b431bc2395602da145b0e88f43f8ae1c2eaa5c21df1c17913cceeec62ba0405",
    "reason": "Expose current schema hash for exact presentation guard, no permission changes."
  },
  {
    "path": "src/components/layout/webuiRuNavPresentation.ts",
    "beforeBlob": null,
    "afterBlob": "22f7fd245ac7598ba64660b7d90772d48f7a7ecc",
    "before": null,
    "after": "97989ec82ff3faa2404072c82abaa21c2b1860a5e50f93eef5d7f50b4902fcbd",
    "reason": "New isolated known-schema and exact Sieve tree guard; preserve all view IDs, no mutation."
  },
  {
    "path": "src/i18n/webuiRuSchemaText.ts",
    "beforeBlob": "4ce52e7827f02785199334b14a9872c88e568e6e",
    "afterBlob": "44f331e398a399e610e2ef73d179a68dfadced94",
    "before": "3897346ef26f3ded3f7837ff9087faf4fcfa834177354ec66db69ea4d19a1d70",
    "after": "e3aba5cb241e0df1f5e867a56708cc37e002f287a18e7eaac16bf3b8ece80f96",
    "reason": "Third exact 27-slot overlay, profile action and six local presentation labels; prior overlays preserved."
  },
  {
    "path": "scripts/check-webuiRu-stage49-components.mjs",
    "beforeBlob": "bb2ffe31185d3c351195422e6a404592735c560d",
    "afterBlob": "849818edb213e69026123258382128ce191f4e31",
    "before": "77b91055bd7055c8494c673c63d3d5a8ebe1de681b7dc89d70bb06b3021619dc",
    "after": "90321273cad1420a6df652d575c58c27878aa821e242d9b70d36c74b92584886",
    "reason": "Add third batch regression and Sieve topology/permissions/fallback/source replay tests."
  },
  {
    "path": "scripts/lib/locale-stage44.mjs",
    "beforeBlob": "2673c2b2a817cf8400b27f10c7654b7576a76221",
    "afterBlob": "6c7f20b851cb65010038fad25b0cd9aa24f37866",
    "before": "589b146eb7c4ef89e5a8a24350fa8ee69349c6e0573303679b10a1e1c62b400e",
    "after": "ffb72571ef55348f12dd8d4a732193cc7e86e6add2101e1cedfd1b17c871a290",
    "reason": "Exact position review for two existing display calls after import addition."
  }
];
function undoStage50ThirdDigest(file, current) {
  const entry = stage50ThirdDelta.find(e => e.path === file);
  if (!entry) return current;
  assert.equal(current, entry.after, "Unreviewed Stage50 third pass file drift: " + file);
  return entry.before;
}
function undoStage50SecondDigest(file, current) {
  const entry = stage50SecondDelta.find(e => e.path === file);
  if (!entry) return current;
  assert.equal(current, entry.after, 'Unreviewed Stage50 second pass file drift: ' + file);
  return entry.before;
}
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
  for (const entry of stage50ThirdDelta.filter(e => e.path.startsWith('src/'))) {
    assert.equal(historical[entry.path], entry.afterBlob, 'Unreviewed Stage50 third pass source drift: ' + entry.path);
    if (entry.beforeBlob === null) delete historical[entry.path];
    else historical[entry.path] = entry.beforeBlob;
  }
  for (const entry of stage50SecondDelta.filter(e => e.path.startsWith('src/'))) {
    assert.equal(historical[entry.path], entry.afterBlob, 'Unreviewed Stage50 second pass source drift: ' + entry.path);
    historical[entry.path] = entry.beforeBlob;
  }
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
  current = undoStage50Digest(file, undoStage50SecondDigest(file, undoStage50ThirdDigest(file, current)));
  const entry = loadWebuiRuStage49Review(root).fileDelta.find(e => e.path === file);
  if (!entry) return current;
  assert.equal(current, entry.after, 'Непроверенное изменение файла: ' + file);
  return entry.before;
}
export function verifyWebuiRuStage49Files(root) {
  const packet = loadWebuiRuStage49Review(root);
  for (const entry of stage50ThirdDelta) {
    assert.ok(entry.reason);
    assert.equal(digest(fs.readFileSync(path.join(root,entry.path))),entry.after,"Unreviewed Stage50 third pass file drift: "+entry.path);
  }
  for (const entry of stage50SecondDelta) {
    assert.ok(entry.reason);
    assert.equal(undoStage50ThirdDigest(entry.path,digest(fs.readFileSync(path.join(root,entry.path)))),entry.after,'Unreviewed Stage50 second pass file drift: '+entry.path);
  }
  for (const entry of stage50Delta) {
    assert.ok(entry.reason);
    assert.equal(undoStage50SecondDigest(entry.path,undoStage50ThirdDigest(entry.path,digest(fs.readFileSync(path.join(root,entry.path))))),entry.after,'Unreviewed Stage50 file drift: '+entry.path);
  }
  const seen = new Set();
  for (const entry of packet.fileDelta) {
    assert.ok(!seen.has(entry.path) && entry.reason, entry.path);
    seen.add(entry.path);
    assert.equal(undoStage50Digest(entry.path,undoStage50SecondDigest(entry.path,undoStage50ThirdDigest(entry.path,digest(fs.readFileSync(path.join(root,entry.path)))))),entry.after,
      'Непроверенное изменение файла этапа 49: '+entry.path);
  }
  return packet;
}
