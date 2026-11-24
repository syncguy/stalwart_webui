#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadInputs,sourceModule,digest} from './lib/locale-source.mjs';
import {buildUsageGraph} from './lib/locale-graph.mjs';
import {loadReviewedBatches,undoBatch,verifyReviewedBatch,batchTextSafe} from './lib/locale-reviewed-batch.mjs';
import './lib/offline-guard.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inputs=loadInputs(root),graph=buildUsageGraph(inputs);
const packets=loadReviewedBatches(root,inputs.policy);
assert.ok(packets.length);
assert.equal(packets[0].stage,19);
assert.equal(packets[0].entries.length,146);
assert.equal(packets[0].baseline,'b727b90b766a669964e891d814e1e31ce4039b24');
assert.deepEqual(packets[0].scope,[{section:'Account',screens:['Mailbox','Calendar','AddressBook']},{section:'Settings',screens:['x:CalendarScheduling','x:CalendarAlarm','x:WebDav']}]);
const stage20=packets.find(p=>p.stage===20);
if(stage20){
  assert.equal(stage20.entries.length,341);
  assert.equal(stage20.baseline,'1797163a2db3c6d6bdc34f9c375fbfed6a496ab3');
  assert.deepEqual(stage20.scope,[{section:'Management',screens:['x:ArfExternalReport','x:DmarcExternalReport','x:DmarcInternalReport','x:QueuedMessage','x:TlsExternalReport','x:TlsInternalReport']}]);
}
assert.equal(batchTextSafe('SMTP enhanced status code "4.7.1" (RFC 6710)','Код SMTP "4.7.1" (RFC 6710)',20),true);
assert.equal(batchTextSafe('SMTP enhanced status code "4.7.1" (RFC 6710)','Код SMTP "5.7.1" (RFC 6710)',20),false);
assert.equal(batchTextSafe('MAIL FROM and RCPT TO','MAIL FROM и RCPT TO',20),true);
assert.equal(batchTextSafe('MAIL FROM and RCPT TO','MAIL FROM и MAIL FROM',20),false);
assert.equal(batchTextSafe('MTA-STS policy','Политика TLS',20),false);
assert.equal(batchTextSafe('DNS Tree Walk method (RFC 9989)','Метод обхода дерева DNS (RFC 7489)',20),false);
const stage21=packets.find(p=>p.stage===21);
if(stage21){
  assert.equal(stage21.entries.length,191);
  assert.equal(stage21.baseline,'3458a218495be7b7757966b86ce3481a49feb5c0');
  assert.deepEqual(stage21.scope,[{section:'Management',screens:['x:Action','x:Task','x:Task/TaskFailed','x:IndexQueueStatus','x:DmarcExternalReport','x:DmarcInternalReport']}]);
}
assert.equal(batchTextSafe('DKIM2 and ARC','DKIM2 и ARC',21),true);
assert.equal(batchTextSafe('DKIM2 and ARC','DKIM и ARC',21),false);
assert.equal(batchTextSafe('MAIL FROM:<>','Пустой MAIL FROM:<>',21),true);
assert.equal(batchTextSafe('MAIL FROM:<>','Пустой MAIL FROM',21),false);
assert.equal(batchTextSafe('X-Spam-AI header "run"','Заголовок X-Spam-AI "run"',21),true);
assert.equal(batchTextSafe('X-Spam-AI header "run"','Заголовок X-Spam-AI "start"',21),false);
const stage22=packets.find(p=>p.stage===22);
if(stage22){
  assert.equal(stage22.entries.length,194);
  assert.equal(stage22.baseline,'0329795476291873dafd373178b982b8ba974cd4');
  assert.deepEqual(stage22.scope,[{section:'Settings',screens:['x:AiModel','x:SpamAi','x:HttpLookup','x:OidcProvider']}]);
}
assert.equal(batchTextSafe('AI_<CATEGORY>_HIGH','Метка AI_<CATEGORY>_HIGH',22),true);
assert.equal(batchTextSafe('AI_<CATEGORY>_HIGH','Метка AI_<CATEGORY>_LOW',22),false);
assert.equal(batchTextSafe('RSASSA-PSS using SHA-256 and MGF1 with SHA-256','RSASSA-PSS с SHA-256 и MGF1 с SHA-384',22),false);
assert.equal(batchTextSafe('OAuth clients require at least 10 minutes','Клиентам OAuth требуется не менее 10 минут',22),true);
assert.equal(batchTextSafe('OAuth clients require at least 10 minutes','Клиентам OAuth требуется не менее 1 минуты',22),false);
assert.equal(batchTextSafe('HTTPS URL','HTTP URL',22),false);
const stage23=packets.find(p=>p.stage===23);
if(stage23){
  assert.equal(stage23.entries.length,282);
  assert.equal(stage23.baseline,'9c6736e5b12ef1642f92444e56ca1bb2b42657a7');
  assert.deepEqual(stage23.scope,[{"section":"Settings","screens":["x:ExternalPublicKey","x:ExternalPublicKey/PendingExternalPublicKey","x:AcmeProvider","x:Certificate","x:SymmetricKey","x:SmimeTrustAnchor","x:Authentication","x:Security"]},{"section":"Account","screens":["x:PublicKey"]},{"section":"Management","screens":["x:DkimSignature"]}]);
}
assert.equal(batchTextSafe('DNS-PERSIST-01','Проверка DNS-PERSIST-01',23),true);
assert.equal(batchTextSafe('DNS-PERSIST-01','Проверка DNS-01',23),false);
assert.equal(batchTextSafe('AES-GCM with RSA-OAEP','AES-GCM с RSA-OAEP',23),true);
assert.equal(batchTextSafe('AES-GCM with RSA-OAEP','AES-GCM с RSA',23),false);
assert.equal(batchTextSafe('guesses >= 10^10','число попыток < 10^10',23),false);
assert.equal(batchTextSafe('1/2 of remaining time','2/3 оставшегося срока',23),false);

const stage24=packets.find(p=>p.stage===24);
if(stage24){
  assert.equal(stage24.entries.length,527);
  assert.equal(stage24.entries.filter(e=>e.slot.startsWith('enum/MetricType/')).length,399);
  assert.equal(stage24.baseline,'1729dd9b9852d0bcd12658f78ea714310e7f3834');
  assert.deepEqual(stage24.scope,[{section:'Settings',screens:['x:Alert','x:DataRetention/TelemetryRetention','x:EventTracingLevel','x:Metrics','x:Metrics/CollectorOtel','x:Metrics/CollectorPrometheus','x:MetricsStore','x:Tracer','x:TracingStore']},{section:'Management',screens:['x:Log']}]);
  assert.equal(digest(stage24.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'c3aaf42958e26db1bf0e6ae77452a8dff37cd076fe06bdabe6d440a6c0361423');
}
assert.equal(batchTextSafe('OpenTelemetry URL localhost port 4317 /v1/metrics','URL OpenTelemetry на localhost, порт 4317, путь /v1/metrics',24),true);
assert.equal(batchTextSafe('OpenTelemetry URL localhost port 4317 /v1/metrics','URL OpenTelemetry на localhost, порт 4318, путь /v1/metrics',24),false);
assert.equal(batchTextSafe('OpenTelemetry URL /v1/metrics','URL OpenTelemetry /v1/traces',24),false);
assert.equal(batchTextSafe('Prometheus interval 100 ms','Интервал Prometheus 100 ms',24),true);
assert.equal(batchTextSafe('Prometheus interval 100 ms','Интервал Prometheus 100 s',24),false);
assert.equal(batchTextSafe("Value of 'metric_name' is %{metric_name}%","Значение 'metric_name': %{metric_name}%",24),true);
assert.equal(batchTextSafe("Value of 'metric_name' is %{metric_name}%","Значение 'metric_name': %{other_metric}%",24),false);
assert.equal(batchTextSafe('Active JMAP WebSocket connections','Активные соединения JMAP HTTP',24),false);
assert.equal(batchTextSafe('Protocol gRPC','Протокол HTTP',24),false);


const stage25=packets.find(p=>p.stage===25);
if(stage25){
  assert.equal(stage25.entries.length,489);
  assert.equal(new Set(stage25.entries.map(e=>e.original)).size,396);
  assert.equal(stage25.baseline,'331603bd35ef1c6aa2d8168c634b6b01723f7440');
  assert.deepEqual(stage25.scope,[{section:'Settings',screens:['x:BlobStore','x:Cache','x:DataStore','x:SearchStore','x:MetricsStore','x:TracingStore','x:InMemoryStore','x:StoreLookup','x:Search','x:Metadata','x:FileStorage','x:Email/EmailStorage']}]);
  assert.equal(digest(stage25.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'98ac83ae01de514bda0d945c7f328ebba9b3601da98af3f61b5a625cc66d98ca');
}
assert.equal(batchTextSafe('Region eu-west-1','Регион eu-west-1',25),true);
assert.equal(batchTextSafe('Region eu-west-1','Регион eu-east-1',25),false);
assert.equal(batchTextSafe('AZURE_CLIENT_ID and AZURE_TENANT_ID','Переменные AZURE_CLIENT_ID и AZURE_TENANT_ID',25),true);
assert.equal(batchTextSafe('AZURE_CLIENT_ID','Переменная AZURE_TENANT_ID',25),false);
assert.equal(batchTextSafe('JMAP metadata and privateMetadata','Свойства JMAP metadata и privateMetadata',25),true);
assert.equal(batchTextSafe('JMAP metadata and privateMetadata','Свойства JMAP метаданные и privateMetadata',25),false);
assert.equal(batchTextSafe('IMAP /shared/admin','Аннотация IMAP /shared/comment',25),false);
assert.equal(batchTextSafe('x-amz-security-token','Заголовок x-amz-security-token',25),true);
assert.equal(batchTextSafe('x-amz-security-token','Заголовок x-amz-token',25),false);
assert.equal(batchTextSafe('one eighth between 256 MiB and 8 GiB','одна восьмая, от 256 MiB до 8 GiB',25),true);
assert.equal(batchTextSafe('one eighth between 256 MiB and 8 GiB','четверть, от 256 MiB до 8 GiB',25),false);
assert.equal(batchTextSafe('one eighth between 256 MiB and 8 GiB','одна восьмая, от 256 GiB до 8 GiB',25),false);
assert.equal(batchTextSafe('one sixteenth of the messages','одна шестнадцатая числа сообщений',25),true);
assert.equal(batchTextSafe('one sixteenth of the messages','одна восьмая числа сообщений',25),false);

const raw=fs.readFileSync(path.join(root,'src/i18n/schemaText.ts'),'utf8');
const makeSchema=catalog=>sourceModule(raw,'schemaText.ts',{'./schema/ru.json':catalog});
let after=inputs.catalog;
for(const packet of [...packets].reverse()){
  const before=undoBatch(after,packet);
  const result=verifyReviewedBatch({packet,before,after,inputs,graph,makeSchema});
  console.log('PASS: reviewed stage '+packet.stage+'; exact eligible slots '+result.eligible+'; translated '+result.before.classification.translated+' -> '+result.after.classification.translated);
  const mutate=fn=>{const p=structuredClone(packet);fn(p);assert.throws(()=>undoBatch(after,p));};
  mutate(p=>{p.apply=true;});
  mutate(p=>{p.entries.push(p.entries[0]);});
  mutate(p=>{p.entries.pop();});
  mutate(p=>{p.entries[0].original+=' changed';});
  mutate(p=>{p.entries[0].ru+=' {{unexpected}}';});
  const tampered=structuredClone(after);
  const oldKey=Object.keys(before.entries)[0];
  tampered.entries[oldKey].ru+=' changed';
  assert.throws(()=>undoBatch(tampered,packet));
  after=before;
}
assert.equal(Object.keys(after.entries).length,2084);
assert.equal(batchTextSafe('IMAP ACL "lr" $seen /api/calendar/rsvp shareWith','IMAP ACL "l" $seen /api/calendar/rsvp shareWith'),false);
assert.equal(batchTextSafe('IMAP ACL "lr" $seen /api/calendar/rsvp shareWith','IMAP ACL "lr" $draft /api/calendar/rsvp shareWith'),false);
assert.equal(batchTextSafe('IMAP ACL "lr" $seen /api/calendar/rsvp shareWith','IMAP ACL "lr" $seen /api/calendar/rsvp shareWith'),true);
console.log('PASS: immutable baseline chain, exact source and scope, protocol markers, negative packet mutations; no automatic catalog writes.');
