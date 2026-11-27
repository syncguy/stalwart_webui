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
import { inputs, schema } from './check-webuiRu-stage49.mjs';
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
const {DynamicList}=component('src/components/lists/DynamicList.tsx',{
  react:{...React,useState:initial=>[initial,v=>{if(initial===null)pending=v;}]},
  'react-router-dom':{useNavigate:()=>p=>navigations.push(p)},'@/components/ui/button':{Button:button},
  '@/components/common/ConfirmDialog':{ConfirmDialog:()=>null},'@/components/common/EnterpriseUpsell':{EnterpriseUpsell:()=>null},
  '@/hooks/usePermissions':{useIsCommunity:()=>false,usePermissionCheckers:()=>({hasObjectPermission:()=>true})},
  '@/hooks/useResolvedView':{useResolvedView:()=>resolved},'@/lib/layout':layout,'@/lib/permissions':{canAccessView:()=>true},'@/lib/schemaResolver':inputs.resolver,
  '@/stores/schemaStore':{useSchemaStore:f=>f({schema:formSchema,viewToSection:{'x:Account/Resource':'Management'}})},
  './FilterBar':{FilterBar:()=>null},'./ListTable':{ListTable:p=>p.renderRowActions?.({},'raw-id','RAW_NAME')??null},
  './ListStates':{ListError:()=>null,ListMessage:passthrough,ListSpinner:()=>null},'./MassActionBar':{MassActionBar:p=>{massProps=p;return null;}},
  './Pagination':{Pagination},'./RowActions':{RowActions:p=>{rowProps=p;return null;}},'./SelectionBanner':{SelectionBanner:()=>null},
  './listActions':{itemActionHref:fatal,resolveItemActions:()=>[{kind:'mutation',key:'delete',action:{type:'delete',label:'Delete'}}],resolveMassActions:()=>[{type:'delete',label:'Delete'}]},
  './listQuery':{getListFields:()=>({}),itemId:()=>null,itemLabel:()=>''},
  './useDynamicList':{useDynamicList:()=>({items:[],total:20,state:{filters:[],anchors:[],sort:[]}})},
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
