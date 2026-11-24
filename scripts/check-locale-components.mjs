#!/usr/bin/env node
// Synthetic React SSR + callback contracts. Real display components; leaf widgets,
// router/store/permission hooks and chart library mocked. No DOM/browser/JMAP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { sourceModule } from './lib/locale-source.mjs';
import './lib/offline-guard.mjs';

const read = p => fs.readFileSync(p,'utf8');
const catalog = JSON.parse(read('src/i18n/schema/ru.json'));
const { schemaText } = sourceModule(read('src/i18n/schemaText.ts'), 'schemaText.ts', {'./schema/ru.json':catalog});
const {sectionDisplayContext} = sourceModule(read('src/i18n/schemaFormContext.ts'),'schemaFormContext.ts');
const h = React.createElement;
let language = 'ru';
let hash = catalog.meta.schemaHashes[0];
const useSchemaText = () => (slot,original) => schemaText(hash,language,slot,original);
const passthrough = ({children}) => h(React.Fragment,null,children);
const icon = () => null;
const cn = (...parts) => parts.filter(Boolean).join(' ');
const common = {
  react: React, 'react/jsx-runtime':jsxRuntime,
  'react-i18next':{useTranslation:()=>({t:(_key,fallback)=>fallback})},
  'lucide-react':{Lock:icon,ArrowUpDown:icon,ChevronDown:icon,ChevronUp:icon,Info:icon},
  '@/hooks/useSchemaText':{useSchemaText}, '@/lib/utils':{cn},
};
function component(file, dependencies) {
  const exports = {};
  const modules = {...common,...dependencies};
  const compiled = ts.transpileModule(read(file),{fileName:file,compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true
  }}).outputText;
  vm.runInNewContext(compiled,{exports,require(name){
    assert.ok(Object.hasOwn(modules,name),'Unexpected import '+name+' in '+file);
    return modules[name];
  }},{filename:file,timeout:5000});
  return exports;
}
const render = (C,props) => renderToStaticMarkup(h(C,props));
const original = slot => catalog.entries[slot].original;
const ru = slot => catalog.entries[slot].ru;
let capturedField;
const capturedFields = new Map();
const {FieldRow} = component('src/components/forms/FieldRow.tsx',{
  '@/components/ui/label':{Label:({children,...props})=>h('label',props,children)},
  '@/components/common/Markdown':{Markdown:({source})=>h('span',null,source)},
  '@/components/common/HelpTooltip':{HelpTooltip:()=>null},
  '@/components/values/FieldValue':{FieldValue:()=>null},
  '@/components/forms/FormProvider':{FieldScopeProvider:passthrough},
  '@/components/forms/widgets/FieldControl':{FieldControl:props=>{
    capturedField=props;
    capturedFields.set(props.formField.name,props);
    return h('input',{id:props.control.id,defaultValue:props.value,readOnly:props.readOnly});
  }},
  '@/extensions/widgets':{resolveWidget:()=>({traits:{labelMode:'control',layout:'side',readOnlyAsValue:false}})},
  '@/components/forms/formContext':{
    fieldIds:(_prefix,path)=>({inputId:path.join('-'),labelId:path.join('-')+'-label',descriptionId:path.join('-')+'-description',errorId:path.join('-')+'-error'}),
    isEnterpriseLockedIn:()=>false,useFieldScope:()=>({path:[],readOnly:false}),
    useFormContext:()=>({schema:{},idPrefix:'synthetic',mode:'edit',hideEnterprise:false,isCommunity:false}),
  },
  '@/components/forms/formLogic':{requiredMarker:()=>null},
  '@/lib/schemaResolver':{resolveObject:()=>undefined},
});
const {FormSections} = component('src/components/forms/FormSections.tsx',{
  '@/i18n/schemaFormContext':{sectionDisplayContext},'@/components/forms/FieldRow':{FieldRow},
  '@/components/forms/VariantSelect':{VariantSelect:()=>null},
});
for (const formKey of ['x:AddressBook','x:Calendar']) {
  const fieldName='defaultDisplayName', slot='form/'+formKey+'/field/'+fieldName, desc='field/'+formKey+'/'+fieldName+'/description';
  const sectionSlot='form/'+formKey+'/section/section-0';
  const sections=[{key:'section-0',title:original(sectionSlot),fields:[{
    formField:{name:fieldName,label:original(slot)},field:{type:{type:'string'},description:original(desc),update:'mutable'}
  }]}];
  const data={defaultDisplayName:'Synthetic name'};
  const snapshot=JSON.stringify({sections,data});
  let event;
  const props={sections,formKey,data,errors:{},readOnly:false,onFieldChange:(name,value)=>{event=[name,value]}};
  for (const knownHash of catalog.meta.schemaHashes) {
    hash=knownHash;
    for (const lang of ['ru','en','ru']) {
      language=lang;
      const html=render(FormSections,props);
      for (const s of [slot,desc,sectionSlot]) assert.ok(html.includes(lang==='ru'?ru(s):original(s)),s);
      assert.ok(html.includes('Synthetic name'));
      assert.equal(capturedField.formField.name,fieldName);
      assert.equal(capturedField.value,'Synthetic name');
      capturedField.onChange('Edited value');
      assert.deepEqual(event,[fieldName,'Edited value']);
      assert.equal(JSON.stringify({sections,data}),snapshot);
    }
  }
  hash='unknown'; language='ru';
  assert.ok(render(FormSections,props).includes(original(slot)));
}
for (const formKey of ['x:MySqlStore','x:PostgreSqlStore']) {
  for (const e of catalog.scopedEntries.filter(e=>e.slot.startsWith('form/'+formKey+'/'))) {
    hash=e.schemaHash; language='ru';
    const props={formKey,sections:[{key:'section-3',title:e.original,fields:[]}],data:{},errors:{},readOnly:false,onFieldChange:()=>{}};
    assert.ok(render(FormSections,props).includes(e.ru));
    language='en';assert.ok(render(FormSections,props).includes(e.original));
    language='ru';hash=catalog.meta.schemaHashes.find(x=>x!==e.schemaHash);
    assert.ok(render(FormSections,props).includes(e.original));
  }
}
console.log('PASS: actual FormSections + FieldRow SSR, RU/EN/RU snapshots, raw callback identity and scoped section fallback');

const {ColumnHeader}=component('src/components/lists/ColumnHeader.tsx',{});
const headerSlot=Object.keys(catalog.entries).find(k=>k.startsWith('list/x:DmarcExternalReport/column/')&&catalog.entries[k].ru!==catalog.entries[k].original);
assert.ok(headerSlot);
const column={name:headerSlot.split('/').at(-1),label:original(headerSlot)};
let sortField;
const headerProps={column,listKey:'x:DmarcExternalReport',sortable:true,sort:null,onSort:name=>{sortField=name}};
hash=catalog.meta.schemaHashes[0];
for(const lang of ['ru','en','ru']){
  language=lang;
  assert.ok(render(ColumnHeader,headerProps).includes(lang==='ru'?ru(headerSlot):original(headerSlot)));
  assert.ok(render(ColumnHeader,{...headerProps,sortable:false}).includes(lang==='ru'?ru(headerSlot):original(headerSlot)));
  const tree=ColumnHeader(headerProps);
  tree.props.children.props.onClick();
  assert.equal(sortField,column.name);
}
console.log('PASS: actual report ColumnHeader SSR, sortable/plain display and raw sort callback');

const seriesSlot=Object.keys(catalog.entries).find(k=>/^dashboard\/[^/]+\/item\/\d+\/series\/0\/label$/.test(k)&&catalog.entries[k].ru!==catalog.entries[k].original&&catalog.entries[k.replace(/\/series\/0\/label$/,'/title')]);
assert.ok(seriesSlot);
const [,dashboardId,,index]=seriesSlot.split('/');
const itemIndex=Number(index);
const titleSlot=seriesSlot.replace(/\/series\/0\/label$/,'/title');
const label=original(seriesSlot);
let seriesProps,chartData;
const chartWrapper=({children,data})=>{chartData=data;return h('div',null,children)};
const seriesLeaf=props=>{seriesProps=props;return h('span',null,props.name)};
const chartComponents={LineChart:chartWrapper,AreaChart:chartWrapper,BarChart:chartWrapper,Line:seriesLeaf,Area:seriesLeaf,Bar:seriesLeaf,XAxis:icon,YAxis:icon,CartesianGrid:icon,Tooltip:icon};
const {DashboardChart}=component('src/features/dashboard/components/DashboardChart.tsx',{
  recharts:chartComponents,'@/components/ui/card':{Card:({children})=>h('div',null,children)},
  '@/components/common/HelpTooltip':{HelpTooltip:icon},
  '@/components/ui/chart':{ChartTooltipContent:icon,getChartColor:()=> '#888'},
  '../helpers':{bucketTimestamps:()=>[new Date(0)],bucketValues:()=>[17],getBucketCount:()=>1,formatTimeTick:()=> '00:00',formatValue:String},
  './ChartSizedContainer':{ChartSizedContainer:({children})=>children(320,200)},
  './tone':{toneClasses:()=>({surface:'',muted:''})}
});
for(const kind of ['line','area','bar']) {
  const chart={title:original(titleSlot),kind,series:[{label}],stacked:false};
  const raw=JSON.stringify(chart);
  for(const lang of ['ru','en','ru']){
    language=lang;
    const html=render(DashboardChart,{dashboardId,itemIndex,chart,historySamples:[{value:17}],historyWindow:{from:new Date(0),to:new Date(60000)},period:'hour'});
    assert.ok(html.includes(lang==='ru'?ru(titleSlot):original(titleSlot)));
    assert.ok(html.includes(lang==='ru'?ru(seriesSlot):label));
    assert.equal(seriesProps.dataKey,label);
    assert.equal(seriesProps.name,lang==='ru'?ru(seriesSlot):label);
    assert.equal(chartData[0][label],17);
    assert.equal(JSON.stringify(chart),raw);
  }
}
console.log('PASS: actual DashboardChart SSR, populated synthetic series and unchanged dataKey/data, mocked Recharts');
console.log('Stage18 synthetic React SSR/callback PASS; no DOM interactions, live authorization, network or server requests tested.');


// Stage19: actual embedded editor and enum widget, pinned schemas and artificial values.
const manifest19=JSON.parse(read('scripts/data/pinned-schema-manifest.json'));
const resolver19=sourceModule(read('src/lib/schemaResolver.ts'),'schemaResolver.ts');
const embedded19=sourceModule(read('src/lib/embeddedSchema.ts'),'embeddedSchema.ts',{'@/lib/jmapUtils':{SECRET_MASK:'synthetic-secret-mask'}});
let fixtureSchema19;
const baseline19={};
const htmlText19=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
const {EmbeddedObjectEditor}=component('src/components/forms/widgets/EmbeddedObjectWidget.tsx',{
  '@/components/forms/FieldRow':{FieldRow},
  '@/components/forms/VariantSelect':{VariantSelect:()=>null},
  '@/components/forms/formContext':{
    EnclosingSchemaContext:passthrough,PanelContext:passthrough,
    useFormContext:()=>({schema:fixtureSchema19,mode:'edit',baseline:baseline19}),
    useInPanel:()=>true,
  },
  '@/lib/schemaResolver':resolver19,
  '@/lib/embeddedSchema':embedded19,
});
let capturedCombo19;
const {EnumWidget}=component('src/components/forms/widgets/EnumWidgets.tsx',{
  'lucide-react':{Search:icon},
  '@/components/ui/button':{Button:passthrough},
  '@/components/ui/checkbox':{Checkbox:()=>null},
  '@/components/ui/input':{Input:()=>null},
  '@/components/ui/label':{Label:passthrough},
  '@/components/ui/combobox':{Combobox:props=>{capturedCombo19=props;return h('div',null,props.options.map(o=>h('span',{key:o.value},o.label)));}},
  '@/components/ui/popover':{Popover:passthrough,PopoverContent:passthrough,PopoverTrigger:passthrough},
  '@/components/common/HelpTooltip':{HelpTooltip:()=>null},
  '@/hooks/usePermissions':{usePermissionCheckers:()=>({hasPermission:id=>id==='sysAccountGet'})},
  '@/lib/schemaResolver':resolver19,
  '@/components/forms/formContext':{useFormContext:()=>({schema:fixtureSchema19})},
  '@/hooks/useSchemaText':{useSchemaText,useCanTranslateSchema:()=>language==='ru'&&catalog.meta.schemaHashes.includes(hash)},
  '@/i18n/schemaPermissionText':{permissionDisplayLabel:(_id,label)=>label},
  '@/components/ui/comboboxSearch':{filterComboboxOptions:options=>options},
  '@/i18n/schemaOptionLabels':{headerProtectionOptionLabel:x=>x,localeOptionLabel:(_id,label)=>label},
  '@/components/forms/widgets/RemovablePill':{RemovablePill:()=>null},
});
for(const pin of manifest19.schemas) {
  fixtureSchema19=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
  hash=pin.schemaHash;
  for(const [objectName,name] of [['AddressBookRights','mayWrite'],['CalendarRights','mayWriteAll'],['MailboxRights','maySetSeen']]){
    const resolved=embedded19.resolveEmbedded(fixtureSchema19,objectName,{});
    assert.ok(resolved);
    const fields=embedded19.embeddedEntries(resolved).filter(({field})=>field.update!=='serverSet');
    const target=fields.find(({formField})=>formField.name===name);
    assert.ok(target);
    const slot='form/'+resolved.schemaName+'/field/'+name,desc='field/'+resolved.schemaName+'/'+name+'/description';
    assert.equal(target.formField.label,original(slot));
    assert.equal(target.field.description,original(desc));
    const value=Object.fromEntries(fields.map(({formField})=>[formField.name,false]));
    const snapshot=JSON.stringify(value);
    let event;
    for(const lang of ['ru','en','ru']){
      language=lang;capturedFields.clear();
      const html=render(EmbeddedObjectEditor,{objectName,value,onChange:v=>{event=v;},readOnly:false,bare:true});
      assert.ok(html.includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
      assert.ok(html.includes(htmlText19(lang==='ru'?ru(desc):original(desc))),desc);
      const control=capturedFields.get(name);
      assert.ok(control);
      assert.equal(control.formField.name,name);
      assert.equal(control.value,false);
      control.onChange(true);
      assert.deepEqual(JSON.parse(JSON.stringify(event)),{...value,[name]:true});
      assert.equal(JSON.stringify(value),snapshot);
    }
  }
  const variants=resolver19.getEnum(fixtureSchema19,'IncludeInAvailability');
  assert.equal(variants.length,3);
  let selected;
  const props={type:{type:'enum',enumName:'IncludeInAvailability',nullable:false},formField:{name:'includeInAvailability'},value:'attending',onChange:v=>{selected=v;},readOnly:false,control:{}};
  for(const lang of ['ru','en','ru']){
    language=lang;
    const html=render(EnumWidget,props);
    assert.equal(capturedCombo19.value,'attending');
    assert.deepEqual(Array.from(capturedCombo19.options,o=>o.value),Array.from(variants,v=>v.name));
    for(const v of variants){
      const slot='enum/IncludeInAvailability/'+v.name+'/label';
      assert.ok(html.includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
    }
    capturedCombo19.onValueChange('none');
    assert.equal(selected,'none');
    assert.equal(props.value,'attending');
  }
  const permissionProps={...props,type:{type:'enum',enumName:'Permission',nullable:false},formField:{name:'permissions'},value:'sysAccountGet'};
  for(const lang of ['ru','en']){
    language=lang;
    render(EnumWidget,permissionProps);
    assert.deepEqual(Array.from(capturedCombo19.options,o=>o.value),['sysAccountGet']);
  }
}
console.log('PASS: Stage19 actual EmbeddedObjectEditor/FieldRow and EnumWidget SSR, pinned schemas, synthetic rights values, raw callback IDs and mocked permission filter invariant');


// Stage20: populated read-only reports and queue actions; no network or real mutations.
const badge20=({children})=>h('span',null,children);
const formats20={formatDuration:String,formatNumber:String,formatSize:String,formatDateTime:String};
const scalar20=component('src/components/values/ScalarValues.tsx',{
  'lucide-react':{Check:icon,Loader2:icon,X:icon},
  '@/components/ui/badge':{Badge:badge20},
  '@/data/objectOptions':{useDisplayName:()=>({label:null,loading:false})},
  '@/lib/format':formats20,'@/lib/schemaResolver':resolver19,
  '@/lib/jmapUtils':{SECRET_MASK:'synthetic-secret-mask'},
  '@/lib/embeddedSchema':embedded19,
});
let descriptions20=[];
const fieldValue20=component('src/components/values/FieldValue.tsx',{
  'lucide-react':{ChevronRight:icon},
  '@/components/ui/badge':{Badge:badge20},
  '@/components/ui/collapsible':{Collapsible:passthrough,CollapsibleContent:passthrough,CollapsibleTrigger:passthrough},
  '@/components/common/HelpTooltip':{HelpTooltip:({content})=>{descriptions20.push(content);return null;}},
  '@/lib/format':formats20,
  '@/extensions/widgets':{resolveWidget:()=>({})},
  '@/lib/schemaResolver':resolver19,
  '@/lib/embeddedSchema':embedded19,
  '@/components/values/ScalarValues':scalar20,
});
const {ListCell}=component('src/components/lists/ListCell.tsx',{
  '@/components/values/FieldValue':fieldValue20,
  '@/components/values/ScalarValues':scalar20,
  './listQuery':{scalarText:()=>{throw Error('Unexpected untyped list fallback');}},
});
const listActions20=sourceModule(read('src/components/lists/listActions.ts'),'listActions.ts',{
  '@/lib/schemaResolver':resolver19,
  './listUrlState':{filteredListSearch:()=>{throw Error('No navigation requested');}},
});
let menu20=[];
const menuDeps20={
  '@/components/ui/button':{Button:passthrough},
  '@/components/ui/dropdown-menu':{
    DropdownMenu:passthrough,DropdownMenuContent:passthrough,DropdownMenuTrigger:passthrough,DropdownMenuSeparator:()=>null,
    DropdownMenuItem:props=>{menu20.push(props);return h('span',null,props.children);},
  },
};
const {RowActions}=component('src/components/lists/RowActions.tsx',{
  ...menuDeps20,'react-router-dom':{Link:passthrough},'lucide-react':{Lock:icon,MoreHorizontal:icon},
});
const {MassActionBar}=component('src/components/lists/MassActionBar.tsx',{
  ...menuDeps20,'lucide-react':{ChevronUp:icon,X:icon},
  '@/components/common/FloatingActionBar':{FloatingActionBar:passthrough,FloatingActionDivider:()=>null,FloatingActionDot:()=>null},
});
for(const pin of manifest19.schemas){
  const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
  hash=pin.schemaHash;
  for(const [objectName,value,fieldName,expectedValue] of [
    ['x:DmarcReportRecord',{count:17,sourceIp:'192.0.2.9',evaluatedDkim:'pass'},'count','17'],
    ['x:TlsReportPolicy',{totalFailedSessions:3,totalSuccessfulSessions:17,policyType:'sts'},'totalFailedSessions','3'],
    ['x:ArfFeedbackReport',{sourcePort:2525,sourceIp:'192.0.2.9',feedbackType:'abuse'},'sourcePort','2525'],
  ]){
    const resolved=embedded19.resolveEmbedded(schema,objectName,value);
    assert.ok(resolved&&resolved.schemaName);
    const target=embedded19.embeddedEntries(resolved).find(e=>e.formField.name===fieldName);
    assert.ok(target);
    const slot='form/'+resolved.schemaName+'/field/'+fieldName,desc='field/'+resolved.schemaName+'/'+fieldName+'/description';
    assert.equal(target.formField.label,original(slot));
    assert.equal(target.field.description,original(desc));
    const snapshot=JSON.stringify(value);
    for(const lang of ['ru','en','ru']){
      language=lang;descriptions20=[];
      const html=render(fieldValue20.ObjectValue,{schema,objectName,value,defaultOpen:true});
      assert.ok(html.includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
      assert.ok(descriptions20.includes(lang==='ru'?ru(desc):original(desc)),desc);
      assert.ok(html.includes(expectedValue));
      const cell=render(ListCell,{schema,objectName,column:fieldName,field:target.field,value:value[fieldName]});
      assert.ok(cell.includes(expectedValue));
      for(const [name,raw] of Object.entries(value)){
        const field=resolved.fields.properties[name];
        if(field?.type.type!=='enum')continue;
        const enumSlot='enum/'+field.type.enumName+'/'+raw+'/label';
        if(!catalog.entries[enumSlot])continue;
        const variant=resolver19.getEnumVariant(schema,field.type.enumName,raw);
        assert.equal(variant.label,original(enumSlot));
        const visible=htmlText19(lang==='ru'?ru(enumSlot):original(enumSlot));
        assert.ok(html.includes(visible),enumSlot);
        assert.ok(render(ListCell,{schema,objectName,column:name,field,value:raw}).includes(visible),enumSlot);
      }
      assert.equal(JSON.stringify(value),snapshot);
    }
  }
  // Real schema list actions and actual permission filter, synthetic permissions only.
  const list=schema.lists['x:QueuedMessage'];
  const resolved=resolver19.resolveObject(schema,'x:QueuedMessage');
  assert.ok(list&&resolved);
  const info={isObject:true,permissionPrefix:resolved.permissionPrefix};
  const allowed={isCommunity:false,hasObjectPermission:(_prefix,action)=>['Destroy','Update'].includes(action)};
  const denied={isCommunity:false,hasObjectPermission:()=>false};
  const queueItems=listActions20.resolveItemActions(schema,list.itemActions,info.permissionPrefix,allowed).filter(e=>e.kind==='mutation');
  const queueMass=listActions20.resolveMassActions(list.massActions,info,allowed,'Delete').filter(e=>e.action.type!=='separator');
  assert.deepEqual(Array.from(queueItems,e=>e.key).sort(),['delete:Cancel Delivery','setProperty:Retry Now']);
  assert.deepEqual(Array.from(queueMass,e=>e.key).sort(),['delete:Cancel All','setProperty:Retry All']);
  const raw=JSON.stringify({items:list.itemActions,mass:list.massActions});
  for(const lang of ['ru','en','ru']){
    language=lang;
    let event;
    menu20=[];
    const itemHtml=render(RowActions,{actions:queueItems,listKey:'x:QueuedMessage',label:'synthetic-queue-id',hrefFor:()=>null,onMutation:e=>{event=e;},onLocked:()=>{throw Error('Unexpected locked action');}});
    for(const [i,e] of queueItems.entries()){
      const slot='list/x:QueuedMessage/itemAction/'+e.key+'/label';
      assert.equal(e.action.label,original(slot));
      assert.ok(itemHtml.includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
      menu20[i].onSelect();
      assert.equal(event,e);
      assert.equal(event.action,e.action);
    }
    menu20=[];
    const massHtml=render(MassActionBar,{actions:queueMass,listKey:'x:QueuedMessage',count:2,disabled:false,onClear:()=>{},onSelect:(action,key)=>{event={action,key};}});
    for(const [i,e] of queueMass.entries()){
      const slot='list/x:QueuedMessage/massAction/'+e.key+'/label';
      assert.equal(e.action.label,original(slot));
      assert.ok(massHtml.includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
      menu20[i].onSelect();
      assert.equal(event.action,e.action);
      assert.equal(event.key,e.key);
    }
    assert.equal(listActions20.resolveItemActions(schema,list.itemActions,info.permissionPrefix,denied).filter(e=>e.kind==='mutation').length,0);
    assert.equal(listActions20.resolveMassActions(list.massActions,info,denied,'Delete').filter(e=>e.action.type!=='separator').length,0);
    assert.equal(JSON.stringify({items:list.itemActions,mass:list.massActions}),raw);
  }
}
console.log('PASS: Stage20 actual ObjectValue/FieldValue/ScalarValues/ListCell populated reports and queue RowActions/MassActionBar, exact action identity and synthetic permission filtering; no DOM, JMAP or real mutations');


// Stage21: diagnostic result and maintenance operation choices are display-only.
for(const pin of manifest19.schemas){
  const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
  hash=pin.schemaHash;
  fixtureSchema19=schema;
  for(const [enumName,selected] of [
    ['TaskType','DestroyAccount'],
    ['TaskStoreMaintenanceType','removeAuthTokens'],
    ['TaskSpamFilterMaintenanceType','updateRules'],
    ['TaskBlobRecodeCompression','lz4'],
    ['TaskStatusType','Failed'],
    ['SpamClassifyResult','discard'],
  ]){
    const variants=resolver19.getEnum(schema,enumName);
    const v=variants.find(x=>x.name===selected);
    assert.ok(v,enumName+': '+selected);
    const slot='enum/'+enumName+'/'+selected+'/label';
    assert.equal(v.label,original(slot));
    const snapshot=JSON.stringify(variants);
    let event;
    const props={type:{type:'enum',enumName,nullable:false},formField:{name:'operation'},value:selected,onChange:value=>{event=value;},readOnly:false,control:{}};
    for(const lang of ['ru','en','ru']){
      language=lang;
      const expected=htmlText19(lang==='ru'?ru(slot):original(slot));
      assert.ok(render(EnumWidget,props).includes(expected),slot);
      assert.equal(capturedCombo19.value,selected);
      assert.deepEqual(Array.from(capturedCombo19.options,o=>o.value),Array.from(variants,o=>o.name));
      capturedCombo19.onValueChange(selected);
      assert.equal(event,selected);
      assert.ok(render(scalar20.EnumValue,{schema,enumName,value:selected}).includes(expected),slot);
      assert.equal(JSON.stringify(variants),snapshot);
    }
  }
  for(const value of ['Fail','Pass','PermError','SoftFail','TempError']){
    const objectName='x:DmarcTroubleshootAuthResult',slot='variant/'+objectName+'/'+value+'/label';
    assert.equal(embedded19.variantLabel(schema,objectName,value),original(slot));
    for(const lang of ['ru','en','ru']){
      language=lang;
      assert.ok(render(fieldValue20.VariantValue,{schema,objectName,value}).includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
    }
  }
}
console.log('PASS: Stage21 actual maintenance EnumWidget/EnumValue and diagnostic VariantValue SSR; both pinned schemas, unchanged raw operation IDs, synthetic callbacks only');
