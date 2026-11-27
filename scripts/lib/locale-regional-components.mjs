// Stage42: run actual React renderers with synthetic schemas, mocked leaf controls,
// both pinned editions, no browser, server, or network. Static display only.
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
const protectedBefore=read('src/i18n/schema/ru.json');
const catalog=JSON.parse(protectedBefore);
const pins=JSON.parse(read('scripts/data/pinned-schema-manifest.json')).schemas.map(p=>({...p,data:JSON.parse(gunzipSync(Buffer.from(read(p.fixture),'base64')))}));
const h=React.createElement,pass=({children})=>h(React.Fragment,null,children),dummy=()=>null;
const render=(C,props)=>renderToStaticMarkup(h(C,props));
const escaped=s=>renderToStaticMarkup(h(React.Fragment,null,s));
const exact=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
function mod(p,imports={},globals={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(read(p),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
    {exports,URL,Date,Intl,require:n=>{assert.ok(Object.hasOwn(imports,n),p+': '+n);return imports[n]},...globals},{filename:p,timeout:5000});
  return exports;
}
let language='ru',hash,schema,captured,missingIntl=false,localButton,selectedItem,pill,checks=0;
const t=(key,fallback,args={})=>Object.entries(args).reduce((s,[k,v])=>s.replaceAll('{{'+k+'}}',String(v)),fallback??key);
const store={useSchemaStore:fn=>fn({schema,schemaHash:hash})};
const text=mod('src/i18n/schemaText.ts',{'./schema/ru.json':catalog});
const resolver=mod('src/lib/schemaResolver.ts');
const common={react:React,'react/jsx-runtime':jsx,'react-i18next':{useTranslation:()=>({t,i18n:{resolvedLanguage:language,language}})},'@/stores/schemaStore':store,'@/lib/schemaResolver':resolver,
  'lucide-react':new Proxy({},{get:()=>dummy}),'@/lib/utils':{cn:(...v)=>v.filter(Boolean).join(' ')}};
const hooks=mod('src/hooks/useSchemaText.ts',{...common,'@/i18n/webuiRuSchemaText':text});
common['@/hooks/useSchemaText']=hooks;
const fmtImports={'@/i18n':{default:{t,language:'ru'}},'@/lib/durationFormat':{SIZE_UNITS:[]},'@/lib/localDateTime':{},'@/lib/weeklySchedule':{WEEKDAYS:[]},'@/stores/accountStore':{DEFAULT_LOCALE:'en-US',useAccountStore:{getState:()=>({})}}};
const offsets=mod('src/lib/format.ts',fmtImports);
const noIntlOffsets=mod('src/lib/format.ts',fmtImports,{Intl:undefined});
const search=mod('src/components/ui/comboboxSearch.ts');
const formatUtcOffset=(...a)=>(missingIntl?noIntlOffsets:offsets).formatUtcOffset(...a);
const tzImports={...common,'@/lib/format':{formatUtcOffset},'@/components/ui/button':{Button:p=>{if(p.onClick)localButton=p.onClick;return pass(p)}},
  '@/components/ui/combobox':{Combobox:p=>{captured=p;return h('span',null,p.options.find(o=>o.value===p.value)?.label??p.value)}},
  '@/components/forms/formContext':{useFormContext:()=>({schema})}};
const zone=mod('src/components/forms/widgets/TimeZoneWidget.tsx',tzImports,{Intl:undefined});
const zoneValue=mod('src/components/values/TimeZoneValue.tsx',tzImports,{Intl:undefined});
const enumImports={...tzImports,'@/hooks/usePermissions':{usePermissionCheckers:()=>({hasPermission:()=>true})},'@/components/ui/checkbox':{Checkbox:dummy},'@/components/ui/input':{Input:dummy},'@/components/ui/label':{Label:pass},'@/components/ui/popover':{Popover:pass,PopoverContent:pass,PopoverTrigger:pass},'@/components/common/HelpTooltip':{HelpTooltip:dummy},'@/i18n/schemaPermissionText':{permissionDisplayLabel:(_id,x)=>x},'@/components/ui/comboboxSearch':search,'@/i18n/schemaOptionLabels':{headerProtectionOptionLabel:x=>x},'@/components/forms/widgets/RemovablePill':{RemovablePill:p=>{pill=p;return pass(p)}}};
const enums=mod('src/components/forms/widgets/EnumWidgets.tsx',enumImports,{Intl:undefined});
const scalars=mod('src/components/values/ScalarValues.tsx',{...common,'@/components/ui/badge':{Badge:pass},'@/data/objectOptions':{useDisplayName:()=>({})},'@/lib/format':{formatDuration:String,formatNumber:String,formatSize:String},'@/lib/jmapUtils':{SECRET_MASK:'MASK'},'@/lib/embeddedSchema':{isMultilineFormat:()=>false}},{Intl:undefined});
const combo=mod('src/components/ui/combobox.tsx',{...common,'@/components/ui/comboboxSearch':search,'@/components/ui/button':{Button:pass},'@/components/ui/command':{Command:pass,CommandEmpty:pass,CommandGroup:pass,CommandInput:dummy,CommandItem:p=>{if(p.value==='Asia/Calcutta')selectedItem=p.onSelect;return pass(p)},CommandList:pass},'@/components/ui/popover':{Popover:pass,PopoverContent:pass,PopoverTrigger:pass}});
const type=(enumName)=>({type:'enum',enumName,nullable:true});
const props=(enumName,value,onChange=()=>{})=>({type:type(enumName),formField:{name:enumName==='Locale'?'locale':'timeZone'},value,onChange,readOnly:false,control:{}});
const wanted=(kind,entry)=>text.schemaText(hash,language,'enum/'+kind+'/'+entry.name+'/label',entry.label);
function check(name,fn){fn();checks++;console.log('PASS '+name);}
check('Both pinned editions: all 598 TimeZone and 322 Locale exact labels, schema order, RU/EN/RU and unknown hash',()=>{
  for(const pin of pins){
    schema=pin.data;
    const before=JSON.stringify(schema);
    assert.equal(schema.enums.TimeZone.length,598);assert.equal(schema.enums.Locale.length,322);
    for(language of ['ru','en','ru'])for(hash of [pin.schemaHash,'unknown']){
      missingIntl=true;
      for(const kind of ['TimeZone','Locale']){
        const variants=schema.enums[kind],C=kind==='TimeZone'?zone.TimeZoneWidget:enums.EnumWidget;
        render(C,props(kind,variants[0].name));
        assert.equal(captured.value,variants[0].name);
        exact(captured.options.map(o=>o.value),variants.map(v=>v.name));
        for(let i=0;i<variants.length;i++){
          const v=variants[i],o=captured.options[i],w=wanted(kind,v);
          assert.equal(o.label,w,v.name);
          if(language==='ru'&&hash===pin.schemaHash)assert.equal(o.label,catalog.entries['enum/'+kind+'/'+v.name+'/label'].ru);
          else assert.equal(o.label,v.label);
          const html=kind==='TimeZone'?render(zoneValue.TimeZoneValue,{schema,type:type(kind),value:v.name,variant:'compact'}):render(scalars.EnumValue,{schema,enumName:kind,value:v.name});
          assert.ok(html.includes(escaped(w)),v.name);
          if(kind==='Locale')assert.ok(render(scalars.ScalarLabel,{schema,type:type(kind),value:v.name}).includes(escaped(w)),v.name);
          if(language==='ru'&&hash===pin.schemaHash){
            for(const q of [v.name,v.label,w])assert.equal(search.filterComboboxOptions([o],q).length,1,v.name+' '+q);
          }
        }
        assert.equal(new Set(captured.options.map(o=>o.label)).size,language==='ru'&&hash===pin.schemaHash?variants.length:new Set(variants.map(v=>v.label)).size);
        exact(search.filterComboboxOptions(captured.options,'').map(o=>o.value),variants.map(v=>v.name));
      }
    }
    assert.equal(JSON.stringify(schema),before);
  }
});
check('Raw IANA/BCP47 callbacks, nullable value and alias identity',()=>{
  schema=pins[0].data;hash=pins[0].schemaHash;language='ru';missingIntl=true;
  for(const value of ['Asia/Calcutta','Asia/Kolkata','Europe/Kiev','Europe/Kyiv','US/Eastern','America/New_York','UTC','Etc/UTC']){
    let v;render(zone.TimeZoneWidget,props('TimeZone',value,x=>v=x));assert.equal(captured.value,value);captured.onValueChange(value);assert.equal(v,value);captured.onValueChange('');assert.equal(v,null);
  }
  for(const value of ['ru-RU','en-US','az-AZ','az-Latn-AZ','zh-Hant-HK','ca-ES-valencia','uz-Latn-UZ']){
    let v;render(enums.EnumWidget,props('Locale',value,x=>v=x));assert.equal(captured.value,value);captured.onValueChange(value);assert.equal(v,value);captured.onValueChange('');assert.equal(v,null);
  }
  render(zone.TimeZoneWidget,props('TimeZone','UTC'));
  assert.equal(captured.options.find(o=>o.value==='Asia/Calcutta').label,'Калькутта (Asia/Calcutta)');
  assert.equal(captured.options.find(o=>o.value==='Asia/Kolkata').label,'Калькутта (Asia/Kolkata)');
  assert.ok(search.filterComboboxOptions(captured.options,'Томск').some(o=>o.value==='Asia/Tomsk'));
  render(enums.EnumWidget,props('Locale','ru-RU'));
  assert.ok(search.filterComboboxOptions(captured.options,'русский россия').some(o=>o.value==='ru-RU'));
  assert.ok(search.filterComboboxOptions(captured.options,'Russian').some(o=>o.value==='ru-RU'));
  assert.ok(search.filterComboboxOptions(captured.options,'ru-RU').some(o=>o.value==='ru-RU'));
});
check('Changed originals, unknown IDs and unknown hash fall back to exact source in editor and readonly',()=>{
  for(const kind of ['TimeZone','Locale']){
    hash=pins[0].schemaHash;language='ru';schema=JSON.parse(JSON.stringify(pins[0].data));missingIntl=true;
    const entry=schema.enums[kind][0];entry.label='CHANGED ORIGINAL '+kind;
    const C=kind==='TimeZone'?zone.TimeZoneWidget:enums.EnumWidget;
    render(C,props(kind,entry.name));
    assert.equal(captured.options.find(o=>o.value===entry.name).label,entry.label);
    const readOnly=(value)=>kind==='TimeZone'?render(zoneValue.TimeZoneValue,{schema,type:type(kind),value,variant:'full'}):render(scalars.EnumValue,{schema,enumName:kind,value});
    assert.ok(readOnly(entry.name).includes(entry.label));assert.ok(readOnly('unknown-raw-ID').includes('unknown-raw-ID'));
    assert.equal(text.schemaText(hash,'ru','enum/'+kind+'/unknown/label','Unknown source'),'Unknown source');
    hash='unknown';render(C,props(kind,entry.name));
    assert.ok(captured.options.every((o,i)=>o.label===schema.enums[kind][i].label));
  }
});
check('Actual Locale multi-select: exact label and raw removal payload, no schema or array mutation',()=>{
  schema=pins[0].data;hash=pins[0].schemaHash;missingIntl=true;
  const items=['en-US','ru-RU'],before=JSON.stringify(items),src=JSON.stringify(schema);let result;
  for(language of ['ru','en','ru']){
    const html=render(enums.EnumMultiSelect,{enumName:'Locale',items,onChange:v=>result=v,readOnly:false,control:{}});
    for(const id of items){const entry=schema.enums.Locale.find(v=>v.name===id);assert.ok(html.includes(escaped(wanted('Locale',entry))))}
    assert.equal(pill.label,wanted('Locale',schema.enums.Locale.find(v=>v.name==='ru-RU')));
    pill.onRemove();exact(result,['en-US']);assert.equal(JSON.stringify(items),before);
  }
  render(enums.EnumMultiSelect,{enumName:'Locale',items:['unknown-raw-ID'],onChange(){},readOnly:true,control:{}});
  assert.equal(pill.label,'unknown-raw-ID');assert.equal(pill.onRemove,undefined);
  assert.equal(JSON.stringify(schema),src);
});
check('Actual Combobox: unknown ID, empty placeholder, selected label and raw selection callback',()=>{
  const options=[{value:'Asia/Calcutta',label:'Калькутта (Asia/Calcutta)'},{value:'Asia/Kolkata',label:'Калькутта (Asia/Kolkata)'}],before=JSON.stringify(options);
  let count=0,value;const p={options,placeholder:'SELECT_EMPTY',onValueChange:v=>{value=v;count++}};
  const unknown=render(combo.Combobox,{...p,value:'Unknown/Zone'});assert.ok(unknown.includes('Unknown/Zone')&&!unknown.includes('SELECT_EMPTY'));
  assert.ok(render(combo.Combobox,{...p,value:''}).includes('SELECT_EMPTY'));
  assert.ok(render(combo.Combobox,{...p,value:'Asia/Kolkata'}).includes('Калькутта (Asia/Kolkata)'));
  assert.equal(count,0);selectedItem();assert.equal(count,1);assert.equal(value,'Asia/Calcutta');assert.equal(JSON.stringify(options),before);
});
check('Fixed-date UTC/DST and inverted Etc/GMT offsets, absence of Intl/invalid zone, no offset in labels',()=>{
  const winter=new Date('2026-01-15T12:00:00Z'),summer=new Date('2026-07-15T12:00:00Z');
  assert.equal(offsets.formatUtcOffset('UTC',winter),'UTC');
  assert.equal(offsets.formatUtcOffset('America/New_York',winter),'UTC-05:00');
  assert.equal(offsets.formatUtcOffset('America/New_York',summer),'UTC-04:00');
  assert.equal(offsets.formatUtcOffset('Etc/GMT-1',winter),'UTC+01:00');
  assert.equal(offsets.formatUtcOffset('Etc/GMT+1',winter),'UTC-01:00');
  assert.equal(offsets.formatUtcOffset('Bad/Zone',winter),null);assert.equal(noIntlOffsets.formatUtcOffset('UTC',winter),null);
  schema=pins[0].data;hash=pins[0].schemaHash;language='ru';missingIntl=true;
  assert.ok(!render(zoneValue.TimeZoneValue,{schema,type:type('TimeZone'),value:'America/New_York',variant:'full'}).includes('UTC-'));
  missingIntl=false;const html=render(zoneValue.TimeZoneValue,{schema,type:type('TimeZone'),value:'America/New_York',variant:'full'});
  assert.ok(html.includes('Нью-Йорк (America/New_York)')&&/UTC-0[45]:00/.test(html));
});
check('Local-zone shortcut chooses only the exact available ID; unavailable ID does not canonicalize',()=>{
  schema=pins[0].data;hash=pins[0].schemaHash;language='ru';missingIntl=true;let result;
  const local=(id)=>mod('src/components/forms/widgets/TimeZoneWidget.tsx',tzImports,{Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:id})})}}).TimeZoneWidget;
  localButton=undefined;let html=render(local('Asia/Calcutta'),props('TimeZone','UTC',x=>result=x));
  assert.ok(html.includes('Калькутта (Asia/Calcutta)'));assert.equal(typeof localButton,'function');localButton();assert.equal(result,'Asia/Calcutta');
  localButton=undefined;render(local('Not/A_Zone'),props('TimeZone','UTC'));assert.equal(localButton,undefined);
});
check('Reviewed catalogue byte identity after tests',()=>assert.equal(read('src/i18n/schema/ru.json'),protectedBefore));
console.log('Stage42 synthetic React / pure tests: '+checks+' groups PASS; no browser or network.');
