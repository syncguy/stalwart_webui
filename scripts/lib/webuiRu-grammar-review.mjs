// Candidate inventory only. A source pair or caption is not a rendering proof.
// New schemas must explicitly review grammar separately from ordinary translation.
const grammarKind = (slot) => {
  if (/^list\/.+\/singular$/.test(slot)) return 'list-singular';
  if (/^list\/.+\/plural$/.test(slot)) return 'list-plural';
  if (/^object\/.+\/description$/.test(slot)) return 'object-description-fallback';
  return null;
};

const contexts = {
  'list-singular': ['action-name/create-edit', 'delete/confirmation', 'detail/title', 'toast'],
  'list-plural': ['count/selection', 'pagination', 'mass-delete/confirmation'],
  'object-description-fallback': ['create-edit without list (consumer review required)'],
};

const consumerKey=u=>JSON.stringify([u.edition,u.screen,u.mode,u.renderer,u.lookupSlot]);
export function grammarReviewCandidates(before, after, beforeUsages=new Map(), afterUsages=new Map()) {
  const rows = [];
  for (const [key, row] of after) {
    const kind = grammarKind(row.slot);
    if (!kind) continue;
    // Compare within edition, not the union of both schemas. A newly introduced
    // edition binding of an otherwise unchanged string also needs review.
    const previous = before.get(key);
    const previousEditions = new Set(previous?.locations.map(l => l.edition) ?? []);
    const oldConsumers=new Set((beforeUsages.get(key)??[]).map(consumerKey));
    const newConsumers=[...new Map((afterUsages.get(key)??[]).filter(u=>!oldConsumers.has(consumerKey(u))).map(u=>[consumerKey(u),{
      edition:u.edition,screen:u.screen,mode:u.mode,renderer:u.renderer,lookupSlot:u.lookupSlot,
    }])).values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
    const bindings = row.locations.filter(l => !previousEditions.has(l.edition)||newConsumers.some(u=>u.edition===l.edition))
      .map(({ edition, schemaHash, sourcePointer }) => ({ edition, schemaHash, sourcePointer }));
    if (!bindings.length) continue;
    bindings.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
    rows.push({
      slot: row.slot, original: row.original, kind,
      status: kind === 'object-description-fallback' ? 'needs-consumer-review' : 'needs-grammar-review',
      possibleContexts: contexts[kind], bindings,
      ...(newConsumers.length?{newConsumers}:{}),
    });
  }
  return rows.sort((a, b) => a.slot.localeCompare(b.slot, 'en') || a.original.localeCompare(b.original, 'en'));
}
