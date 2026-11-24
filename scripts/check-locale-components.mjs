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
import { sourceModule, loadInputs, at } from './lib/locale-source.mjs';
import {loadFormContextPacket,undoFormContext} from './lib/locale-form-context.mjs';
import {loadVariantPacket,undoVariants} from './lib/locale-variant-labels.mjs';
import {loadTracePacket,undoTrace} from './lib/locale-trace-labels.mjs';
import { buildUsageGraph } from './lib/locale-graph.mjs';
import { classify } from './lib/locale-planner.mjs';
import {loadFieldDescriptionPacket,undoFieldDescriptions} from './lib/locale-field-descriptions.mjs';
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


// Stage27: Sieve capability names, classifier parameters and spam lists; display-only synthetic SSR.
if(catalog.entries['enum/SieveCapability/body/label']){
  let checks27=[],labels27=new Map(),pills27=[],search27,select27,options27=[];
  const {EnumMultiSelect}=component('src/components/forms/widgets/EnumWidgets.tsx',{
    'lucide-react':{Search:icon},
    '@/components/ui/button':{Button:passthrough},
    '@/components/ui/checkbox':{Checkbox:props=>{checks27.push(props);return null;}},
    '@/components/ui/input':{Input:()=>null},
    '@/components/ui/label':{Label:props=>{labels27.set(props.htmlFor,React.Children.toArray(props.children).filter(c=>typeof c==='string').join(''));return h('label',{htmlFor:props.htmlFor},props.children);}},
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
    '@/components/forms/widgets/RemovablePill':{RemovablePill:props=>{pills27.push(props);return h('span',null,props.children);}},
  });
  const selectDeps27={Select:props=>{select27=props;return h('div',null,props.children);},SelectContent:passthrough,SelectTrigger:passthrough,SelectValue:()=>null,SelectItem:props=>{options27.push(props);return h('span',null,props.children);}};
  const {VariantSelect}=component('src/components/forms/VariantSelect.tsx',{
    '@/components/ui/select':selectDeps27,
    '@/components/forms/FieldRow':{FieldLabel:props=>h('span',null,props.label)},
    '@/components/forms/formContext':{fieldIds:()=>({inputId:'classifier-type',labelId:'classifier-label'}),useFieldScope:()=>({path:[]}),useFormContext:()=>({idPrefix:'synthetic'}),useInPanel:()=>false},
    '@/components/forms/formLogic':{VARIANT_FIELD:'@type'},
  });
  const {FilterField}=component('src/components/lists/FilterFields.tsx',{
    '@/components/ui/input':{Input:()=>null},'@/components/ui/select':selectDeps27,
    '@/components/ui/combobox':{Combobox:()=>null},'@/components/common/ObjectPicker':{ObjectPicker:()=>null},
    '@/components/common/SearchInput':{SearchInput:props=>{search27=props;return h('input',{value:props.value,readOnly:true});}},
    '@/lib/schemaResolver':resolver19,
  });
  let multi27=0,models27=0,variants27=0,forms27=0,columns27=0,filters27=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    const caps=resolver19.getEnum(schema,'SieveCapability');
    const items=['body','comparator-i;ascii-casemap'],next='regex';
    assert.ok(items.every(id=>caps.some(v=>v.name===id))&&caps.some(v=>v.name===next));
    const capRaw=JSON.stringify({caps,items});
    let event;
    const props={enumName:'SieveCapability',items,onChange:v=>{event=v;},readOnly:false,control:{id:'capabilities'}};
    for(const lang of ['ru','en','ru']){
      language=lang;checks27=[];labels27=new Map();pills27=[];
      const html=render(EnumMultiSelect,props);
      assert.equal(checks27.length,caps.length);
      for(const [i,v] of caps.entries()){
        const slot='enum/SieveCapability/'+v.name+'/label',entry=catalog.entries[slot];
        const id='capabilities-dd-'+v.name.replace(/[^A-Za-z0-9_-]/g,'_');
        assert.equal(checks27[i].id,id);
        assert.equal(checks27[i].checked,items.includes(v.name));
        assert.equal(labels27.get(id),lang==='ru'&&entry?.original===v.label?entry.ru:v.label,slot);
      }
      for(const [i,id] of items.entries()){
        const slot='enum/SieveCapability/'+id+'/label';
        assert.equal(pills27[i].label,lang==='ru'?ru(slot):original(slot));
        assert.ok(html.includes(htmlText19(pills27[i].label)),slot);
        assert.ok(render(scalar20.EnumValue,{schema,enumName:'SieveCapability',value:id}).includes(htmlText19(pills27[i].label)),slot);
      }
      checks27[caps.findIndex(v=>v.name===next)].onCheckedChange();
      assert.deepEqual(Array.from(event),[...items,next]);
      pills27[0].onRemove();assert.deepEqual(Array.from(event),[items[1]]);
      assert.equal(JSON.stringify({caps,items}),capRaw);
    }
    hash='unknown';language='ru';checks27=[];labels27=new Map();pills27=[];
    render(EnumMultiSelect,props);
    assert.equal(pills27[0].label,original('enum/SieveCapability/body/label'));
    hash=pin.schemaHash;multi27++;
    const sizes=resolver19.getEnum(schema,'ModelSize');
    const selected=sizes.find(v=>String(v.name)==='16'),changed=sizes.find(v=>String(v.name)==='28');
    assert.ok(selected&&changed);
    const sizeRaw=JSON.stringify(sizes);
    const sizeProps={type:{type:'enum',enumName:'ModelSize',nullable:false},formField:{name:'numFeatures'},value:selected.name,onChange:v=>{event=v;},readOnly:false,control:{}};
    for(const lang of ['ru','en','ru']){
      language=lang;const html=render(EnumWidget,sizeProps);
      for(const v of sizes){
        const slot='enum/ModelSize/'+v.name+'/label';
        assert.ok(html.includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
      }
      assert.equal(capturedCombo19.value,selected.name);
      assert.deepEqual(Array.from(capturedCombo19.options,v=>v.value),Array.from(sizes,v=>v.name));
      capturedCombo19.onValueChange(changed.name);assert.equal(event,changed.name);
      assert.equal(JSON.stringify(sizes),sizeRaw);
    }
    models27++;
    const modelScope='x:SpamClassifierModel',modelVariants=schema.schemas[modelScope].variants;
    assert.deepEqual(Array.from(modelVariants,v=>v.name).sort(),['Disabled','FtrlCcfh','FtrlFh']);
    const modelRaw=JSON.stringify(modelVariants);
    for(const lang of ['ru','en','ru']){
      language=lang;select27=undefined;options27=[];
      const html=render(VariantSelect,{variantScope:modelScope,variants:modelVariants,value:'FtrlFh',onChange:v=>{event=v;},readOnly:false,ariaLabel:'Classifier'});
      assert.equal(select27.value,'FtrlFh');
      assert.deepEqual(Array.from(options27,v=>v.value),Array.from(modelVariants,v=>v.name));
      for(const v of modelVariants){
        const slot='variant/'+modelScope+'/'+v.name+'/label',entry=catalog.entries[slot];
        // Stage27 left Disabled ambiguous; Stage35 explicitly reviewed this exact variant.
        if(v.name==='Disabled'){
          if(catalog.entries['enum/CompressionAlgo/none/label'])assert.deepEqual(entry,{original:'Disabled',ru:'Отключено'});
          else assert.ok(!entry);
        }else assert.ok(entry);
        if(entry)assert.equal(entry.original,v.label);
        const label=lang==='ru'&&entry?entry.ru:v.label;
        assert.ok(html.includes(htmlText19(label)),slot);
        assert.ok(render(fieldValue20.VariantValue,{schema,objectName:modelScope,value:v.name}).includes(htmlText19(label)),slot);
      }
      select27.onValueChange('FtrlCcfh');assert.equal(event,'FtrlCcfh');
      assert.equal(JSON.stringify(modelVariants),modelRaw);
    }
    variants27++;
    for(const [formKey,name,value,changed] of [
      ['x:SieveSystemInterpreter','noCapabilityCheck',false,true],
      ['x:SieveUserInterpreter','maxScripts',10,20],
      ['x:SieveUserInterpreter','maxReceivedHeaders',30,40],
      ['x:SieveUserScript','contents','require ["fileinto"]; keep;','keep;'],
      ['SieveScript','isActive',false,true],
      ['x:SpamSettings','scoreDiscard',0,15],
      ['x:SpamSettings','scoreReject',0,20],
      ['x:SpamSettings','spamFilterRulesUrl','https://example.invalid/rules','https://example.invalid/other'],
      ['x:SpamPyzor','enable',false,true],
      ['x:SpamClassifier','learnSpamFromRblHits',0,3],
      ['x:FtrlParameters','numFeatures','16','28'],
      ['x:SpamTrainingSample','deleteAfterUse',false,true],
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
      const formProps={sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,v)=>{event=[key,v];}};
      for(const lang of ['ru','en','ru']){
        language=lang;
        const html=render(FormSections,formProps);
        for(const key of [slot,desc])assert.ok(html.includes(htmlText19(lang==='ru'?ru(key):original(key))),key);
        assert.equal(capturedField.formField.name,name);
        assert.equal(capturedField.value,value);
        capturedField.onChange(changed);assert.deepEqual(event,[name,changed]);
        assert.equal(JSON.stringify({sections,data}),snapshot);
      }
      hash='unknown';language='ru';
      assert.ok(render(FormSections,formProps).includes(htmlText19(original(slot))),slot);
      hash=pin.schemaHash;forms27++;
    }
    for(const [listKey,name] of [['x:SpamTag','score'],['x:SpamFileExtension','extension'],['SieveScript','isActive']]){
      const column=schema.lists[listKey].columns.find(v=>v.name===name),slot='list/'+listKey+'/column/'+name;
      assert.equal(column.label,original(slot));
      let sorted;const raw=JSON.stringify(column),props={column,listKey,sortable:true,sort:null,onSort:v=>{sorted=v;}};
      for(const lang of ['ru','en','ru']){
        language=lang;const label=lang==='ru'?ru(slot):original(slot);
        assert.ok(render(ColumnHeader,props).includes(htmlText19(label)),slot);
        assert.ok(render(ColumnHeader,{...props,sortable:false}).includes(htmlText19(label)),slot);
        ColumnHeader(props).props.children.props.onClick();assert.equal(sorted,name);
        assert.equal(JSON.stringify(column),raw);
      }
      columns27++;
    }
    for(const [listKey,name,value,changed] of [['x:SpamFileExtension','extension','zip','pdf'],['x:SpamTag','tag','RBL_TEST','RBL_NEXT']]){
      const filter=schema.lists[listKey].filters.find(v=>v.field===name),slot='list/'+listKey+'/filter/'+name;
      assert.equal(filter.label,original(slot));assert.equal(filter.type,'text');
      const values={[name]:value},raw=JSON.stringify({filter,values});
      const props={schema,listKey,filter,values,isXPrefixed:true,onChange:(k,v)=>{event=[k,v];},onCommit:()=>{throw Error('Unexpected commit');}};
      for(const lang of ['ru','en','ru']){
        language=lang;search27=undefined;
        assert.ok(render(FilterField,props).includes(htmlText19(lang==='ru'?ru(slot):original(slot))),slot);
        assert.equal(search27.value,value);
        search27.onValueChange(changed);assert.deepEqual(event,[name,changed]);
        assert.equal(JSON.stringify({filter,values}),raw);
      }
      filters27++;
    }
  }
  assert.equal(multi27,2);assert.equal(models27,2);assert.equal(variants27,2);
  assert.equal(forms27,24);assert.equal(columns27,6);assert.equal(filters27,4);
  console.log('PASS: Stage27 actual EnumMultiSelect/EnumWidget/EnumValue/VariantSelect/VariantValue/FormSections/FieldRow/ColumnHeader/FilterField synthetic SSR; both pinned editions, Sieve capabilities, classifier model and numeric IDs, raw script/threshold/filter values and callbacks; no script execution, classifier training, rule downloads or network');
}

// Stage28: DNS and network display only; no actual connections, policy evaluation or delivery.
if(catalog.entries['enum/DnsResolverProtocol/tcp/label']){
  let formCases28=0,enumCases28=0,columns28=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    for(const [enumName,selected,next] of [
      ['DnsResolverProtocol','tcp','udp'],
      ['TsigAlgorithm','hmac-sha256','hmac-sha512'],
      ['NetworkListenerProtocol','imap','lmtp'],
      ['TlsVersion','tls12','tls13'],
      ['BlockReason','manual','authFailure'],
      ['ServiceProtocol','smtp','caldav'],
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
      hash=pin.schemaHash;enumCases28++;
    }
    for(const [formKey,name,value,changed] of [
      ['x:DnsCustomResolver','address','192.0.2.1','192.0.2.2'],
      ['x:DnsCustomResolver','port',53,853],
      ['x:DnsResolverCommon','enableEdns',true,false],
      ['x:DnsResolverCustom','maxConcurrentRequests',0,1],
      ['x:DnsResolverTls','useTls',true,false],
      ['x:NetworkListener','socketTtl',64,32],
      ['x:Service','cleartext',false,true],
      ['x:AllowedIp','reason','synthetic allow','synthetic change'],
      ['x:BlockedIp','address','192.0.2.0/24','198.51.100.0/24'],
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
      hash=pin.schemaHash;formCases28++;
    }
    for(const [listKey,name] of [['x:DnsServer','ttl'],['x:AllowedIp','address'],['x:BlockedIp','reason']]){
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
      columns28++;
    }
  }
  assert.equal(enumCases28,12);
  assert.equal(formCases28,18);
  assert.equal(columns28,6);
  console.log('PASS: Stage28 actual EnumWidget/EnumValue, FormSections/FieldRow and ColumnHeader synthetic SSR; both pinned editions, DNS protocols/TSIG/TLS/listener and address settings, raw callbacks and sort keys, unknown hash fallback; no DNS requests, network connections or policy changes');
}



// Stage29: Directory and accounts display only; no actual connections, policy evaluation or delivery.
if(catalog.entries['enum/OAuthGrantType/authorizationCode/label']){
  let formCases29=0,enumCases29=0,columns29=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    for(const [enumName,selected,next] of [
      ['OAuthGrantType','authorizationCode','refreshToken'],
      ['OAuthScope','mail','full'],
      ['OAuthClientKind','dynamic','registered'],
      ['PasskeyAlgorithm','ed25519','es256'],
      ['OidcIntrospectionAuth','clientSecretBasic','clientSecretPost'],
      ['StorageQuota','maxApiKeys','maxAppPasswords'],
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
      hash=pin.schemaHash;enumCases29++;
    }
    for(const [formKey,name,value,changed] of [
      ['x:AccountPassword','currentSecret','synthetic-old','synthetic-new'],
      ['x:AccountPassword','secret','synthetic-new','synthetic-other'],
      ['x:MaskedEmail','emailDomain','example.invalid','example.org'],
      ['x:MaskedEmail','emailPrefix','test_1','test_2'],
      ['x:MaskedEmail','forDomain','example.invalid','example.org'],
      ['x:OAuthGrant','remoteIp','192.0.2.1','192.0.2.2'],
      ['x:OAuthGrant','createdAt','2026-01-01T00:00:00Z','2026-01-02T00:00:00Z'],
      ['x:OAuthGrant','lastUsedAt','2026-01-01T00:00:00Z','2026-01-02T00:00:00Z'],
      ['x:AccountSettings','locale','en','ru'],
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
      hash=pin.schemaHash;formCases29++;
    }
    for(const [listKey,name] of [['x:MaskedEmail','forDomain'],['x:OAuthGrant','createdAt'],['x:OAuthGrant','lastUsedAt']]){
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
      columns29++;
    }
  }
  assert.equal(enumCases29,12);
  assert.equal(formCases29,18);
  assert.equal(columns29,6);
  console.log('PASS: Stage29 actual EnumWidget/EnumValue, FormSections/FieldRow and ColumnHeader synthetic SSR; both pinned editions, OAuth, passkeys, quotas and account labels, raw callbacks and sort keys, unknown hash fallback; no credential changes, OAuth requests, permissions or policy changes');
}




 // Stage29: use the real previously accepted permission adapter with synthetic ACL filtering.
if(catalog.entries['enum/Permission/sysAccountGet/label']){
  const oldPermission=JSON.parse(read('src/i18n/schema/permission_ru.json'));
  const {permissionDisplayLabel}=sourceModule(read('src/i18n/schemaPermissionText.ts'),'schemaPermissionText.ts',{'./schema/permission_ru.json':oldPermission});
  let checks=[],labels=new Map(),combo;
  const permitted=new Set(['sysAccountGet','sysAccountQuery','sysAccountUpdate','impersonate','unlimitedRequests']);
  const {EnumMultiSelect,EnumWidget:PermissionWidget}=component('src/components/forms/widgets/EnumWidgets.tsx',{
    'lucide-react':{Search:icon},
    '@/components/ui/button':{Button:passthrough},
    '@/components/ui/checkbox':{Checkbox:props=>{checks.push(props);return null;}},
    '@/components/ui/input':{Input:()=>null},
    '@/components/ui/label':{Label:props=>{labels.set(props.htmlFor,React.Children.toArray(props.children).filter(c=>typeof c==='string').join(''));return h('label',{htmlFor:props.htmlFor},props.children);}},
    '@/components/ui/combobox':{Combobox:props=>{combo=props;return h('div',null,props.options.map(o=>h('span',{key:o.value},o.label)));}},
    '@/components/ui/popover':{Popover:passthrough,PopoverContent:passthrough,PopoverTrigger:passthrough},
    '@/components/common/HelpTooltip':{HelpTooltip:()=>null},
    '@/hooks/usePermissions':{usePermissionCheckers:()=>({hasPermission:id=>permitted.has(id)})},
    '@/lib/schemaResolver':resolver19,
    '@/components/forms/formContext':{useFormContext:()=>({schema:fixtureSchema19})},
    '@/hooks/useSchemaText':{useSchemaText,useCanTranslateSchema:()=>language==='ru'&&catalog.meta.schemaHashes.includes(hash)},
    '@/i18n/schemaPermissionText':{permissionDisplayLabel},
    '@/components/ui/comboboxSearch':{filterComboboxOptions:options=>options},
    '@/i18n/schemaOptionLabels':{headerProtectionOptionLabel:x=>x,localeOptionLabel:(_id,label)=>label},
    '@/components/forms/widgets/RemovablePill':{RemovablePill:()=>null},
  });
  let cases=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    const all=resolver19.getEnum(schema,'Permission');
    const selected=all.filter(v=>permitted.has(v.name));
    assert.equal(selected.length,permitted.size);
    for(const v of all){
      const entry=oldPermission.entries[v.name];
      assert.equal(entry.original,v.label);
      assert.deepEqual(catalog.entries['enum/Permission/'+v.name+'/label'],entry);
    }
    const items=['sysAccountGet'],snapshot=JSON.stringify({all,items});
    let event;
    const multiProps={enumName:'Permission',items,onChange:v=>{event=v;},readOnly:false,control:{id:'permissions'}};
    const singleProps={type:{type:'enum',enumName:'Permission',nullable:false},formField:{name:'permissions'},value:items[0],onChange:v=>{event=v;},readOnly:false,control:{}};
    for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
      language=lang;hash=activeHash;checks=[];labels=new Map();
      render(EnumMultiSelect,multiProps);render(PermissionWidget,singleProps);
      assert.equal(checks.length,selected.length);
      assert.deepEqual(Array.from(combo.options,o=>o.value),Array.from(selected,v=>v.name));
      for(const [i,v] of selected.entries()){
        const slot='enum/Permission/'+v.name+'/label',id='permissions-'+v.name;
        const label=lang==='ru'&&activeHash===pin.schemaHash?ru(slot):v.label;
        assert.equal(checks[i].id,id);assert.equal(labels.get(id),label);
        assert.equal(checks[i].checked,items.includes(v.name));
        assert.equal(combo.options[i].label,label);
        assert.ok(render(scalar20.EnumValue,{schema,enumName:'Permission',value:v.name}).includes(htmlText19(label)));
      }
      checks[selected.findIndex(v=>v.name==='sysAccountQuery')].onCheckedChange();
      assert.deepEqual(Array.from(event),['sysAccountGet','sysAccountQuery']);
      combo.onValueChange('sysAccountUpdate');assert.equal(event,'sysAccountUpdate');
      assert.equal(JSON.stringify({all,items}),snapshot);
    }
    cases++;
  }
  assert.equal(cases,2);
  console.log('PASS: Stage29 Permission catalog parity, actual EnumMultiSelect/EnumWidget/EnumValue, real legacy adapter, raw IDs, mocked ACL filter, callbacks and unknown hash fallback on both pinned editions');
}

// Stage30: coordinator and store variants and settings remain display-only. No storage connections.
if(catalog.entries['variant/x:Coordinator/Kafka/label']){
  let select30,items30=[];
  const {VariantSelect}=component('src/components/forms/VariantSelect.tsx',{
    '@/components/ui/select':{
      Select:props=>{select30=props;return h('div',null,props.children);},
      SelectContent:passthrough,SelectTrigger:passthrough,SelectValue:()=>null,
      SelectItem:props=>{items30.push(props);return h('span',null,props.children);},
    },
    '@/components/forms/FieldRow':{FieldLabel:props=>h('span',null,props.label)},
    '@/components/forms/formContext':{fieldIds:()=>({inputId:'storage-type',labelId:'storage-label'}),useFieldScope:()=>({path:[]}),useFormContext:()=>({idPrefix:'synthetic'}),useInPanel:()=>false},
    '@/components/forms/formLogic':{VARIANT_FIELD:'@type'},
  });
  let variantCases30=0,formCases30=0,enumCases30=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    for(const [objectName,selected,next] of [
      ['x:Coordinator','Kafka','Nats'],
      ['x:KeepTls','Authority','Disabled'],
    ]){
      const variants=schema.schemas[objectName]?.variants;
      assert.ok(variants,objectName);
      assert.ok(variants.some(v=>v.name===selected)&&variants.some(v=>v.name===next),objectName);
      const raw=JSON.stringify(variants);
      let event;
      const props={variantScope:objectName,variants,value:selected,onChange:v=>{event=v;},readOnly:false,ariaLabel:'Storage type'};
      for(const lang of ['ru','en','ru']){
        language=lang;select30=undefined;items30=[];
        const html=render(VariantSelect,props);
        assert.ok(select30,objectName+' dropdown expected');
        assert.equal(select30.value,selected);
        assert.deepEqual(Array.from(items30,v=>v.value),Array.from(variants,v=>v.name));
        for(const [i,v] of variants.entries()){
          const slot='variant/'+objectName+'/'+v.name+'/label';
          const entry=catalog.entries[slot];
          const expected=lang==='ru'&&entry?.original===v.label?entry.ru:v.label;
          assert.equal(items30[i].children,expected,slot);
          assert.ok(html.includes(htmlText19(expected)),slot);
        }
        select30.onValueChange(next);
        assert.equal(event,next);
        assert.equal(props.value,selected);
        assert.equal(JSON.stringify(variants),raw);
      }
      hash='unknown';language='ru';items30=[];
      render(VariantSelect,props);
      assert.deepEqual(Array.from(items30,v=>v.children),Array.from(variants,v=>v.label));
      hash=pin.schemaHash;variantCases30++;
    }
    for(const [enumName,selected,next] of [
      ['KeepStreamMode','everywhere','owner'],
      ['PostgreSqlRecyclingMethod','clean','verified'],
      ['RedisProtocol','resp2','resp3'],
    ]){
      const variants=resolver19.getEnum(schema,enumName);
      assert.ok(variants.length,enumName);
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
      hash='unknown';language='ru';
      assert.ok(render(EnumWidget,{type:{type:'enum',enumName,nullable:false},formField:{name:'mode'},value:selected,onChange:()=>{},readOnly:false,control:{}}).includes(htmlText19(original(slot))),slot);
      hash=pin.schemaHash;enumCases30++;
    }
    for(const [formKey,name,value,changed] of [
      ['x:KeepStore','clusterDiscovery',false,true],
      ['x:KeepStore','deadline','5s','10s'],
      ['x:MySqlStore','maxAllowedPacket',1048576,2097152],
      ['x:MySqlStore','allowInvalidCerts',false,true],
      ['x:PostgreSqlStore','responseTimeout','5s','10s'],
      ['x:NatsCoordinator','noEcho',false,true],
      ['x:KafkaCoordinator','allowInvalidCerts',false,true],
      ['x:RedisClusterStore','readFromReplicas',false,true],
      ['x:SqliteStore','poolWorkers',4,8],
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
      hash='unknown';language='ru';
      assert.ok(render(FormSections,{sections,formKey,data,errors:{},readOnly:false,onFieldChange:()=>{}}).includes(htmlText19(original(slot))),slot);
      hash=pin.schemaHash;formCases30++;
    }
  }
  assert.equal(variantCases30,4);
  assert.equal(enumCases30,6);
  assert.equal(formCases30,18);
  console.log('PASS: Stage30 actual VariantSelect, EnumWidget/EnumValue, FormSections/FieldRow synthetic SSR; edition-pinned coordinator/TLS variants, raw protocol IDs and callbacks, deadline, invalid-cert flags, replica and worker settings; no storage connections or configuration writes');
}




// Stage31: protocol and proxy display only; no live HTTP, IMAP, JMAP or mail operations.
if(catalog.entries['enum/ClientIpSource/forwarded/label']){
  let enumCases31=0,formCases31=0,mapCases31=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    const enumName='ClientIpSource',variants=resolver19.getEnum(schema,enumName);
    assert.deepEqual(Array.from(variants,v=>v.name).sort(),['forwarded','peer','xForwardedFor']);
    const raw=JSON.stringify(variants);
    for(const [selected,next] of [['forwarded','peer'],['peer','xForwardedFor'],['xForwardedFor','forwarded']]){
      let event;
      const props={type:{type:'enum',enumName,nullable:false},formField:{name:'clientIpSource'},value:selected,onChange:v=>{event=v;},readOnly:false,control:{}};
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;
        const expected=v=>lang==='ru'&&activeHash===pin.schemaHash?ru('enum/'+enumName+'/'+v.name+'/label'):v.label;
        const html=render(EnumWidget,props);
        assert.deepEqual(Array.from(capturedCombo19.options,v=>v.value),Array.from(variants,v=>v.name));
        for(const [i,v] of variants.entries()){
          assert.equal(capturedCombo19.options[i].label,expected(v));
          assert.ok(html.includes(htmlText19(expected(v))));
          assert.ok(render(scalar20.EnumValue,{schema,enumName,value:v.name}).includes(htmlText19(expected(v))));
        }
        assert.equal(capturedCombo19.value,selected);capturedCombo19.onValueChange(next);assert.equal(event,next);
        assert.equal(props.value,selected);assert.equal(JSON.stringify(variants),raw);
      }
      enumCases31++;
    }
    // Split forms use the actual form key; their currently unwired description
    // slots are deliberately NOT credited by this packet.
    for(const [formKey,objectKey,name,value,changed] of [
      ['x:Http','x:Http','clientIpSource','forwarded','peer'],
      ['x:Http','x:Http','forwardedHops',1,2],
      ['x:Http','x:Http','redirectRoot','https://example.invalid/old','https://example.invalid/new'],
      ['x:Http','x:Http','responseHeaders',{'X-Synthetic':'old'},{'X-Synthetic':'new'}],
      ['x:Http/HttpSecurity','x:Http','enableHsts',false,true],
      ['x:Http/HttpSecurity','x:Http','usePermissiveCors',false,true],
      ['x:HttpForm','x:HttpForm','fieldHoneyPot','synthetic-old','synthetic-new'],
      ['x:Imap','x:Imap','allowPlainTextAuth',false,true],
      ['x:Imap','x:Imap','maxMessagesPerCommand',1000,2000],
      ['x:Imap','x:Imap','maxMessagesPerSave',2000,3000],
      ['x:Imap','x:Imap','minUidBatchSize',250,500],
      ['x:Jmap/JmapLimits','x:Jmap','maxConcurrentUploads',2,4],
      ['x:Jmap/JmapPush','x:Jmap','maxPushAttempts',3,4],
      ['x:Jmap/JmapWebsocket','x:Jmap','websocketHeartbeat','30s','60s'],
      ['x:Email/EmailLimits','x:Email','maxFlagLength',64,128],
      ['x:EmailFolder','x:EmailFolder','create',false,true],
    ]){
      const form=schema.forms[formKey],field=schema.fields[objectKey]?.properties[name];
      assert.ok(form&&field,formKey+'/'+name);
      const section=form.sections.find(s=>s.fields.some(f=>f.name===name));
      assert.ok(section,formKey+'/'+name);
      const formField=section.fields.find(f=>f.name===name);
      const slot='form/'+formKey+'/field/'+name,desc='field/'+formKey+'/'+name+'/description';
      assert.equal(formField.label,original(slot));
      const sections=[{key:'section-'+form.sections.indexOf(section),title:section.title,fields:[{formField,field}]}];
      const data={[name]:value},snapshot=JSON.stringify({sections,data});
      let event;
      const props={sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,v)=>{event=[key,v];}};
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;
        const localized=lang==='ru'&&activeHash===pin.schemaHash;
        const html=render(FormSections,props);
        assert.ok(html.includes(htmlText19(localized?ru(slot):original(slot))),slot);
        if(catalog.entries[desc]){
          assert.equal(field.description,original(desc));
          assert.ok(html.includes(htmlText19(localized?ru(desc):original(desc))),desc);
        }else{
          assert.ok(field.description);
          assert.ok(html.includes(htmlText19(field.description)),desc+' raw fallback');
        }
        assert.equal(capturedField.formField.name,name);
        assert.equal(capturedField.value,value);
        if(name==='responseHeaders'){
          for(const key of ['keyLabel','valueLabel']){
            const labelSlot=slot+'/'+key;
            assert.equal(formField[key],original(labelSlot));
            assert.equal(capturedField.formField[key],localized?ru(labelSlot):original(labelSlot));
          }
        }
        capturedField.onChange(changed);assert.deepEqual(event,[name,changed]);
        assert.equal(JSON.stringify({sections,data}),snapshot);
      }
      if(name==='responseHeaders')mapCases31++;
      formCases31++;
    }
  }
  assert.equal(enumCases31,6);
  assert.equal(formCases31,32);
  assert.equal(mapCases31,2);
  console.log('PASS: Stage31 actual EnumWidget/EnumValue/FormSections/FieldRow synthetic SSR, both pinned editions, trusted proxy sources and raw IDs, header map key/value display metadata, IMAP limits and JMAP split-form labels, raw callbacks and unknown-hash fallback; unwired descriptions explicitly left raw; no live connections or configuration writes');
}


// Stage32: report settings and retention schedules; display only, no report or cleanup jobs.
if(catalog.entries['variant/x:Cron/Daily/label']){
  const {VariantSelect}=component('src/components/forms/VariantSelect.tsx',{
    '@/components/ui/select':{
      Select:()=>{throw Error('Cron selector must remain segmented');},
      SelectContent:passthrough,SelectTrigger:passthrough,SelectValue:()=>null,SelectItem:passthrough,
    },
    '@/components/forms/FieldRow':{FieldLabel:props=>h('span',null,props.label)},
    '@/components/forms/formContext':{fieldIds:()=>({inputId:'cron-type',labelId:'cron-label'}),useFieldScope:()=>({path:[]}),useFormContext:()=>({idPrefix:'synthetic'}),useInPanel:()=>false},
    '@/components/forms/formLogic':{VARIANT_FIELD:'@type'},
  });
  function find32(node,predicate){
    if(!React.isValidElement(node))return [];
    return [...(predicate(node)?[node]:[]),...React.Children.toArray(node.props.children).flatMap(child=>find32(child,predicate))];
  }
  let variantCases32=0,formCases32=0,archiveCases32=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    const variants=schema.schemas['x:Cron'].variants;
    assert.deepEqual(Array.from(variants,v=>v.name).sort(),['Daily','Hourly','Weekly']);
    const raw=JSON.stringify(variants);
    for(const [selected,next] of [['Daily','Hourly'],['Hourly','Weekly'],['Weekly','Daily']]){
      let event;
      const props={variantScope:'x:Cron',variants,value:selected,onChange:v=>{event=v;},readOnly:false,ariaLabel:'Schedule'};
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;
        const localized=lang==='ru'&&activeHash===pin.schemaHash;
        const html=render(VariantSelect,props);
        assert.ok(html.includes('role="radiogroup"'));
        const controls=find32(VariantSelect(props),n=>typeof n.type==='function'&&n.type.name==='SegmentedVariants');
        assert.equal(controls.length,1);
        const control=controls[0];assert.equal(control.props.value,selected);
        assert.deepEqual(Array.from(control.props.variants,v=>v.name),Array.from(variants,v=>v.name));
        const radios=find32(control.type(control.props),n=>n.type==='button'&&n.props.role==='radio');
        assert.equal(radios.length,variants.length);
        for(const [i,v] of variants.entries()){
          const slot='variant/x:Cron/'+v.name+'/label';
          assert.equal(v.label,original(slot));
          const expected=localized?ru(slot):v.label;
          assert.equal(radios[i].props.children,expected);
          assert.equal(radios[i].props['aria-checked'],v.name===selected);
          assert.ok(html.includes(htmlText19(expected)),slot);
          assert.ok(render(fieldValue20.VariantValue,{schema,objectName:'x:Cron',value:v.name}).includes(htmlText19(expected)),slot);
        }
        radios[variants.findIndex(v=>v.name===next)].props.onClick();
        assert.equal(event,next);assert.equal(props.value,selected);assert.equal(JSON.stringify(variants),raw);
      }
      variantCases32++;
    }
    for(const [formKey,objectKey,name,value,changed] of [
      ['x:CronDaily','x:CronDaily','hour',3,5],
      ['x:CronHourly','x:CronHourly','minute',15,45],
      ['x:CronWeekly','x:CronWeekly','day',1,2],
      ['x:DkimReportSettings','x:DkimReportSettings','fromName','Synthetic name','Edited name'],
      ['x:DmarcReportSettings','x:DmarcReportSettings','maxAggregateReportSize',1024,2048],
      ['x:DsnReportSettings','x:DsnReportSettings','fromName','Synthetic name','Edited name'],
      ['x:ReportSettings','x:ReportSettings','inboundReportForwarding',false,true],
      ['x:ReportSettings','x:ReportSettings','outboundReportDomain','example.invalid','other.invalid'],
      ['x:SpfReportSettings','x:SpfReportSettings','fromName','Synthetic name','Edited name'],
      ['x:TlsReportSettings','x:TlsReportSettings','maxReportSize',1024,2048],
      ['x:DataRetention/DataCleanup','x:DataRetention','holdMtaReportsFor','7d','14d'],
      ['x:DataRetention/DataExpunge','x:DataRetention','expungeTrashAfter','7d','14d'],
      ['x:DataRetention/ArchivingRetention','x:DataRetention','archiveDeletedAccountsFor','7d','14d'],
    ]){
      const form=schema.forms[formKey],field=schema.fields[objectKey]?.properties[name];
      if(formKey==='x:DataRetention/ArchivingRetention'&&pin.edition==='oss'){assert.ok(!form);continue;}
      assert.ok(form&&field,formKey+'/'+name);
      const section=form.sections.find(s=>s.fields.some(f=>f.name===name));
      assert.ok(section,formKey+'/'+name);
      const formField=section.fields.find(f=>f.name===name);
      const slot='form/'+formKey+'/field/'+name,desc='field/'+formKey+'/'+name+'/description';
      assert.equal(formField.label,original(slot));
      const sectionKey='section-'+form.sections.indexOf(section),sectionSlot='form/'+formKey+'/section/'+sectionKey;
      const sections=[{key:sectionKey,title:section.title,fields:[{formField,field}]}];
      const data={[name]:value},snapshot=JSON.stringify({sections,data});let event;
      const props={sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,v)=>{event=[key,v];}};
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;
        const localized=lang==='ru'&&activeHash===pin.schemaHash;
        const html=render(FormSections,props);
        assert.ok(html.includes(htmlText19(localized?ru(slot):original(slot))),slot);
        if(catalog.entries[sectionSlot]){
          assert.equal(section.title,original(sectionSlot));
          assert.ok(html.includes(htmlText19(localized?ru(sectionSlot):original(sectionSlot))),sectionSlot);
        }
        if(catalog.entries[desc]){
          assert.equal(field.description,original(desc));
          assert.ok(html.includes(htmlText19(localized?ru(desc):original(desc))),desc);
        }else if(field.description){
          assert.ok(html.includes(htmlText19(field.description)),desc+' raw fallback');
        }
        assert.equal(capturedField.formField.name,name);assert.equal(capturedField.value,value);
        capturedField.onChange(changed);assert.deepEqual(event,[name,changed]);
        assert.equal(JSON.stringify({sections,data}),snapshot);
      }
      if(formKey==='x:DataRetention/ArchivingRetention')archiveCases32++;
      formCases32++;
    }
  }
  assert.equal(variantCases32,6);
  assert.equal(formCases32,25);
  assert.equal(archiveCases32,1);
  console.log('PASS: Stage32 actual segmented VariantSelect/VariantValue/FormSections/FieldRow synthetic SSR; both pinned editions; Cron raw IDs and numeric callbacks, report settings, retention split forms and Enterprise-only archive, unknown hash fallback; no report delivery or scheduled cleanup execution');
}


// Stage33: application resources, ASN, cluster roles, licensing, lookup keys and webhooks.
// All inputs are synthetic, no actual fetch, activation, task execution or licensing.
if(catalog.entries['enum/ClusterTaskType/accountMaintenance/label']){
  let checks33=[],labels33=new Map(),pills33=[],select33,options33=[];
  const {EnumMultiSelect}=component('src/components/forms/widgets/EnumWidgets.tsx',{
    'lucide-react':{Search:icon},
    '@/components/ui/button':{Button:passthrough},
    '@/components/ui/checkbox':{Checkbox:props=>{checks33.push(props);return null;}},
    '@/components/ui/input':{Input:()=>null},
    '@/components/ui/label':{Label:props=>{labels33.set(props.htmlFor,React.Children.toArray(props.children).filter(c=>typeof c==='string').join(''));return h('label',{htmlFor:props.htmlFor},props.children);}},
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
    '@/components/forms/widgets/RemovablePill':{RemovablePill:props=>{pills33.push(props);return h('span',null,props.children);}},
  });
  const selectDeps33={Select:props=>{select33=props;return h('div',null,props.children);},SelectContent:passthrough,SelectTrigger:passthrough,SelectValue:()=>null,SelectItem:props=>{options33.push(props);return h('span',null,props.children);}};
  const {VariantSelect}=component('src/components/forms/VariantSelect.tsx',{
    '@/components/ui/select':selectDeps33,
    '@/components/forms/FieldRow':{FieldLabel:props=>h('span',null,props.label)},
    '@/components/forms/formContext':{fieldIds:()=>({inputId:'lookup-type',labelId:'lookup-label'}),useFieldScope:()=>({path:[]}),useFormContext:()=>({idPrefix:'synthetic'}),useInPanel:()=>false},
    '@/components/forms/formLogic':{VARIANT_FIELD:'@type'},
  });
  function find33(node,predicate){
    if(!React.isValidElement(node))return [];
    return [...(predicate(node)?[node]:[]),...React.Children.toArray(node.props.children).flatMap(child=>find33(child,predicate))];
  }
  let multi33=0,variant33=0,forms33=0,enterprise33=0,columns33=0,placeholder33=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    const caps=resolver19.getEnum(schema,'ClusterTaskType');
    const items=['accountMaintenance','searchIndexing'],next='metricsPush';
    assert.equal(caps.length,10);
    assert.ok(items.every(id=>caps.some(v=>v.name===id))&&caps.some(v=>v.name===next));
    const capRaw=JSON.stringify({caps,items});let event;
    const props={enumName:'ClusterTaskType',items,onChange:v=>{event=v;},readOnly:false,control:{id:'cluster-tasks'}};
    for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
      language=lang;hash=activeHash;checks33=[];labels33=new Map();pills33=[];
      const localized=lang==='ru'&&activeHash===pin.schemaHash;
      const html=render(EnumMultiSelect,props);
      assert.equal(checks33.length,caps.length);
      for(const [i,v] of caps.entries()){
        const slot='enum/ClusterTaskType/'+v.name+'/label';
        assert.equal(v.label,original(slot));
        const id='cluster-tasks-'+v.name.replace(/[^A-Za-z0-9_-]/g,'_');
        assert.equal(checks33[i].id,id);assert.equal(checks33[i].checked,items.includes(v.name));
        assert.equal(labels33.get(id),localized?ru(slot):v.label,slot);
        assert.ok(render(scalar20.EnumValue,{schema,enumName:'ClusterTaskType',value:v.name}).includes(htmlText19(localized?ru(slot):v.label)),slot);
      }
      // Exactly ten variants use the inline grid, not the searchable popover/pills.
      assert.equal(pills33.length,0);
      assert.ok(html.includes('sm:grid-cols-2'));
      for(const v of caps){
        const slot='enum/ClusterTaskType/'+v.name+'/label';
        assert.ok(html.includes(htmlText19(localized?ru(slot):v.label)),slot);
      }
      checks33[caps.findIndex(v=>v.name===next)].onCheckedChange();
      assert.deepEqual(Array.from(event),[...items,next]);
      checks33[caps.findIndex(v=>v.name===items[0])].onCheckedChange();
      assert.deepEqual(Array.from(event),[items[1]]);
      assert.equal(JSON.stringify({caps,items}),capRaw);
    }
    multi33++;
    for(const variantScope of ['x:Asn','x:ClusterListenerGroup','x:ClusterTaskGroup']){
      const variants=schema.schemas[variantScope].variants,raw=JSON.stringify(variants);
      const expectedIds=variantScope==='x:Asn'?['Disabled','Dns','Resource']:['DisableAll','DisableSome','EnableAll','EnableSome'];
      assert.deepEqual(Array.from(variants,v=>v.name).sort(),expectedIds);
      const selected=variants[0].name,nextVariant=variants[1].name;
      const variantProps={variantScope,variants,value:selected,onChange:v=>{event=v;},readOnly:false,ariaLabel:'Synthetic variant'};
      const segmented=variants.length>1&&variants.length<=4&&variants.reduce((sum,v)=>sum+v.label.length,0)<=44;
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;select33=undefined;options33=[];
        const localized=lang==='ru'&&activeHash===pin.schemaHash;
        const html=render(VariantSelect,variantProps);
        const label=v=>localized&&catalog.entries['variant/'+variantScope+'/'+v.name+'/label']?ru('variant/'+variantScope+'/'+v.name+'/label'):v.label;
        for(const v of variants){
          const slot='variant/'+variantScope+'/'+v.name+'/label';
          if(variantScope==='x:Asn'&&v.name==='Disabled'){
            assert.equal(v.label,'Disabled');
            if(catalog.entries[slot])assert.deepEqual(catalog.entries[slot],{original:'Disabled',ru:'Отключено'});
            else assert.ok(!catalog.entries[slot],slot);
          }else assert.equal(v.label,original(slot));
          assert.ok(html.includes(htmlText19(label(v))),slot);
          assert.ok(render(fieldValue20.VariantValue,{schema,objectName:variantScope,value:v.name}).includes(htmlText19(label(v))),slot);
        }
        if(segmented){
          assert.ok(html.includes('role="radiogroup"'));
          const controls=find33(VariantSelect(variantProps),n=>typeof n.type==='function'&&n.type.name==='SegmentedVariants');
          assert.equal(controls.length,1);
          const control=controls[0];assert.equal(control.props.value,selected);
          assert.deepEqual(Array.from(control.props.variants,v=>v.name),Array.from(variants,v=>v.name));
          const radios=find33(control.type(control.props),n=>n.type==='button'&&n.props.role==='radio');
          assert.equal(radios.length,variants.length);
          for(const [i,v] of variants.entries()){
            assert.equal(radios[i].props.children,label(v));
            assert.equal(radios[i].props['aria-checked'],v.name===selected);
          }
          radios[1].props.onClick();
        }else{
          assert.equal(select33.value,selected);
          assert.deepEqual(Array.from(options33,v=>v.value),Array.from(variants,v=>v.name));
          select33.onValueChange(nextVariant);
        }
        assert.equal(event,nextVariant);assert.equal(variantProps.value,selected);assert.equal(JSON.stringify(variants),raw);
      }
      variant33++;
    }
    for(const [formKey,name,value,changed] of [
      ['x:Application','autoUpdateInterval','7d','14d'],
      ['x:Application','oauthClientId','synthetic-client','edited-client'],
      ['x:Application','oauthScopes',['synthetic-scope'],['edited-scope']],
      ['x:Application','resourceUrl','https://example.invalid/app','https://example.invalid/other'],
      ['x:Application','unpackDirectory','/synthetic','/edited'],
      ['x:Application','urlPrefix','/synthetic','/edited'],
      ['x:AsnDns','indexAsn',1,2],
      ['x:AsnDns','separator',',',';'],
      ['x:AsnDns','zoneIpV4','example.invalid','other.invalid'],
      ['x:AsnResource','asnUrls',['https://example.invalid/asn'],['https://example.invalid/other']],
      ['x:AsnResource','maxSize',1024,2048],
      ['x:AsnResource','refreshInterval','7d','14d'],
      ['x:AsnResource','timeout','10s','20s'],
      ['x:MemoryLookupKey','isGlobPattern',false,true],
      ['x:MemoryLookupKey','namespace','synthetic','edited'],
      ['x:MemoryLookupKeyValue','key','synthetic-key','edited-key'],
      ['x:MemoryLookupKeyValue','value','synthetic-value','edited-value'],
      ['x:WebHook','enable',false,true],
      ['x:WebHook','url','https://example.invalid/hook','https://example.invalid/other'],
      ['x:WebHook','signatureKey','synthetic-key','edited-key'],
      ['x:WebHook','lossy',false,true],
      ['x:WebHook','httpHeaders',{'X-Synthetic':'old'},{'X-Synthetic':'new'}],
      ['x:WebHook','discardAfter','10s','20s'],
      ['x:WebHook','throttle','10s','20s'],
      ['x:Enterprise','apiKey','synthetic-not-a-real-key','edited-not-a-real-key'],
      ['x:Enterprise','licenseKey','synthetic-not-a-license','edited-not-a-license'],
      ['x:Enterprise','logo','https://example.invalid/logo','https://example.invalid/other'],
    ]){
      const form=schema.forms[formKey],field=schema.fields[formKey]?.properties[name];
      if(formKey==='x:Enterprise'&&pin.edition==='oss'){assert.ok(!form);continue;}
      assert.ok(form&&field,formKey+'/'+name);
      const section=form.sections.find(s=>s.fields.some(f=>f.name===name));assert.ok(section,formKey+'/'+name);
      const formField=section.fields.find(f=>f.name===name);
      const slot='form/'+formKey+'/field/'+name,desc='field/'+formKey+'/'+name+'/description';
      assert.equal(formField.label,original(slot));assert.equal(field.description,original(desc));
      const sectionKey='section-'+form.sections.indexOf(section),sectionSlot='form/'+formKey+'/section/'+sectionKey;
      const sections=[{key:sectionKey,title:section.title,fields:[{formField,field}]}];
      const data={[name]:value},snapshot=JSON.stringify({sections,data});
      const formProps={sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,v)=>{event=[key,v];}};
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;
        const localized=lang==='ru'&&activeHash===pin.schemaHash;
        const html=render(FormSections,formProps);
        for(const key of [slot,desc])assert.ok(html.includes(htmlText19(localized?ru(key):original(key))),key);
        if(catalog.entries[sectionSlot]){
          assert.equal(section.title,original(sectionSlot));
          assert.ok(html.includes(htmlText19(localized?ru(sectionSlot):original(sectionSlot))),sectionSlot);
        }
        assert.equal(capturedField.formField.name,name);assert.equal(capturedField.value,value);
        if(name==='urlPrefix'){
          const ph=slot+'/placeholder';assert.equal(formField.placeholder,'/admin');
          assert.equal(capturedField.formField.placeholder,localized?ru(ph):original(ph));
          assert.equal(original(ph),'/admin');
        }
        capturedField.onChange(changed);assert.deepEqual(event,[name,changed]);
        assert.equal(JSON.stringify({sections,data}),snapshot);
      }
      if(name==='urlPrefix')placeholder33++;
      if(formKey==='x:Enterprise')enterprise33++;
      forms33++;
    }
    for(const [listKey,name] of [['x:Application','autoUpdateInterval'],['x:Application','urlPrefix'],['x:MemoryLookupKey','key'],['x:MemoryLookupKey','namespace'],['x:MemoryLookupKeyValue','value'],['x:WebHook','url']]){
      const column=schema.lists[listKey].columns.find(v=>v.name===name),slot='list/'+listKey+'/column/'+name;
      assert.equal(column.label,original(slot));
      let sorted;const raw=JSON.stringify(column),props={column,listKey,sortable:true,sort:null,onSort:v=>{sorted=v;}};
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;
        const label=lang==='ru'&&activeHash===pin.schemaHash?ru(slot):original(slot);
        assert.ok(render(ColumnHeader,props).includes(htmlText19(label)),slot);
        assert.ok(render(ColumnHeader,{...props,sortable:false}).includes(htmlText19(label)),slot);
        ColumnHeader(props).props.children.props.onClick();assert.equal(sorted,name);
        assert.equal(JSON.stringify(column),raw);
      }
      columns33++;
    }
  }
  assert.equal(multi33,2);assert.equal(variant33,6);
  assert.equal(forms33,51);assert.equal(enterprise33,3);assert.equal(placeholder33,2);assert.equal(columns33,12);
  console.log('PASS: Stage33 actual EnumMultiSelect/EnumValue, VariantSelect/VariantValue, FormSections/FieldRow and ColumnHeader synthetic SSR; both pinned editions, raw IDs, callback payloads, immutable placeholder source, unknown-hash fallback and Enterprise-only settings; no network, application or hook activation, licensing or task execution');
}


// Stage34: close the globally wired residual, keeping prior adapter wording and raw identities.
// All controls, secrets, endpoints and retry values below are synthetic, never used by a server.
if(catalog.entries['variant/x:TaskRetryStrategy/FixedDelay/label']){
  let selected34,options34=[];
  const optionLabels34=sourceModule(read('src/i18n/schemaOptionLabels.ts'),'schemaOptionLabels.ts');
  let enumControl34;
  const {EnumWidget:EnumWidget34}=component('src/components/forms/widgets/EnumWidgets.tsx',{
    'lucide-react':{Search:icon},
    '@/components/ui/button':{Button:passthrough},'@/components/ui/checkbox':{Checkbox:()=>null},
    '@/components/ui/input':{Input:()=>null},'@/components/ui/label':{Label:passthrough},
    '@/components/ui/combobox':{Combobox:props=>{enumControl34=props;return h('div',null,props.options.map(o=>h('span',{key:o.value},o.label)));}},
    '@/components/ui/popover':{Popover:passthrough,PopoverContent:passthrough,PopoverTrigger:passthrough},
    '@/components/common/HelpTooltip':{HelpTooltip:()=>null},
    '@/hooks/usePermissions':{usePermissionCheckers:()=>({hasPermission:()=>true})},
    '@/lib/schemaResolver':resolver19,
    '@/components/forms/formContext':{useFormContext:()=>({schema:fixtureSchema19})},
    '@/hooks/useSchemaText':{useSchemaText,useCanTranslateSchema:()=>language==='ru'&&catalog.meta.schemaHashes.includes(hash)},
    '@/i18n/schemaPermissionText':{permissionDisplayLabel:(_id,label)=>label},
    '@/components/ui/comboboxSearch':{filterComboboxOptions:options=>options},
    '@/i18n/schemaOptionLabels':optionLabels34,
    '@/components/forms/widgets/RemovablePill':{RemovablePill:()=>null},
  });
  const {VariantSelect}=component('src/components/forms/VariantSelect.tsx',{
    '@/components/ui/select':{
      Select:props=>{selected34=props;return h('div',null,props.children);},
      SelectContent:passthrough,SelectTrigger:passthrough,SelectValue:()=>null,
      SelectItem:props=>{options34.push(props);return h('span',null,props.children);},
    },
    '@/components/forms/FieldRow':{FieldLabel:props=>h('span',null,props.label)},
    '@/components/forms/formContext':{fieldIds:()=>({inputId:'residual-type',labelId:'residual-label'}),useFieldScope:()=>({path:[]}),useFormContext:()=>({idPrefix:'synthetic'}),useInPanel:()=>false},
    '@/components/forms/formLogic':{VARIANT_FIELD:'@type'},
  });
  const find34=(node,predicate)=>!React.isValidElement(node)?[]:[...(predicate(node)?[node]:[]),...React.Children.toArray(node.props.children).flatMap(child=>find34(child,predicate))];
  const packet34=JSON.parse(read('scripts/data/stage34-shared-residual-review.json'));
  const newSlots34=new Set(packet34.entries.map(e=>e.slot));
  const expected34=(slot,raw,localized)=>{
    const e=catalog.entries[slot];
    return localized&&e?.original===raw?e.ru:raw;
  };
  let enumCases34=0,enumLabels34=0,variantCases34=0,formCases34=0,columns34=0;
  for(const pin of manifest19.schemas){
    const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
    fixtureSchema19=schema;hash=pin.schemaHash;
    for(const enumName of ['ArchivedItemStatus','AzureEnvironment','EventPolicy','HeaderProtection','PublicKeyKind','SpecialUse','TracingLevel']){
      const variants=resolver19.getEnum(schema,enumName);
      if(enumName==='ArchivedItemStatus'&&pin.edition==='oss'){assert.equal(variants.length,0);continue;}
      assert.ok(variants.length>=2,enumName);
      const raw=JSON.stringify(variants);
      let event;
      const fieldName=enumName==='HeaderProtection'?'headerProtection':'synthetic';
      const props={type:{type:'enum',enumName,nullable:false},formField:{name:fieldName},value:variants[0].name,onChange:v=>{event=v;},readOnly:false,control:{}};
      const newVariants=variants.filter(v=>newSlots34.has('enum/'+enumName+'/'+v.name+'/label'));
      assert.ok(newVariants.length>0,enumName);
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;
        const localized=lang==='ru'&&activeHash===pin.schemaHash;
        const html=render(EnumWidget34,props);
        assert.deepEqual(Array.from(enumControl34.options,v=>v.value),Array.from(variants,v=>v.name));
        for(const [i,v] of variants.entries()){
          const slot='enum/'+enumName+'/'+v.name+'/label',label=expected34(slot,v.label,localized);
          if(newSlots34.has(slot))assert.equal(original(slot),v.label,slot);
          const controlLabel=localized&&fieldName==='headerProtection'?optionLabels34.headerProtectionOptionLabel(label):label;
          if(localized&&fieldName==='headerProtection'&&newSlots34.has(slot)){
            assert.equal(label,optionLabels34.headerProtectionOptionLabel(v.label),'Previously translated adapter label changed');
          }
          assert.equal(enumControl34.options[i].label,controlLabel,slot);
          assert.ok(html.includes(htmlText19(controlLabel)),slot);
          assert.ok(render(scalar20.EnumValue,{schema,enumName,value:v.name}).includes(htmlText19(label)),slot);
        }
        assert.equal(enumControl34.value,variants[0].name);
        enumControl34.onValueChange(variants[1].name);assert.equal(event,variants[1].name);
        assert.equal(props.value,variants[0].name);assert.equal(JSON.stringify(variants),raw);
      }
      enumCases34++;enumLabels34+=newVariants.length;
    }
    for(const variantScope of ['x:HttpAuth','x:SecretKey','x:SecretKeyOptional','x:SecretText','x:SecretTextOptional','x:TaskRetryStrategy']){
      const variants=schema.schemas[variantScope].variants,raw=JSON.stringify(variants);
      const expectedIds=packet34.entries.filter(e=>e.slot.startsWith('variant/'+variantScope+'/')).map(e=>e.slot.split('/')[2]).sort();
      assert.deepEqual(Array.from(variants,v=>v.name).sort(),expectedIds,variantScope);
      let event;
      const props={variantScope,variants,value:variants[0].name,onChange:v=>{event=v;},readOnly:false,ariaLabel:'Synthetic type'};
      const segmented=variants.length>1&&variants.length<=4&&variants.reduce((sum,v)=>sum+v.label.length,0)<=44;
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;selected34=undefined;options34=[];
        const localized=lang==='ru'&&activeHash===pin.schemaHash;
        const html=render(VariantSelect,props);
        const label=v=>expected34('variant/'+variantScope+'/'+v.name+'/label',v.label,localized);
        for(const v of variants){
          const slot='variant/'+variantScope+'/'+v.name+'/label';
          assert.equal(original(slot),v.label);
          assert.ok(html.includes(htmlText19(label(v))),slot);
          assert.ok(render(fieldValue20.VariantValue,{schema,objectName:variantScope,value:v.name}).includes(htmlText19(label(v))),slot);
        }
        if(segmented){
          assert.ok(html.includes('role="radiogroup"'));
          const controls=find34(VariantSelect(props),n=>typeof n.type==='function'&&n.type.name==='SegmentedVariants');
          assert.equal(controls.length,1);
          const control=controls[0];assert.equal(control.props.value,variants[0].name);
          assert.deepEqual(Array.from(control.props.variants,v=>v.name),Array.from(variants,v=>v.name));
          const radios=find34(control.type(control.props),n=>n.type==='button'&&n.props.role==='radio');
          assert.equal(radios.length,variants.length);
          for(const [i,v] of variants.entries()){
            assert.equal(radios[i].props.children,label(v));
            assert.equal(radios[i].props['aria-checked'],i===0);
          }
          radios[1].props.onClick();
        }else{
          assert.equal(selected34.value,variants[0].name);
          assert.deepEqual(Array.from(options34,v=>v.value),Array.from(variants,v=>v.name));
          selected34.onValueChange(variants[1].name);
        }
        assert.equal(event,variants[1].name);assert.equal(props.value,variants[0].name);assert.equal(JSON.stringify(variants),raw);
      }
      variantCases34++;
    }
    for(const [formKey,objectKey,name,value,changed] of [
      ['x:HttpAuthBasic','x:HttpAuthBasic','username','synthetic-user','edited-user'],
      ['x:HttpAuthBasic','x:HttpAuthBasic','secret','synthetic-secret','edited-secret'],
      ['x:HttpAuthBearer','x:HttpAuthBearer','bearerToken','synthetic-token','edited-token'],
      ['x:SecretKeyEnvironmentVariable','x:SecretKeyEnvironmentVariable','variableName','SYNTHETIC_KEY','EDITED_KEY'],
      ['x:SecretKeyFile','x:SecretKeyFile','filePath','/synthetic','/edited'],
      ['x:SecretKeyValue','x:SecretKeyValue','secret','synthetic-secret','edited-secret'],
      ['x:SecretTextValue','x:SecretTextValue','secret','synthetic-secret','edited-secret'],
      ['x:SenderAuth','x:SenderAuth','dkimStrict',false,true],
      ['x:SenderAuth','x:SenderAuth','spfEhloVerify','relaxed','strict'],
      ['x:SenderAuth','x:SenderAuth','reverseIpVerify','relaxed','strict'],
      ['x:Sharing','x:Sharing','allowDirectoryQueries',false,true],
      ['x:Sharing','x:Sharing','maxShares',5,10],
      ['x:TaskManager','x:TaskManager','alertAfter',5,10],
      ['x:TaskRetryStrategyBackoff','x:TaskRetryStrategyBackoff','factor',2,3],
      ['x:TaskRetryStrategyBackoff','x:TaskRetryStrategyBackoff','initialDelay','10s','20s'],
      ['x:TaskRetryStrategyBackoff','x:TaskRetryStrategyBackoff','jitter',false,true],
      ['x:TaskRetryStrategyBackoff','x:TaskRetryStrategyBackoff','maxDelay','1m','2m'],
      ['x:TaskRetryStrategyFixed','x:TaskRetryStrategyFixed','delay','10s','20s'],
      ['x:Encryption/EncryptionDiscovery','x:Encryption','discoveryProxy','https://example.invalid/proxy','https://example.invalid/other'],
      ['x:Encryption/EncryptionDiscovery','x:Encryption','keyRefreshInterval','7d','14d'],
      ['x:Encryption/EncryptionGateway','x:Encryption','gatewayEnable',false,true],
      ['x:Encryption/EncryptionGateway','x:Encryption','gatewayHeaderProtection','baseline','noConfidentiality'],
      ['x:Encryption/EncryptionStorage','x:Encryption','atRestEnable',false,true],
      ['x:Encryption/EncryptionTrust','x:Encryption','useBundledRoots',false,true],
      ['x:Encryption/EncryptionTrust','x:Encryption','maxCrlSize',1024,2048],
    ]){
      const form=schema.forms[formKey],field=schema.fields[objectKey]?.properties[name];
      assert.ok(form&&field,formKey+'/'+name);
      const section=form.sections.find(s=>s.fields.some(f=>f.name===name));assert.ok(section,formKey+'/'+name);
      const formField=section.fields.find(f=>f.name===name);
      const slot='form/'+formKey+'/field/'+name,desc='field/'+formKey+'/'+name+'/description';
      assert.ok(newSlots34.has(slot)||newSlots34.has(desc),slot);
      if(newSlots34.has(slot))assert.equal(formField.label,original(slot));
      if(newSlots34.has(desc))assert.equal(field.description,original(desc));
      const sectionKey='section-'+form.sections.indexOf(section),sectionSlot='form/'+formKey+'/section/'+sectionKey;
      const sections=[{key:sectionKey,title:section.title,fields:[{formField,field}]}];
      const data={[name]:value},snapshot=JSON.stringify({sections,data});let event;
      const props={sections,formKey,data,errors:{},readOnly:false,onFieldChange:(key,v)=>{event=[key,v];}};
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;
        const localized=lang==='ru'&&activeHash===pin.schemaHash;
        const html=render(FormSections,props);
        assert.ok(html.includes(htmlText19(expected34(slot,formField.label,localized))),slot);
        if(section.title)assert.ok(html.includes(htmlText19(expected34(sectionSlot,section.title,localized))),sectionSlot);
        if(field.description)assert.ok(html.includes(htmlText19(expected34(desc,field.description,localized))),desc);
        assert.equal(capturedField.formField.name,name);assert.equal(capturedField.value,value);
        capturedField.onChange(changed);assert.deepEqual(event,[name,changed]);
        assert.equal(JSON.stringify({sections,data}),snapshot);
      }
      formCases34++;
    }
    if(pin.edition==='oss'){assert.ok(!schema.lists['x:ArchivedItem']);}
    else for(const name of ['archivedAt','archivedUntil']){
      const listKey='x:ArchivedItem',column=schema.lists[listKey].columns.find(v=>v.name===name),slot='list/'+listKey+'/column/'+name;
      assert.equal(column.label,original(slot));let sorted;
      const raw=JSON.stringify(column),props={column,listKey,sortable:true,sort:null,onSort:v=>{sorted=v;}};
      for(const [lang,activeHash] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]]){
        language=lang;hash=activeHash;
        const label=expected34(slot,column.label,lang==='ru'&&activeHash===pin.schemaHash);
        assert.ok(render(ColumnHeader,props).includes(htmlText19(label)),slot);
        assert.ok(render(ColumnHeader,{...props,sortable:false}).includes(htmlText19(label)),slot);
        ColumnHeader(props).props.children.props.onClick();assert.equal(sorted,name);
        assert.equal(JSON.stringify(column),raw);
      }
      columns34++;
    }
  }
  assert.equal(enumCases34,13);assert.equal(enumLabels34,48);assert.equal(variantCases34,12);
  assert.equal(formCases34,50);assert.equal(columns34,2);
  console.log('PASS: Stage34 actual EnumWidget/EnumValue/VariantSelect/VariantValue/FormSections/FieldRow/ColumnHeader synthetic SSR; both pinned editions, prior headerProtection adapter wording, raw IDs and callbacks, unknown hash and raw split-form descriptions; no secret access, encryption, authentication, restoration, task execution or network');

  // Stage35: every explicitly reviewed residual slot, on each actual pinned edition.
  if(catalog.entries['enum/CompressionAlgo/none/label']){
    const packet35=JSON.parse(read('scripts/data/stage35-ambiguous-missing-review.json'));
    const instances=new Map(packet35.entries.map(e=>[e.slot,0]));
    const counts={enum:0,variant:0,form:0,field:0,list:0};
    let seenView;
    const {DynamicView}=component('src/components/views/DynamicView.tsx',{
      '@/components/ui/badge':{Badge:passthrough},
      '@/components/values/FieldValue':{ValueRow:props=>{seenView=props;return h('div',null,props.label,props.description,String(props.value));}},
      '@/lib/schemaResolver':resolver19,'@/lib/embeddedSchema':embedded19,
    });
    let views=0;
    for(const pin of manifest19.schemas){
      const schema=JSON.parse(gunzipSync(Buffer.from(read(pin.fixture).trim(),'base64')).toString('utf8'));
      fixtureSchema19=schema;
      const modes=[['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown'],['ru',pin.schemaHash]];
      for(const e of packet35.entries){
        const [kind,key,part,name]=e.slot.split('/');
        let present=false;
        const snapshot=JSON.stringify({entry:e});
        if(kind==='enum'){
          const vs=resolver19.getEnum(schema,key),v=vs.find(v=>v.name===part);
          if(!v)continue;
          present=true;assert.equal(v.label,e.original,e.slot);const raw=JSON.stringify(vs);
          const fieldName=key==='HeaderProtection'?'headerProtection':'synthetic';
          let changed;
          const props={type:{type:'enum',enumName:key,nullable:false},formField:{name:fieldName},value:v.name,onChange:x=>{changed=x;},readOnly:false,control:{}};
          for(const [lang,activeHash] of modes){
            language=lang;hash=activeHash;const local=lang==='ru'&&activeHash===pin.schemaHash;
            const expected=local?e.ru:e.original;
            const html=render(EnumWidget34,props);
            assert.equal(enumControl34.options.find(o=>o.value===v.name).label,expected,e.slot);
            assert.deepEqual(Array.from(enumControl34.options,o=>o.value),Array.from(vs,x=>x.name));
            assert.ok(html.includes(htmlText19(expected)),e.slot);
            assert.ok(render(scalar20.EnumValue,{schema,enumName:key,value:v.name}).includes(htmlText19(expected)),e.slot);
            if(local&&key==='HeaderProtection')assert.equal(optionLabels34.headerProtectionOptionLabel(e.original),e.ru);
            const next=vs.find(x=>x.name!==v.name).name;enumControl34.onValueChange(next);
            assert.equal(changed,next);assert.equal(props.value,v.name);assert.equal(JSON.stringify(vs),raw);
          }
        }else if(kind==='variant'){
          const vs=schema.schemas[key]?.variants,v=vs?.find(v=>v.name===part);
          if(!v)continue;
          present=true;assert.equal(v.label,e.original,e.slot);const raw=JSON.stringify(vs);let changed;
          const props={variantScope:key,variants:vs,value:v.name,onChange:x=>{changed=x;},readOnly:false,ariaLabel:'Synthetic type'};
          const segmented=vs.length>1&&vs.length<=4&&vs.reduce((n,x)=>n+x.label.length,0)<=44;
          for(const [lang,activeHash] of modes){
            language=lang;hash=activeHash;selected34=undefined;options34=[];const local=lang==='ru'&&activeHash===pin.schemaHash;
            const expected=local?e.ru:e.original,html=render(VariantSelect,props);
            assert.ok(html.includes(htmlText19(expected)),e.slot);
            assert.ok(render(fieldValue20.VariantValue,{schema,objectName:key,value:v.name}).includes(htmlText19(expected)),e.slot);
            if(segmented){
              const control=find34(VariantSelect(props),n=>typeof n.type==='function'&&n.type.name==='SegmentedVariants')[0];
              assert.ok(control,e.slot);
              const radios=find34(control.type(control.props),n=>n.type==='button'&&n.props.role==='radio');
              assert.deepEqual(Array.from(control.props.variants,x=>x.name),Array.from(vs,x=>x.name));
              assert.equal(radios[vs.indexOf(v)].props.children,expected);
              assert.equal(radios[vs.indexOf(v)].props['aria-checked'],true);
              const index=vs.findIndex(x=>x.name!==v.name);radios[index].props.onClick();assert.equal(changed,vs[index].name);
            }else{
              assert.equal(selected34.value,v.name);assert.deepEqual(Array.from(options34,x=>x.value),Array.from(vs,x=>x.name));
              assert.equal(options34.find(x=>x.value===v.name).children,expected);
              const next=vs.find(x=>x.name!==v.name).name;selected34.onValueChange(next);assert.equal(changed,next);
            }
            assert.equal(props.value,v.name);assert.equal(JSON.stringify(vs),raw);
          }
        }else if(kind==='form'||kind==='field'){
          const fieldName=kind==='form'?name:part,form=schema.forms[key],field=schema.fields[key]?.properties[fieldName];
          if(!form||!field)continue;
          const section=form.sections.find(s=>s.fields.some(f=>f.name===fieldName));assert.ok(section,e.slot);
          const ff=section.fields.find(f=>f.name===fieldName);
          present=true;assert.equal(kind==='form'?ff.label:field.description,e.original,e.slot);
          const sectionKey='section-'+form.sections.indexOf(section);
          const sections=[{key:sectionKey,title:section.title,fields:[{formField:ff,field}]}];
          const value=fieldName==='enable'||fieldName==='allowInvalidCerts'?false:'synthetic-value',edited=typeof value==='boolean'?true:'edited-value';
          const data={[fieldName]:value},raw=JSON.stringify({sections,data});let changed;
          const props={sections,formKey:key,data,errors:{},readOnly:false,onFieldChange:(n,v)=>{changed=[n,v];}};
          for(const [lang,activeHash] of modes){
            language=lang;hash=activeHash;
            const expected=lang==='ru'&&activeHash===pin.schemaHash?e.ru:e.original;
            const html=render(FormSections,props);assert.ok(html.includes(htmlText19(expected)),e.slot);
            assert.equal(capturedField.formField.name,fieldName);assert.equal(capturedField.value,value);
            if(field.update!=='serverSet'){capturedField.onChange(edited);assert.deepEqual(changed,[fieldName,edited]);}
            assert.equal(JSON.stringify({sections,data}),raw);
            if(key==='x:SpamTrainingSample'&&['from','subject'].includes(fieldName)){
              seenView=undefined;
              const view=render(DynamicView,{schema,objectName:key,viewName:key,data,visibleFields:new Set([fieldName])});
              assert.ok(view.includes(htmlText19(expected)),e.slot);
              assert.equal(seenView.label,expected);assert.equal(seenView.value,value);
              assert.equal(JSON.stringify({sections,data}),raw);
            }
          }
          if(key==='x:SpamTrainingSample'&&['from','subject'].includes(fieldName))views++;
        }else if(kind==='list'){
          const column=schema.lists[key]?.columns.find(c=>c.name===name);
          if(!column)continue;
          present=true;assert.equal(column.label,e.original,e.slot);let sorted;
          const raw=JSON.stringify(column),props={column,listKey:key,sortable:true,sort:null,onSort:x=>{sorted=x;}};
          for(const [lang,activeHash] of modes){
            language=lang;hash=activeHash;const expected=lang==='ru'&&activeHash===pin.schemaHash?e.ru:e.original;
            assert.ok(render(ColumnHeader,props).includes(htmlText19(expected)),e.slot);
            assert.ok(render(ColumnHeader,{...props,sortable:false}).includes(htmlText19(expected)),e.slot);
            ColumnHeader(props).props.children.props.onClick();assert.equal(sorted,name);
            assert.equal(JSON.stringify(column),raw);
          }
        }else assert.fail(e.slot);
        assert.ok(present,e.slot);instances.set(e.slot,instances.get(e.slot)+1);counts[kind]++;
        assert.equal(JSON.stringify({entry:e}),snapshot);
      }
    }
    assert.equal(instances.size,61);assert.equal([...instances.values()].filter(x=>x===2).length,52);
    assert.equal([...instances.values()].filter(x=>x===1).length,9);
    assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),113);assert.equal(views,4);
    console.log('PASS: Stage35 all 61 residual slots, 113 edition instances '+JSON.stringify(counts)+'; exact raw IDs and callbacks, HeaderProtection parity, SpamTrainingSample DynamicView 4 cases, unknown hash and EN fallback; no server or browser');
  }

}

// Stage37: exercise every historical mismatched description usage using actual
// pinned fields and resolved schema owner, not a synthetic view key equal to owner.
// Leaf widgets and ValueRow are mocked as in earlier SSR tests.
{
  const inputs37=loadInputs(process.cwd());
  const packet37=loadFieldDescriptionPacket(process.cwd(),inputs37.policy);
  const stage37Catalog=undoFormContext(undoVariants(undoTrace(catalog,loadTracePacket(process.cwd(),inputs37.policy)),loadVariantPacket(process.cwd(),inputs37.policy)),loadFormContextPacket(process.cwd(),inputs37.policy));
  const oldCatalog=undoFieldDescriptions(stage37Catalog,packet37);
  const oldInputs={...inputs37,catalog:oldCatalog,schema:sourceModule(read('src/i18n/schemaText.ts'),'schemaText.ts',{'./schema/ru.json':oldCatalog})};
  const oldRows=classify(oldInputs,buildUsageGraph(oldInputs)).rows.filter(r=>
    r.classification==='renderer-unwired'&&r.slot.startsWith('field/')&&r.slot.endsWith('/description'));
  assert.equal(oldRows.length,978);
  const pinMap=new Map(inputs37.pins.map(p=>[p.schemaHash,p.data]));
  let seen;
  const {DynamicView:DynamicView37}=component('src/components/views/DynamicView.tsx',{
    '@/components/ui/badge':{Badge:passthrough},
    '@/components/values/FieldValue':{ValueRow:props=>{seen=props;return h('div',null,props.label,props.description,String(props.value));}},
    '@/lib/schemaResolver':resolver19,'@/lib/embeddedSchema':embedded19,
  });
  const modes37={detail:0,singleton:0,edit:0,create:0};
  const screenSet37=new Set();
  const covered=new Set();
  let networkSettings=0;
  for(const row of oldRows){
    const [,owner,name]=row.slot.split('/');
    const expectedEntry=catalog.entries[row.slot];
    assert.equal(expectedEntry.original,row.original,row.slot);
    for(const u of row.usages.filter(u=>u.state==='slot-mismatch')){
      const schema=pinMap.get(u.schemaHash);
      const object=resolver19.resolveObject(schema,u.screen);
      assert.ok(object,u.screen);
      const sch=resolver19.resolveSchema(schema,object.objectName);
      assert.ok(sch,u.screen);
      const variantName=u.conditions.find(x=>x.startsWith('variant:'))?.slice(8);
      const resolved=sch.type==='single'?sch:sch.variants.find(v=>v.name===variantName);
      assert.equal(resolved?.schemaName,owner,row.slot+' '+u.screen+' '+u.mode);
      const field=resolved.fields.properties[name];
      assert.equal(field.description,row.original,row.slot);
      const data={...(variantName?{'@type':variantName}:{}),[name]:'synthetic-value'};
      const before=JSON.stringify({field,data});
      const modes=[['ru',u.schemaHash],['en',u.schemaHash],['ru','unknown'],['ru',u.schemaHash]];
      if(u.mode==='detail'){
        for(const [lang,activeHash] of modes){
          language=lang;hash=activeHash;seen=undefined;
          const expected=lang==='ru'&&activeHash===u.schemaHash?expectedEntry.ru:row.original;
          const html=render(DynamicView37,{schema,objectName:object.objectName,viewName:u.screen,data,visibleFields:new Set([name])});
          assert.ok(seen,row.slot+' detail not rendered on '+u.screen);
          assert.equal(seen.description,expected,row.slot);
          assert.equal(seen.value,data[name],row.slot);
          assert.equal(seen.type,field.type,row.slot);
          assert.ok(html.includes(htmlText19(expected)),row.slot);
        }
      }else{
        const formKey=u.via.slice(0,-name.length-1);
        const form=schema.forms[formKey];
        assert.ok(form,row.slot+' missing form '+formKey);
        const section=form.sections.find(s=>s.fields.some(f=>f.name===name));
        assert.ok(section,row.slot);
        const ff=section.fields.find(f=>f.name===name);
        const sections=[{key:'section-'+form.sections.indexOf(section),title:section.title,fields:[{formField:ff,field}]}];
        let event;
        const props={sections,formKey,fieldOwner:resolved.schemaName,data,errors:{},readOnly:false,onFieldChange:(key,value)=>{event=[key,value];}};
        for(const [lang,activeHash] of modes){
          language=lang;hash=activeHash;
          const expected=lang==='ru'&&activeHash===u.schemaHash?expectedEntry.ru:row.original;
          const html=render(FormSections,props);
          assert.ok(html.includes(htmlText19(expected)),row.slot+' '+u.screen);
          assert.equal(capturedField.formField.name,name,row.slot);
          assert.equal(capturedField.field,field,row.slot);
          assert.equal(capturedField.value,data[name],row.slot);
          if(field.update!=='serverSet'){
            capturedField.onChange('edited-value');
            assert.deepEqual(event,[name,'edited-value']);
          }
        }
      }
      assert.equal(JSON.stringify({field,data}),before,row.slot);
      modes37[u.mode]++;
      covered.add(row.slot);
      screenSet37.add(u.section+'\0'+u.screen);
      if(u.screen==='x:SystemSettings/NetworkSettings')networkSettings++;
    }
  }
  assert.deepEqual(modes37,{detail:2103,singleton:185,edit:34,create:14});
  assert.equal(screenSet37.size,38);
  assert.equal(covered.size,978);
  assert.equal(networkSettings,14);
  console.log('PASS: Stage37 actual DynamicView/FormSections/FieldRow; '+JSON.stringify(modes37)+'; 978 descriptions, 38 affected screens, NetworkSettings 14 edition usages, RU/EN/RU and unknown hash, unchanged raw fields and callbacks; no browser or network');
}

// Stage38: actual merged form layout and title hook, pinned schemas, all
// historical form-caption mismatches. Assert lookup identity, not only text
// presence (several sections and fields can have the same English label).
{
  const inputs38=loadInputs(process.cwd());
  const oldCatalog=undoFormContext(undoVariants(undoTrace(catalog,loadTracePacket(process.cwd(),inputs38.policy)),loadVariantPacket(process.cwd(),inputs38.policy)),loadFormContextPacket(process.cwd(),inputs38.policy));
  const oldInputs={...inputs38,catalog:oldCatalog,schema:sourceModule(read('src/i18n/schemaText.ts'),'schemaText.ts',{'./schema/ru.json':oldCatalog})};
  const rows38=classify(oldInputs,buildUsageGraph({...oldInputs,fieldOwners:true})).rows.filter(r=>
    r.classification==='renderer-unwired'&&['form-field-label','form-section','form'].includes(r.category));
  assert.equal(rows38.length,1251);
  const pins=new Map(inputs38.pins.map(p=>[p.schemaHash,p.data]));
  let calls=[],seen=[];
  const trackedDisplay=()=> (slot,original)=> {
    calls.push([slot,original]);return schemaText(hash,language,slot,original);
  };
  const {DynamicView:DynamicView38}=component('src/components/views/DynamicView.tsx',{
    '@/components/ui/badge':{Badge:passthrough},
    '@/components/values/FieldValue':{ValueRow:props=>{seen.push(props);return h('div',null,props.label,props.description,String(props.value));}},
    '@/hooks/useSchemaText':{useSchemaText:trackedDisplay},
    '@/lib/schemaResolver':resolver19,'@/lib/embeddedSchema':embedded19,
  });
  // Execute the actual title hook from DynamicForm, isolated from editor,
  // network, router and store hooks. No duplicate implementation in test.
  const titleSource=ts.createSourceFile('DynamicForm.tsx',read('src/components/forms/DynamicForm.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const titleNode=titleSource.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='useFormTitle');
  assert.ok(titleNode);
  const {useFormTitle:title38}=sourceModule("import {useTranslation,useSchemaText,coerceLabel} from 'mock';\nexport "+titleNode.getText(titleSource),'title38.ts',{
    mock:{useTranslation:()=>({t:(_key,fallback)=>fallback}),useSchemaText:trackedDisplay,coerceLabel:()=>''}
  });
  const count={field:0,section:0,title:0},screens=new Set(),covered=new Set();
  const unrenderable=[];
  for(const row of rows38){
    const entry=catalog.entries[row.slot];assert.equal(entry.original,row.original,row.slot);
    for(const u of row.usages.filter(u=>u.state==='slot-mismatch')){
      const schema=pins.get(u.schemaHash),object=resolver19.resolveObject(schema,u.screen);
      assert.ok(object,u.screen);
      const sch=resolver19.resolveSchema(schema,object.objectName);
      const variantName=u.conditions.find(x=>x.startsWith('variant:'))?.slice(8);
      const resolved=sch.type==='single'?sch:sch.variants.find(v=>v.name===variantName);
      const pointer=u.sourcePointer.split('/').slice(1).map(x=>x.replace(/~1/g,'/').replace(/~0/g,'~'));
      const formKey=pointer[1],form=schema.forms[formKey];
      assert.equal(pointer[0],'forms');
      assert.equal(at(schema,u.sourcePointer),row.original,row.slot);
      const kind=row.category==='form'?'title':row.category==='form-section'?'section':'field';
      const section=kind==='title'?null:form.sections[Number(pointer[3])];
      const fieldName=kind==='field'?section.fields[Number(pointer[5])].name:
        kind==='section'?section.fields.find(f=>f.name!=='@type'&&resolved?.fields?.properties[f.name])?.name:undefined;
      const field=fieldName?resolved?.fields?.properties[fieldName]:undefined;
      if(kind!=='title'&&!field){
        // A section with no visible data field cannot render on a read-only
        // card. Record that boundary rather than fabricate a visible field.
        assert.equal(kind,'section',row.slot);
        unrenderable.push({slot:row.slot,screen:u.screen,hash:u.schemaHash});
        continue;
      }
      const data={...(variantName?{'@type':variantName}:{}),...(fieldName?{[fieldName]:'synthetic-value'}:{})};
      const before=JSON.stringify({form,data,field});
      for(const [lang,activeHash] of [['ru',u.schemaHash],['en',u.schemaHash],['ru','unknown'],['ru',u.schemaHash]]){
        language=lang;hash=activeHash;calls=[];seen=[];
        const expected=lang==='ru'&&activeHash===u.schemaHash?entry.ru:row.original;
        if(kind==='title'){
          assert.equal(sch.type,'single',row.slot);
          const selected=resolver19.resolveForm(schema,u.screen,object.objectName,sch.schemaName);
          assert.equal(selected,form,row.slot);
          assert.equal(title38({schema,resolved:{object},mode:'edit',isSingleton:true,state:{data},parentForm:null,variantForm:selected}),expected,row.slot);
        }else{
          const html=render(DynamicView38,{schema,objectName:object.objectName,viewName:u.screen,data,visibleFields:new Set([fieldName])});
          assert.ok(html.includes(htmlText19(expected)),row.slot+' '+u.screen);
          if(kind==='field')assert.ok(seen.some(p=>p.label===expected&&p.type===field.type&&p.value===data[fieldName]),row.slot);
        }
        assert.ok(calls.some(([slot,original])=>slot===row.slot&&original===row.original),row.slot+' wrong lookup');
        assert.equal(JSON.stringify({form,data,field}),before,row.slot);
      }
      count[kind]++;screens.add(u.section+'\0'+u.screen);covered.add(row.slot);
    }
  }
  assert.equal(count.field,2241);
  assert.equal(count.title,36);
  assert.equal(count.section+unrenderable.length,861);
  assert.equal(screens.size,33);
  assert.equal(covered.size,1251);
  console.log('PASS: Stage38 actual DynamicView/title hook '+JSON.stringify(count)+'; '+covered.size+' source pairs, '+screens.size+' screens; invisible section usages='+JSON.stringify(unrenderable)+'; RU/EN/unknown hash, exact form slot and raw data preserved; no browser/network');
}

// Stage39: execute the actual detail badge for every historical raw usage,
// plus the real selector, list-cell and nested display paths on pinned data.
// All mutations are synthetic callbacks; no server, browser or external IO.
{
  const inputs39=loadInputs(process.cwd());
  const packet39=loadVariantPacket(process.cwd(),inputs39.policy);
  const previous39=undoVariants(undoTrace(catalog,loadTracePacket(process.cwd(),inputs39.policy)),packet39);
  const old39={...inputs39,catalog:previous39,schema:sourceModule(read('src/i18n/schemaText.ts'),'schemaText.ts',{'./schema/ru.json':previous39})};
  const scope39=classify(old39,buildUsageGraph({...old39,fieldOwners:true,formOwners:true})).rows.filter(r=>r.classification==='renderer-unwired');
  assert.equal(scope39.length,135);
  const pins39=new Map(inputs39.pins.map(p=>[p.schemaHash,p.data]));
  let calls39=[],select39,options39=[],fixtureSchema39;
  const tracked39=()=> (slot,original)=>{calls39.push([slot,original]);return schemaText(hash,language,slot,original);};
  const {DynamicView:DynamicView39}=component('src/components/views/DynamicView.tsx',{
    '@/components/ui/badge':{Badge:badge20},
    '@/components/values/FieldValue':{ValueRow:()=>null},
    '@/hooks/useSchemaText':{useSchemaText:tracked39},
    '@/lib/schemaResolver':resolver19,'@/lib/embeddedSchema':embedded19,
  });
  const {VariantSelect:VariantSelect39}=component('src/components/forms/VariantSelect.tsx',{
    '@/components/ui/select':{
      Select:props=>{select39=props;return h('div',null,props.children);},
      SelectContent:passthrough,SelectTrigger:passthrough,SelectValue:()=>null,
      SelectItem:props=>{options39.push(props);return h('span',null,props.children);},
    },
    '@/hooks/useSchemaText':{useSchemaText:tracked39},
    '@/components/forms/FieldRow':{FieldLabel:props=>h('span',null,props.label)},
    '@/components/forms/formContext':{fieldIds:()=>({inputId:'variant39',labelId:'label39'}),useFieldScope:()=>({path:[]}),useFormContext:()=>({idPrefix:'synthetic'}),useInPanel:()=>false},
    '@/components/forms/formLogic':{VARIANT_FIELD:'@type'},
  });
  const {FormSections:FormSections39}=component('src/components/forms/FormSections.tsx',{
    '@/i18n/schemaFormContext':{sectionDisplayContext},
    '@/components/forms/FieldRow':{FieldRow:()=>null},
    '@/components/forms/VariantSelect':{VariantSelect:VariantSelect39},
  });
  const {EmbeddedObjectEditor:EmbeddedObjectEditor39}=component('src/components/forms/widgets/EmbeddedObjectWidget.tsx',{
    '@/components/forms/FieldRow':{FieldRow:()=>null},
    '@/components/forms/VariantSelect':{VariantSelect:VariantSelect39},
    '@/components/forms/formContext':{
      EnclosingSchemaContext:passthrough,PanelContext:passthrough,
      useFormContext:()=>({schema:fixtureSchema39,mode:'edit',baseline:null}),
      useInPanel:()=>true,
    },
    '@/lib/schemaResolver':resolver19,'@/lib/embeddedSchema':embedded19,
  });
  function find39(node,predicate){
    if(!React.isValidElement(node))return [];
    return [...(predicate(node)?[node]:[]),...React.Children.toArray(node.props.children).flatMap(child=>find39(child,predicate))];
  }
  const modes39=pinHash=>[['ru',pinHash],['en',pinHash],['ru','unknown'],['ru',pinHash]];
  const clear39=()=>{select39=undefined;options39=[];calls39=[];};
  const count39={detail:0,list:0,selector:0,form:0,embedded:0,changedOriginal:0};
  const screens39=new Set();
  const covered39=new Set();
  for(const row of scope39){
    const [,objectName,id]=row.slot.split('/');
    const entry=catalog.entries[row.slot];
    assert.equal(entry.original,row.original,row.slot);
    for(const loc of row.locations){
      const schema=pins39.get(loc.schemaHash),sch=schema.schemas[objectName],variants=sch.variants;
      const rawVariant=variants.find(v=>v.name===id);
      assert.ok(rawVariant,row.slot);assert.equal(rawVariant.label,row.original,row.slot);
      assert.equal(at(schema,loc.sourcePointer),row.original,row.slot);
      fixtureSchema39=schema;
      const data={'@type':id},populated={...data,syntheticMarker:'synthetic-value'};
      const snapshot=JSON.stringify({variants,data,populated});
      const segmented=variants.length>1&&variants.length<=4&&variants.reduce((n,v)=>n+v.label.length,0)<=44;
      const next=variants.find(v=>v.name!==id)?.name;
      let changed;
      const props={variantScope:objectName,variants,value:id,onChange:v=>{changed=v;},readOnly:false,ariaLabel:'Synthetic type'};
      for(const [lang,activeHash] of modes39(loc.schemaHash)){
        language=lang;hash=activeHash;clear39();
        const expected=lang==='ru'&&activeHash===loc.schemaHash?entry.ru:row.original;
        const html=render(VariantSelect39,props);
        assert.ok(html.includes(htmlText19(expected)),row.slot);
        assert.ok(calls39.some(([slot,o])=>slot===row.slot&&o===row.original),row.slot+' selector lookup');
        if(segmented){
          assert.ok(html.includes('role="radiogroup"'));
          const control=find39(VariantSelect39(props),n=>typeof n.type==='function'&&n.type.name==='SegmentedVariants')[0];
          assert.ok(control,row.slot);
          assert.equal(control.props.value,id);
          assert.deepEqual(Array.from(control.props.variants,v=>v.name),Array.from(variants,v=>v.name));
          const radios=find39(control.type(control.props),n=>n.type==='button'&&n.props.role==='radio');
          const i=variants.findIndex(v=>v.name===id);
          assert.equal(radios[i].props.children,expected);assert.equal(radios[i].props['aria-checked'],true);
          if(next){radios[variants.findIndex(v=>v.name===next)].props.onClick();assert.equal(changed,next);}
        }else{
          assert.ok(select39,row.slot);assert.equal(select39.value,id);
          assert.deepEqual(Array.from(options39,v=>v.value),Array.from(variants,v=>v.name));
          assert.equal(options39.find(v=>v.value===id).children,expected);
          if(next){select39.onValueChange(next);assert.equal(changed,next);}
        }
        assert.equal(props.value,id);
        assert.ok(render(fieldValue20.VariantValue,{schema,objectName,value:id}).includes(htmlText19(expected)),row.slot);
        assert.ok(render(fieldValue20.ObjectValue,{schema,objectName,value:data}).includes(htmlText19(expected)),row.slot+' empty nested');
        assert.ok(render(fieldValue20.ObjectValue,{schema,objectName,value:populated,defaultOpen:true}).includes(htmlText19(expected)),row.slot+' populated nested');
        assert.ok(render(fieldValue20.EmbeddedSummaryValue,{schema,objectName,value:populated}).includes(htmlText19(expected)),row.slot+' compact nested');
        // The real FormSections variant adapter receives canonical objectName,
        // with a synthetic type row just as the dynamic form renderer does.
        clear39();
        const section={key:'section-0',fields:[{formField:{name:'@type',label:'Type'},field:null}]};
        const variant={variants,value:id,onChange:v=>{changed=v;}};
        assert.ok(render(FormSections39,{sections:[section],formKey:objectName,data,errors:{},readOnly:false,onFieldChange:()=>{},variant}).includes(htmlText19(expected)),row.slot+' form adapter');
        assert.ok(calls39.some(([slot,o])=>slot===row.slot&&o===row.original),row.slot+' form lookup');
        clear39();
        const embedded=render(EmbeddedObjectEditor39,{objectName,value:data,onChange:()=>{},readOnly:false,control:{'aria-label':'Synthetic type'}});
        assert.ok(embedded.includes(htmlText19(expected)),row.slot+' embedded editor');
        assert.ok(calls39.some(([slot,o])=>slot===row.slot&&o===row.original),row.slot+' embedded lookup');
        assert.equal(JSON.stringify({variants,data,populated}),snapshot,row.slot);
      }
      count39.selector++;count39.form++;count39.embedded++;
      // Same raw ID with a changed server-supplied original must stay English.
      const altered=row.original+' changed';
      const changedSchema={...schema,schemas:{...schema.schemas,[objectName]:{...sch,variants:variants.map(v=>v.name===id?{...v,label:altered}:v)}}};
      language='ru';hash=loc.schemaHash;clear39();
      assert.ok(render(DynamicView39,{schema:changedSchema,objectName,viewName:objectName,data}).includes(htmlText19(altered)),row.slot+' changed detail fallback');
      assert.ok(calls39.some(([slot,o])=>slot===row.slot&&o===altered),row.slot+' changed detail lookup');
      assert.ok(render(ListCell,{schema:changedSchema,objectName,column:'@type',field:undefined,value:id}).includes(htmlText19(altered)),row.slot+' changed list fallback');
      assert.ok(render(VariantSelect39,{...props,variants:changedSchema.schemas[objectName].variants}).includes(htmlText19(altered)),row.slot+' changed selector fallback');
      count39.changedOriginal++;
    }
    for(const u of row.usages){
      if(!['detail','list-cell'].includes(u.mode))continue;
      const schema=pins39.get(u.schemaHash),data={'@type':id};
      const object=resolver19.resolveObject(schema,u.screen);
      assert.ok(object,u.screen);assert.equal(object.objectName,objectName,row.slot+' '+u.screen);
      for(const [lang,activeHash] of modes39(u.schemaHash)){
        language=lang;hash=activeHash;clear39();
        const expected=lang==='ru'&&activeHash===u.schemaHash?entry.ru:row.original;
        if(u.mode==='detail'){
          assert.equal(u.state,'unwired');
          const html=render(DynamicView39,{schema,objectName,viewName:u.screen,data});
          assert.ok(html.includes(htmlText19(expected)),row.slot+' '+u.screen);
          assert.ok(calls39.some(([slot,o])=>slot===row.slot&&o===row.original),row.slot+' detail lookup');
        }else{
          assert.ok(render(ListCell,{schema,objectName,column:'@type',field:undefined,value:id}).includes(htmlText19(expected)),row.slot+' '+u.screen+' list cell');
        }
        assert.equal(data['@type'],id);
      }
      if(u.mode==='detail'){count39.detail++;screens39.add(u.section+'\0'+u.screen);}
      else count39.list++;
    }
    covered39.add(row.slot);
  }
  assert.deepEqual(count39,{detail:296,list:281,selector:258,form:258,embedded:258,changedOriginal:258});
  assert.equal(screens39.size,14);assert.equal(covered39.size,135);
  console.log('PASS: Stage39 actual DynamicView, VariantSelect, FormSections, ListCell, ObjectValue, EmbeddedSummaryValue, EmbeddedObjectEditor; '+JSON.stringify(count39)+'; 135 exact pairs, 14 affected screens; RU/EN/unknown hash, changed-original fallback, raw IDs, callbacks and schema unchanged; no browser/network');
}

await import('./lib/locale-trace-components.mjs');
