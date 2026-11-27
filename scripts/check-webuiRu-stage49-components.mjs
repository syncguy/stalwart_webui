// Real source modules and React SSR, isolated synthetic data; no browser/JMAP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { create } from 'zustand';
import i18next from 'i18next';
import { inputs, runtimeSchema as schema, currentPairs, previousPairs } from './check-webuiRu-stage49.mjs';
import { sourceModule } from './lib/locale-source.mjs';
import './lib/offline-guard.mjs';

const read=p=>fs.readFileSync(p,'utf8');
const parse=p=>JSON.parse(read(p));
const mod=(p,deps={})=>sourceModule(read(p),p,deps);
const app=i18next.createInstance();
await app.init({lng:'ru',fallbackLng:'en',resources:{en:{translation:parse('src/i18n/en.json')},ru:{translation:parse('src/i18n/ru.json')}},interpolation:{escapeValue:false}});
const t=app.t.bind(app), h=React.createElement;
let activeHash=inputs.pins[0].schemaHash;
const display=(slot,original)=>schema.schemaText(activeHash,app.language,slot,original);
const utils=mod('src/lib/jmapUtils.ts');
const embedded=mod('src/lib/embeddedSchema.ts',{'@/lib/jmapUtils':utils});
const local=mod('src/lib/localDateTime.ts');
const duration=mod('src/lib/durationFormat.ts');
const weekly=mod('src/lib/weeklySchedule.ts',{'@/lib/localDateTime':local,'@/lib/embeddedSchema':embedded});
const fmt=mod('src/lib/format.ts',{'@/i18n':app,'@/lib/durationFormat':duration,'@/lib/localDateTime':local,'@/lib/weeklySchedule':weekly,'@/stores/accountStore':{DEFAULT_LOCALE:'en-US',useAccountStore:{getState:()=>({locale:'en-US'})}}});
const model=mod('src/features/mailRules/model.ts',{'@/lib/embeddedSchema':embedded,'@/lib/jmapUtils':utils});
const builder=mod('src/features/mailRules/builder.ts',{'@/lib/embeddedSchema':embedded,'./model':model});
const summary=mod('src/features/mailRules/summary.ts',{'@/lib/embeddedSchema':embedded,'@/lib/format':fmt,'@/lib/localDateTime':local,'@/lib/jmapUtils':utils,'@/lib/schemaResolver':inputs.resolver,'./model':model,'./mailboxes':mod('src/features/mailRules/mailboxes.ts')});
const lazyPage=()=>()=>null;
const sel=mod('src/extensions/pages.sel.ts',{'@/extensions/lazyPage':{lazyPage}});
const pages=mod('src/extensions/pages.ts',{'@/extensions/lazyPage':{lazyPage},'@/extensions/pages.sel':sel,'@/lib/schemaResolver':inputs.resolver});
const perms=mod('src/lib/permissions.ts',{'@/lib/schemaResolver':inputs.resolver});
const layout=mod('src/lib/layout.ts',{'@/lib/schemaResolver':inputs.resolver,'@/lib/permissions':perms,'@/extensions/pages':pages});
const {useSchemaStore}=mod('src/stores/schemaStore.ts',{'zustand':{create},'@/i18n/webuiRuSchemaText':schema,'@/lib/layout':layout});

for(const pin of inputs.pins) {
  const before=JSON.stringify(pin.data);
  for(const hash of [pin.schemaHash,'unknown']) {
    activeHash=hash;
    useSchemaStore.getState().setSchema(pin.data,hash);
    for(const language of ['ru','en','ru']) {
      await app.changeLanguage(language);
      useSchemaStore.getState().setDisplayLanguage(language);
      const state=useSchemaStore.getState();
      assert.equal(state.schema,pin.data);
      assert.ok(state.searchIndex.some(r=>r.text===(language==='ru'&&hash!=='unknown'?'Ресурсы':'Resources')));
      const ctx={schema:pin.data,t,display};
      for(const [enumName,value,condition] of [
        ['MailRuleImportanceLevel','high',{'@type':'Importance',level:'high'}],
        ['MailRuleSensitivityLevel','private',{'@type':'Sensitivity',level:'private'}],
        ['MailRuleMessageKind','meetingRequest',{'@type':'MessageType',kind:'meetingRequest'}],
        ['MailRuleSentToMePlacement','to',{'@type':'SentToMe',placement:'to'}],
      ]) {
        const raw=JSON.stringify(condition), original=pin.data.enums[enumName].find(e=>e.name===value).label;
        const result=summary.conditionPhrase(ctx,condition);
        assert.ok(result.includes(display(`enum/${enumName}/${value}/label`,original)),result);
        assert.equal(JSON.stringify(condition),raw);
      }
      const rawCondition={'@type':'From',operator:'domain',values:{'raw.example':true}};
      const result=summary.conditionPhrase(ctx,rawCondition);
      assert.ok(result.includes('raw.example'));
      assert.ok(result.includes(language==='ru'&&hash!=='unknown'?'Принадлежит домену':'Is in the domain'));
      const action=model.parseActions({setImportance:'high',addKeywords:{$seen:true,RAW_KEYWORD:true}});
      const initial=JSON.stringify(action);
      assert.ok(summary.actionPhrases(ctx,action).some(s=>s.includes(language==='ru'&&hash!=='unknown'?'Высокая':'High')));
      assert.equal(JSON.stringify(action),initial);
    }
  }
  assert.equal(JSON.stringify(pin.data),before);
}
console.log('PASS Stage49: actual store/search RU-EN-RU, both editions, unknown hash, raw identity, rule enum/variant summaries');

const passthrough=({children})=>h(React.Fragment,null,children);
const common={react:React,'react/jsx-runtime':jsx,'react-i18next':{useTranslation:()=>({t,i18n:app})},'@/hooks/useSchemaText':{useSchemaText:()=>display,useSchemaActionName:()=> (slot,original)=>schema.schemaActionName(activeHash,app.language,slot,original)},'lucide-react':new Proxy({},{get:()=>()=>null}),'@/lib/utils':{cn:(...v)=>v.filter(Boolean).join(' ')}};
function component(file,deps={},globals={}) {
  const exports={}, modules={...common,...deps};
  const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{exports,...globals,require:name=>{assert.ok(Object.hasOwn(modules,name),name);return modules[name];}},{filename:file,timeout:5000});
  return exports;
}
const render=(C,p={})=>renderToStaticMarkup(h(C,p));
for(const language of ['ru','en']) {
  await app.changeLanguage(language);
  for(const kind of ['ci','local']) {
    const identity={version:'2.1.1',edition:'ru',timestampUtc:'2026-11-26T06:00:00Z',kind,sourceSha:kind==='ci'?'a'.repeat(40):null,runNumber:kind==='ci'?'51':null,runAttempt:kind==='ci'?'2':null};
    const {WebuiRuBuildInfo}=component('src/components/common/WebuiRuBuildInfo.tsx',{}, {__WEBUI_RU_BUILD_IDENTITY__:identity});
    const html=render(WebuiRuBuildInfo);
    assert.ok(html.includes('2.1.1')&&html.includes(identity.timestampUtc)&&html.includes('UTC'));
    assert.ok(!html.includes('{{')&&!html.includes('undefined')&&!html.includes('null'));
    if(kind==='ci')assert.ok(html.includes('51.2')&&html.includes('a'.repeat(12)));
    else assert.ok(html.includes(language==='ru'?'Локальная':'Local')&&!html.includes('51.2'));
    assert.ok(html.includes(language==='ru'?'Русская редакция · лабораторная версия':'Russian edition · laboratory build'));
  }
}
assert.ok(read('src/components/layout/TopBar.tsx').includes('<WebuiRuBuildInfo />'));
console.log('PASS Stage49: actual tooltip content, RU/EN and CI/local identity; existing TopBar slot wired');

let formSchema=inputs.pins[0].data;
const controls=[];
const formContext={useFormContext:()=>({schema:formSchema,idPrefix:'test',mode:'edit',baseline:{}}),useFieldScope:()=>({path:[],readOnly:false}),fieldIds:(_prefix,path)=>({inputId:path.join('-'),labelId:path.join('-')+'-label',descriptionId:path.join('-')+'-description',errorId:path.join('-')+'-error'}),EnclosingSchemaContext:passthrough};
const {RuleFieldRow}=component('src/features/mailRules/components/RuleFieldRow.tsx',{
  '@/components/common/Markdown':{Markdown:({source})=>h('span',null,source)},
  '@/components/forms/FieldRow':{FieldLabel:({label})=>h('label',null,label),FieldError:({error})=>h('span',null,error)},
  '@/components/forms/formContext':formContext,'@/extensions/widgets':{widgetTraits:()=>({layout:'side'})},
});
const fieldRowStub=props=>{controls.push(props);return h('div',null,props.formKey?display(`form/${props.formKey}/field/${props.formField.name}`,props.formField.label):props.formField.label);};
const controlStub=props=>{controls.push(props);return h('input',{'aria-label':props.control?.['aria-label'],value:typeof props.value==='string'?props.value:'',readOnly:true});};
const {RuleItemList}=component('src/features/mailRules/components/RuleItemList.tsx',{
  '@/components/ui/button':{Button:passthrough},'@/components/ui/select':{Select:passthrough,SelectContent:passthrough,SelectItem:({children,value})=>h('option',{value},children),SelectTrigger:passthrough,SelectValue:()=>null},
  '@/components/forms/FieldRow':{FieldRow:fieldRowStub,FieldError:({error})=>h('span',null,error)},
  '@/components/forms/FormProvider':{FieldScopeProvider:passthrough},
  '@/components/forms/formLogic':{missingNestedFields:()=>[]},'@/components/forms/formContext':formContext,
  '@/components/forms/widgets/FieldControl':{FieldControl:controlStub},'@/lib/embeddedSchema':embedded,
  '@/lib/format':fmt,'@/lib/schemaResolver':inputs.resolver,'../builder':builder,
  './KeywordInput':{KeywordInput:controlStub},'./RuleFieldRow':{RuleFieldRow},
});
for(const pin of inputs.pins) {
  formSchema=pin.data; activeHash=pin.schemaHash;
  for(const language of ['ru','en','ru']) {
    await app.changeLanguage(language);
    const value={'raw-item-id':{'@type':'Subject',operator:'contains',values:{'raw subject':true}}};
    const before=JSON.stringify(value);let changed;
    const html=render(RuleItemList,{name:'matchAll',objectName:'x:MailRuleCondition',value,onChange:v=>{changed=v;},readOnly:false,invalid:false,itemLabel:n=>'ITEM '+n,addLabel:'ADD'});
    const label=pin.data.schemas['x:MailRuleCondition'].variants.find(v=>v.name==='Subject').label;
    assert.ok(html.includes(display('variant/x:MailRuleCondition/Subject/label',label)));
    assert.equal(JSON.stringify(value),before);
    const control=controls.findLast(c=>c.value==='contains');assert.ok(control);
    control.onChange('is');
    assert.equal(changed['raw-item-id'].operator,'is');
    assert.equal(changed['raw-item-id']['@type'],'Subject');
    assert.deepEqual(JSON.parse(JSON.stringify(changed['raw-item-id'].values)),{'raw subject':true});
    const formKey='x:MailRuleKeywordTest',field=pin.data.fields[formKey].properties.keywords;
    const formField=pin.data.forms[formKey].sections[0].fields[0];
    const rowHtml=render(RuleFieldRow,{field,formField,formKey,fieldOwner:formKey,value:{RAW:true},onChange:()=>{},Edit:controlStub});
    assert.ok(rowHtml.includes(display(`form/${formKey}/field/keywords`,formField.label)));
    assert.ok(rowHtml.includes(display(`field/${formKey}/keywords/description`,field.description)));
  }
}
console.log('PASS Stage49: actual custom rule editor and field row SSR, exact owners, RU/EN, raw callback values');

// RU-49-01: actual list create button and form create/edit title. Synthetic
// stores and leaf controls only; all mutation callbacks remain traps.
const fatal=()=>{throw new Error('Запрещена реальная мутация в SSR');};
let formModel,resolved,pending,massProps,rowProps,formConfirm,selectedCount=1;
const clicks=[],navigations=[];
const button=p=>{clicks.push(p);return h('button',{onClick:p.onClick},p.children);};
const {DynamicForm}=component('src/components/forms/DynamicForm.tsx',{
  'react-router-dom':{useNavigate:()=>p=>navigations.push(p)},'@/components/ui/button':{Button:button},
  '@/components/common/ConfirmDialog':{ConfirmDialog:p=>{formConfirm=p;return null;}},
  '@/components/common/FloatingActionBar':{FloatingActionBar:passthrough,FloatingActionDivider:passthrough,FloatingActionDot:passthrough},
  '@/hooks/usePermissions':{useCanAccess:()=>true},'@/lib/objectOptions':{coerceLabel:String},'@/lib/schemaResolver':inputs.resolver,
  '@/components/forms/CreatedValuesDialog':{CreatedValuesDialog:()=>null},'@/components/forms/FormProvider':{FormProvider:passthrough},
  '@/components/forms/FormSections':{FormSections:()=>null},'@/i18n/schemaFormContext':{sectionDisplayContext:fatal},
  '@/components/forms/UnsavedChangesDialog':{UnsavedChangesDialog:()=>null},'@/components/forms/useDynamicForm':{useDynamicForm:()=>formModel},
});
const {Pagination}=component('src/components/lists/Pagination.tsx',{'@/components/ui/button':{Button:button}});
let useListState=()=>({items:[],total:20,state:{filters:[],anchors:[],sort:[]}});
const listStates=component('src/components/lists/ListStates.tsx',{'@/components/ui/button':{Button:button}});
const {DynamicList}=component('src/components/lists/DynamicList.tsx',{
  react:{...React,useState:initial=>[initial,v=>{if(initial===null)pending=v;}]},
  'react-router-dom':{useNavigate:()=>p=>navigations.push(p)},'@/components/ui/button':{Button:button},
  '@/components/common/ConfirmDialog':{ConfirmDialog:()=>null},'@/components/common/EnterpriseUpsell':{EnterpriseUpsell:()=>null},
  '@/hooks/usePermissions':{useIsCommunity:()=>false,usePermissionCheckers:()=>({hasObjectPermission:()=>true})},
  '@/hooks/useResolvedView':{useResolvedView:()=>resolved},'@/lib/layout':layout,'@/lib/permissions':{canAccessView:()=>true},'@/lib/schemaResolver':inputs.resolver,
  '@/stores/schemaStore':{useSchemaStore:f=>f({schema:formSchema,viewToSection:{'x:Account/Resource':'Management','x:Log':'Management','x:NetworkListener':'Settings',...Object.fromEntries(['x:MtaHook','x:MtaMilter','x:MtaInboundThrottle','x:MtaOutboundThrottle','x:MtaQueueQuota','x:MemoryLookupKeyValue'].map(name=>[name,'Settings']))}})},
  './FilterBar':{FilterBar:()=>null},'./ListTable':{ListTable:p=>p.renderRowActions?.({},'raw-id','RAW_NAME')??null},
  './ListStates':listStates,'./MassActionBar':{MassActionBar:p=>{massProps=p;return null;}},
  './Pagination':{Pagination},'./RowActions':{RowActions:p=>{rowProps=p;return null;}},'./SelectionBanner':{SelectionBanner:()=>null},
  './listActions':{itemActionHref:fatal,resolveItemActions:()=>[{kind:'mutation',key:'delete',action:{type:'delete',label:'Delete'}}],resolveMassActions:()=>[{type:'delete',label:'Delete'}]},
  './listQuery':{getListFields:()=>({}),itemId:()=>null,itemLabel:()=>''},
  './useDynamicList':{useDynamicList:(...args)=>useListState(...args)},
  './useListActions':{useListActions:()=>({pending:false,runMassAction:fatal,runItemAction:fatal})},
  './useListSelection':{useListSelection:()=>({selectedIds:Array.from({length:selectedCount},(_,i)=>'raw-'+i),allMatching:false,pageState:'partial'})},
});
const resolvedView=(s,name)=>{
  const object=inputs.resolver.resolveObject(s,name);
  return {object,resolvedSchema:inputs.resolver.resolveSchema(s,object.objectName),list:inputs.resolver.resolveList(s,name,object.objectName)};
};
for(const pin of inputs.pins)for(const hash of [pin.schemaHash,'unknown'])for(const language of ['ru','en','ru']) {
  formSchema=pin.data;activeHash=hash;await app.changeLanguage(language);
  const localized=language==='ru'&&hash!=='unknown';
  for(const [name,noun,formName] of [['x:Account/Resource','ресурс','x:ResourceAccount'],['x:MailRule','почтовое правило','x:MailRule']]) {
    resolved=resolvedView(pin.data,name);
    const data={name:'RAW_NAME',description:'RAW_NAME',...(resolved.list.labelProperty?{[resolved.list.labelProperty]:'RAW_NAME'}:{})};
    const initialData=JSON.stringify(data);
    formModel={schema:pin.data,resolved,mode:'create',isSingleton:false,state:{data,original:{},fieldErrors:{},variant:'Resource'},parentForm:null,variantForm:pin.data.forms[formName],sections:[],guard:{},save:fatal,remove:fatal};
    const create=language==='en'?'Create '+resolved.list.singularName:localized?'Создать '+noun:'Создать';
    assert.ok(render(DynamicForm,{viewName:name,objectId:null}).includes('>'+create+'</h1>'));
    formModel.mode='edit';
    const edit=(language==='en'?'Edit '+resolved.list.singularName:localized?'Изменить '+noun:'Изменить')+(resolved.list.labelProperty?': RAW_NAME':'');
    const editHtml=render(DynamicForm,{viewName:name,objectId:'raw-id'});
    assert.ok(editHtml.includes('>'+edit+'</h1>'),name+': '+editHtml.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1]+' expected '+edit);
    assert.ok(formConfirm.title.includes(display(`list/${name}/singular`,resolved.list.singularName).replace(/^./,c=>c.toUpperCase())));
    assert.equal(JSON.stringify(data),initialData);
    if(name==='x:Account/Resource') {
      for(selectedCount of [1,2,5]) {
        clicks.length=0;pending=massProps=rowProps=null;
        assert.ok(render(DynamicList,{viewName:name}).includes(create));
        const createButton=clicks.find(p=>JSON.stringify(p.children)?.includes(create));assert.ok(createButton);createButton.onClick();
        assert.equal(navigations.at(-1),'/Management/x:Account/Resource/new');
        massProps.onSelect({type:'delete',label:'Delete'},'delete');
        assert.ok(pending.title.includes(String(selectedCount)));
        assert.ok(pending.title.includes(display(`list/${name}/${selectedCount===1?'singular':'plural'}`,selectedCount===1?resolved.list.singularName:resolved.list.pluralName)));
        rowProps.onMutation({kind:'mutation',key:'delete',action:{type:'delete',label:'Delete'}});
        assert.ok(pending.description.includes('RAW_NAME'));
      }
    }
  }
  const footer=render(Pagination,{range:{from:1,to:5,hasPrev:false,hasNext:true},total:20,count:5,pluralName:'resources',onPrev:fatal,onNext:fatal});
  assert.ok(footer.includes(language==='ru'?'Показано 1–5 из 20':'Showing 1-5 of 20 resources'),footer);
}
console.log('PASS Stage49 grammar: actual Resource button and Resource/MailRule create/edit titles, deletion/count labels, RU/EN/RU, unknown hash, raw route/data preserved');

// Stage50: editorial correction census. Derive expected listener corrections
// independently from the historical catalogs (not from the new override table).
const oldCatalogue=parse('src/i18n/schema/ru.json');
const oldPermission=parse('src/i18n/schema/permission_ru.json');
const listenerRows=Object.entries(oldCatalogue.entries).filter(([,e])=>/слушател/i.test(e.ru));
assert.equal(listenerRows.length,45);
assert.ok(!oldCatalogue.scopedEntries.some(e=>/слушател/i.test(e.ru)));
assert.ok(!Object.values(parse('src/i18n/schema/webuiRu-1.2.json').entries).some(e=>/слушател/i.test(e.ru)));
const newWord=s=>s.replaceAll('Слушател','Прослушивател').replaceAll('слушател','прослушивател');
const expectedEditorial=Object.fromEntries(listenerRows.map(([slot,e])=>[slot,newWord(e.ru)]));
Object.assign(expectedEditorial,{
  'variant/x:Account/User/label':'Пользователь','variant/x:Account/Group/label':'Группа',
  'variant/x:Account/Resource/label':'Ресурс','nav/container/Settings/MTA':'Почтовый транспорт',
});
assert.deepEqual(Object.keys(schema.webuiRuStage50Editorial).sort(),Object.keys(expectedEditorial).sort());
assert.equal(Object.keys(expectedEditorial).length,49);
const seenEditorial=new Set();
let pairBindings=0, correctedBindings=0;
for(const pairs of [previousPairs,currentPairs])for(const row of pairs.values())for(const binding of row.locations) {
  const {slot,original}=row, hash=binding.schemaHash;
  const before=schema.stage49SchemaText(hash,'ru',slot,original);
  const correction=schema.webuiRuStage50Editorial[slot];
  const expected=Object.hasOwn(expectedEditorial,slot)&&before!==original?expectedEditorial[slot]:before;
  const actual=schema.stage50SchemaText(hash,'ru',slot,original);
  assert.equal(actual,expected,slot+' '+hash);
  if(expected!==before){
    assert.equal(correction.before,before,slot);seenEditorial.add(slot);correctedBindings++;
    assert.equal(schema.schemaText(hash,'ru-RU',slot,original),expected);
    for(const lang of ['en','de'])assert.equal(schema.schemaText(hash,lang,slot,original),original);
    assert.equal(schema.schemaText('unknown','ru',slot,original),original);
    assert.equal(schema.schemaText(hash,'ru',slot,original+' changed'),original+' changed');
  }
  pairBindings++;
}
assert.deepEqual([...seenEditorial].sort(),Object.keys(expectedEditorial).sort());
// The actual permission widget tries permissionDisplayLabel after schema display,
// so the already localized label must stay unchanged; raw permission IDs never change.
const permission=mod('src/i18n/schemaPermissionText.ts',{'./schema/permission_ru.json':oldPermission});
const listenerPermissions=Object.entries(oldPermission.entries).filter(([,e])=>/слушател/i.test(e.ru));
assert.equal(listenerPermissions.length,5);
for(const pin of [...inputs.pins,...parse('scripts/data/pinned-schema-manifest.json').schemas]){
  for(const [name,e] of listenerPermissions){
    const localized=schema.schemaText(pin.schemaHash,'ru','enum/Permission/'+name+'/label',e.original);
    assert.equal(permission.permissionDisplayLabel(name,localized),newWord(e.ru),name);
    assert.equal(schema.schemaText(pin.schemaHash,'en','enum/Permission/'+name+'/label',e.original),e.original);
  }
  assert.equal(schema.schemaActionName(pin.schemaHash,'ru','list/x:NetworkListener/singular','listener'),'прослушиватель');
  assert.equal(schema.schemaActionName(pin.schemaHash,'en','list/x:NetworkListener/singular','listener'),'listener');
  assert.equal(schema.schemaActionName(pin.schemaHash,'ru','list/x:NetworkListener/singular','listener changed'),null);
}
assert.equal(schema.schemaActionName('unknown','ru','list/x:NetworkListener/singular','listener'),null);
console.log('PASS Stage50: 49 editorial slots; '+correctedBindings+' corrected / '+pairBindings+' total pinned edition bindings; unchanged fallback, five permissions and listener action case.');
// Second pass: previous overlay stays unchanged; test all pinned pairs and exact new bindings.
const second=schema.webuiRuStage50Editorial2;
assert.equal(Object.keys(second).length,96);
const seenSecond=new Set();let secondBindings=0;
for(const pairs of [previousPairs,currentPairs])for(const row of pairs.values())for(const binding of row.locations) {
  const {slot,original}=row, hash=binding.schemaHash;
  const prior=schema.stage50SchemaText(hash,'ru',slot,original);
  const e=Object.hasOwn(second,slot)?second[slot]:null;
  const applied=e && e.original===original && e.before===prior;
  assert.equal(schema.schemaText(hash,'ru',slot,original),applied?e.ru:prior,slot+' '+hash);
  if(applied){
    assert.equal(oldCatalogue.entries[slot].original,original);
    assert.equal(oldCatalogue.entries[slot].ru,prior);
    assert.equal(schema.schemaText(hash,'ru-RU',slot,original),e.ru);
    for(const lang of ['en','de'])assert.equal(schema.schemaText(hash,lang,slot,original),original);
    assert.equal(schema.schemaText('unknown','ru',slot,original),original);
    assert.equal(schema.schemaText(hash,'ru',slot,original+' changed'),original+' changed');
    seenSecond.add(slot);secondBindings++;
  }
}
assert.deepEqual([...seenSecond].sort(),Object.keys(second).sort());
const secondActions=[
  ['x:MtaHook','hook','веб-хук MTA'],
  ['x:MtaMilter','milter','фильтр Milter'],
  ['x:MtaInboundThrottle','throttle','лимит скорости приёма'],
  ['x:MtaOutboundThrottle','throttle','лимит скорости отправки'],
  ['x:MtaQueueQuota','quota','квоту очереди'],
  ['x:MemoryLookupKeyValue','key','пару'],
];
const secondLabels={
  'nav/link/Settings/x:MtaHook':'Веб-хуки MTA',
  'nav/container/Settings/MTA/Rates & Quotas':'Лимиты и квоты',
  'nav/link/Settings/x:MtaInboundThrottle':'Лимиты приёма',
  'nav/link/Settings/x:MtaOutboundThrottle':'Лимиты отправки',
  'list/x:MtaInboundThrottle/title':'Лимиты скорости приёма',
  'list/x:MtaOutboundThrottle/title':'Лимиты скорости отправки',
  'nav/link/Settings/x:MemoryLookupKeyValue':'Пары ключ–значение',
  'list/x:MemoryLookupKeyValue/title':'Пары «ключ — значение» в памяти',
  'nav/link/Settings/x:Metrics/CollectorOtel':'OpenTelemetry',
  'nav/link/Settings/x:Metrics/CollectorPrometheus':'Prometheus',
  'form/x:Metrics/CollectorOtel/title':'Сбор метрик OpenTelemetry',
  'form/x:Metrics/CollectorPrometheus/title':'Сбор метрик Prometheus',
};
for(const pin of [...inputs.pins,...parse('scripts/data/pinned-schema-manifest.json').schemas]){
  for(const [slot,ru] of Object.entries(secondLabels))
    assert.equal(schema.schemaText(pin.schemaHash,'ru',slot,oldCatalogue.entries[slot].original),ru);
  for(const [name,original,noun] of secondActions){
    const slot='list/'+name+'/singular';
    assert.equal(schema.schemaActionName(pin.schemaHash,'ru',slot,original),noun);
    assert.equal(schema.schemaActionName(pin.schemaHash,'en',slot,original),original);
    assert.equal(schema.schemaActionName(pin.schemaHash,'ru',slot,original+' changed'),null);
    assert.equal(schema.schemaActionName('unknown','ru',slot,original),null);
  }
}
console.log('PASS Stage50 second editorial pass: '+seenSecond.size+' slots / '+secondBindings+' exact bindings; six action cases and twelve operator menu/title labels.');
let secondFormCases=0;
for(const pin of inputs.pins)for(const language of ['ru','en','ru']){
  formSchema=pin.data;activeHash=pin.schemaHash;await app.changeLanguage(language);
  for(const [name,original,noun] of secondActions){
    resolved=resolvedView(pin.data,name);
    const data={name:'RAW_NAME',description:'RAW_NAME',...(resolved.list.labelProperty?{[resolved.list.labelProperty]:'RAW_NAME'}:{})};
    const initialData=JSON.stringify(data);
    formModel={schema:pin.data,resolved,mode:'create',isSingleton:false,state:{data,original:{},fieldErrors:{}},parentForm:null,variantForm:pin.data.forms[name],sections:[],guard:{},save:fatal,remove:fatal};
    const create=language==='ru'?'Создать '+noun:'Create '+original;
    clicks.length=0;
    const listHtml=render(DynamicList,{viewName:name});
    assert.ok(listHtml.includes(create),name+' missing button '+create);
    const createButton=clicks.find(p=>JSON.stringify(p.children)?.includes(create));assert.ok(createButton);
    createButton.onClick();assert.equal(navigations.at(-1),'/Settings/'+name+'/new');
    assert.ok(render(DynamicForm,{viewName:name,objectId:null}).includes('>'+create+'</h1>'),name+' create title');
    formModel.mode='edit';
    const edit=(language==='ru'?'Изменить '+noun:'Edit '+original)+(resolved.list.labelProperty?': RAW_NAME':'');
    assert.ok(render(DynamicForm,{viewName:name,objectId:'raw-id'}).includes('>'+edit+'</h1>'),name+' edit title');
    assert.equal(JSON.stringify(data),initialData);
    secondFormCases++;
  }
}
console.log('PASS Stage50 second pass: '+secondFormCases+' actual list/create/edit SSR cases, raw routes and fixture data unchanged.');



// Real VariantSelect with synthetic form state. Raw variant values, selected
// radio, and segmented control must survive RU -> EN -> RU.
const {VariantSelect}=component('src/components/forms/VariantSelect.tsx',{
  '@/components/ui/select':{Select:passthrough,SelectContent:passthrough,SelectItem:passthrough,SelectTrigger:passthrough,SelectValue:()=>null},
  '@/components/forms/FieldRow':{FieldLabel:({label})=>h('label',null,label)},
  '@/components/forms/formContext':{...formContext,useInPanel:()=>false},
  '@/components/forms/formLogic':{VARIANT_FIELD:'@type'},
});
for(const pin of inputs.pins){
  activeHash=pin.schemaHash;
  const variants=pin.data.schemas['x:Account'].variants;
  const before=JSON.stringify(variants);
  for(const language of ['ru','en','ru']){
    await app.changeLanguage(language);
    const html=render(VariantSelect,{label:'Account type',variantScope:'x:Account',variants,value:'Resource',onChange:fatal,readOnly:false});
    assert.ok(html.includes('role="radiogroup"')&&html.includes('aria-checked="true"'),html);
    for(const v of variants)assert.ok(html.includes('>'+ (language==='ru'?expectedEditorial['variant/x:Account/'+v.name+'/label']:v.label)+'</button>'),v.name);
    assert.equal(JSON.stringify(variants),before);
    useSchemaStore.getState().setSchema(pin.data,pin.schemaHash);
    useSchemaStore.getState().setDisplayLanguage(language);
    assert.ok(useSchemaStore.getState().searchIndex.some(e=>e.text===(language==='ru'?'Прослушиватели':'Listeners')));
  }
}

// Structured JMAP error -> actual useDynamicList -> actual DynamicList -> actual
// ListError. Only network/data/router boundaries are mocked, with no requests.
const errorTypes=mod('src/services/errors.ts');
const errorFormatter=mod('src/lib/jmapErrors.ts',{'@/services/errors':errorTypes,'@/i18n':app});
let query;
const hook=mod('src/components/lists/useDynamicList.ts',{
  react:{useEffect:()=>{}},'react-router-dom':{useSearchParams:()=>[new URLSearchParams(),fatal]},
  '@/data/objects':{useJmapList:()=>query},'@/lib/jmapErrors':errorFormatter,'@/services/errors':errorTypes,
  './listQuery':{
    LIST_PAGE_SIZE:50,buildListFilter:()=>undefined,buildListPageParams:()=>({}),buildListSort:()=>undefined,
    effectiveSort:()=>null,isStrandedPage:()=>false,itemId:()=>null,
    pageRange:()=>({from:0,to:0,hasPrev:false,hasNext:false}),
  },
  './listUrlState':{listStateKey:()=>'',parseListSearch:()=>({filters:{},sort:null,anchors:[]}),serializeListSearch:()=>new URLSearchParams(),nextSort:()=>null},
});
useListState=hook.useDynamicList;
const rawLog='No log tracers configured on the server';
const method=(type,description)=>new errorTypes.JmapMethodError('x:Log/query','0',{type,description});
const known=method('invalidArguments',rawLog);
const cases=[
  ['x:Log',known,true],
  ['x:Domain',known,false],
  ['x:Log',method('invalidArguments',rawLog+'.'),false],
  ['x:Log',method('serverFail',rawLog),false],
  ['x:Log',method('futureUnknown',rawLog),false],
  ['x:Log',method('invalidArguments','Other diagnostic'),false],
  ['x:Log',method('invalidArguments',null),false],
  ['x:Log',new errorTypes.ApiError(403,'Forbidden',{detail:rawLog}),false],
];
formSchema=inputs.pins[0].data;activeHash=inputs.pins[0].schemaHash;
assert.ok(formSchema.lists['x:Log']);
for(const lang of ['ru','en','ru']){
  await app.changeLanguage(lang);
  for(const [name,error,special] of cases){
    resolved=resolvedView(formSchema,name);
    query={isError:true,error,isFetching:false,isPending:false,isSuccess:false,data:{list:[],total:0,position:0},refetch:()=>{}};
    const state=hook.useDynamicList(resolved.object.objectName,resolved.list);
    assert.equal(state.webuiRuNoLogTracers,special);
    const expected=special?t('webuiRu.logs.noTracersConfigured',rawLog):errorFormatter.errorMessage(error);
    const html=render(DynamicList,{viewName:name});
    assert.ok(html.includes('role="alert"'),html);
    assert.ok(html.includes(expected),name+' '+lang+' '+expected);
    if(special&&lang==='ru')assert.ok(!html.includes(rawLog)&&!html.includes(t('jmapErrors.invalidArguments')));
    assert.equal(query.error,error);
  }
}
console.log('PASS Stage50: real VariantSelect RU/EN/RU and actual hook/list/alert with 24 structured error scenarios; no server/browser claims.');

// Source-executed sidebar behavior with synthetic browser boundaries (not browser layout).
const navTree=mod('src/components/layout/navTree.ts');
const data=inputs.pins[0].data;
const sidebarChanges=[];
let captured=false,hoverState=false,overflowMeasure,cleaned=false,refElement={clientWidth:100,scrollWidth:180};
let sidebarEffects=true;
const sidebarDeps={
  react:{...React,useState:initial=>[sidebarEffects?hoverState:initial,v=>{hoverState=v;}],
    useRef:()=>({current:sidebarEffects?refElement:null}),
    useEffect:callback=>{if(sidebarEffects)overflowMeasure=callback();},useId:()=> 'test-id'},
  'react-router-dom':{Link:passthrough,useLocation:()=>({pathname:'/Settings/x:MtaInboundThrottle'}),useNavigate:()=>fatal},
  '@/components/ui/button':{Button:button},'@/components/common/DynamicIcon':{DynamicIcon:()=>null},
  '@/components/common/EnterpriseUpsell':{EnterpriseUpsell:()=>null},
  '@/components/ui/collapsible':{Collapsible:passthrough,CollapsibleContent:passthrough,CollapsibleTrigger:passthrough},
  '@/components/ui/tooltip':{Tooltip:passthrough,TooltipContent:passthrough,TooltipTrigger:passthrough},
  '@/stores/uiStore':{useUIStore:f=>f({activeSection:'Settings',sidebarOpen:true,setSidebarOpen:fatal,setActiveSection:fatal})},
  './navTree':navTree,'./sidebarContext':{SIDEBAR_ID:'sidebar',SidebarNavContext:passthrough,useSidebarNav:fatal},
  './useLayoutNavigation':{useLayoutNavigation:()=>({layouts:data.layouts,isVisible:()=>true,isLocked:()=>false,landingPath:fatal})}
};
let observerCallback;
const {Sidebar,WebuiRuNavOverflowHint}=component('src/components/layout/Sidebar.tsx',sidebarDeps,{
  window:{addEventListener:()=>{},removeEventListener:()=>{cleaned=true;},matchMedia:()=>({matches:false})},
  document:{fonts:{ready:Promise.resolve()}},
  ResizeObserver:class{constructor(cb){observerCallback=cb;}observe(){}disconnect(){cleaned=true;}}
});
const hintProps={text:'Очень длинная подпись',children:label=>h('button',null,label)};
const hiddenHint=WebuiRuNavOverflowHint(hintProps);
assert.equal(hoverState,true,'measure clipped label');
assert.equal(hiddenHint.props.children[1],false,'initial render no hint before measurement');
const visibleHint=WebuiRuNavOverflowHint(hintProps);
assert.equal(visibleHint.props.children[1].props.children,hintProps.text);
refElement.clientWidth=200;observerCallback();assert.equal(hoverState,false,'growing panel clears overflow');
overflowMeasure();assert.equal(cleaned,true);
sidebarEffects=false;
const tree=Sidebar({width:240,maxWidth:520,onWidthChange:w=>sidebarChanges.push(w)});
const handle=tree.props.children.find(child=>child?.props?.role==='separator');
assert.ok(handle);assert.equal(handle.props['aria-valuenow'],240);assert.equal(handle.props['aria-valuemax'],520);
const eventTarget={focus(){},setPointerCapture(){captured=true;},hasPointerCapture(){return captured;}};
const event={button:0,isPrimary:true,clientX:252,pointerId:7,currentTarget:eventTarget,preventDefault(){}};
handle.props.onPointerDown(event);
handle.props.onPointerMove({...event,clientX:452});
assert.equal(sidebarChanges.at(-1),440);
handle.props.onLostPointerCapture();handle.props.onPointerMove({...event,clientX:500});assert.equal(sidebarChanges.at(-1),440);
for(const [key,width] of [['ArrowLeft',228],['ArrowRight',252],['Home',200],['End',520]]) {
  handle.props.onKeyDown({key,preventDefault(){}});assert.equal(sidebarChanges.at(-1),width);
}
handle.props.onDoubleClick();assert.equal(sidebarChanges.at(-1),240);
assert.match(read('src/pages/AdminPanel.tsx'),/useState\(240\)/);
assert.match(read('src/pages/AdminPanel.tsx'),/Math\.max\(200, Math\.min\(sidebarMax, Math\.round\(width\)\)\)/);
assert.match(read('src/pages/AdminPanel.tsx'),/md:ml-\[calc\(var\(--webui-ru-sidebar-width\)\+12px\)\]/);
assert.match(read('src/components/layout/TopBar.tsx'),/md:w-\[calc\(var\(--webui-ru-sidebar-width,240px\)-12px\)\]/);
assert.ok(!read('src/pages/AdminPanel.tsx').includes('localStorage'));
console.log('PASS Stage50 sidebar: synthetic clipping measurement, conditional full text, drag/capture and keyboard handlers, default reset and layout source contract; actual browser pending.');
