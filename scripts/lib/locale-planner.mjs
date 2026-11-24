import { at, compare, digest, json } from './locale-source.mjs';

export const CATEGORIES = ['translated', 'missing', 'keep-original', 'technical', 'renderer-unwired', 'unreachable/conditional', 'needs-review'];
const unique = values => [...new Set(values)].sort(compare);
const counts = rows => Object.fromEntries(CATEGORIES.map(c => [c, rows.filter(r => r.classification === c).length]));
const key = row => row.slot + '\0' + row.original;

export function protectedTokens(text) {
  // Exact multisets, including repeated placeholders and Markdown destinations/code.
  return [...text.matchAll(/\{\{[^{}]+\}\}|%\{[^{}]+\}%?|\{(?:version|algorithm|date-[^{}]+)\}|`+[^`]*`+|https?:\/\/[^\s<>\])]+|\]\([^)]*\)|<\/?[A-Za-z][^>]*>/g)]
    .map(m => m[0]).sort(compare);
}
export const textSafe = (original, ru) => json(protectedTokens(original)) === json(protectedTokens(ru));

function technicalReason(row) {
  if (row.category !== 'form-field-placeholder') return null;
  const s = row.original;
  if (/^(?:https?|ldaps?):\/\/\S+$/.test(s)) return 'technical-placeholder:URI';
  if (/^\/?(?:[\w.-]+\/)+[\w.-]+$/.test(s)) return 'technical-placeholder:path';
  if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(s)) return 'technical-placeholder:email';
  if (/^(?:\d+\.){3}\d+$/.test(s)) return 'technical-placeholder:IPv4';
  if (/^\d+(?:ms|s|m|h|d)?$/.test(s)) return 'technical-placeholder:number-or-duration';
  if (/^[\w-]+(?:\.[\w-]+)*\.example\.(?:com|org)$|^example\.(?:com|org)$/.test(s)) return 'technical-placeholder:example-host';
  if (/^(?:dc|cn|ou)=/.test(s) || /^\(&\(objectClass=/.test(s)) return 'technical-placeholder:LDAP';
  if (s.startsWith('{')) {
    try { JSON.parse(s); return 'technical-placeholder:JSON'; } catch { /* prose stays in review */ }
  }
  return null;
}

function matchRule(row, rules) {
  return rules.filter(r => r.slot === row.slot && r.original === row.original &&
    (!r.schemaHash || row.locations.some(l => l.schemaHash === r.schemaHash)));
}

export function semanticGroup(row) {
  const domains = unique(row.usages.map(u => u.area));
  const field = row.slot.match(/\/field\/(.*?)(?:\/(?:placeholder|keyLabel|valueLabel))?$/)?.[1]
    ?? row.slot.match(/^field\/.*\/([^/]+)\/description$/)?.[1];
  const scope = domains.length ? domains.join('+') : 'unmapped:' + row.locations[0].sourcePointer.split('/')[1];
  // No global English-word grouping: domain, display role and field grammar are retained.
  const grammar = field ?? (row.category === 'list' ? row.slot.split('/').at(-1) : row.category);
  return scope + '|' + row.category + '|' + grammar;
}

function displayedText(inputs, row, usage) {
  const { schema, options, permission } = inputs;
  if (!['wired', 'slot-mismatch'].includes(usage.state) || !usage.lookupSlot) return { ru: row.original, source: 'renderer-not-verified' };
  let ru = schema.schemaText(usage.schemaHash, 'ru', usage.lookupSlot, row.original);
  let source = ru !== row.original ? 'schemaText' : 'original';
  if (row.category === 'enum' && schema.canTranslateSchema(usage.schemaHash, 'ru')) {
    const [, name, ...rest] = row.slot.split('/');
    const id = rest.slice(0, -1).join('/');
    if (usage.renderer === 'EnumMultiSelect' && name === 'Permission') {
      ru = permission.permissionDisplayLabel(id, ru); source = 'permission_ru:EnumMultiSelect';
    } else if (usage.renderer.endsWith(':quota')) {
      ru = options.quotaOptionLabel(ru); source = 'quotaOptionLabel:map';
    } else if (usage.renderer.endsWith(':headerProtection')) {
      ru = options.headerProtectionOptionLabel(ru); source = 'headerProtectionOptionLabel:enum';
    } else if (usage.renderer.includes(':Intl')) {
      // Do not persist host ICU/date-dependent output as an approved translation.
      return { ru: null, source: usage.renderer, conditional: 'Intl/browser-ICU-dependent; English fallback allowed' };
    }
  }
  return { ru, source };
}

export function classify(inputs, graph) {
  const { inventory, pins, policy, catalog, adapterDrift } = inputs;
  const pinByHash = new Map(pins.map(p => [p.schemaHash, p]));
  const originals = new Map();
  for (const row of inventory.rows) originals.set(row.slot, unique([...(originals.get(row.slot) ?? []), row.original]));
  const rows = inventory.rows.map(row => {
    const uses = (graph.usages.get(key(row)) ?? []).map(u => ({ ...u, text: displayedText(inputs, row, u) }));
    const reasons = [];
    const conflicts = originals.get(row.slot).length > 1;
    const unknown = row.locations.some(l => !policy.schemaHashes.includes(l.schemaHash));
    const mismatch = row.locations.some(l => at(pinByHash.get(l.schemaHash)?.data, l.sourcePointer) !== row.original);
    const entry = catalog.entries[row.slot];
    const changed = entry && entry.original !== row.original;
    // A source conflict is resolved only by complete reviewed hash+slot+original
    // bindings. Never treat an arbitrary translated fallback as proof.
    const scoped = row.locations.map(l => {
      const matches = (catalog.scopedEntries ?? []).filter(e => e.schemaHash === l.schemaHash &&
        e.slot === row.slot && e.original === row.original);
      if (matches.length !== 1) return null;
      const e = matches[0];
      const reviewed = policy.contextCandidates.filter(p => p.schemaHash === e.schemaHash &&
        p.slot === e.slot && p.original === e.original && p.ru === e.ru);
      return reviewed.length === 1 && e.ru !== e.original && textSafe(e.original, e.ru) &&
        inputs.schema.schemaText(l.schemaHash, 'ru', row.slot, row.original) === e.ru ? e : null;
    });
    const scopedResolved = conflicts && !entry && scoped.length > 0 && scoped.every(Boolean) &&
      new Set(scoped.map(e => e.ru)).size === 1;
    const keep = matchRule(row, policy.keepOriginal);
    const technical = matchRule(row, policy.technical);
    const syntax = technicalReason(row);
    const resolvedAlias = u => u.state === 'slot-mismatch' && u.text.ru && u.text.ru !== row.original;
    const wired = uses.filter(u => u.state === 'wired' || resolvedAlias(u));
    const unwired = uses.filter(u => u.state === 'unwired' || u.state === 'slot-mismatch' && !resolvedAlias(u));
    const uncertain = uses.filter(u => u.state === 'review');
    const translatedUses = wired.filter(u => u.text.ru !== null && u.text.ru !== row.original);
    const intlUses = wired.filter(u => u.text.conditional);
    const catalogTranslation = scopedResolved || entry?.original === row.original && entry.ru !== row.original;
    let classification;
    if (unknown || mismatch || changed || conflicts && !scopedResolved || adapterDrift.length) {
      classification = 'needs-review';
      if (unknown) reasons.push('unknown-schema-hash');
      if (mismatch) reasons.push('original-source-mismatch');
      if (changed) reasons.push('accepted-original-changed');
      if (conflicts && !scopedResolved) reasons.push('cross-schema-slot-conflict: use hash+slot+original binding');
      if (adapterDrift.length) reasons.push('renderer-source-drift');
    } else if (technical.length || syntax) {
      classification = 'technical'; reasons.push(technical[0]?.reason ?? syntax);
    } else if (keep.length) {
      classification = 'keep-original'; reasons.push(keep[0].reason);
    } else if (unwired.length) {
      classification = 'renderer-unwired'; reasons.push('observed-lookup-slot-mismatch-or-raw-path');
    } else if (!uses.length) {
      classification = 'unreachable/conditional'; reasons.push('no-proven-navigation-consumer: direct routes/search/custom paths may exist');
    } else if (uncertain.length || intlUses.length) {
      classification = 'needs-review';
      if (uncertain.length) reasons.push('custom-or-compact-renderer-needs-adapter');
      if (intlUses.length) reasons.push('Intl-labels-conditional-on-browser-ICU');
    } else if (translatedUses.length === wired.length && wired.length) {
      classification = 'translated'; reasons.push('exact-source-translation-in-audited-consumers');
    } else if (entry?.original === row.original && entry.ru === row.original) {
      classification = 'needs-review'; reasons.push('identical-accepted-text-needs-explicit-policy');
    } else {
      classification = 'missing'; reasons.push(translatedUses.length ? 'translation-present-only-in-some-renderers' : 'no-translation-in-audited-consumers');
    }
    const result = {
      id: digest(key(row)).slice(0, 20), slot: row.slot, original: row.original, category: row.category,
      classification, reasons, catalogState: changed ? 'changed-original' : catalogTranslation ? 'translated' : entry ? 'same-original' : 'missing',
      acceptedTranslation: scopedResolved ? scoped[0].ru : entry?.original === row.original ? entry.ru : null,
      sourceConflict: conflicts, scopedBindingVerified: scopedResolved,
      locations: row.locations, sections: unique(uses.map(u => u.section)),
      reachability: uses.length ? 'static-reference-only' : 'unproven', access: 'unknown',
      renderer: { wired: wired.length, unwired: unwired.length, review: uncertain.length },
      translatedUses: translatedUses.length, intlUses: intlUses.length,
      usages: uses,
    };
    result.semanticGroup = semanticGroup(result);
    return result;
  });
  const staleRules = ['keepOriginal', 'technical', 'contextCandidates'].flatMap(kind => policy[kind]
    .filter(r => !rows.some(row => matchRule(row, [r]).length)).map(r => ({ kind, ...r })));
  return { rows, staleRules };
}

export function translationMemory(inputs, rows) {
  const memory = new Map();
  const add = (original, ru, source) => {
    if (!ru || ru === original) return;
    const list = memory.get(original) ?? [];
    if (!list.some(x => x.ru === ru && json(x.source) === json(source))) list.push({ ru, source });
    memory.set(original, list);
  };
  for (const row of rows) {
    if (row.catalogState === 'translated') add(row.original, row.acceptedTranslation, { kind: 'accepted-catalog', slot: row.slot, semanticGroup: row.semanticGroup });
    for (const u of row.usages) if (u.text.ru && u.text.ru !== row.original) add(row.original, u.text.ru, { kind: u.text.source, slot: row.slot, semanticGroup: row.semanticGroup });
  }
  // Glossary is a candidate source, never blanket approval for another context.
  for (const [original, ru] of Object.entries(inputs.glossary.pairs)) add(original, ru, { kind: 'glossary', file: 'scripts/schema-glossary.ru.json' });
  const glossaryConflicts = [];
  for (const decision of inputs.policy.glossaryDecisions) {
    const accepted = inputs.catalog.entries[decision.sourceSlot];
    if (!accepted || accepted.original !== decision.original || accepted.ru !== decision.ru) throw new Error('Устарело решение глоссария: ' + decision.original);
    const old = inputs.glossary.pairs[decision.original];
    if (old && old !== decision.ru) glossaryConflicts.push({ original: decision.original, glossary: old, preferred: decision.ru, sourceSlot: decision.sourceSlot });
    const list = (memory.get(decision.original) ?? []).filter(x => x.source.kind !== 'glossary');
    list.push({ ru: decision.ru, source: { kind: 'accepted-glossary-decision', slot: decision.sourceSlot } });
    memory.set(decision.original, list);
  }
  return { memory, glossaryConflicts };
}

export function candidates(inputs, rows) {
  const { memory, glossaryConflicts } = translationMemory(inputs, rows);
  const groups = new Map();
  const scopedRows = rows.flatMap(row => {
    const rules = matchRule(row, inputs.policy.contextCandidates);
    if (!rules.some(r => r.schemaHash)) return [row];
    const scopes = new Map();
    for (const location of row.locations) {
      const signature = json(rules.filter(r => !r.schemaHash || r.schemaHash === location.schemaHash));
      scopes.set(signature, [...(scopes.get(signature) ?? []), location]);
    }
    return [...scopes.values()].map(locations => ({ ...row, locations }));
  });
  for (const row of scopedRows) {
    if (['translated', 'technical', 'keep-original'].includes(row.classification)) continue;
    // A renderer problem does not justify rewriting an already accepted translation.
    const accepted = row.catalogState === 'translated';
    const contextual = matchRule(row, inputs.policy.contextCandidates);
    const suggestions = new Map();
    function add(ru, source, rank) {
      if (!ru || ru === row.original) return;
      const x = suggestions.get(ru) ?? { ru, sources: [], rank, safe: textSafe(row.original, ru) };
      x.sources.push(source); x.rank = Math.min(rank, x.rank); suggestions.set(ru, x);
    }
    for (const c of contextual) add(c.ru, { kind: 'context-candidate', slot: c.slot, schemaHash: c.schemaHash, reason: c.reason }, 0);
    if (accepted) add(row.acceptedTranslation, { kind: 'existing-translation-preserved', slot: row.slot }, 1);
    for (const m of memory.get(row.original) ?? []) add(m.ru, m.source,
      m.source.semanticGroup === row.semanticGroup ? 2 : m.source.kind === 'accepted-glossary-decision' ? 3 : m.source.kind === 'glossary' ? 5 : 4);
    const choices = [...suggestions.values()].sort((a, b) => a.rank - b.rank || compare(a.ru, b.ru));
    const blocked = row.reasons.some(r => ['unknown-schema-hash', 'original-source-mismatch', 'accepted-original-changed', 'renderer-source-drift'].includes(r))
      || row.reasons.some(r => r.startsWith('cross-schema')) && !contextual.length;
    const groupKey = json([row.original, row.semanticGroup, accepted ? row.acceptedTranslation : null, blocked,
      contextual.map(c => [c.schemaHash, c.ru]), choices.map(c => c.ru)]);
    const existing = groups.get(groupKey) ?? {
      id: digest(groupKey).slice(0, 20), original: row.original, semanticGroup: row.semanticGroup,
      reviewStatus: 'pending', apply: false,
      action: accepted ? 'review-renderer-or-reachability' : 'propose-translation',
      suggestions: choices, ambiguous: choices.length > 1,
      selected: !blocked && choices[0]?.safe && (choices.length === 1 || choices[0].rank === 0 && choices[1]?.rank !== 0) ? choices[0].ru : null,
      reviewFlags: [], targets: [], rowIds: [], sections: [],
    };
    const critical = /permission|delete|destroy|certificate|tls|oauth|oidc|relay|download|external|resource|bytes|seconds/i.test(row.original + ' ' + row.slot);
    existing.reviewFlags.push(...row.reasons, ...(critical ? ['security-action-or-unit-review'] : []),
      ...(choices.length > 1 ? ['multiple-contextual-translations'] : []),
      ...(!choices.length ? ['new-translation-required'] : []),
      ...(choices.some(c => !c.safe) ? ['protected-text-mismatch'] : []));
    existing.targets.push(...row.locations.map(l => ({ schemaHash: l.schemaHash, edition: l.edition, slot: row.slot, original: row.original,
      sourcePointer: l.sourcePointer, binding: 'schemaHash+slot+original', catalogWrite: false })));
    existing.rowIds.push(row.id); existing.sections.push(...row.sections);
    groups.set(groupKey, existing);
  }
  return { groups: [...groups.values()].map(g => ({ ...g, reviewFlags: unique(g.reviewFlags), rowIds: unique(g.rowIds), sections: unique(g.sections),
    targets: g.targets.sort((a, b) => compare(json(a), json(b))) })).sort((a, b) => compare(a.id, b.id)), glossaryConflicts };
}

// Explicit editor preview only. Not imported by src/ and never activates a candidate.
export function preview(candidate, hash, slot, original, language) {
  if (language !== 'ru' || !candidate.selected || !textSafe(original, candidate.selected)) return original;
  return candidate.targets.some(t => t.schemaHash === hash && t.slot === slot && t.original === original) ? candidate.selected : original;
}

export function diffRows(previous, rows) {
  const old = new Map((previous?.rows ?? []).map(r => [key(r), r]));
  const current = new Map(rows.map(r => [key(r), r]));
  const oldBySlot = new Map();
  for (const r of previous?.rows ?? []) oldBySlot.set(r.slot, unique([...(oldBySlot.get(r.slot) ?? []), r.original]));
  return {
    baselineProvided: !!previous,
    added: rows.filter(r => !old.has(key(r))).map(r => ({ slot: r.slot, original: r.original, previousOriginals: oldBySlot.get(r.slot) ?? [] })),
    removed: (previous?.rows ?? []).filter(r => !current.has(key(r))).map(r => ({ slot: r.slot, original: r.original })),
    changedClassification: rows.filter(r => old.has(key(r)) && old.get(key(r)).classification !== r.classification)
      .map(r => ({ slot: r.slot, original: r.original, before: old.get(key(r)).classification, after: r.classification })),
  };
}

// Normalize repeated contexts/texts. Full provenance stays available without a
// 200 MB file repeating the same permission conditions for every enum variant.
export function compactReport(report) {
  const contexts = [], texts = [], contextIndex = new Map(), textIndex = new Map();
  const intern = (value, table, index) => {
    const k = json(value);
    if (!index.has(k)) { index.set(k, table.length); table.push(value); }
    return index.get(k);
  };
  const rows = report.rows.map(row => ({ ...row, usages: row.usages.map(u => {
    const { sourcePointer, lookupSlot, text, ...context } = u;
    return { context: intern(context, contexts, contextIndex),
      location: row.locations.findIndex(l => l.schemaHash === u.schemaHash && l.sourcePointer === sourcePointer),
      ...(lookupSlot !== row.slot ? { lookupSlot } : {}), text: intern(text, texts, textIndex) };
  }) }));
  return { ...report, rows, usageContexts: contexts, displayTexts: texts,
    usageFormat: 'row.usages.context indexes usageContexts; location indexes row.locations; text indexes displayTexts; absent lookupSlot equals row.slot' };
}

export function plan(inputs, graph, previous = null) {
  const { rows, staleRules } = classify(inputs, graph);
  const proposal = candidates(inputs, rows);
  function scoped(row, uses) {
    if (row.reasons.some(r => ['unknown-schema-hash', 'original-source-mismatch', 'accepted-original-changed', 'renderer-source-drift'].includes(r) || r.startsWith('cross-schema'))) return row;
    if (['technical', 'keep-original'].includes(row.classification)) return row;
    let classification;
    if (!uses.length) classification = 'unreachable/conditional';
    else if (uses.some(u => u.state === 'unwired' || u.state === 'slot-mismatch' && (!u.text.ru || u.text.ru === row.original))) classification = 'renderer-unwired';
    else if (uses.some(u => u.state === 'review' || u.text.conditional)) classification = 'needs-review';
    else if (uses.every(u => u.text.ru && u.text.ru !== row.original)) classification = 'translated';
    else classification = row.catalogState === 'same-original' ? 'needs-review' : 'missing';
    return { classification };
  }
  const sections = ['Settings', 'Management', 'Account'].map(section => {
    const relevant = rows.filter(r => r.sections.includes(section));
    return { section, slots: relevant.length, ...counts(relevant.map(r => scoped(r, r.usages.filter(u => u.section === section)))), candidateGroups: proposal.groups.filter(g => g.sections.includes(section)).length };
  });
  const screens = graph.screens.map(s => {
    const relevant = rows.filter(r => r.usages.some(u => u.section === s.section && u.screen === s.view));
    const inScreen = u => u.section === s.section && u.screen === s.view;
    return { ...s, slots: relevant.length, ...counts(relevant.map(r => scoped(r, r.usages.filter(inScreen)))), rowIds: relevant.map(r => r.id),
      modes: s.modes.map(mode => {
        const perMode = relevant.filter(r => r.usages.some(u => inScreen(u) && u.mode === mode));
        return { mode, slots: perMode.length, ...counts(perMode.map(r => scoped(r, r.usages.filter(u => inScreen(u) && u.mode === mode)))) };
      }) };
  });
  const conflicts = unique(rows.filter(r => r.sourceConflict).map(r => r.slot)).map(slot => {
    const variants = rows.filter(r => r.slot === slot);
    const resolved = variants.every(r => r.scopedBindingVerified);
    return { slot, variants: variants.map(r => ({ original: r.original, locations: r.locations, scopedBindingVerified: r.scopedBindingVerified })),
      resolution: resolved ? 'Exact reviewed hash+slot+original runtime lookup verified statically; browser acceptance pending.'
        : 'Candidate targets require exact schemaHash+slot+original binding.' };
  });
  const rawJsx = inputs.inventory.rawJsx.map(r => {
    const rule = inputs.policy.clientLiterals.find(p => p.file === r.file && p.kind === r.kind && p.original === r.original);
    return { ...r, classification: rule?.classification ?? 'renderer-unwired', reason: rule?.reason ?? 'literal-not-passed-to-i18n' };
  });
  return { version: 1, stage: 18, scope: 'static source planning; no browser or ACL acceptance', source: inputs.inventory.source,
    inputs: inputs.provenance, schemaHashes: inputs.pins.map(p => p.schemaHash),
    summary: { slots: rows.length, classification: counts(rows), candidateGroups: proposal.groups.length,
      groupsWithSuggestions: proposal.groups.filter(g => g.suggestions.length).length,
      ambiguousGroups: proposal.groups.filter(g => g.ambiguous).length, unassignedSlots: rows.filter(r => !r.sections.length).length,
      sections, acceptedCatalogEntries: Object.keys(inputs.catalog.entries).length, acceptedScopedEntries: (inputs.catalog.scopedEntries ?? []).length },
    diagnostics: { adapterDrift: inputs.adapterDrift, staleRules, unresolvedReferences: graph.unresolved, orphanEntries: inputs.inventory.orphan,
      glossaryConflicts: proposal.glossaryConflicts },
    conflicts, rows, screens, candidates: proposal.groups,
    client: { messages: inputs.inventory.clients.map(c => ({ ...c, classification: c.status === 'translated' ? 'translated' : c.status === 'missing' ? 'missing' : 'needs-review' })),
      extraPluralKeys: inputs.inventory.extraRuPlurals, rawJsx,
      dynamicCalls: inputs.inventory.dynamicCalls.map(c => ({ ...c, classification: 'needs-review' })),
      note: 'Shared client messages are separate from schema slots; AST inventory is not exhaustive JS-string analysis.' },
    diff: diffRows(previous, rows),
  };
}
