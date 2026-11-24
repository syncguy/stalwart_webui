#!/usr/bin/env node
// Synthetic React SSR + callback contracts. Real display components; leaf widgets,
// router/store/permission hooks and chart library mocked. No DOM/browser/JMAP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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
const {FieldRow} = component('src/components/forms/FieldRow.tsx',{
  '@/components/ui/label':{Label:({children,...props})=>h('label',props,children)},
  '@/components/common/Markdown':{Markdown:({source})=>h('span',null,source)},
  '@/components/common/HelpTooltip':{HelpTooltip:()=>null},
  '@/components/values/FieldValue':{FieldValue:()=>null},
  '@/components/forms/FormProvider':{FieldScopeProvider:passthrough},
  '@/components/forms/widgets/FieldControl':{FieldControl:props=>{
    capturedField=props;
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
