// Adapted from Astra 010 check-review.mjs; original SHA256 d4701b56c62eb3ddb08cc49d28b1873e5b0a88e9803b4952755cc8703d8f8592; fixture preserves pre-patch source; current source and actual catalogue separate.
// Run from the review directory: node check-review.mjs WEBUI_ROOT REPORT_DIR
// Synthetic SSR and source contracts only. No browser/server/credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]??process.cwd());
const reports=path.join(root,'.artifacts');
const require=createRequire(path.join(root,'package.json'));
const ts=require('typescript'), React=require('react'), jsx=require('react/jsx-runtime');
const {renderToStaticMarkup}=require('react-dom/server');
await import(pathToFileURL(path.join(root,'scripts/lib/offline-guard.mjs')));
const {loadInputs,sourceModule,registry}=await import(pathToFileURL(path.join(root,'scripts/lib/locale-source.mjs')));
const inputs=loadInputs(root);
const report=JSON.parse(fs.readFileSync(path.join(reports,'locale-candidates/stage43-classification.json')));
const ledger=JSON.parse(fs.readFileSync(path.join(root,'scripts/data/stage44-final-review.json')));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'scripts/data/stage44-before-review.json')));
const read=(p,before=false)=>before?baseline.files[p].content:fs.readFileSync(path.join(root,p),'utf8');
const h=React.createElement, pass=({children})=>h(React.Fragment,null,children), icon=()=>null;
const fatal=()=>{throw Error('Forbidden operation in synthetic test');};
let language='ru',hash=inputs.pins[0].schemaHash,ctx={schema:inputs.pins[0].data,mode:'create',hideEnterprise:false,idPrefix:'test'};
const catalog=structuredClone(inputs.catalog);
for(const r of ledger.rows) catalog.entries[r.slot]={original:r.original,ru:'ПРОВЕРКА_'+r.id};
const {schemaText,schemaActionName}=sourceModule(read('src/i18n/schemaText.ts'),'schemaText.ts',{'./schema/ru.json':catalog});
const display=(slot,original)=>schemaText(hash,language,slot,original);
const useSchemaText=()=>display;
const en=JSON.parse(read('src/i18n/en.json')),ru=JSON.parse(read('src/i18n/ru.json'));
const pick=(o,k)=>k.split('.').reduce((a,b)=>a?.[b],o);
const t=(k,fallback,opts={})=>{const text=pick(language==='ru'?ru:en,k)??fallback??k;return text.replace(/{{(\w+)}}/g,(_,n)=>String(opts[n]??'{{'+n+'}}'));};
const formContext={useFormContext:()=>ctx,useFieldScope:()=>({path:[],readOnly:false}),useInPanel:()=>false,
 fieldIds:(_p,a)=>({inputId:a.join('-'),labelId:a.join('-')+'-label',descriptionId:a.join('-')+'-description',errorId:a.join('-')+'-error'}),
 isEnterpriseLockedIn:()=>false,EnclosingSchemaContext:React.createContext(null),PanelContext:React.createContext(false)};
const widgets=registry(read('src/extensions/widgets.ts'),'widgets.ts','WIDGETS');
const resolveWidget=type=>widgets.find(w=>w.match.objectName===type.objectName&&type.type==='object')??widgets.find(w=>w.match.type===type.type)??{traits:{labelMode:'control'}};
const common={'react':React,'react/jsx-runtime':jsx,'react-i18next':{useTranslation:()=>({t,i18n:{language,resolvedLanguage:language}})},
 'lucide-react':new Proxy({},{get:()=>icon}),'@/hooks/useSchemaText':{useSchemaText,useSchemaActionName:()=> (slot,original)=>schemaActionName(hash,language,slot,original)},'@/lib/utils':{cn:(...a)=>a.filter(x=>typeof x==='string').join(' ')},
 '@/stores/schemaStore':{useSchemaStore:f=>f({schema:ctx.schema,schemaHash:hash})},
 '@/components/forms/formContext':formContext,'@/extensions/widgets':{resolveWidget},
 '@/components/ui/button':{Button:pass},'@/components/common/CopyButton':{CopyButton:()=>null},
 '@/components/common/HelpTooltip':{HelpTooltip:({content})=>h('i',null,content)}};
function mod(file,deps={},before=false,extra=''){
 const exports={},imports={...common,...deps};
 const js=ts.transpileModule(read(file,before)+extra,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{exports,URL,require:name=>{assert.ok(Object.hasOwn(imports,name),'Unexpected import '+name+' in '+file);return imports[name];}},{filename:file,timeout:5000});
 return exports;
}
const render=(C,props)=>renderToStaticMarkup(h(C,props));
const escaped=x=>x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
const row=(slot)=>ledger.rows.find(r=>r.slot===slot);
const expectRow=(html,r)=>assert.ok(html.includes(escaped(display(r.slot,r.original))),r.slot);
const resolver=inputs.resolver;
const embedded=sourceModule(read('src/lib/embeddedSchema.ts'),'embeddedSchema.ts',{'@/lib/jmapUtils':{SECRET_MASK:'__synthetic_mask__'}});
let captured=[];
const {FieldRow}=mod('src/components/forms/FieldRow.tsx',{
 '@/components/ui/label':{Label:pass},'@/components/common/Markdown':{Markdown:({source})=>h('span',null,source)},
 '@/components/values/FieldValue':{FieldValue:({value})=>h('span',null,String(value))},
 '@/components/forms/FormProvider':{FieldScopeProvider:pass},
 '@/components/forms/widgets/FieldControl':{FieldControl:p=>{captured.push(p);return h('span',null,'CONTROL');}},
 '@/components/forms/formLogic':{requiredMarker:()=>null},'@/lib/schemaResolver':resolver,
});
function valueModule(before=false){return mod('src/components/values/FieldValue.tsx',{
 '@/components/ui/badge':{Badge:pass},'@/components/ui/collapsible':{Collapsible:pass,CollapsibleContent:pass,CollapsibleTrigger:pass},
 '@/lib/format':{formatDateTime:String},'@/lib/schemaResolver':resolver,'@/lib/embeddedSchema':embedded,
 '@/components/values/ScalarValues':Object.fromEntries(['BooleanValue','EmptyValue','EnumValue','NumberValue','ObjectIdValue','ScalarLabel','StringValue'].map(n=>[n,p=>{
   if(n==='EmptyValue')return null;
   if(n==='EnumValue'){const v=resolver.getEnumVariant(p.schema,p.enumName,p.value);return h('span',null,v?display(`enum/${p.enumName}/${v.name}/label`,v.label):String(p.value));}
   return h('span',null,String(p.value??p.id??''));
 }]))},before);}
const values=valueModule(),beforeValues=valueModule(true);
const {DynamicView}=mod('src/components/views/DynamicView.tsx',{'@/components/ui/badge':{Badge:pass},'@/components/values/FieldValue':values,'@/lib/schemaResolver':resolver,'@/lib/embeddedSchema':embedded});
const lazyPage=()=>()=>null;
const sel=sourceModule(read('src/extensions/pages.sel.ts'),'pages.sel.ts',{'@/extensions/lazyPage':{lazyPage}});
const pages=sourceModule(read('src/extensions/pages.ts'),'pages.ts',{'@/extensions/lazyPage':{lazyPage},'@/extensions/pages.sel':sel,'@/lib/schemaResolver':resolver});
const perms=sourceModule(read('src/lib/permissions.ts'),'permissions.ts',{'@/lib/schemaResolver':resolver});
const layout=sourceModule(read('src/lib/layout.ts'),'layout.ts',{'@/lib/schemaResolver':resolver,'@/lib/permissions':perms,'@/extensions/pages':pages});
const schemaStore=mod('src/stores/schemaStore.ts',{'zustand':{create:()=>()=>null},'@/i18n/schemaText':{schemaText},'@/lib/layout':layout},false,'\nexport {walkLayouts,buildSearchIndex};');
let checks=0;function passGroup(s){checks++;console.log('PASS '+checks+': '+s);}
assert.equal(report.rows.length,12246);assert.equal(ledger.rows.length,828);assert.equal(ledger.rows.reduce((n,r)=>n+r.bindings.length,0),1539);
assert.equal(report.stage,43);assert.deepEqual(report.rows.filter(r=>r.classification==='unreachable/conditional').map(r=>r.id).sort(),ledger.rows.map(r=>r.id).sort());
passGroup('historical replay residual census: 828 IDs / 1539 bindings; archive comparison separate');

function wizardModule(before=false){
 const screens=mod('src/components/bootstrap/BootstrapScreens.tsx',{'@/components/common/Logo':{DefaultLogo:()=>null}},before);
 let states=[],i=0;
 const {BootstrapWizard}=mod('src/components/bootstrap/BootstrapWizard.tsx',{
  react:{...React,useState:initial=>[i<states.length?states[i++]:initial,fatal]},
  '@/components/forms/FormProvider':{FormProvider:pass},'@/components/forms/FieldRow':{FieldRow},
  '@/components/forms/formLogic':{mapSetError:fatal,validateRequired:fatal},
  '@/components/bootstrap/BootstrapScreens':screens,'@/lib/schemaResolver':resolver,
  '@/lib/jmapPatch':{calculateJmapPatch:fatal},'@/data/objects':{useJmapObject:()=>({isSuccess:true,data:{}})},
  '@/data/mutations':{useJmapSet:()=>({mutateAsync:fatal})},
  '@/lib/jmapErrors':{errorMessage:fatal,friendlySetError:fatal,validationErrorMessage:fatal},
 },before);
 return (page,extra=null)=>{i=0;states=[{}, {},page,false,{},null,extra,true];return render(BootstrapWizard,{});};
}
const wizard=wizardModule(),beforeWizard=wizardModule(true);
for(const pin of inputs.pins){
 ctx={...ctx,schema:pin.data,hideEnterprise:true}; hash=pin.schemaHash;
 const snap=JSON.stringify(pin.data);
 for(language of ['ru','en','ru']){
  const all=Array.from({length:5},(_,i)=>wizard(i)).join('')+wizard(0,{username:'SYNTHETIC_USER',secret:'SYNTHETIC_VALUE'});
  for(const r of ledger.rows.filter(r=>r.group==='B0'))expectRow(all,r);
 }
 language='ru';const old=Array.from({length:5},(_,i)=>beforeWizard(i)).join('')+beforeWizard(0,{username:'SYNTHETIC_USER',secret:'SYNTHETIC_VALUE'});
 for(const r of ledger.rows.filter(r=>r.group==='B0'))assert.ok(!old.includes('ПРОВЕРКА_'+r.id),r.slot);
 hash='unknown';const all=Array.from({length:5},(_,i)=>wizard(i)).join('')+wizard(0,{username:'SYNTHETIC_USER',secret:'SYNTHETIC_VALUE'});
 for(const r of ledger.rows.filter(r=>r.group==='B0'))expectRow(all,r);
 assert.equal(JSON.stringify(pin.data),snap);
}
passGroup('actual BootstrapWizard/FieldRow/SuccessScreen: 29 pairs, both editions, RU/EN/RU, unknown hash, baseline defect');
// An empty first section must not renumber the original section lookup.
ctx.schema=structuredClone(inputs.pins[0].data);ctx.schema.forms['x:Bootstrap'].sections[0].fields=[];hash=inputs.pins[0].schemaHash;language='ru';
expectRow(wizard(0),row('form/x:Bootstrap/section/section-1'));
captured=[];wizard(0);assert.ok(captured.every(p=>p.formField.name!=='username'&&p.formField.name!=='secret'));
passGroup('source section index survives filtering; serverSet fields do not become editable');

let options=[],selected,changed;
const {VariantSelect}=mod('src/components/forms/VariantSelect.tsx',{
 '@/components/ui/select':{Select:p=>{selected=p.value;changed=p.onValueChange;return h(React.Fragment,null,p.children);},SelectContent:pass,SelectTrigger:pass,SelectValue:()=>null,SelectItem:p=>{options.push(p.value);return h('span',null,p.children);}},
 '@/components/forms/FieldRow':{FieldLabel:({label})=>h('label',null,label)},'@/components/forms/formLogic':{VARIANT_FIELD:'@type'},
});
for(const pin of inputs.pins){ctx.schema=pin.data;hash=pin.schemaHash;for(const name of ['x:DnsServerBootstrap','x:DirectoryBootstrap']){
 const variants=pin.data.schemas[name].variants,snap=JSON.stringify(variants);
 for(language of ['ru','en','ru']){options=[];const html=render(VariantSelect,{variantScope:name,variants,value:variants[0].name,onChange:v=>{selected=v;},readOnly:false});
 for(const r of ledger.rows.filter(r=>r.slot.startsWith('variant/'+name+'/')))expectRow(html,r);
 assert.deepEqual(options,variants.map(v=>v.name));changed(variants.at(-1).name);assert.equal(selected,variants.at(-1).name);assert.equal(JSON.stringify(variants),snap);}
 hash='unknown';language='ru';const html=render(VariantSelect,{variantScope:name,variants,value:variants[0].name,onChange:fatal,readOnly:true});for(const v of variants)assert.ok(html.includes(escaped(v.label)));hash=pin.schemaHash;
}}
passGroup('75 bootstrap variants: real VariantSelect, raw IDs/order/callbacks preserved, enum duplicates unused');

function sampleField(f,s){const z=f.type;if(z.type==='enum')return s.enums[z.enumName]?.[0]?.name??'unknown';if(z.type==='number')return 1;if(z.type==='boolean')return true;return 'SYNTHETIC';}
for(const pin of inputs.pins){ctx.schema=pin.data;hash=pin.schemaHash;language='ru';const s=pin.data;
 const checkers=perms.createPermissionCheckers(s.enums.Permission.map(v=>v.name));
 for(const name of ['Principal','x:Metric','x:Domain/DomainZone','x:QueuedMessage/MessageContents','x:Trace']){
  if(!s.objects[name])continue;
  assert.equal(layout.isLinkAccessible(s,name,'enterprise',checkers.canGet,checkers.hasPermission),true,name);
  assert.equal(pages.resolvePage(s,name,undefined,checkers).kind,'object');
  const r=resolver.resolveObject(s,name),sch=resolver.resolveSchema(s,r.objectName);
  if(name==='x:Trace'){assert.ok(pages.resolvePage(s,name,'synthetic-id',checkers).component);continue;}
  for(const v of sch.type==='single'?[sch]:sch.variants){if(!v.fields)continue;
   const data=Object.fromEntries(Object.entries(v.fields.properties).map(([k,f])=>[k,sampleField(f,s)]));if(v.name)data['@type']=v.name;
   const html=render(DynamicView,{schema:s,objectName:r.objectName,viewName:name,data});
   const relevant=ledger.rows.filter(x=>['D0','D1','D2'].includes(x.group)&&x.bindings.some(b=>b.edition===pin.edition)&&
      (x.slot.startsWith('field/'+v.schemaName+'/')||x.slot.startsWith('form/'+v.schemaName+'/')||x.slot.startsWith('form/'+name+'/'))&&!x.slot.endsWith('/field/@type'));
   for(const x of relevant)expectRow(html,x);
  }
 }
 const {viewToSection,linkEntries}=schemaStore.walkLayouts(s,hash,language);
 const index=schemaStore.buildSearchIndex(s,viewToSection,linkEntries,hash,language).filter(e=>resolver.resolveObject(s,e.viewName));
 for(const x of ledger.rows.filter(x=>x.group==='Q0'&&x.bindings.some(b=>b.edition===pin.edition)))assert.ok(index.some(e=>(e.text+' '+e.breadcrumb).includes(display(x.slot,x.original))),x.slot);
 for(const x of ledger.rows.filter(x=>x.group==='S0'))assert.ok(!index.some(e=>e.text==='ПРОВЕРКА_'+x.id),x.slot);
}
passGroup('actual route resolver and ACL helpers: direct routes; DynamicView; 8 search-only paths; embedded section search rejection');

const {ActionResult}=mod('src/features/actions/components/ActionResult.tsx',{'@/components/ui/card':{Card:pass,CardContent:pass},'@/components/views/DynamicView':{DynamicView}});
for(const pin of inputs.pins){hash=pin.schemaHash;language='ru';ctx.schema=pin.data;const s=pin.data;
 const variant=s.schemas['x:Action'].variants.find(v=>v.name==='ClassifySpam');let html='';
 for(const e of s.enums.SpamClassifyTagDisposition)html+=render(ActionResult,{schema:s,variant,data:{tags:{SYNTHETIC_TAG:{score:1,disposition:e.name}}},onNewAction:fatal});
 const d=s.schemas['x:Action'].variants.find(v=>v.name==='TroubleshootDmarc');const v=s.schemas['x:DmarcTroubleshootAuthResult'].variants.find(v=>v.schemaName==='x:DmarcTroubleshootDetails');
 html+=render(ActionResult,{schema:s,variant:d,data:{arcResult:{'@type':v.name,details:'SYNTHETIC_DETAILS'}},onNewAction:fatal});
 for(const r of ledger.rows.filter(r=>r.group==='A0'))expectRow(html,r);
 for(const r of ledger.rows.filter(r=>r.group==='F0')){
  const owner=r.slot.split('/')[1],name=r.slot.split('/')[2];const v=s.schemas['x:Credential'].variants.find(v=>v.schemaName===owner);const data={'@type':v.name,[name]:'SYNTHETIC'};
  const props={schema:s,objectName:'x:Credential',value:data,defaultOpen:true};expectRow(render(values.ObjectValue,props),r);
  assert.ok(!render(beforeValues.ObjectValue,props).includes('ПРОВЕРКА_'+r.id));assert.deepEqual(data,{'@type':v.name,[name]:'SYNTHETIC'});
 }
}
passGroup('9 action-result pairs and 5 raw fallback descriptions reproduced with actual ActionResult/DynamicView/ObjectValue');

for(const pin of inputs.pins){ctx.schema=pin.data;hash=pin.schemaHash;language='ru';
 for(const [owner,name] of [['x:AccountPassword','otpAuth'],['x:Passkey','registration']]){
  const field=pin.data.fields[owner].properties[name],formField=pin.data.forms[owner].sections.flatMap(s=>s.fields).find(f=>f.name===name);
  const html=render(FieldRow,{field,formField,formKey:owner,fieldOwner:owner,value:{},onChange:fatal});
  for(const slot of [`field/${owner}/${name}/description`,`form/${owner}/field/${name}`]){
   const entry=inputs.catalog.entries[slot];assert.ok(entry);assert.ok(!html.includes(escaped(entry.ru)),slot);
  }
 }
 assert.equal(resolveWidget(pin.data.fields['x:Passkey'].properties.registration.type).traits.createOnly,true);
 assert.equal(pages.resolvePage(pin.data,'x:AccountPassword','synthetic-id',perms.createPermissionCheckers([])).target.mode,'singleton');
 const searchMap=schemaStore.walkLayouts(pin.data,hash,language);
 const searchEntries=schemaStore.buildSearchIndex(pin.data,searchMap.viewToSection,searchMap.linkEntries,hash,language);
 for(const slot of ['form/x:AccountPassword/field/otpAuth','form/x:Passkey/field/registration'])assert.ok(searchEntries.some(e=>e.text===inputs.catalog.entries[slot].ru),slot);
 const html=render(DynamicView,{schema:pin.data,objectName:'x:Passkey',viewName:'x:Passkey',data:{registration:{clientDataJson:'SYNTHETIC'}}});
 assert.ok(html.includes(escaped(inputs.catalog.entries['field/x:Passkey/registration/description'].ru)));
}
passGroup('actual UNLABELLED traits suppress outer OTP/Passkey metadata; Passkey detail remains a conditional consumer');

const primitive={Root:pass,Trigger:pass,Portal:pass,Close:pass,Overlay:pass,Content:pass,Title:pass,Description:pass};
const {DialogContent}=mod('src/components/ui/dialog.tsx',{'@radix-ui/react-dialog':primitive});
const {ToastClose}=mod('src/components/ui/toast.tsx',{'class-variance-authority':{cva:()=>()=>''}});
for(language of ['ru','en','ru']){assert.ok(render(DialogContent,{}).includes(language==='ru'?'Закрыть':'Close'));assert.ok(render(ToastClose,{}).includes('aria-label="'+(language==='ru'?'Закрыть':'Close')+'"'));}
passGroup('both actual accessibility Close components switch RU/EN/RU');

const {buildUsageGraph}=await import(pathToFileURL(path.join(root,'scripts/lib/locale-graph.mjs')));
const originalGraph=await import('data:text/javascript;base64,'+Buffer.from(read('scripts/lib/locale-graph.mjs',true).replace("'./locale-source.mjs'",JSON.stringify(pathToFileURL(path.join(root,'scripts/lib/locale-source.mjs')).href))).toString('base64'));
const flags={fieldOwners:true,formOwners:true,variantBadges:true,traceLabels:true,regionalLabels:true,specializedPaths:true};
const old=originalGraph.buildUsageGraph({...inputs,...flags}),unchanged=buildUsageGraph({...inputs,...flags});
assert.equal(JSON.stringify([...old.usages]),JSON.stringify([...unchanged.usages]));
assert.equal(JSON.stringify(old.screens),JSON.stringify(unchanged.screens));assert.equal(JSON.stringify(old.unresolved),JSON.stringify(unchanged.unresolved));
const added=buildUsageGraph({...inputs,...flags,webuiRuBootstrapPaths:true});
const changedRows=ledger.rows.filter(r=>added.usages.get(r.slot+'\0'+r.original).length);
assert.equal(changedRows.length,104);assert.ok(changedRows.every(r=>['B0','B1'].includes(r.group)));
passGroup('opt-in Bootstrap graph adds exactly 104 residual pairs; flag-off stage43 graph is byte-identical');

let granted=false;
const objectOptionsDeps={'@/lib/schemaResolver':resolver,'@/hooks/usePermissions':{usePermissionCheckers:()=>({hasObjectPermission:()=>granted})}};
const optionsNow=mod('src/lib/objectOptions.ts',objectOptionsDeps),optionsBefore=mod('src/lib/objectOptions.ts',objectOptionsDeps,true);
const {Pagination}=mod('src/components/lists/Pagination.tsx');
const listActions=mod('src/components/lists/listActions.ts',{'@/lib/schemaResolver':resolver,'./listUrlState':{filteredListSearch:fatal}});
for(const pin of inputs.pins){ctx.schema=pin.data;hash=pin.schemaHash;const s=pin.data;language='ru';
 const r=row('list/Principal/plural');granted=false;
 assert.equal(optionsNow.useNoPermissionMessage(s,'Principal'),t('field.noPermissionToView',undefined,{name:display(r.slot,r.original)}));
 assert.ok(optionsBefore.useNoPermissionMessage(s,'Principal').includes(r.original));
 granted=true;assert.equal(optionsNow.useNoPermissionMessage(s,'Principal'),null);granted=false;
 for(language of ['en','ru'])assert.equal(optionsNow.useNoPermissionMessage(s,'Principal'),t('field.noPermissionToView',undefined,{name:display(r.slot,r.original)}));
 hash='unknown';language='ru';assert.ok(optionsNow.useNoPermissionMessage(s,'Principal').includes(r.original));hash=pin.schemaHash;
 const checkers=perms.createPermissionCheckers(s.enums.Permission.map(v=>v.name));
 for(const name of ['x:Metric','x:Trace']){if(!s.objects[name])continue;
  const list=s.lists[name],obj=resolver.resolveObject(s,name);
  assert.equal(listActions.resolveMassActions(list.massActions,{isObject:true,permissionPrefix:obj.permissionPrefix},checkers,'Delete').length,0);
  assert.equal((list.itemActions??[]).length,0);
  for(const action of ['Create','Update','Destroy'])assert.equal(checkers.hasObjectPermission(obj.permissionPrefix,action),false);
  assert.ok(!JSON.stringify(s.fields).includes('"objectName":"'+name+'"'));
  for(language of ['ru','en','ru']){const html=render(Pagination,{range:{from:1,to:1,hasPrev:false,hasNext:false},total:1,count:1,pluralName:list.pluralName,disabled:false,onPrev:fatal,onNext:fatal});
   assert.equal(html.includes(list.pluralName),language==='en');
  }
 }
}
passGroup('Principal no-permission caption is raw before proposal; Metric/Trace plurals are EN-only under both pinned permission sets');

language='ru';hash=inputs.pins[0].schemaHash;ctx.schema=inputs.pins[0].data;
const logicAst=ts.createSourceFile('formLogic.ts',read('src/components/forms/formLogic.ts'),ts.ScriptTarget.Latest,true);
const labelFunction=logicAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='formFieldLabels');assert.ok(labelFunction);
const labelHelper=sourceModule(labelFunction.getText(logicAst),'formFieldLabels.ts',{}).formFieldLabels;
const {CreatedValuesDialog}=mod('src/components/forms/CreatedValuesDialog.tsx',{'@/components/ui/dialog':Object.fromEntries(['Dialog','DialogContent','DialogDescription','DialogFooter','DialogHeader','DialogTitle'].map(n=>[n,pass]))});
for(const name of ['x:AppPassword','x:ApiKey']){
 const labels=labelHelper(ctx.schema.forms[name]);const html=render(CreatedValuesDialog,{values:{secret:'SYNTHETIC_VALUE'},labels,onContinue:fatal});
 assert.ok(html.includes('Secret'));assert.ok(!html.includes(inputs.catalog.entries[`form/${name}/field/secret`].ru));
}
const errorTypes=sourceModule(read('src/services/errors.ts'),'errors.ts',{});
const errors=sourceModule(read('src/lib/jmapErrors.ts'),'jmapErrors.ts',{'@/services/errors':errorTypes,'@/i18n':{t,get resolvedLanguage(){return language;}}});
assert.equal(errors.friendlySetError({type:'forbidden',description:'SYNTHETIC_SERVER_DESCRIPTION'}),t('jmapErrors.forbidden')+'\nSYNTHETIC_SERVER_DESCRIPTION');
assert.equal(errors.friendlyMethodError(new errorTypes.JmapMethodError('x:Test/get','synthetic',{type:'forbidden',description:'SYNTHETIC_SERVER_DESCRIPTION'})),t('jmapErrors.forbidden')+'\nSYNTHETIC_SERVER_DESCRIPTION');
assert.equal(errors.errorMessage(new errorTypes.ApiError(403,'Forbidden',{detail:'SYNTHETIC_SERVER_DESCRIPTION'})),t('jmapErrors.forbidden')+'\nSYNTHETIC_SERVER_DESCRIPTION');
assert.equal(errors.friendlySetError({type:'unknown',description:'SYNTHETIC_SERVER_DESCRIPTION'}),'SYNTHETIC_SERVER_DESCRIPTION');
language='en';assert.equal(errors.friendlySetError({type:'forbidden',description:'SYNTHETIC_SERVER_DESCRIPTION'}),'SYNTHETIC_SERVER_DESCRIPTION');language='ru';
assert.equal(errors.friendlySetError({type:'forbidden'}),t('jmapErrors.forbidden'));
const navTree=sourceModule(read('src/components/layout/navTree.ts'),'navTree.ts',{});
for(const pin of inputs.pins){hash=pin.schemaHash;ctx.schema=pin.data;const visit=nodes=>{for(const n of nodes){const record=report.rows.find(r=>r.slot===n.displaySlot&&r.original===n.name);assert.ok(record,n.displaySlot);if(record.classification==='translated')assert.notEqual(display(n.displaySlot,n.name),n.name,n.displaySlot);else assert.ok(['technical','keep-original'].includes(record.classification),n.displaySlot);if(n.children)visit(n.children);}};
 for(const l of pin.data.layouts)visit(navTree.layoutNavNodes(l));
}
passGroup('baseline raw Secret helper, known RU error summaries with preserved diagnostics, and exact Sidebar nav slots');

// Actual DynamicForm -> CreatedValuesDialog: mock only data/hooks and leaf controls.
let model, copied=[];
const actualDialog=mod('src/components/forms/CreatedValuesDialog.tsx',{'@/components/ui/dialog':Object.fromEntries(['Dialog','DialogContent','DialogDescription','DialogFooter','DialogHeader','DialogTitle'].map(n=>[n,pass])),'@/components/common/CopyButton':{CopyButton:p=>{copied.push(p);return null;}}});
const {DynamicForm}=mod('src/components/forms/DynamicForm.tsx',{
 'react-router-dom':{useNavigate:()=>fatal},'@/components/common/ConfirmDialog':{ConfirmDialog:()=>null},
 '@/components/common/FloatingActionBar':{FloatingActionBar:pass,FloatingActionDivider:pass,FloatingActionDot:pass},
 '@/hooks/usePermissions':{useCanAccess:()=>true},'@/lib/objectOptions':{coerceLabel:String},
 '@/lib/schemaResolver':resolver,'@/components/forms/CreatedValuesDialog':actualDialog,
 '@/components/forms/FormProvider':{FormProvider:pass},'@/components/forms/FormSections':{FormSections:()=>null},
 '@/i18n/schemaFormContext':{sectionDisplayContext:fatal},'@/components/forms/UnsavedChangesDialog':{UnsavedChangesDialog:()=>null},
 '@/components/forms/useDynamicForm':{useDynamicForm:()=>model},
});
function resolvedView(s,name){const object=resolver.resolveObject(s,name);return {object,resolvedSchema:resolver.resolveSchema(s,object.objectName),list:resolver.resolveList(s,name,object.objectName)};}
for(const pin of inputs.pins){
 ctx.schema=pin.data;hash=pin.schemaHash;
 for(const name of ['x:AppPassword','x:ApiKey']){
  if(!pin.data.objects[name])continue;
  const form=pin.data.forms[name],values={secret:'SYNTHETIC_VALUE'};
  model={schema:pin.data,resolved:resolvedView(pin.data,name),mode:'create',isSingleton:false,state:{data:{},original:{},fieldErrors:{},created:{values}},variantForm:form,parentForm:null,sections:[],guard:{},continueAfterCreate:fatal};
  for(language of ['ru','en','ru']){
   copied=[];const html=render(DynamicForm,{viewName:name,objectId:null});
   const label=display('form/'+name+'/field/secret',form.sections.flatMap(s=>s.fields).find(f=>f.name==='secret').label);
   assert.ok(html.includes(escaped(label)),name);assert.ok(html.includes('SYNTHETIC_VALUE'));
   assert.ok(copied.some(p=>p.label===label&&p.value==='SYNTHETIC_VALUE'));
   assert.deepEqual(values,{secret:'SYNTHETIC_VALUE'});
  }
 }
}
passGroup('actual DynamicForm -> CreatedValuesDialog: RU/EN/RU metadata, raw value and copy unchanged');

// Exercise the actual list callbacks, with synthetic data and mutation traps.
let resolved, pending, massProps, rowProps, selection, listData, destroyPayload, toastData;
const listModule=mod('src/components/lists/DynamicList.tsx',{
 react:{...React,useState:initial=>[initial,v=>{if(initial===null)pending=v;}]},
 'react-router-dom':{useNavigate:()=>fatal},'@/components/common/ConfirmDialog':{ConfirmDialog:()=>null},
 '@/components/common/EnterpriseUpsell':{EnterpriseUpsell:()=>null},
 '@/hooks/usePermissions':{useIsCommunity:()=>false,usePermissionCheckers:()=>({hasObjectPermission:()=>true})},
 '@/hooks/useResolvedView':{useResolvedView:()=>resolved},'@/lib/layout':layout,'@/lib/permissions':{canAccessView:()=>true},'@/lib/schemaResolver':resolver,
 '@/stores/schemaStore':{useSchemaStore:f=>f({schema:ctx.schema,viewToSection:{'x:AppPassword':'Account',Principal:'Management','x:Metric':'Management','x:Trace':'Management'}})},
 './FilterBar':{FilterBar:()=>null},'./ListTable':{ListTable:p=>p.renderRowActions?p.renderRowActions({},'synthetic-id','SYNTHETIC_LABEL'):null},
 './ListStates':{ListError:()=>null,ListMessage:pass,ListSpinner:()=>null},
 './MassActionBar':{MassActionBar:p=>{massProps=p;return null;}},'./Pagination':{Pagination:()=>null},
 './RowActions':{RowActions:p=>{rowProps=p;return null;}},'./SelectionBanner':{SelectionBanner:()=>null},
 './listActions':{itemActionHref:fatal,resolveItemActions:()=>[{kind:'mutation',key:'delete',action:{type:'delete',label:'Delete'}}],resolveMassActions:()=>[{type:'delete',label:'Delete'}]},
 './listQuery':{getListFields:()=>({}),itemId:()=>null,itemLabel:()=>''},
 './useDynamicList':{useDynamicList:()=>listData},'./useListActions':{useListActions:()=>({pending:false,runMassAction:fatal,runItemAction:fatal})},
 './useListSelection':{useListSelection:()=>selection},
});
for(const pin of inputs.pins){
 ctx.schema=pin.data;hash=pin.schemaHash;
 if(!pin.data.objects['x:AppPassword'])continue;
 resolved=resolvedView(pin.data,'x:AppPassword');
 listData={items:[],total:20,state:{filters:[],anchors:[],sort:[]}};
 for(language of ['ru','en','ru']) for(const n of [1,2,5]){
  selection={selectedIds:Array.from({length:n},(_,i)=>'synthetic-'+i),allMatching:false,pageState:'partial'};
  pending=massProps=rowProps=null;
  render(listModule.DynamicList,{viewName:'x:AppPassword'});
  assert.ok(massProps&&rowProps);
  massProps.onSelect({type:'delete',label:'Delete'},'delete');
  assert.ok(pending.title.includes(String(n)));
  assert.ok(pending.title.includes(display('list/x:AppPassword/'+(n===1?'singular':'plural'),n===1?resolved.list.singularName:resolved.list.pluralName)));
  rowProps.onMutation({kind:'mutation',key:'delete',action:{type:'delete',label:'Delete'}});
  assert.ok(pending.title.includes(display('list/x:AppPassword/singular',resolved.list.singularName)));
  assert.ok(pending.description.includes('SYNTHETIC_LABEL'));
 }
}
passGroup('actual DynamicList mass/item confirmation callbacks: RU/EN/RU, count 1/2/5, raw label intact');

// useDynamicForm.remove/save: only fake mutation responses; assert payload, toast and returned-value opt-in.
let hookDispatches=[],hookNavigations=[];
const hook=mod('src/components/forms/useDynamicForm.ts',{
 react:{...React,useEffect:()=>{},useReducer:()=>[{data:{},original:{},variant:'',source:resolved},event=>hookDispatches.push(event)]},
 'react-router-dom':{useNavigate:()=>path=>hookNavigations.push(path)},
 '@/stores/schemaStore':{useSchemaStore:f=>f({schema:ctx.schema,viewToSection:{'x:AppPassword':'Account'}})},
 '@/hooks/usePermissionCheckers':{},'@/hooks/usePermissions':{usePermissionCheckers:()=>({canGet:()=>true})},
 '@/hooks/useResolvedView':{useResolvedView:()=>resolved},'@/hooks/use-toast':{toast:p=>{toastData=p;}},
 '@/lib/schemaResolver':resolver,'@/lib/objectOptions':{coerceLabel:String},'@/lib/layout':{layoutViewFor:()=>null},
 '@/lib/embeddedSchema':embedded,'@/lib/jmapErrors':errors,'@/lib/debug':{logFormChange:()=>{}},
 '@/data/objects':{useJmapObject:()=>({fetchStatus:'idle'})},'@/data/mutations':{useJmapSet:()=>({isPending:false,mutateAsync:async p=>{destroyPayload=p;return p.create?{created:{'new-0':{id:'synthetic-id',secret:'SYNTHETIC_RETURNED_VALUE'}}}:{destroyed:['synthetic-id']};}})},
 '@/components/forms/formLogic':{filterAccessibleFields:f=>f,buildSections:()=>[],withoutSectionTitles:(sections,names)=>{assert.equal(names,undefined);return sections;},formFieldNames:()=>[],validatedFieldNames:()=>[],validateRequired:()=>({}),validateFormat:()=>({}),mergeFieldErrors:()=>({}),isOtpAuthValid:()=>true,buildCreatePayload:()=>({name:'SYNTHETIC_NAME'}),collectBlobUploads:payload=>({blobs:[],payload}),collectFetchProperties:()=>[],combineForms:()=>null,VARIANT_FIELD:'@type'},
 '@/components/forms/formReducer':{isFormDirty:()=>false},'@/components/forms/useUnsavedChangesGuard':{useUnsavedChangesGuard:()=>({allowNextNavigation:()=>{}})},
});
for(const pin of inputs.pins){
 ctx.schema=pin.data;hash=pin.schemaHash;if(!pin.data.objects['x:AppPassword'])continue;resolved=resolvedView(pin.data,'x:AppPassword');
 for(language of ['ru','en','ru']){
  destroyPayload=toastData=null;await hook.useDynamicForm('x:AppPassword','synthetic-id',{accountId:'synthetic-account'}).remove();
  assert.equal(JSON.stringify(destroyPayload),JSON.stringify({destroy:['synthetic-id'],accountId:'synthetic-account'}));
  const name=display('list/x:AppPassword/singular',resolved.list.singularName);
  assert.equal(toastData.title,t('form.deletedSuccess',undefined,{name:name.charAt(0).toUpperCase()+name.slice(1)}));
 }
}
passGroup('actual useDynamicForm.remove callback: localized toast, synthetic raw destroy payload');
// 2.1.1 shared hook: existing credential flows must retain returned values;
// the new option is opt-in, not a global behavior change. Only synthetic data.
for(const pin of inputs.pins){
 ctx.schema=pin.data;hash=pin.schemaHash;
 if(!pin.data.objects['x:AppPassword'])continue;
 resolved=resolvedView(pin.data,'x:AppPassword');language='ru';
 let previous;
 for(const options of [{},{showCreatedValues:false}]){
  hookDispatches=[];hookNavigations=[];toastData=destroyPayload=null;
  await hook.useDynamicForm('x:AppPassword',null,{accountId:'synthetic-account',...options}).save();
  const create={create:{'new-0':{name:'SYNTHETIC_NAME'}},blobs:[],accountId:'synthetic-account'};
  assert.equal(JSON.stringify(destroyPayload),JSON.stringify(create));
  if(previous)assert.equal(JSON.stringify(destroyPayload),previous);
  previous=JSON.stringify(destroyPayload);
  const returned=hookDispatches.find(event=>event.type==='created');
  if(options.showCreatedValues===false){
   assert.equal(returned,undefined);assert.ok(hookDispatches.some(event=>event.type==='commit'));
   assert.equal(toastData.title,t('form.createdSuccess'));assert.equal(hookNavigations.length,1);
  }else{
   assert.equal(returned.result.id,'synthetic-id');assert.equal(returned.result.values.secret,'SYNTHETIC_RETURNED_VALUE');
   assert.equal(hookNavigations.length,0);
  }
 }
}
passGroup('Stage48 actual useDynamicForm.save: default credential return preserved, explicit opt-out only, identical fake create payload');

const stage44=await import(pathToFileURL(path.join(root,'scripts/lib/locale-stage44.mjs')));
assert.throws(()=>stage44.validateStage44(root,inputs,{...ledger,manifestSha256:'0'.repeat(64)}),/reopen stage44/);
assert.throws(()=>stage44.validateStage44(root,inputs,{...ledger,sourceBlobs:{...ledger.sourceBlobs,'src/App.tsx':'changed'}}),/reopen stage44/);
assert.throws(()=>stage44.validateStage44(root,inputs,{...ledger,schemaHashes:['unknown']}),/Expected values/);
passGroup('schema/source drift mutations reopen review instead of silently accepting exclusions');
console.log('ALL '+checks+' GROUPS PASS; synthetic renderers and local source only, no browser/server acceptance');
