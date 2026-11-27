// Reviewed custom consumers introduced by the 1.2.x schemas. This adapter is
// separate from the immutable historical graph; no raw schema is modified.
import assert from 'node:assert/strict';
const key = r => r.slot + '\0' + r.original;
const senderNames = new Set(['x:BlockedSender','x:SafeSender']);
const summaryEnums = new Set(['MailRuleAddressOperator','MailRuleTextOperator','MailRuleSentToMePlacement','MailRuleImportanceLevel','MailRuleSensitivityLevel','MailRuleMessageKind','Weekday']);

export function webuiRuStage49Graph(inputs, graph) {
  const bySlot = new Map(inputs.inventory.rows.map(r=>[r.slot,r]));
  const add = (row, renderer, screen, mode, reason) => {
    for (const b of row.locations) graph.usages.get(key(row)).push({
      ...b, section:'Account',area:'Account',screen,mode,via:renderer,
      lookupSlot:row.slot,renderer,state:'wired',conditions:[reason,'ACL/license/data-dependent; browser not tested'],
    });
  };
  for (const row of inputs.inventory.rows) {
    const [kind,owner,,field] = row.slot.split('/');
    const kept=[];
    for (const usage of graph.usages.get(key(row))) {
      // WeeklyScheduleWidget and its View both use client labels and parsed
      // raw day/time values, never the inner generic field metadata.
      if (owner==='x:WorkingHoursSlot' || usage.conditions.some(c=>c==='special-widget:objectList:x:WorkingHoursSlot')) continue;
      if (senderNames.has(usage.screen) && usage.mode!=='search') {
        if (kind==='list' && ['title','subtitle','column/address'].includes(row.slot.split('/').slice(2).join('/'))) {
          kept.push({...usage,state:'wired',renderer:'SenderListPage'});
        }
        // Other generic list/form metadata is replaced by the custom page.
        continue;
      }
      if (usage.screen==='x:MailRule' && usage.mode!=='search') {
        if (kind==='list') {
          if (['title','subtitle','singular'].includes(row.slot.split('/')[2])) kept.push({...usage,state:'wired',renderer:row.slot.endsWith('/singular')?'DynamicForm/form title':'MailRulesPage'});
          continue;
        }
        if (owner==='x:MailRule') {
          const name=kind==='field'?row.slot.split('/')[2]:field;
          if (['conditions','actions'].includes(name)) continue;
          if (name==='position' && usage.mode!=='detail') continue;
          kept.push({...usage,state:'wired',renderer:'MailRuleFormPage/DynamicForm/DynamicView'});
          continue;
        }
        if (['x:MailRuleActions','x:MailRuleConditions'].includes(owner)) continue;
        if (kind==='variant' && owner==='x:MailRuleCondition') {
          kept.push({...usage,state:'wired',renderer:'RuleItemList/summary.conditionPhrase'});continue;
        }
        if (kind==='enum' && (summaryEnums.has(owner)||owner==='TimeZone')) {
          kept.push({...usage,state:'wired',renderer:'RuleItemList/FieldControl/summary.enumLabel'});continue;
        }
        if (owner.startsWith('x:MailRule')) {
          // Detail uses the summary override. Conditions use inline controls
          // (labels/ARIA but no descriptions) or the block FieldRow. Actions
          // use ActionDetails, with explicit form and field owners.
          if (usage.mode==='detail') continue;
          if (kind==='field') {
            const type=inputs.pins.find(p=>p.schemaHash===usage.schemaHash).data.fields[owner]?.properties[row.slot.split('/')[2]]?.type;
            const inline=type && inputs.webuiRuInlineField({type});
            const action=['x:MailRuleReply','x:MailRuleRedirect','x:MailRuleReject'].includes(owner);
            if (inline && !action) continue;
          }
          kept.push({...usage,state:'wired',renderer:'RuleItemList/RuleFieldRow/ActionDetails/FieldRow'});continue;
        }
      }
      kept.push(usage);
    }
    graph.usages.set(key(row),kept);
    if (kind==='enum' && summaryEnums.has(owner)) add(row,'summary.enumLabel','x:MailRule','summary','Exact enum name in mail-rule summary; raw value preserved');
    if (kind==='variant' && owner==='x:MailRuleCondition') add(row,'summary.conditionPhrase','x:MailRule','summary','Actual selected condition variant; raw @type preserved');
    if (senderNames.has(owner) && row.slot===`field/${owner}/address/description`) add(row,'SenderListPage/AddEntries',owner,'create','Permitted AddEntries form');
  }
  // The existing search index has literal field and section consumers even
  // when the custom page replaces those labels. Only top-level routed forms
  // are added here; no unreachable nested forms are promoted.
  for (const name of ['x:MailRule','x:BlockedSender','x:SafeSender']) {
    for (const row of inputs.inventory.rows.filter(r=>r.slot.startsWith(`form/${name}/`))) {
      if (row.category==='form-section'||row.category==='form-field-label') add(row,'schemaStore.buildSearchIndex',name,'search','Routed top-level form: field/section label and breadcrumb');
    }
    const singular=bySlot.get(`list/${name}/singular`);
    assert.ok(singular);add(singular,'schemaStore.buildSearchIndex',name,'search','Localized breadcrumb for object description');
  }
  return graph;
}
