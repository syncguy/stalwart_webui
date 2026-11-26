// Stage48 new client rules, tested using real i18next and the actual pure
// upstream model/summary. No browser, JMAP network or live server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { loadInputs, sourceModule } from './locale-source.mjs';
import { loadStage48Packet } from './locale-stage48.mjs';

const root=process.cwd();
const read=p=>fs.readFileSync(p,'utf8');
const parse=p=>JSON.parse(read(p));
const mod=(p,deps={})=>sourceModule(read(p),p,deps);
const inputs=loadInputs(root);
const packet=loadStage48Packet(root);
const en=parse('src/i18n/en.json'), ru=parse('src/i18n/ru.json');
const app=i18next.createInstance();
await app.init({lng:'ru',fallbackLng:'en',resources:{en:{translation:en},ru:{translation:ru}},interpolation:{escapeValue:false}});
const t=app.t.bind(app);
let accountLocale='en-US';
const utils=mod('src/lib/jmapUtils.ts');
const embedded=mod('src/lib/embeddedSchema.ts',{'@/lib/jmapUtils':utils});
const localDateTime=mod('src/lib/localDateTime.ts');
const duration=mod('src/lib/durationFormat.ts');
const weekly=mod('src/lib/weeklySchedule.ts',{'@/lib/localDateTime':localDateTime,'@/lib/embeddedSchema':embedded});
const fmt=mod('src/lib/format.ts',{'@/i18n':app,'@/lib/durationFormat':duration,'@/lib/localDateTime':localDateTime,'@/lib/weeklySchedule':weekly,'@/stores/accountStore':{DEFAULT_LOCALE:'en-US',useAccountStore:{getState:()=>({locale:accountLocale})}}});
const model=mod('src/features/mailRules/model.ts',{'@/lib/embeddedSchema':embedded,'@/lib/jmapUtils':utils});
const builder=mod('src/features/mailRules/builder.ts',{'@/lib/embeddedSchema':embedded,'./model':model});
const mailboxes=mod('src/features/mailRules/mailboxes.ts');
const summary=mod('src/features/mailRules/summary.ts',{'@/lib/embeddedSchema':embedded,'@/lib/format':fmt,'@/lib/localDateTime':localDateTime,'@/lib/jmapUtils':utils,'@/lib/schemaResolver':inputs.resolver,'./model':model,'./mailboxes':mailboxes});
const clone=v=>JSON.parse(JSON.stringify(v));
const noMarkers=text=>assert.ok(!text.includes('{{')&&!text.startsWith('mailRules.')&&!text.startsWith('webuiRu.'),text);
const ctx={t,schema:inputs.pins[0].data};

// All literal new/removed keys and plural stems in actual AST inventory.
const refs=new Set(inputs.inventory.astReferences.map(r=>r.messageId));
const messageIds=new Set(inputs.inventory.clients.map(r=>r.messageId));
for(const key of [...packet.client.keyDelta.added,...packet.client.keyDelta.changed,...packet.client.keyDelta.forkAdded]){
  assert.ok(messageIds.has(key),key);
  assert.ok(refs.has(key)||refs.has(key.replace(/_(one|other)$/,'')),'No literal consumer: '+key);
}
for(const key of packet.client.keyDelta.removed){
  assert.ok(!messageIds.has(key)&&!refs.has(key),'Removed key remains active: '+key);
}
for(const ref of inputs.inventory.astReferences.filter(r=>r.file.startsWith('src/features/mailRules/'))){
  assert.ok(messageIds.has(ref.messageId)||messageIds.has(ref.messageId+'_one'),'Unknown mail-rule key: '+ref.messageId);
}
console.log('PASS Stage48: all added/changed/removed client keys checked against actual literal consumers');

// All 16 sentence branches in both display languages; account locale is
// intentionally opposite to the selected UI language.
let sentenceCount=0;
for(const language of ['ru','en','ru']){
  await app.changeLanguage(language);accountLocale=language==='ru'?'en-GB':'ru-RU';
  const conjunction=language==='ru'?' и ':' and ', disjunction=language==='ru'?' или ':' or ';
  assert.equal(fmt.webuiRuFormatRuleList(['A','B']), 'A'+conjunction+'B');
  assert.equal(fmt.webuiRuFormatRuleList(['A','B'],'disjunction'), 'A'+disjunction+'B');
  assert.equal(fmt.formatList(['A','B']), language==='ru'?'A and B':'A и B');
  for(const withConditions of [false,true])for(const withExceptions of [false,true])for(const withActions of [false,true])for(const stopProcessing of [false,true]){
    const input={matchAll:withConditions?['ALL_A','ALL_B']:[],matchAny:withConditions?['ANY_A','ANY_B']:[],matchNone:withExceptions?['NONE_A','NONE_B']:[],actions:withActions?['ACT_A','ACT_B']:[],stopProcessing};
    const before=JSON.stringify(input);
    const result=summary.ruleSentence(ctx,input);
    noMarkers(result);
    for(const [expected,marker] of [[withConditions,'ALL_A'],[withExceptions,'NONE_A'],[withActions,'ACT_A']]){
      assert.equal(result.includes(marker),expected,result);
    }
    if(withConditions)assert.ok(result.includes('ANY_A'+disjunction+'ANY_B'),result);
    if(withExceptions)assert.ok(result.includes('NONE_A'+disjunction+'NONE_B'),result);
    if(withActions)assert.ok(result.includes('ACT_A'+conjunction+'ACT_B'),result);
    assert.equal(result.includes(language==='ru'?'прекратить обработку остальных правил':'stop processing more rules'),stopProcessing,result);
    assert.equal(result.includes(language==='ru'?'ничего не делать':'do nothing'),!withActions&&!stopProcessing,result);
    assert.equal(JSON.stringify(input),before);
    sentenceCount++;
  }
}
assert.equal(sentenceCount,48);
console.log('PASS Stage48: 16 sentence branches x RU/EN/RU; list joins follow UI locale, account formatting unaffected');

// Exact plural/counter semantics, including Russian "one" for 21, 31...
for(const language of ['ru','en']){
  await app.changeLanguage(language);
  for(const days of [0,1,2,5,11,21,22,25,31,101,111])for(const withSubject of [false,true]){
    const reply={days,...(withSubject?{subject:'RAW_SUBJECT'}:{})};
    const raw=model.newRuleValues(10);raw.actions.reply=reply;
    const start=JSON.stringify(raw);
    const out=summary.summarizeCustomRule(ctx,raw).actions;
    assert.equal(out.length,1);
    const phrase=out[0];noMarkers(phrase);
    assert.equal(phrase.includes('RAW_SUBJECT'),withSubject,phrase);
    if(days===0)assert.ok(phrase.includes(language==='ru'?'каждое письмо':'every message'),phrase);
    else if(days===1)assert.ok(phrase.includes(language==='ru'?'в сутки':'once a day'),phrase);
    else if(language==='en')assert.ok(phrase.includes(days+' days'),phrase);
    else {
      const plural=new Intl.PluralRules('ru').select(days);
      assert.ok(phrase.includes(days+' '+({one:'день',few:'дня',many:'дней',other:'дней'}[plural])),phrase);
    }
    assert.equal(JSON.stringify(raw),start);
  }
}
console.log('PASS Stage48: all reply intervals 0/1/2/5/11/21/22/25/31/101/111, with and without subject, RU/EN');

// New rule model/actions retain raw data, keyword flags and mailbox names.
const body=model.newRuleValues(17);
body.conditions.matchAll={'1':{'@type':'Subject',operator:'Contains',values:{RAW_TEST:true}}};
body.actions.addKeywords={$seen:true,RAW_KEYWORD:true};
body.actions.removeKeywords={$flagged:true};
body.actions.copyTo={b:true,RAW_BOX:true};
body.actions.moveTo={c:true};
body.actions.stopProcessing=true;
const rawBefore=JSON.stringify(body);
for(const language of ['ru','en','ru']){
  await app.changeLanguage(language);
  const summaryResult=summary.summarizeCustomRule({...ctx,mailboxName:mailboxes.mailboxNamer(t,undefined)},body);
  const text=summary.ruleSentence(ctx,summaryResult);
  noMarkers(text);assert.ok(text.includes('RAW_KEYWORD')&&text.includes('RAW_BOX')&&text.includes('RAW_TEST'),text);
  assert.ok(text.includes(language==='ru'?'Корзина':'Trash')&&text.includes(language==='ru'?'Спам':'Junk'),text);
  assert.equal(JSON.stringify(body),rawBefore);
  assert.ok(model.parseActions(body.actions).addKeywords.includes('$seen'));
  assert.equal(mailboxes.mailboxNamer(t,[{id:'id1',path:['RAW_USER_MAILBOX']}])('id1'),'RAW_USER_MAILBOX');
  assert.ok(mailboxes.mailboxNamer(t,[])('unknown-id').includes('unknown-id'));
  const flags=builder.setFlag(body.actions,'flag',true);
  assert.ok(flags.addKeywords.$flagged&&!flags.removeKeywords.$flagged);
  assert.ok(flags.addKeywords.RAW_KEYWORD);
  assert.equal(JSON.stringify(body),rawBefore);
  for(const issue of ['rejectNotAlone','keywordConflict','forwardingNotAllowed','sizeInvalid'])noMarkers(summary.ruleIssueMessage(t,issue));
  assert.equal(model.needsAction(model.parseActions({stopProcessing:true})),false);
}
assert.equal(builder.isInlineField({type:{type:'enum',enumName:'TimeZone'}}),false);
assert.equal(builder.isInlineField({type:{type:'enum',enumName:'Weekday'}}),true);
console.log('PASS Stage48: new raw rule model, action/flag semantics, mailbox fallback, issue captions and TimeZone editor trait');

// Source-level shared form opt-in: only requested titles are suppressed,
// original sections and default/generic behavior stay intact.
const logic=mod('src/components/forms/formLogic.ts',{
  '@/lib/jmapPatch':{},'@/lib/schemaResolver':inputs.resolver,'@/lib/jmapUtils':utils,'@/lib/embeddedSchema':embedded,
  '@/lib/fieldRules':{},'@/lib/localDateTime':localDateTime,'@/lib/weeklySchedule':weekly,'@/extensions/widgets':{}
});
const sections=[{title:'first',fields:[{formField:{name:'actions'}}]},{title:'second',fields:[{formField:{name:'other'}}]}];
const snapshot=JSON.stringify(sections);
assert.equal(logic.withoutSectionTitles(sections,undefined),sections);
assert.equal(logic.withoutSectionTitles(sections,[]),sections);
const filtered=logic.withoutSectionTitles(sections,['actions']);
assert.equal(filtered[0].title,undefined);assert.equal(filtered[1],sections[1]);assert.equal(JSON.stringify(sections),snapshot);
console.log('PASS Stage48: shared DynamicForm title suppression is explicit and nonmutating');

// Actual KeywordInput SSR: client labels and raw key callback, not mutated
// model values. A separate stage must qualify new server schema metadata.
const h=React.createElement, captured={};
function component(p,deps){
 const exports={};
 const js=ts.transpileModule(read(p),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const imports={react:React,'react/jsx-runtime':jsx,'react-i18next':{useTranslation:()=>({t,i18n:app})},...deps};
 vm.runInNewContext(js,{exports,require:n=>{assert.ok(Object.hasOwn(imports,n),p+' '+n);return imports[n];}},{filename:p,timeout:5000});
 return exports;
}
const {KeywordInput}=component('src/features/mailRules/components/KeywordInput.tsx',{
 '@/components/forms/widgets/RemovablePill':{RemovablePill:p=>{captured.pill=p;return h('span',null,p.label);}},
 '@/components/forms/widgets/SetWidget':{SetWidget:p=>{captured.set=p;return h('span',null,Object.keys(p.value).join(','));}},
 '../builder':builder,'../model':model,'../summary':summary,
});
for(const language of ['ru','en']){
 await app.changeLanguage(language);
 const raw={$seen:true,'raw-custom':true};
 let updated;
 const html=renderToStaticMarkup(h(KeywordInput,{type:{type:'set'},value:raw,onChange:v=>{updated=clone(v);},readOnly:false}));
 assert.ok(html.includes(language==='ru'?'Прочитано':'Read')&&html.includes('raw-custom'));
 assert.ok(!html.includes('$seen'));
 assert.deepEqual(clone(captured.set.value),{'raw-custom':true});
 captured.pill.onRemove();assert.deepEqual(updated,{'raw-custom':true});
 captured.set.onChange({'raw-custom':true,'New-Custom':true});
 assert.deepEqual(updated,{$seen:true,'raw-custom':true,'new-custom':true});
 assert.deepEqual(raw,{$seen:true,'raw-custom':true});
 renderToStaticMarkup(h(KeywordInput,{type:{type:'set'},value:raw,onChange:()=>{throw Error('no change');},readOnly:true}));
 assert.equal(captured.pill.onRemove,undefined);
}
console.log('PASS Stage48: actual KeywordInput SSR RU/EN, localized labels, raw IDs/callbacks/read-only');
