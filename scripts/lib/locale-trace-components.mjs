import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import './offline-guard.mjs';
const read=p=>fs.readFileSync(p,'utf8');
let language='ru',hash,schema;
const h=React.createElement, pass=({children})=>h(React.Fragment,null,children), icon=()=>null;
const clone=x=>JSON.parse(JSON.stringify(x));
const exact=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
function mod(p,imports={},extra='',globals={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(read(p)+extra,{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
 {exports,URL,Date,Intl,require:n=>{assert.ok(Object.hasOwn(imports,n),p+': '+n);return imports[n]},...globals},{filename:p,timeout:5000});
 return exports;
}
const manifest=JSON.parse(read('scripts/data/pinned-schema-manifest.json'));
const pins=manifest.schemas.map(p=>({...p,data:JSON.parse(gunzipSync(Buffer.from(read(p.fixture),'base64')))}));
const catalog=JSON.parse(read('src/i18n/schema/ru.json'));
const protectedBefore=read('src/i18n/schema/ru.json');
const review=JSON.parse(read('.artifacts/locale-candidates/classification.json'));
const expected=review.rows.filter(r=>['EventType','Key'].includes(r.slot.split('/')[1]));
assert.equal(expected.length,1441);
const text=mod('src/i18n/schemaText.ts',{'./schema/ru.json':catalog});
const resolver=mod('src/lib/schemaResolver.ts');
const store={useSchemaStore:fn=>fn({schema,schemaHash:hash,viewToSection:{'x:QueuedMessage':'Management'}})};
const t=(key,fallback,args={})=>Object.entries(args).reduce((s,[k,v])=>s.replaceAll('{{'+k+'}}',String(v)),fallback??key);
const common={react:React,'react/jsx-runtime':jsx,'react-i18next':{useTranslation:()=>({t,i18n:{resolvedLanguage:language,language}})},'@/hooks/useSchemaText':null,'@/stores/schemaStore':store,'@/lib/schemaResolver':resolver,
 'lucide-react':new Proxy({},{get:()=>icon}),'@/lib/utils':{cn:(...v)=>v.filter(Boolean).join(' ')}};
const render=(C,p)=>renderToStaticMarkup(h(C,p));
const hooks=mod('src/hooks/useSchemaText.ts',{...common,'@/i18n/schemaText':text});
common['@/hooks/useSchemaText']=hooks;
const displayFor=()=> {const currentHash=hash,currentLanguage=language;return (slot,original)=>text.schemaText(currentHash,currentLanguage,slot,original)};
const trace=mod('src/features/tracing/hooks/useTraceLabels.ts',common);
const rawLive=mod('src/features/tracing/liveTracing.ts');
const fmt=mod('src/features/tracing/format.ts');
const dummy=()=>null;
const scalarFmt={formatDateTime:String,formatElapsed:String,formatNumber:String,formatTime:String};
const traceValue=mod('src/features/tracing/components/TraceValue.tsx',{...common,'react-router-dom':{Link:({children,to})=>h('a',{href:to},children)},'@/lib/format':scalarFmt,'../format':fmt,'../hooks/useTraceLabels':trace});
const timeline=mod('src/features/tracing/components/TraceTimeline.tsx',{...common,'@/lib/format':scalarFmt,'../format':fmt,'../hooks/useTraceLabels':trace,'./TraceValue':traceValue});
const filterImports={...common,'../hooks/useTraceLabels':trace,'../liveTracing':rawLive,
 '@/components/ui/button':{Button:pass},'@/components/ui/input':{Input:dummy},'@/components/ui/label':{Label:pass},'@/components/ui/badge':{Badge:pass},'@/components/ui/card':{Card:pass,CardContent:pass},
 '@/components/ui/select':{Select:pass,SelectContent:pass,SelectItem:pass,SelectTrigger:pass,SelectValue:dummy}};
const live=mod('src/features/tracing/components/LiveTracingForm.tsx',filterImports,'\nexport { FilterEditor };');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name)}
check('1441 accepted exact pairs; both pinned editions',()=>{
 assert.equal(expected.length,1441);
 assert.ok(expected.every(r=>r.classification==='translated'&&catalog.entries[r.slot]?.original===r.original));
});
check('Every EventType label/explanation and Key across both schemas: RU/EN/unknown hash, immutable raw data',()=>{
 for(const pin of pins){schema=pin.data;const before=JSON.stringify(schema);
  for(const lang of ['ru','en','ru'])for(const testHash of [pin.schemaHash,'unknown']){
   hash=testHash;language=lang;const display=displayFor(), labels=trace.traceLabelsFor(schema,display);
   for(const v of schema.enums.EventType){assert.equal(labels.event(v.name).label,display('enum/EventType/'+v.name+'/label',v.label));assert.equal(labels.event(v.name).explanation,display('enum/EventType/'+v.name+'/explanation',v.explanation));assert.equal(labels.event(v.name).known,true)}
   for(const v of schema.enums.Key)assert.equal(labels.key(v.name),display('enum/Key/'+v.name+'/label',v.label));
  }
  assert.equal(JSON.stringify(schema),before);
 }
});
check('Trace cache follows locale/hash; unknown IDs, null schema and changed original fall back',()=>{
 schema=pins[0].data;hash=pins[0].schemaHash;language='ru';const ru=trace.traceLabelsFor(schema,displayFor());
 language='en';const en=trace.traceLabelsFor(schema,displayFor());
 assert.notEqual(ru.key('details'),en.key('details'));assert.equal(en.key('details'),'Details');
 assert.equal(ru.key('unknown-key'),'unknown-key');exact(ru.event('unknown-event'),{label:'unknown-event',known:false});assert.equal(trace.traceLabelsFor(null).key('domain'),'domain');
 const changed=clone(schema);changed.enums.Key.find(v=>v.name==='details').label='Changed details';language='ru';assert.equal(trace.traceLabelsFor(changed,displayFor()).key('details'),'Changed details');
});
check('Actual TraceTimeline/TraceValue SSR translates synthetic labels, preserves nested raw diagnostics and typed values',()=>{
 schema=pins[0].data;hash=pins[0].schemaHash;const event=schema.enums.EventType[0];
 const payload=[{timestamp:'2026-01-15T12:00:00Z',event:event.name,keyValues:[{key:'domain',value:{'@type':'String',value:'raw.invalid'}},{key:'details',value:{'@type':'Event',event:event.name,value:[{key:'details',value:{'@type':'String',value:'RAW_DIAGNOSTIC'}}]}}]}];const before=JSON.stringify(payload);
 for(language of ['ru','en','ru']){const html=render(timeline.TraceTimeline,{events:payload});assert.ok(html.includes(language==='ru'?catalog.entries['enum/EventType/'+event.name+'/label'].ru:event.label));assert.ok(html.includes('RAW_DIAGNOSTIC')&&html.includes('raw.invalid'))}
 assert.equal(JSON.stringify(payload),before);
 const raw=[{key:'details',value:{'@type':'Event',event:'unknown-event',value:[]}}];assert.ok(render(traceValue.TraceKeyValueList,{keyValues:raw,depth:2}).includes('unknown-event'));
});
check('Active live filter labels react without mutating state or SSE parameter keys/values',()=>{
 schema=pins[0].data;hash=pins[0].schemaHash;
 const filters=[{key:'domain',label:'Domain',value:'raw.invalid'}];const before=JSON.stringify(filters),request=JSON.stringify(rawLive.buildTracingParams('raw words',filters));
 for(language of ['ru','en','ru']){const html=render(live.LiveTracingForm,{keywords:'raw words',filters,starting:false,onStart(){},onKeywordsChange(){},onFiltersChange(){}});assert.ok(html.includes(language==='ru'?'Домен':'Domain'));assert.ok(html.includes('raw.invalid'));assert.equal(JSON.stringify(rawLive.buildTracingParams('raw words',filters)),request)}
 assert.equal(JSON.stringify(filters),before);
 const selectHtml=render(live.FilterEditor,{onAdd(){},onCancel(){}});assert.ok(selectHtml.includes('Домен'));
});
check('Live filter selection and add callbacks preserve raw key and original label',()=>{
 schema=pins[0].data;hash=pins[0].schemaHash;language='ru';let stateIndex=0,selectRaw,onAddButton,result;
 const controlled=mod('src/features/tracing/components/LiveTracingForm.tsx',{...filterImports,
  react:{...React,useState:()=>{const n=stateIndex++;return [n===0?'domain':'  raw.invalid  ',v=>{if(n===0)selectRaw=v}]}},
  '@/components/ui/button':{Button:p=>{if(p['aria-label']==='Add this filter')onAddButton=p.onClick;return pass(p)}},
  '@/components/ui/select':{...filterImports['@/components/ui/select'],Select:p=>{p.onValueChange('accountId');return pass(p)}}
 },'\nexport { FilterEditor };');
 render(controlled.FilterEditor,{onAdd:x=>result=x,onCancel(){}});assert.equal(selectRaw,'accountId');onAddButton();exact(result,{key:'domain',label:'Domain',value:'raw.invalid'});
});

const summary=mod('src/features/tracing/components/TraceSummaryCards.tsx',{...filterImports,'@/lib/format':scalarFmt,'../format':fmt});
const normalize=mod('src/features/tracing/normalize.ts',{'@/lib/jmapUtils':{jmapMapToArray:v=>Array.isArray(v)?v:Object.values(v??{})}});
let requested,rawObject;
const detail=mod('src/features/tracing/components/TraceDetailView.tsx',{...filterImports,
 'react-router-dom':{useNavigate:()=>()=>{}},'@/data/objects':{useJmapObject:(...args)=>{requested=args;return {data:rawObject,isSuccess:true}}},
 '@/lib/jmapErrors':{errorMessage:String},'../normalize':normalize,'./TraceTimeline':timeline,'./TraceSummaryCards':summary,
 '@/hooks/useResolvedView':{useResolvedView:()=>({object:{objectName:'x:Trace'}})}});
const session=mod('src/features/tracing/components/LiveTracingSession.tsx',{...filterImports,'@/services/sse':{isStreamActive:()=>true},'./TraceTimeline':timeline});
check('Actual summary, detail and live session show accepted translations; JMAP ID and payload unchanged',()=>{
 schema=pins[0].data;hash=pins[0].schemaHash;
 const v=schema.enums.EventType[0],entry=catalog.entries['enum/EventType/'+v.name+'/label'];
 const events=[{event:v.name,timestamp:'2026-01-15T12:00:00Z',keyValues:[{key:'domain',value:{'@type':'String',value:'raw.invalid'}}]}];
 rawObject={events};const snapshot=JSON.stringify(rawObject);
 for(language of ['ru','en','ru']) {
  const wanted=language==='ru'?entry.ru:v.label;
  assert.ok(render(summary.TraceSummaryCards,{events}).includes(wanted));
  assert.ok(render(detail.TraceDetailView,{viewName:'x:Trace/InboundDelivery',objectId:'raw-id'}).includes(wanted));
  exact(requested,['x:Trace','raw-id']);
  assert.ok(render(session.LiveTracingSession,{status:{kind:'open'},buffer:{events,dropped:0,anchorTimestamp:null},error:null,onStop(){},onRestart(){}}).includes(wanted));
 }
 assert.equal(JSON.stringify(rawObject),snapshot);
});
check('Source catalogue unchanged by synthetic tests',()=>assert.equal(read('src/i18n/schema/ru.json'),protectedBefore));
console.log('Stage41 synthetic React / pure tests: '+checks+' groups PASS; no browser or network.');
