// Re-evaluate exact current bindings, never grandfather a count or schema hash.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { digest } from './locale-source.mjs';
const key=r=>r.slot+'\0'+r.original;
const refs=(value,property,name)=>{
  if(!value||typeof value!=='object')return 0;
  return (value[property]===name?1:0)+Object.values(value).reduce((n,v)=>n+refs(v,property,name),0);
};
function sourceStrings() {
  const strings=new Set();
  function walk(dir) {
    for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
      const file=dir+'/'+e.name;
      if(e.isDirectory())walk(file);
      else if(/\.[jt]sx?$/.test(file)) {
        const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
        const visit=n=>{if(ts.isStringLiteralLike(n))strings.add(n.text);ts.forEachChild(n,visit);};visit(source);
      }
    }
  }
  walk('src');return strings;
}
export function reviewWebuiRuStage49Exclusions(inputs,original,historicalReport,packet,report) {
  const prior=historicalReport.rows.filter(r=>r.classification==='unreachable/conditional');
  assert.equal(prior.length,640);
  const priorMap=new Map(prior.map(r=>[key(r),r]));
  const oldReview=new Map(packet.rows.map(r=>[key(r),r]));
  const strings=sourceStrings(),rows=[];
  const noEnumConsumer=(schema,owner)=>{
    assert.equal(refs(schema,'enumName',owner),0,'Новая ссылка на исключённый enum: '+owner);
    assert.ok(!strings.has(owner),'Новый прямой потребитель enum: '+owner);
  };
  const embeddedOnly=(schema,owner)=>{
    assert.equal(inputs.resolver.resolveObject(schema,owner),null,'Новый прямой маршрут: '+owner);
    assert.ok(!schema.objects[owner],'Новый корневой объект: '+owner);
    for(const variant of schema.schemas['x:Action'].variants.filter(v=>v.schemaName)) {
      const name=variant.schemaName, resolved=inputs.resolver.resolveSchema(schema,name);
      const form=inputs.resolver.resolveForm(schema,name,name,resolved?.schemaName??name);
      assert.notEqual(form,schema.forms[owner],'Новая форма результата действия: '+owner);
      for(const nested of resolved?.variants??[])
        assert.notEqual(nested.schemaName,owner,'Новая variant-форма результата действия: '+owner);
    }
  };
  for(const row of report.rows.filter(r=>r.classification==='unreachable/conditional')) {
    assert.equal(row.usages.length,0,row.slot);
    const [kind,owner,field]=row.slot.split('/');
    const previous=priorMap.get(key(row)),review=oldReview.get(key(row));
    let group,reason,sourceFiles;
    if(previous) {
      group=review?.group??'OTP-outer';reason=previous.reasons[0];
      sourceFiles=review?.sourceFiles??['src/components/forms/FieldRow.tsx','src/extensions/widgets.ts','src/components/forms/widgets/OtpAuthField.tsx','src/stores/schemaStore.ts'];
      assert.deepEqual(row.locations.map(b=>b.edition).sort(),previous.locations.map(b=>b.edition).sort(),row.slot);
      for(const b of row.locations) {
        const schema=inputs.pins.find(p=>p.schemaHash===b.schemaHash).data;
        const old=original.pins.find(p=>p.edition===b.edition).data;
        if(group==='E0')noEnumConsumer(schema,owner);
        else if(group==='S0')embeddedOnly(schema,owner);
        else {
          // All surrounding contracts for the remaining 25 historical slots
          // are identical, not merely the displayed English string.
          for(const section of ['objects','schemas','fields','forms','lists'])
            assert.deepEqual(schema[section][owner],old[section][owner],section+'/'+owner);
        }
        if(group==='N8') {
          const prefix=inputs.resolver.resolveObject(schema,owner).permissionPrefix;
          assert.deepEqual(schema.enums.Permission.filter(e=>e.name.startsWith(prefix)),old.enums.Permission.filter(e=>e.name.startsWith(prefix)));
        }
      }
    } else {
      sourceFiles=['src/extensions/pages.ts','src/extensions/widgets.ts','src/stores/schemaStore.ts','src/hooks/useGlobalSearch.ts'];
      if(kind==='enum') {
        group='new-unused-enum';reason='Нет enumName-ссылки в обеих схемах и литерала семейства enum в текущих исходниках; VariantSelect использует отдельные variant slots.';
        for(const b of row.locations)noEnumConsumer(inputs.pins.find(p=>p.schemaHash===b.schemaHash).data,owner);
      } else if(row.category==='form-section') {
        group='new-embedded-section';reason='Вложенная форма: заголовки секций не выводятся embeddedEntries; прямой маршрут и доступный результат поиска не разрешаются.';
        for(const b of row.locations)embeddedOnly(inputs.pins.find(p=>p.schemaHash===b.schemaHash).data,owner);
        sourceFiles.push('src/lib/embeddedSchema.ts','src/components/values/FieldValue.tsx');
      } else if(row.slot==='form/x:FoundationDbCluster/field/@type') {
        group='new-parent-variant';reason='Вложенный VariantSelect выводит подписи variants и внешнего поля; внутренняя подпись @type не используется.';
        for(const b of row.locations) {
          const s=inputs.pins.find(p=>p.schemaHash===b.schemaHash).data;embeddedOnly(s,owner);assert.equal(s.schemas[owner].type,'multiple');
        }
        sourceFiles.push('src/components/forms/VariantSelect.tsx','src/components/forms/widgets/EmbeddedObjectWidget.tsx');
      } else if(owner==='x:WorkingHoursSlot') {
        group='new-weekly-widget';reason='WeeklyScheduleWidget/Value используют клиентские подписи и исходные дни/время; внутренние form/field метаданные не выводятся.';
        assert.ok(inputs.widgets.some(w=>w.match.listObjectName===owner&&w.key==='objectList:x:WorkingHoursSlot'));
        sourceFiles.push('src/components/forms/widgets/WeeklyScheduleWidget.tsx','src/components/values/WeeklyScheduleValue.tsx');
      } else if(['x:MailRuleActions','x:MailRuleConditions'].includes(owner)||kind==='field'&&owner==='x:MailRule'&&['actions','conditions'].includes(field)) {
        group='new-rule-builder';reason='RuleBuilder/ActionForm заменяют эти метаданные клиентскими t()-подписями; поиск учитывает только корневые подписи полей, не описания и вложенные формы.';
        sourceFiles.push('src/features/mailRules/components/RuleBuilder.tsx','src/features/mailRules/components/ActionForm.tsx','src/features/mailRules/components/MailRuleFormPage.tsx');
      } else if(kind==='field'&&owner.startsWith('x:MailRule')) {
        group='new-inline-description';reason='RuleItemList выводит встроенный контрол и локализованную метку/ARIA, без описания; detail использует RuleSummaryRow.';
        for(const b of row.locations)assert.ok(inputs.webuiRuInlineField(inputs.pins.find(p=>p.schemaHash===b.schemaHash).data.fields[owner].properties[field]),row.slot);
        sourceFiles.push('src/features/mailRules/components/RuleItemList.tsx','src/features/mailRules/components/RuleBuilder.tsx','src/features/mailRules/builder.ts');
      } else if(kind==='list'&&['x:MailRule','x:BlockedSender','x:SafeSender'].includes(owner)) {
        group='new-custom-list';reason='Специальная страница списка заменяет стандартные колонки/фильтр/множественное имя клиентскими подписями; используемые title/subtitle/address/singular учтены отдельно.';
        assert.ok(field==='plural'||owner==='x:MailRule'&&field==='column'||owner!=='x:MailRule'&&field==='filter',row.slot);
        sourceFiles.push('src/features/mailRules/components/MailRulesPage.tsx','src/features/mailRules/components/SenderListPage.tsx');
      } else assert.fail('Новое исключение без отдельного обоснования: '+row.slot);
      row.reasons=[reason];
    }
    rows.push({id:row.id,slot:row.slot,original:row.original,historical:!!previous,group,reason,
      bindings:row.locations,sourceSha256:Object.fromEntries(sourceFiles.map(p=>[p,digest(fs.readFileSync(p))])),
      evidence:'source + exact current schema; no browser/ACL/runtime proof; independent review pending'});
  }
  assert.deepEqual(rows.filter(r=>r.historical).map(key).sort(),prior.map(key).sort(),'Исторические исключения требуют нового решения');
  assert.equal(rows.filter(r=>!r.historical).length,104);
  return {stage:49,historical:640,new:104,total:744,groups:Object.fromEntries([...new Set(rows.map(r=>r.group))].sort().map(g=>[g,rows.filter(r=>r.group===g).length])),rows};
}
