// Stage43: synthetic actual renderers, both pinned editions; no browser or server.
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
    {exports,URL,Date,Intl,TextEncoder,require:n=>{assert.ok(Object.hasOwn(imports,n),p+': '+n);return imports[n]},...globals},{filename:p,timeout:5000});
  return exports;
}
let language='ru',hash,schema,captured,mode='create',checks=0,select,buttons=[],inputs=[],calls=[],changed,range,wrapper;
const dictionaries={ru:JSON.parse(read('src/i18n/ru.json')),en:JSON.parse(read('src/i18n/en.json'))};
const t=(key,fallback,args={})=>Object.entries(args).reduce((s,[k,v])=>s.replaceAll('{{'+k+'}}',String(v)),key.split('.').reduce((a,k)=>a?.[k],dictionaries[language])??fallback??key);
const store={useSchemaStore:fn=>fn({schema,schemaHash:hash})};
const text=mod('src/i18n/schemaText.ts',{'./schema/ru.json':catalog});
const resolver=mod('src/lib/schemaResolver.ts');
const common={react:React,'react/jsx-runtime':jsx,'react-i18next':{useTranslation:()=>({t,i18n:{resolvedLanguage:language,language}})},'@/stores/schemaStore':store,'@/lib/schemaResolver':resolver,
  'lucide-react':new Proxy({},{get:()=>dummy}),'@/lib/utils':{cn:(...v)=>v.filter(Boolean).join(' ')}};
const hooks=mod('src/hooks/useSchemaText.ts',{...common,'@/i18n/schemaText':text});
common['@/hooks/useSchemaText']={...hooks,useSchemaText:()=>{const display=hooks.useSchemaText();return (slot,original)=>{calls.push(slot);return display(slot,original)}}};

const packet=JSON.parse(read('scripts/data/stage43-specialized-review.json'));
const entries=[...packet.entries,...packet.existing];
const denied=new Set(packet.noConsumer.map(e=>e.slot));
const expected=e=>text.schemaText(hash,language,e.slot,e.original);
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name)};
const never=()=>{throw Error('Real credential or network operation prohibited')};
const controls={'@/components/ui/button':{Button:p=>{buttons.push(p);return pass(p)}},
  '@/components/ui/input':{Input:p=>{inputs.push(p);return h('input',{value:p.value??'',readOnly:true,'aria-label':p['aria-label']})}},
  '@/components/ui/label':{Label:pass},
  '@/components/ui/select':{Select:p=>{select=p;return pass(p)},SelectContent:pass,SelectItem:pass,SelectTrigger:pass,SelectValue:pass}};
const embedded=mod('src/lib/embeddedSchema.ts',{'@/lib/jmapUtils':{SECRET_MASK:'MASK'}});
const formats={formatDuration:String,formatNumber:String,formatSize:String,formatDateTime:String};
const scalars=mod('src/components/values/ScalarValues.tsx',{...common,'@/components/ui/badge':{Badge:pass},'@/data/objectOptions':{useDisplayName:()=>({})},'@/lib/format':formats,'@/lib/jmapUtils':{SECRET_MASK:'MASK'},'@/lib/embeddedSchema':embedded});
const traits={labelMode:'control',layout:'side',readOnlyAsValue:false};
const widgets={resolveWidget:()=>({traits}),widgetTraits:()=>traits};
const values=mod('src/components/values/FieldValue.tsx',{...common,'@/components/ui/badge':{Badge:pass},'@/components/ui/collapsible':{Collapsible:pass,CollapsibleTrigger:pass,CollapsibleContent:pass},'@/components/common/HelpTooltip':{HelpTooltip:p=>h('span',null,p.content)},'@/lib/format':formats,'@/extensions/widgets':widgets,'@/lib/embeddedSchema':embedded,'@/components/values/ScalarValues':scalars});
const context={useFormContext:()=>({schema,mode,idPrefix:'test',isCommunity:false,hideEnterprise:false,baseline:{}}),useFieldScope:()=>({path:[],readOnly:false}),isEnterpriseLockedIn:()=>false,fieldIds:(_p,path)=>({inputId:path.join('.'),labelId:'label',descriptionId:'help',errorId:'error'}),useInPanel:()=>false};
const fields=mod('src/components/forms/FieldRow.tsx',{...common,...controls,'@/components/common/Markdown':{Markdown:p=>h('span',null,p.source)},'@/components/common/HelpTooltip':{HelpTooltip:dummy},'@/components/values/FieldValue':values,'@/components/forms/FormProvider':{FieldScopeProvider:pass},'@/components/forms/widgets/FieldControl':{FieldControl:p=>{captured=p;return null}},'@/extensions/widgets':widgets,'@/components/forms/formContext':context,'@/components/forms/formLogic':{requiredMarker:()=>null}});
const fieldValue=(type,value,variant='full')=>render(values.FieldValue,{schema,type,value,variant});
const sample=t=>{switch(t.type){case 'enum':return schema.enums[t.enumName][0].name;case 'number':return 42;case 'boolean':return true;case 'utcDateTime':return '2026-01-15T12:00:00Z';case 'set':return {[t.class.type==='enum'?schema.enums[t.class.enumName][0].name:'raw.example']:true};case 'objectList':return {'0':{if:'raw-condition',then:'raw-result'}};default:return 'RAW-SYNTHETIC'}};
const dataFor=(name,id)=>{const v=id===undefined?{}:{'@type':id};const obj=embedded.resolveEmbedded(schema,name,v);for(const {formField,field} of embedded.embeddedEntries(obj))if(!['@type','id'].includes(formField.name))v[formField.name]=sample(field.type);return v};
const roots=['x:DnsManagement','x:CertificateManagement','x:TaskStatus','x:IndexStatus','x:KeySource'];
check('Compact summaries and full detail: DNS/cert, task/index and external key families; raw data unchanged',()=>{
 for(const pin of pins){schema=pin.data;hash=pin.schemaHash;for(language of ['ru','en','ru'])for(const root of roots){
  for(const v of schema.schemas[root].variants){const data=dataFor(root,v.name),before=JSON.stringify(data);const type={type:'object',objectName:root},slot='variant/'+root+'/'+v.name+'/label';calls=[];const compact=fieldValue(type,data,'compact');
   assert.ok(compact.includes(escaped(text.schemaText(hash,language,slot,v.label))),slot);
   assert.ok(!calls.some(x=>/^(field|form)\//.test(x)),slot);
   assert.ok(!calls.some(x=>x.startsWith('enum/DnsRecordType/')),slot);
   if(root==='x:KeySource'&&v.name==='Automatic')assert.ok(calls.some(x=>x.startsWith('enum/KeyDiscoverySource/')),slot);
   calls=[];const full=fieldValue(type,data);
   for(const e of entries.filter(e=>e.slot.startsWith('field/'+v.schemaName+'/')||e.slot.startsWith('form/'+v.schemaName+'/field/'))){
    assert.ok(calls.includes(e.slot),e.slot);assert.ok(full.includes(escaped(expected(e))),e.slot);
   }
   assert.equal(JSON.stringify(data),before);
  }
 }}
});
check('All exact enum labels in full set and scalar values, unchanged identifiers and fallback',()=>{
 for(const pin of pins){schema=pin.data;hash=pin.schemaHash;for(language of ['ru','en','ru'])for(const name of ['DnsRecordType','KeyDiscoverySource']){
  const options=schema.enums[name];for(const v of options){const e=entries.find(e=>e.slot==='enum/'+name+'/'+v.name+'/label');assert.ok(e);
   const type={type:'enum',enumName:name};const data={[v.name]:true};
   assert.ok(fieldValue(type,v.name).includes(escaped(expected(e))),e.slot);
   assert.ok(fieldValue({type:'set',class:type},data).includes(escaped(expected(e))),e.slot);
   exact(data,{[v.name]:true});
  }
 }}
});
check('Every active field/form caption via exact schema FieldRow; all edition bindings, RU/EN and fallback',()=>{
 let count=0;
 for(const pin of pins){schema=pin.data;for(const e of entries){const [kind,owner,...rest]=e.slot.split('/');if(kind!=='field'&&!(kind==='form'&&rest[0]==='field'))continue;
  const fieldName=kind==='field'?rest[0]:rest[1];const field=schema.fields[owner]?.properties[fieldName],formField=schema.forms[owner]?.sections.flatMap(s=>s.fields).find(f=>f.name===fieldName);
  if(!field||!formField)continue;
  const before=JSON.stringify({field,formField});const raw=sample(field.type);
  for(const [lang,active] of [['ru',pin.schemaHash],['en',pin.schemaHash],['ru','unknown']]){language=lang;hash=active;calls=[];const html=render(fields.FieldRow,{field,formField,formKey:owner,fieldOwner:owner,value:raw,onChange:v=>changed=v});
   assert.ok(calls.includes(e.slot),e.slot);assert.ok(html.includes(escaped(expected(e))),e.slot);
   assert.equal(captured.formField.name,fieldName);assert.equal(captured.value,raw);captured.onChange(raw);assert.equal(changed,raw);
  }assert.equal(JSON.stringify({field,formField}),before);count++;
 }}assert.ok(count>150,'edition field bindings '+count);
});
check('Full detail retains expression, rate and registration metadata; compact lists/maps omit nested captions',()=>{
 for(const pin of pins){schema=pin.data;hash=pin.schemaHash;language='ru';
  for(const name of ['x:Expression','x:Rate','x:PasskeyRegistration']){
   const data=dataFor(name),before=JSON.stringify(data),type={type:'object',objectName:name};calls=[];fieldValue(type,data);
   for(const e of entries.filter(e=>e.slot.startsWith('field/'+name+'/')||e.slot.startsWith('form/'+name+'/field/')))assert.ok(calls.includes(e.slot),e.slot);
   assert.equal(JSON.stringify(data),before);
  }
  calls=[];fieldValue({type:'objectList',objectName:'x:ExpressionMatch'},{'0':{if:'a',then:'b'}},'compact');assert.equal(calls.length,0);
  calls=[];const html=fieldValue({type:'map',keyClass:{type:'string',format:'string'},valueClass:{type:'object',objectName:'x:Expression'}},{raw:{match:{},else:'x'}},'compact');assert.ok(html.includes('raw'));assert.equal(calls.length,0);
 }
});
const model=mod('src/features/vacation/model.ts',{'@/lib/localDateTime':{MINUTES_PER_HOUR:60}});
const period=mod('src/features/vacation/components/PeriodRow.tsx',{...common,'@/components/forms/FieldRow':fields,'@/components/forms/formContext':context,'../model':model,'./DateRangePicker':{DateRangePicker:p=>{range=p;return null}},'./VacationStatusLine':{VacationStatusLine:dummy}});
const vacation=mod('src/features/vacation/VacationResponsePage.tsx',{...common,'@/components/forms/DynamicForm':{DynamicForm:p=>{wrapper=p;return null}},'@/lib/format':formats,'./model':model,'./components/PeriodRow':period,'./components/VacationPreview':{VacationPreview:dummy}});
const logic=mod('src/components/forms/formLogic.ts',{'@/lib/jmapPatch':{},'@/lib/schemaResolver':resolver,'@/lib/jmapUtils':{SECRET_MASK:'MASK'},'@/lib/embeddedSchema':embedded,'@/lib/fieldRules':{},'@/lib/localDateTime':{},'@/lib/weeklySchedule':{},'@/extensions/widgets':widgets});
const sections=mod('src/components/forms/FormSections.tsx',{...common,'@/i18n/schemaFormContext':mod('src/i18n/schemaFormContext.ts'),'@/components/forms/FieldRow':fields,'@/components/forms/VariantSelect':{VariantSelect:dummy}});
check('VacationResponse wrapper, actual sections and period override: raw UTC/null callback; no hidden help',()=>{
 for(const pin of pins){schema=pin.data;hash=pin.schemaHash;mode='singleton';for(language of ['ru','en','ru']){
  render(vacation.VacationResponsePage,{viewName:'VacationResponse',objectId:'singleton'});exact(wrapper.fieldOverrides.hidden,['toDate']);assert.equal(wrapper.fieldOverrides.render.fromDate,period.PeriodRow);
  const form=schema.forms.VacationResponse;const data={isEnabled:true,fromDate:null,toDate:null,subject:'RAW',textBody:'RAW',htmlBody:'RAW'};const changes=[];
  const rs=logic.buildSections(form,schema.fields.VacationResponse,'singleton',new Set(wrapper.fieldOverrides.hidden));assert.ok(!rs.flatMap(s=>s.fields).some(f=>f.formField.name==='toDate'));
  calls=[];const html=render(sections.FormSections,{sections:rs,formKey:'VacationResponse',fieldOwner:'VacationResponse',data,errors:{},readOnly:false,onFieldChange:(...v)=>changes.push(v),renderers:wrapper.fieldOverrides.render});
  assert.ok(html.includes(escaped(t('vacation.period','Period'))));assert.ok(html.includes(escaped(t('vacation.periodHelp',''))));
  for(const e of entries.filter(e=>e.slot.includes('/VacationResponse/')&&!/\/(title|subtitle)$/.test(e.slot))){assert.ok(calls.includes(e.slot),e.slot);assert.ok(html.includes(escaped(expected(e))),e.slot);}
  assert.ok(!calls.some(s=>denied.has(s)&&s!=='form/VacationResponse/field/fromDate')); // override receives label, does not render it
  range.onChange({from:new Date('2026-01-15T12:00:00Z'),to:null});exact(changes,[['fromDate','2026-01-15T12:00:00Z'],['toDate',null]]);
 }}
});
const exprEditor=mod('src/components/expression/ExpressionEditor.tsx',{...common,...controls,'@/hooks/useBufferedValue':{useBufferedValue:v=>[v,()=>{}]}});
const expression=mod('src/components/forms/widgets/ExpressionWidget.tsx',{...common,'@/components/expression/ExpressionEditor':exprEditor,'@/lib/embeddedSchema':embedded});
const units=mod('src/components/forms/widgets/useDurationUnitLabel.ts',common);
const rate=mod('src/components/forms/widgets/RateWidget.tsx',{...common,...controls,'@/hooks/useBufferedValue':{useResetOnChange:()=>{}},'@/lib/durationFormat':mod('src/lib/durationFormat.ts'),'@/lib/format':formats,'@/components/forms/widgets/useDurationUnitLabel':units});
check('Expression and Rate editors use client labels; raw expression and millisecond payloads unchanged',()=>{
 for(language of ['ru','en','ru']){
  buttons=[];inputs=[];calls=[];const value={match:{'2':{if:'raw_if',then:'raw_then'}},else:'raw_else'},before=JSON.stringify(value);
  const html=render(expression.ExpressionWidget,{formField:{label:'Raw'},value,onChange:v=>changed=v,control:{},readOnly:false});
  assert.ok(html.includes(escaped(t('expression.if','IF'))));assert.ok(html.includes('raw_if'));buttons.find(b=>b['aria-label']===t('expression.removeCondition','Remove condition {{n}}',{n:1})).onClick();exact(changed,{match:{},else:'raw_else'});assert.equal(JSON.stringify(value),before);assert.equal(calls.length,0);
  buttons=[];calls=[];const raw={count:7,period:1000};const rh=render(rate.RateWidget,{type:{type:'object',objectName:'x:Rate',nullable:true},value:raw,onChange:v=>changed=v,readOnly:false,control:{}});
  assert.ok(rh.includes(escaped(t('rate.count','Count'))));select.onValueChange('s');exact(changed,{count:7,period:1000});buttons.find(b=>b['aria-label']===t('common.clear','Clear')).onClick();assert.equal(changed,null);exact(raw,{count:7,period:1000});assert.equal(calls.length,0);
 }
});
const otp=mod('src/components/forms/widgets/OtpAuthField.tsx',{...common,...controls,'otpauth':{TOTP:never,Secret:never},qrcode:{toDataURL:never},'@/components/common/CopyButton':{CopyButton:dummy},'@/lib/jmapUtils':{SECRET_MASK:'MASK'}});
const passkey=mod('src/components/forms/widgets/PasskeyRegistrationField.tsx',{...common,...controls,'@/components/forms/formContext':context,'@/services/jmap/client':{getAccountId:never,jmapCall:never,jmapGetOne:never},'@/services/errors':{JmapMethodError:Error}},{window:{PublicKeyCredential:class{}},navigator:{credentials:{create:never}}});
check('OTP and Passkey actual editor branches: client text, no internal labels, no credential operation',()=>{
 for(language of ['ru','en','ru']){
  calls=[];buttons=[];inputs=[];const value={otpUrl:'synthetic-uri',otpCode:'MASK'};const html=render(otp.OtpAuthField,{value,onChange:v=>changed=v,readOnly:false});
  assert.ok(html.includes(escaped(t('otp.statusEnabled',''))));assert.equal(inputs[0].value,'');inputs[0].onChange({target:{value:'12 34'}});exact(changed,{otpUrl:'synthetic-uri',otpCode:'1234'});
  assert.ok(render(otp.OtpAuthField,{value:null,readOnly:true}).includes(escaped(t('otp.statusDisabled',''))));
  mode='create';buttons=[];const registration={clientDataJson:'synthetic-data',attestationObject:'synthetic-object'};assert.ok(render(passkey.PasskeyRegistrationField,{value:registration,onChange:v=>changed=v,readOnly:false}).includes(escaped(t('passkey.ready',''))));buttons[0].onClick();assert.equal(changed,null);mode='edit';assert.equal(render(passkey.PasskeyRegistrationField,{value:registration,readOnly:false}),'');
  assert.equal(calls.length,0);
 }
});
check('Trace create excludes server-set fields; exact variants and raw IDs in generic summaries',()=>{
 for(const pin of pins){schema=pin.data;hash=pin.schemaHash;if(!schema.schemas['x:TraceValue'])continue;language='ru';mode='create';
  const rs=logic.buildSections(schema.forms['x:Trace'],schema.fields['x:Trace'],'create');
  const names=rs.flatMap(s=>s.fields.map(f=>f.formField.name));for(const name of ['from','to','size','timestamp'])assert.ok(!names.includes(name),name);assert.ok(names.includes('events'));
  for(const v of schema.schemas['x:TraceValue'].variants){const slot='variant/x:TraceValue/'+v.name+'/label';const html=render(values.VariantValue,{schema,objectName:'x:TraceValue',value:v.name});assert.ok(html.includes(escaped(text.schemaText(hash,language,slot,v.label))),slot);}
 }
});
check('Reviewed catalogue byte identity',()=>assert.equal(read('src/i18n/schema/ru.json'),protectedBefore));
console.log('Stage43 synthetic React / pure tests: '+checks+' groups PASS; no browser or network.');
