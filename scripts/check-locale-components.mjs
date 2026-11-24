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


// Stage22: outbound service settings, display-only; no real HTTP or AI requests.
let enterprise22=0;
for(const pin of manifest19.schemas){
  const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
  hash=pin.schemaHash;
  fixtureSchema19=schema;
  const selections=[['JwtSignatureAlgorithm','ps256','rs512'],['OAuthClientMetadataPolicy','sameDomain','disabled']];
  if(schema.enums.SpamAiMode){
    enterprise22++;
    selections.push(['SpamAiMode','Shadow','Automatic'],['AiOpenAiProfile','Generic','OpenAi']);
  }
  for(const [enumName,selected,next] of selections){
    const variants=resolver19.getEnum(schema,enumName);
    const target=variants.find(v=>v.name===selected);
    assert.ok(target&&variants.some(v=>v.name===next),enumName);
    const slot='enum/'+enumName+'/'+selected+'/label';
    assert.equal(target.label,original(slot));
    const raw=JSON.stringify(variants);
    let event;
    const props={type:{type:'enum',enumName,nullable:false},formField:{name:'mode'},value:selected,onChange:v=>{event=v;},readOnly:false,control:{}};
    for(const lang of ['ru','en','ru']){
      language=lang;
      const expected=htmlText19(lang==='ru'?ru(slot):original(slot));
      assert.ok(render(EnumWidget,props).includes(expected),slot);
      assert.equal(capturedCombo19.value,selected);
      assert.deepEqual(Array.from(capturedCombo19.options,v=>v.value),Array.from(variants,v=>v.name));
      capturedCombo19.onValueChange(next);
      assert.equal(event,next);
      assert.equal(props.value,selected);
      assert.ok(render(scalar20.EnumValue,{schema,enumName,value:selected}).includes(expected),slot);
      assert.equal(JSON.stringify(variants),raw);
    }
  }
  for(const [formKey,name] of [['x:HttpLookup','allowInvalidCerts'],...(schema.forms['x:SpamAiProperties']?[['x:SpamAiProperties','includeAttachments'],['x:SpamAiProperties','includeLinks'],['x:SpamAiProperties','includeAuth']]:[])]){
    const section=schema.forms[formKey].sections.find(s=>s.fields.some(f=>f.name===name));
    const formField=section.fields.find(f=>f.name===name),field=schema.fields[formKey].properties[name];
    const slot='form/'+formKey+'/field/'+name,desc='field/'+formKey+'/'+name+'/description';
    assert.equal(formField.label,original(slot));
    assert.equal(field.description,original(desc));
    const sectionSlot='form/'+formKey+'/section/section-'+schema.forms[formKey].sections.indexOf(section);
    const sections=[{key:sectionSlot.split('/').at(-1),title:original(sectionSlot),fields:[{formField,field}]}];
    const data={[name]:false},snapshot=JSON.stringify({sections,data});
    let event;
    const props={sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,value)=>{event=[key,value];}};
    for(const lang of ['ru','en','ru']){
      language=lang;
      const html=render(FormSections,props);
      for(const key of [slot,desc,sectionSlot])assert.ok(html.includes(htmlText19(lang==='ru'?ru(key):original(key))),key);
      assert.equal(capturedField.formField.name,name);
      assert.equal(capturedField.value,false);
      capturedField.onChange(true);
      assert.deepEqual(event,[name,true]);
      assert.equal(JSON.stringify({sections,data}),snapshot);
    }
  }
  for(const value of ['Csv','List']){
    const objectName='x:HttpLookupFormat',slot='variant/'+objectName+'/'+value+'/label';
    assert.equal(embedded19.variantLabel(schema,objectName,value),original(slot));
    for(const lang of ['ru','en','ru']){
      language=lang;
      assert.ok(render(fieldValue20.VariantValue,{schema,objectName,value}).includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
    }
  }
}
assert.equal(enterprise22,1,'AI settings expected only in pinned enterprise schema');
console.log('PASS: Stage22 real FormSections/FieldRow, EnumWidget/EnumValue and VariantValue SSR for HTTP, OAuth and enterprise AI; raw values and callbacks unchanged, no actual network');


// Stage23: key and certificate choices are display-only, with no real key material or network.
for(const pin of manifest19.schemas){
  const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
  hash=pin.schemaHash;
  fixtureSchema19=schema;
  for(const [enumName,selected,next] of [
    ['AcmeChallengeType','DnsPersist01','Dns01'],
    ['PasswordHashAlgorithm','argon2id','bcrypt'],
    ['PasswordStrength','four','three'],
    ['SymmetricCipher','aes256Gcm','chacha20Poly1305'],
    ['DkimCanonicalization','relaxed/relaxed','simple/simple'],
  ]){
    const variants=resolver19.getEnum(schema,enumName);
    const target=variants.find(v=>v.name===selected);
    assert.ok(target&&variants.some(v=>v.name===next),enumName);
    const slot='enum/'+enumName+'/'+selected+'/label';
    assert.equal(target.label,original(slot));
    const snapshot=JSON.stringify(variants);
    let event;
    const props={type:{type:'enum',enumName,nullable:false},formField:{name:'algorithm'},value:selected,onChange:v=>{event=v;},readOnly:false,control:{}};
    for(const lang of ['ru','en','ru']){
      language=lang;
      const expected=htmlText19(lang==='ru'?ru(slot):original(slot));
      assert.ok(render(EnumWidget,props).includes(expected),slot);
      assert.equal(capturedCombo19.value,selected);
      assert.deepEqual(Array.from(capturedCombo19.options,v=>v.value),Array.from(variants,v=>v.name));
      capturedCombo19.onValueChange(next);
      assert.equal(event,next);
      assert.equal(props.value,selected);
      assert.ok(render(scalar20.EnumValue,{schema,enumName,value:selected}).includes(expected),slot);
      assert.equal(JSON.stringify(variants),snapshot);
    }
  }
  for(const [formKey,name,value,changed] of [['x:AcmeProvider','reuseKey',false,true],['x:Authentication','minPasswordLength',16,20],['x:Security','authBanPeriod','15m','30m']]){
    const form=schema.forms[formKey];
    const section=form.sections.find(s=>s.fields.some(f=>f.name===name));
    const formField=section.fields.find(f=>f.name===name),field=schema.fields[formKey].properties[name];
    const slot='form/'+formKey+'/field/'+name,desc='field/'+formKey+'/'+name+'/description';
    const sectionSlot='form/'+formKey+'/section/section-'+form.sections.indexOf(section);
    assert.equal(formField.label,original(slot));
    assert.equal(field.description,original(desc));
    const sections=[{key:sectionSlot.split('/').at(-1),title:original(sectionSlot),fields:[{formField,field}]}];
    const data={[name]:value},snapshot=JSON.stringify({sections,data});
    let event;
    for(const lang of ['ru','en','ru']){
      language=lang;
      const html=render(FormSections,{sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,v)=>{event=[key,v];}});
      for(const key of [slot,desc,sectionSlot])assert.ok(html.includes(htmlText19(lang==='ru'?ru(key):original(key))),key);
      assert.equal(capturedField.formField.name,name);
      assert.equal(capturedField.value,value);
      capturedField.onChange(changed);
      assert.deepEqual(event,[name,changed]);
      assert.equal(JSON.stringify({sections,data}),snapshot);
    }
  }
}
console.log('PASS: Stage23 actual EnumWidget/EnumValue and FormSections/FieldRow SSR for ACME, DKIM, password algorithms and security settings; raw IDs and synthetic callbacks unchanged; no network or key operations');


// Stage24: real metric selector, populated synthetic forms and numeric rendering.
// Leaf controls remain mocked; no DOM, live metric collection, JMAP or network.
if(catalog.entries['enum/MetricType/acme.auth-error/label']){
  let checks24=[],labels24=new Map(),pills24=[];
  const {EnumMultiSelect}=component('src/components/forms/widgets/EnumWidgets.tsx',{
    'lucide-react':{Search:icon},
    '@/components/ui/button':{Button:passthrough},
    '@/components/ui/checkbox':{Checkbox:props=>{checks24.push(props);return null;}},
    '@/components/ui/input':{Input:()=>null},
    '@/components/ui/label':{Label:props=>{labels24.set(props.htmlFor,React.Children.toArray(props.children).filter(c=>typeof c==='string').join(''));return h('label',{htmlFor:props.htmlFor},props.children);}},
    '@/components/ui/combobox':{Combobox:()=>null},
    '@/components/ui/popover':{Popover:passthrough,PopoverContent:passthrough,PopoverTrigger:passthrough},
    '@/components/common/HelpTooltip':{HelpTooltip:()=>null},
    '@/hooks/usePermissions':{usePermissionCheckers:()=>({hasPermission:()=>true})},
    '@/lib/schemaResolver':resolver19,
    '@/components/forms/formContext':{useFormContext:()=>({schema:fixtureSchema19})},
    '@/hooks/useSchemaText':{useSchemaText,useCanTranslateSchema:()=>language==='ru'&&catalog.meta.schemaHashes.includes(hash)},
    '@/i18n/schemaPermissionText':{permissionDisplayLabel:(_id,label)=>label},
    '@/components/ui/comboboxSearch':{filterComboboxOptions:options=>options},
    '@/i18n/schemaOptionLabels':{headerProtectionOptionLabel:x=>x,localeOptionLabel:(_id,label)=>label},
    '@/components/forms/widgets/RemovablePill':{RemovablePill:props=>{pills24.push(props);return h('span',null,props.children);}},
  });
  let editions24=0,forms24=new Set();
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;editions24++;
    const variants=resolver19.getEnum(schema,'MetricType');
    const metricCount=pin.edition==='enterprise'?399:387;
    assert.equal(variants.length,metricCount);
    const items=['delivery.total-time','server.memory'],next='queue.count';
    const raw=JSON.stringify({variants,items});
    let event;
    const props={enumName:'MetricType',items,onChange:v=>{event=v;},readOnly:false,control:{id:'metrics'}};
    for(const lang of ['ru','en','ru']){
      language=lang;checks24=[];labels24=new Map();pills24=[];
      const html=render(EnumMultiSelect,props);
      assert.equal(checks24.length,metricCount);
      assert.equal(labels24.size,metricCount);
      for(const [i,v] of variants.entries()){
        const slot='enum/MetricType/'+v.name+'/label';
        assert.equal(v.label,original(slot));
        const id='metrics-dd-'+v.name.replace(/[^A-Za-z0-9_-]/g,'_');
        assert.equal(checks24[i].id,id);
        assert.equal(checks24[i].checked,items.includes(v.name));
        assert.equal(labels24.get(id),lang==='ru'?ru(slot):v.label,slot);
      }
      for(const [i,name] of items.entries()){
        const slot='enum/MetricType/'+name+'/label';
        assert.equal(pills24[i].label,lang==='ru'?ru(slot):original(slot));
        assert.ok(html.includes(htmlText19(pills24[i].label)));
        assert.ok(render(scalar20.EnumValue,{schema,enumName:'MetricType',value:name}).includes(htmlText19(pills24[i].label)));
      }
      checks24[variants.findIndex(v=>v.name===next)].onCheckedChange();
      assert.deepEqual(Array.from(event),[...items,next]);
      pills24[0].onRemove();
      assert.deepEqual(Array.from(event),[items[1]]);
      assert.equal(JSON.stringify({variants,items}),raw);
    }
    hash='unknown';language='ru';checks24=[];labels24=new Map();pills24=[];
    render(EnumMultiSelect,props);
    assert.equal(pills24[0].label,original('enum/MetricType/'+items[0]+'/label'));
    hash=pin.schemaHash;
    for(const [formKey,name,value,changed] of [
      ['x:Metrics','serviceName','synthetic-metrics','changed-metrics'],
      ['x:MetricsOtelGrpc','interval','15s','30s'],
      ['x:MetricsOtelHttp','timeout','10s','20s'],
      ['x:MetricsOtelGrpc','url','http://localhost:4317','http://localhost:4318'],
    ]){
      const form=schema.forms[formKey],field=schema.fields[formKey]?.properties[name];
      if(!form||!field)continue;
      forms24.add(formKey+'/'+name);
      const section=form.sections.find(s=>s.fields.some(f=>f.name===name));
      const formField=section.fields.find(f=>f.name===name);
      const slot='form/'+formKey+'/field/'+name,desc='field/'+formKey+'/'+name+'/description';
      assert.equal(formField.label,original(slot));
      assert.equal(field.description,original(desc));
      const sectionKey='section-'+form.sections.indexOf(section);
      const sections=[{key:sectionKey,title:section.title,fields:[{formField,field}]}];
      const data={[name]:value},snapshot=JSON.stringify({sections,data});
      let event;
      for(const lang of ['ru','en','ru']){
        language=lang;
        const html=render(FormSections,{sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,v)=>{event=[key,v];}});
        for(const key of [slot,desc])assert.ok(html.includes(htmlText19(lang==='ru'?ru(key):original(key))),key);
        assert.ok(html.includes(htmlText19(value)));
        assert.equal(capturedField.formField.name,name);
        assert.equal(capturedField.value,value);
        capturedField.onChange(changed);
        assert.deepEqual(event,[name,changed]);
        assert.equal(JSON.stringify({sections,data}),snapshot);
      }
    }
  }
  assert.equal(editions24,2);
  assert.equal(forms24.size,4);
  const numericCalls24=[];
  const numeric24=component('src/components/values/ScalarValues.tsx',{
    'lucide-react':{Check:icon,Loader2:icon,X:icon},
    '@/components/ui/badge':{Badge:badge20},
    '@/data/objectOptions':{useDisplayName:()=>({label:null,loading:false})},
    '@/lib/format':{
      formatDuration:v=>{numericCalls24.push(['duration',v]);return v+' ms';},
      formatSize:v=>{numericCalls24.push(['size',v]);return v+' B';},
      formatNumber:v=>{numericCalls24.push(['number',v]);return String(v);},
    },
    '@/lib/schemaResolver':resolver19,'@/lib/jmapUtils':{SECRET_MASK:'synthetic-secret-mask'},
    '@/lib/embeddedSchema':embedded19,
  });
  for(const lang of ['ru','en','ru']){
    language=lang;numericCalls24.length=0;
    assert.ok(render(numeric24.NumberValue,{value:1500,format:'duration'}).includes('1500 ms'));
    assert.ok(render(numeric24.NumberValue,{value:4096,format:'size'}).includes('4096 B'));
    assert.ok(render(numeric24.NumberValue,{value:17,format:'integer'}).includes('17'));
    assert.deepEqual(numericCalls24,[['duration',1500],['size',4096],['number',17]]);
  }
  console.log('PASS: Stage24 actual EnumMultiSelect (399 Enterprise / 387 OSS options), EnumValue, FormSections/FieldRow and NumberValue SSR; both pinned schemas, RU/EN/RU and unknown hash, raw IDs, callbacks and numeric/unit dispatch unchanged; leaf formatters mocked, no live metrics or network');
}


// Stage25: storage variants and settings remain display-only. No storage connections.
if(catalog.entries['variant/x:DataStore/Sqlite/label']){
  let select25,items25=[];
  const {VariantSelect}=component('src/components/forms/VariantSelect.tsx',{
    '@/components/ui/select':{
      Select:props=>{select25=props;return h('div',null,props.children);},
      SelectContent:passthrough,SelectTrigger:passthrough,SelectValue:()=>null,
      SelectItem:props=>{items25.push(props);return h('span',null,props.children);},
    },
    '@/components/forms/FieldRow':{FieldLabel:props=>h('span',null,props.label)},
    '@/components/forms/formContext':{fieldIds:()=>({inputId:'storage-type',labelId:'storage-label'}),useFieldScope:()=>({path:[]}),useFormContext:()=>({idPrefix:'synthetic'}),useInPanel:()=>false},
    '@/components/forms/formLogic':{VARIANT_FIELD:'@type'},
  });
  let variantCases25=0,formCases25=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    for(const [objectName,selected,next] of [
      ['x:DataStore','Sqlite','RocksDb'],
      ['x:BlobStore','FileSystem','S3'],
      ['x:S3StoreRegion','UsEast1','EuWest1'],
      ['x:AzureAuth','SharedKey','SasToken'],
      ['x:InMemoryStore','Redis','RedisSentinel'],
    ]){
      const variants=schema.schemas[objectName]?.variants;
      if(!variants)continue;
      assert.ok(variants.some(v=>v.name===selected)&&variants.some(v=>v.name===next),objectName);
      const raw=JSON.stringify(variants);
      let event;
      const props={variantScope:objectName,variants,value:selected,onChange:v=>{event=v;},readOnly:false,ariaLabel:'Storage type'};
      for(const lang of ['ru','en','ru']){
        language=lang;select25=undefined;items25=[];
        const html=render(VariantSelect,props);
        assert.ok(select25,objectName+' dropdown expected');
        assert.equal(select25.value,selected);
        assert.deepEqual(Array.from(items25,v=>v.value),Array.from(variants,v=>v.name));
        for(const [i,v] of variants.entries()){
          const slot='variant/'+objectName+'/'+v.name+'/label';
          const entry=catalog.entries[slot];
          const expected=lang==='ru'&&entry?.original===v.label?entry.ru:v.label;
          assert.equal(items25[i].children,expected,slot);
          assert.ok(html.includes(htmlText19(expected)),slot);
        }
        select25.onValueChange(next);
        assert.equal(event,next);
        assert.equal(props.value,selected);
        assert.equal(JSON.stringify(variants),raw);
      }
      hash='unknown';language='ru';items25=[];
      render(VariantSelect,props);
      assert.deepEqual(Array.from(items25,v=>v.children),Array.from(variants,v=>v.label));
      hash=pin.schemaHash;variantCases25++;
    }
    for(const [enumName,selected,next] of [
      ['CompressionAlgo','lz4','zstd'],
      ['SearchEmailField','body','attachment'],
      ['MetadataDataType','ContactCard','CalendarEvent'],
    ]){
      const variants=resolver19.getEnum(schema,enumName);
      if(!variants.length)continue;
      const slot='enum/'+enumName+'/'+selected+'/label';
      assert.ok(variants.some(v=>v.name===selected)&&variants.some(v=>v.name===next),enumName);
      const raw=JSON.stringify(variants);
      let event;
      for(const lang of ['ru','en','ru']){
        language=lang;
        const html=render(EnumWidget,{type:{type:'enum',enumName,nullable:false},formField:{name:'mode'},value:selected,onChange:v=>{event=v;},readOnly:false,control:{}});
        assert.ok(html.includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
        assert.deepEqual(Array.from(capturedCombo19.options,v=>v.value),Array.from(variants,v=>v.name));
        capturedCombo19.onValueChange(next);
        assert.equal(event,next);
        assert.ok(render(scalar20.EnumValue,{schema,enumName,value:selected}).includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
        assert.equal(JSON.stringify(variants),raw);
      }
    }
    for(const [formKey,name,value,changed] of [
      ['x:RocksDbStore','cacheSize',268435456,536870912],
      ['x:Cache','negativeTtl','5m','10m'],
      ['x:S3Store','verifyAfterWrite',false,true],
      ['x:Search','maxExtractDocumentSize',1048576,2097152],
      ['x:Metadata','maxDepth',8,16],
    ]){
      const form=schema.forms[formKey],field=schema.fields[formKey]?.properties[name];
      if(!form||!field)continue;
      const section=form.sections.find(s=>s.fields.some(f=>f.name===name));
      assert.ok(section,formKey+'/'+name);
      const formField=section.fields.find(f=>f.name===name);
      const slot='form/'+formKey+'/field/'+name,desc='field/'+formKey+'/'+name+'/description';
      assert.equal(formField.label,original(slot));
      assert.equal(field.description,original(desc));
      const sections=[{key:'section-'+form.sections.indexOf(section),title:section.title,fields:[{formField,field}]}];
      const data={[name]:value},snapshot=JSON.stringify({sections,data});
      let event;
      for(const lang of ['ru','en','ru']){
        language=lang;
        const html=render(FormSections,{sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,v)=>{event=[key,v];}});
        for(const key of [slot,desc])assert.ok(html.includes(htmlText19(lang==='ru'?ru(key):original(key))),key);
        assert.equal(capturedField.formField.name,name);
        assert.equal(capturedField.value,value);
        capturedField.onChange(changed);
        assert.deepEqual(event,[name,changed]);
        assert.equal(JSON.stringify({sections,data}),snapshot);
      }
      formCases25++;
    }
  }
  assert.ok(variantCases25>=6,'storage variant coverage');
  assert.ok(formCases25>=6,'storage form coverage');
  console.log('PASS: Stage25 actual VariantSelect, EnumWidget/EnumValue, FormSections/FieldRow synthetic SSR; edition-pinned storage/backend labels, region IDs, raw callbacks, compression, cache size/TTL, metadata and indexing limits; no storage connections or configuration writes');
}


// Stage26: SMTP transport display only; no actual connections, policy evaluation or delivery.
if(catalog.entries['enum/MtaIpStrategy/v4Only/label']){
  let formCases26=0,enumCases26=0,columns26=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    for(const [enumName,selected,next] of [
      ['MtaIpStrategy','v4Only','v6ThenV4'],
      ['MilterVersion','v2','v6'],
      ['MtaRequiredOrOptional','require','optional'],
      ['MtaInboundThrottleKey','authenticatedAs','remoteIp'],
      ['MtaStage','auth','connect'],
      ['PolicyEnforcement','enforce','testing'],
    ]){
      const variants=resolver19.getEnum(schema,enumName);
      assert.ok(variants.some(v=>v.name===selected)&&variants.some(v=>v.name===next),enumName);
      const slot='enum/'+enumName+'/'+selected+'/label',raw=JSON.stringify(variants);
      let event;
      const props={type:{type:'enum',enumName,nullable:false},formField:{name:'mode'},value:selected,onChange:v=>{event=v;},readOnly:false,control:{}};
      for(const lang of ['ru','en','ru']){
        language=lang;
        const label=lang==='ru'?ru(slot):original(slot);
        assert.ok(render(EnumWidget,props).includes(htmlText19(label)),slot);
        assert.equal(capturedCombo19.value,selected);
        assert.deepEqual(Array.from(capturedCombo19.options,v=>v.value),Array.from(variants,v=>v.name));
        capturedCombo19.onValueChange(next);
        assert.equal(event,next);
        assert.ok(render(scalar20.EnumValue,{schema,enumName,value:selected}).includes(htmlText19(label)),slot);
        assert.equal(JSON.stringify(variants),raw);
        assert.equal(props.value,selected);
      }
      hash='unknown';language='ru';
      assert.ok(render(EnumWidget,props).includes(htmlText19(original(slot))),slot);
      hash=pin.schemaHash;enumCases26++;
    }
    for(const [formKey,name,value,changed] of [
      ['x:MtaInboundSession','idleTimeout','1m','2m'],
      ['x:MtaMilter','port',10025,10026],
      ['x:MtaMilter','tempFailOnError',true,false],
      ['x:MtaStageAuth','maxFailures',3,5],
      ['x:MtaStageData','maxMessages',100,200],
      ['x:MtaTlsStrategy','allowInvalidCerts',false,true],
      ['x:MtaHook','url','https://example.invalid/hook','https://example.invalid/other'],
      ['x:MtaDeliveryExpirationAttempts','maxAttempts',5,10],
      ['x:MtaQueueQuota','messages',100,200],
    ]){
      const form=schema.forms[formKey],field=schema.fields[formKey]?.properties[name];
      assert.ok(form&&field,formKey+'/'+name);
      const section=form.sections.find(s=>s.fields.some(f=>f.name===name));
      assert.ok(section,formKey+'/'+name);
      const formField=section.fields.find(f=>f.name===name);
      const slot='form/'+formKey+'/field/'+name,desc='field/'+formKey+'/'+name+'/description';
      assert.equal(formField.label,original(slot));
      assert.equal(field.description,original(desc));
      const sections=[{key:'section-'+form.sections.indexOf(section),title:section.title,fields:[{formField,field}]}];
      const data={[name]:value},snapshot=JSON.stringify({sections,data});
      let event;
      const props={sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,v)=>{event=[key,v];}};
      for(const lang of ['ru','en','ru']){
        language=lang;
        const html=render(FormSections,props);
        for(const key of [slot,desc])assert.ok(html.includes(htmlText19(lang==='ru'?ru(key):original(key))),key);
        assert.equal(capturedField.formField.name,name);
        assert.equal(capturedField.value,value);
        capturedField.onChange(changed);
        assert.deepEqual(event,[name,changed]);
        assert.equal(JSON.stringify({sections,data}),snapshot);
      }
      hash='unknown';language='ru';
      assert.ok(render(FormSections,props).includes(htmlText19(original(slot))),slot);
      hash=pin.schemaHash;formCases26++;
    }
    for(const [listKey,name] of [['x:MtaQueueQuota','messages'],['x:MtaMilter','host'],['x:MtaDeliverySchedule','queueId']]){
      const column=schema.lists[listKey].columns.find(v=>v.name===name);
      const slot='list/'+listKey+'/column/'+name;
      assert.equal(column.label,original(slot));
      const snapshot=JSON.stringify(column);
      let sorted;
      const props={column,listKey,sortable:true,sort:null,onSort:v=>{sorted=v;}};
      for(const lang of ['ru','en','ru']){
        language=lang;
        const label=lang==='ru'?ru(slot):original(slot);
        assert.ok(render(ColumnHeader,props).includes(htmlText19(label)),slot);
        assert.ok(render(ColumnHeader,{...props,sortable:false}).includes(htmlText19(label)),slot);
        ColumnHeader(props).props.children.props.onClick();
        assert.equal(sorted,name);
        assert.equal(JSON.stringify(column),snapshot);
      }
      columns26++;
    }
  }
  assert.equal(enumCases26,12);
  assert.equal(formCases26,18);
  assert.equal(columns26,6);
  console.log('PASS: Stage26 actual EnumWidget/EnumValue, FormSections/FieldRow and ColumnHeader synthetic SSR; both pinned editions, SMTP strategy/Milter/relay settings, raw callbacks and sort keys, unknown hash fallback; no SMTP traffic or policy changes');
}
