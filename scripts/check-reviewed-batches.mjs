#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadInputs,sourceModule,digest} from './lib/locale-source.mjs';
import {buildUsageGraph} from './lib/locale-graph.mjs';
import {loadReviewedBatches,undoBatch,verifyReviewedBatch,batchTextSafe} from './lib/locale-reviewed-batch.mjs';
import {loadFieldDescriptionPacket,undoFieldDescriptions} from './lib/locale-field-descriptions.mjs';
import {loadFormContextPacket,undoFormContext} from './lib/locale-form-context.mjs';
import {loadVariantPacket,undoVariants} from './lib/locale-variant-labels.mjs';
import {loadTracePacket,undoTrace} from './lib/locale-trace-labels.mjs';
import {loadRegionalPacket,undoRegional} from './lib/locale-regional-labels.mjs';
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

const stage26=packets.find(p=>p.stage===26);
if(stage26){
  assert.equal(stage26.entries.length,378);
  assert.equal(new Set(stage26.entries.map(e=>e.original)).size,322);
  assert.equal(stage26.baseline,'f72042f33ead091872637425f44bbe3b670fed0f');
  assert.deepEqual(stage26.scope,[{"section":"Settings","screens":["x:MtaConnectionStrategy","x:MtaDeliverySchedule","x:MtaExtensions","x:MtaHook","x:MtaInboundSession","x:MtaInboundThrottle","x:MtaMilter","x:MtaOutboundStrategy","x:MtaOutboundThrottle","x:MtaQueueQuota","x:MtaRoute","x:MtaStageAuth","x:MtaStageConnect","x:MtaStageData","x:MtaStageEhlo","x:MtaStageMail","x:MtaStageRcpt","x:MtaSts","x:MtaTlsStrategy","x:MtaVirtualQueue"]},{"section":"Management","screens":["x:QueuedMessage"]}]);
  assert.equal(digest(stage26.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'4b582430caf12f0ccff103f5317d974b3ea2d84710e1c5a284aad91d31fceb12');
}
assert.equal(batchTextSafe('SASL PLAIN LOGIN OAUTHBEARER XOAUTH2 only with TLS','Механизмы SASL PLAIN LOGIN OAUTHBEARER XOAUTH2 только с TLS',26),true);
assert.equal(batchTextSafe('SASL PLAIN LOGIN OAUTHBEARER XOAUTH2 only with TLS','Механизмы SASL PLAIN LOGIN OAUTHBEARER только с TLS',26),false);
assert.equal(batchTextSafe('Temporary SMTP failure 4xx','Временный отказ SMTP 4xx',26),true);
assert.equal(batchTextSafe('Temporary SMTP failure 4xx','Временный отказ SMTP 5xx',26),false);
assert.equal(batchTextSafe('Add Received-SPF and Return-Path','Добавить Received-SPF и Return-Path',26),true);
assert.equal(batchTextSafe('Add Received-SPF and Return-Path','Добавить Received и Return-Path',26),false);
assert.equal(batchTextSafe('MT-PRIORITY (RFC 6710) mixer stanag4406 nsep or false','MT-PRIORITY (RFC 6710) mixer stanag4406 nsep или false',26),true);
assert.equal(batchTextSafe('MT-PRIORITY (RFC 6710) mixer stanag4406 nsep or false','MT-PRIORITY (RFC 6710) mixer stanag4406 test или false',26),false);
assert.equal(batchTextSafe('PIPELINING CHUNKING REQUIRETLS EXPN/VRFY FUTURERELEASE DELIVERBY','Расширения PIPELINING CHUNKING REQUIRETLS EXPN/VRFY FUTURERELEASE DELIVERBY',26),true);
assert.equal(batchTextSafe('PIPELINING CHUNKING REQUIRETLS EXPN/VRFY FUTURERELEASE DELIVERBY','Расширения PIPELINING CHUNKING TLS EXPN/VRFY FUTURERELEASE DELIVERBY',26),false);

const stage27=packets.find(p=>p.stage===27);
if(stage27){
  assert.equal(stage27.entries.length,389);
  assert.equal(new Set(stage27.entries.map(e=>e.original)).size,334);
  assert.equal(stage27.baseline,'9835d17fa27f6e8f44096c0a3e39b668ed7ee640');
  assert.deepEqual(stage27.scope,[{"section":"Account","screens":["SieveScript","x:SpamTrainingSample"]},{"section":"Settings","screens":["x:MemoryLookupKey/SpamBlockedDomain","x:MemoryLookupKey/SpamTrap","x:MemoryLookupKey/SpamTrustedDomain","x:MemoryLookupKey/SpamUrlRedirector","x:SieveSystemInterpreter","x:SieveSystemScript","x:SieveUserInterpreter","x:SieveUserScript","x:SpamAi","x:SpamClassifier","x:SpamDnsblServer","x:SpamDnsblSettings","x:SpamFileExtension","x:SpamPyzor","x:SpamRule","x:SpamSettings","x:SpamTag"]}]);
  assert.equal(digest(stage27.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'313c1e12f00452d5c3a8d2eb6667e29949627ab27c490ec0dbd369ecc1a99cc2');
}
assert.equal(batchTextSafe('131k','131k параметров',27),true);
assert.equal(batchTextSafe('131k','131M параметров',27),false);
assert.equal(batchTextSafe('The number of parameters (2^n)','Число параметров (2^n)',27),true);
assert.equal(batchTextSafe('The number of parameters (2^n)','Число параметров (2^m)',27),false);
assert.equal(batchTextSafe('FTRL-Proximal + Cuckoo Feature Hashing','FTRL-Proximal + хеширование признаков Cuckoo',27),true);
assert.equal(batchTextSafe('FTRL-Proximal + Cuckoo Feature Hashing','FTRL-Proximal + хеширование признаков',27),false);
assert.equal(batchTextSafe('List of allowed URIs for the notify extension','Список разрешённых URI для расширения notify',27),true);
assert.equal(batchTextSafe('List of allowed URIs for the notify extension','Список разрешённых URI для расширения include',27),false);
assert.equal(batchTextSafe('Default expiration time for IDs stored by the duplicate extension from user scripts','Срок хранения идентификаторов расширения duplicate',27),true);
assert.equal(batchTextSafe('Default expiration time for IDs stored by the duplicate extension from user scripts','Срок хранения идентификаторов расширения vacation',27),false);
assert.equal(batchTextSafe('DNSBl Servers','Серверы DNSBL',27),true);
assert.equal(batchTextSafe('DNSBl Servers','Серверы DNS',27),false);
assert.equal(batchTextSafe('DNSBl Servers','Серверы DNSBL',26),false);
assert.equal(batchTextSafe('Discard messages with a score at or above this threshold. Set to 0 or below to disable; rejection takes precedence','Удалять без уведомления сообщения с баллом, равным этому порогу или превышающим его. Установите 0 или меньше, чтобы отключить; отклонение имеет приоритет',27),true);
assert.equal(batchTextSafe('Discard messages with a score at or above this threshold. Set to 0 or below to disable; rejection takes precedence','Удалять сообщения. Установите 1 или меньше',27),false);
assert.equal(batchTextSafe('DNSBL tags named with the `RBL_` prefix and scoring above 1.0','Метки DNSBL с префиксом `RBL_` и баллом выше 1.0',27),true);
assert.equal(batchTextSafe('DNSBL tags named with the `RBL_` prefix and scoring above 1.0','Метки DNSBL с префиксом `OTHER_` и баллом выше 1.0',27),false);


const stage28=packets.find(p=>p.stage===28);
if(stage28){
  assert.equal(stage28.entries.length,195);
  assert.equal(new Set(stage28.entries.map(e=>e.original)).size,152);
  assert.equal(stage28.baseline,'caade105c28386f2e15493cf2e5bdc47ec86f256');
  assert.deepEqual(stage28.scope,[{"section":"Settings","screens":["x:AllowedIp","x:BlockedIp","x:DnsResolver","x:DnsServer","x:NetworkListener","x:SystemSettings/NetworkServices","x:SystemSettings/NetworkSettings"]}]);
  assert.equal(digest(stage28.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'f10513a37ef694a95cb96b4a9494be8b80e2f6f37030a77c4abc2022eb0b98e9');
}
assert.equal(batchTextSafe('DNS over TLS','Запросы DNS через TLS',28),true);
assert.equal(batchTextSafe('DNS over TLS','Запросы DNS через TCP',28),false);
assert.equal(batchTextSafe('HMAC-SHA256-128','Алгоритм HMAC-SHA256-128',28),true);
assert.equal(batchTextSafe('HMAC-SHA256-128','Алгоритм HMAC-SHA256-256',28),false);
assert.equal(batchTextSafe('HMAC-SHA1','Алгоритм HMAC-SHA224',28),false);
assert.equal(batchTextSafe('EDNS (Extension Mechanisms for DNS)','EDNS (механизмы расширения DNS)',28),true);
assert.equal(batchTextSafe('EDNS (Extension Mechanisms for DNS)','Механизмы расширения DNS',28),false);
assert.equal(batchTextSafe('Try TCP on UDP error','Пробовать TCP при ошибке UDP',28),true);
assert.equal(batchTextSafe('Try TCP on UDP error','Пробовать TCP при ошибке TCP',28),false);
assert.equal(batchTextSafe('TOS and TTL','Значения TOS и TTL',28),true);
assert.equal(batchTextSafe('TOS and TTL','Значение TTL',28),false);
assert.equal(batchTextSafe('0 or 1','0 или 1',28),true);
assert.equal(batchTextSafe('0 or 1','1 или 2',28),false);


const stage29=packets.find(p=>p.stage===29);
if(stage29){
  assert.equal(stage29.entries.length,837);
  assert.equal(new Set(stage29.entries.map(e=>e.original)).size,772);
  assert.equal(stage29.baseline,'6c1add8bf09005a6a8114ca85a45b4178f37f78b');
  assert.deepEqual(stage29.scope,[{"section":"Account","screens":["x:AccountPassword","x:AccountSettings","x:ApiKey","x:AppPassword","x:MaskedEmail","x:OAuthGrant","x:Passkey"]},{"section":"Management","screens":["x:Account/Group","x:Account/User","x:Domain","x:OAuthClient","x:Role","x:Tenant"]},{"section":"Settings","screens":["x:Directory"]}]);
  assert.equal(digest(stage29.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'866e418be490b65de1279609c492ee5f4c85231e381e755e18f6793867d5ce56');
  const permissionRows=stage29.entries.filter(e=>e.slot.startsWith('enum/Permission/'));
  assert.equal(permissionRows.length,667);
  assert.deepEqual(Object.fromEntries(permissionRows.map(e=>[e.slot.split('/')[2],{original:e.original,ru:e.ru}])),inputs.permissionCatalog.entries);
  assert.equal(stage29.entries.filter(e=>/^enum\/(?:Tenant)?StorageQuota\//.test(e.slot)).length,31);
}
assert.equal(batchTextSafe('OTP authentication','Аутентификация OTP',29),true);
assert.equal(batchTextSafe('OTP authentication','Аутентификация',29),false);
assert.equal(batchTextSafe('IP or CIDR','IP или CIDR',29),true);
assert.equal(batchTextSafe('IP or CIDR','IP',29),false);
assert.equal(batchTextSafe('HTTP Basic (client_secret_basic)','Аутентификация HTTP Basic (client_secret_basic)',29),true);
assert.equal(batchTextSafe('HTTP Basic (client_secret_basic)','Аутентификация HTTP Basic (client_secret_post)',29),false);
assert.equal(batchTextSafe('DKIM2 (ML-DSA-44)','Подпись DKIM2 (ML-DSA-44)',29),true);
assert.equal(batchTextSafe('DKIM2 (ML-DSA-44)','Подпись DKIM2 (ML-DSA-65)',29),false);
assert.equal(batchTextSafe('MUST be <= 64 characters a-z, 0-9 and _','Допустимо <= 64 символов a-z, 0-9 и _',29),true);
assert.equal(batchTextSafe('MUST be <= 64 characters a-z, 0-9 and _','Допустимо <= 64 символов A-Z, 0-9 и _',29),false);
assert.equal(batchTextSafe('Date the authorization was granted','Дата предоставления авторизации',29),true);
assert.equal(batchTextSafe('Date the authorization was granted','Дата предоставления авторизации',28),false);
assert.equal(batchTextSafe('Date header','Заголовок',29),false);


const stage30=packets.find(p=>p.stage===30);
if(stage30){
  assert.equal(stage30.entries.length,240);
  assert.equal(new Set(stage30.entries.map(e=>e.original)).size,159);
  assert.equal(stage30.baseline,'deb4fe202d44155939401657dbe6061f39d4e7e8');
  assert.deepEqual(stage30.scope,[{"section":"Settings","screens":["x:BlobStore","x:Cache","x:Coordinator","x:DataStore","x:Directory","x:InMemoryStore","x:MetricsStore","x:SearchStore","x:StoreLookup","x:TracingStore"]}]);
  assert.equal(digest(stage30.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'230040c04638ddb9d9e940529fabda448932b061b3409300ddd120fd3a1d13c7');
}
assert.equal(batchTextSafe('RESP2','Протокол RESP2',30),true);
assert.equal(batchTextSafe('RESP2','Протокол RESP3',30),false);
assert.equal(batchTextSafe('host:port Kafka','Адрес host:port Kafka',30),true);
assert.equal(batchTextSafe('host:port Kafka','Адрес host Kafka',30),false);
assert.equal(batchTextSafe('MySQL wait_timeout','Параметр MySQL wait_timeout',30),true);
assert.equal(batchTextSafe('MySQL wait_timeout','Параметр MySQL connect_timeout',30),false);
assert.equal(batchTextSafe('PEM or DER','PEM или DER',30),true);
assert.equal(batchTextSafe('PEM or DER','PEM или PEM',30),false);
assert.equal(batchTextSafe('SQLite stalwart.db','Файл SQLite stalwart.db',30),true);
assert.equal(batchTextSafe('SQLite stalwart.db','Файл SQLite data.db',30),false);
assert.equal(batchTextSafe('32 hexadecimal digits without TLS','32 шестнадцатеричные цифры без TLS',30),true);
assert.equal(batchTextSafe('32 hexadecimal digits without TLS','64 шестнадцатеричные цифры без TLS',30),false);
assert.equal(batchTextSafe('Stalwart Keep or Redis','Stalwart Keep или Redis',30),true);
assert.equal(batchTextSafe('Stalwart Keep or Redis','Stalwart или Redis',30),false);


const stage31=packets.find(p=>p.stage===31);
if(stage31){
  assert.equal(stage31.entries.length,154);
  assert.equal(new Set(stage31.entries.map(e=>e.original)).size,147);
  assert.equal(stage31.baseline,'9c5643d7ec28d9b82b3b7a9f8ae18148a1e943f3');
  assert.deepEqual(stage31.scope,[{"section":"Settings","screens":["x:Email/EmailDefaults","x:Email/EmailLimits","x:Email/EmailStorage","x:Http","x:Http/HttpSecurity","x:HttpForm","x:Imap","x:Jmap/JmapLimits","x:Jmap/JmapPush","x:Jmap/JmapWebsocket"]}]);
  assert.equal(digest(stage31.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'986f6fe24e37e08dae5ee14fb7e12a7264f0cf4e0efb3579c20e2822f77dc4a7');
}
assert.equal(batchTextSafe('Forwarded header (RFC 7239)','Заголовок Forwarded (RFC 7239)',31),true);
assert.equal(batchTextSafe('Forwarded header (RFC 7239)','Заголовок X-Forwarded-For (RFC 7239)',31),false);
assert.equal(batchTextSafe('UIDBATCHES and TOOFEW, 500','UIDBATCHES и TOOFEW, 500',31),true);
assert.equal(batchTextSafe('UIDBATCHES and TOOFEW, 500','UIDBATCHES и TOOMANY, 500',31),false);
assert.equal(batchTextSafe('UIDBATCHES and TOOFEW, 500','UIDBATCHES и TOOFEW, 501',31),false);
assert.equal(batchTextSafe('COPY APPEND SAVELIMIT MESSAGELIMIT','COPY APPEND SAVELIMIT MESSAGELIMIT',31),true);
assert.equal(batchTextSafe('COPY APPEND SAVELIMIT MESSAGELIMIT','COPY APPEND MESSAGELIMIT MESSAGELIMIT',31),false);
assert.equal(batchTextSafe('Messages per Copy or Append','Сообщений на команду COPY или APPEND',31),true);
assert.equal(batchTextSafe('FETCH SEARCH STORE MOVE UID EXPUNGE','Команды FETCH SEARCH STORE MOVE UID EXPUNGE',31),true);
assert.equal(batchTextSafe('FETCH SEARCH STORE MOVE UID EXPUNGE','Команды FETCH SEARCH STORE MOVE EXPUNGE',31),false);
assert.equal(batchTextSafe('HSTS CORS VAPID Web Push','Настройки HSTS CORS VAPID Web Push',31),true);
assert.equal(batchTextSafe('HSTS CORS VAPID Web Push','Настройки HSTS VAPID Web Push',31),false);
assert.equal(batchTextSafe('HTTP 404 Not Found','Ответ HTTP 404 Not Found',31),true);
assert.equal(batchTextSafe('HTTP 404 Not Found','Ответ HTTP 404',31),false);


const stage32=packets.find(p=>p.stage===32);
if(stage32){
  assert.equal(stage32.entries.length,125);
  assert.equal(new Set(stage32.entries.map(e=>e.original)).size,95);
  assert.equal(stage32.baseline,'6491192ec301bb32f7ed500d18f3dd94f358945b');
  assert.deepEqual(stage32.scope,[{"section":"Settings","screens":["x:DataRetention/ArchivingRetention","x:DataRetention/DataCleanup","x:DataRetention/DataExpunge","x:DataRetention/TelemetryRetention","x:DkimReportSettings","x:DmarcReportSettings","x:DsnReportSettings","x:ReportSettings","x:SpfReportSettings","x:TlsReportSettings"]}]);
  assert.equal(digest(stage32.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'d217afc2a49834cb67ef772b374c3f63548309a5209dae678a2e3b9fbfb0075d');
}
assert.equal(batchTextSafe('From header of DKIM report','Заголовок From отчёта DKIM',32),true);
assert.equal(batchTextSafe('From header of DKIM report','Заголовок To отчёта DKIM',32),false);
assert.equal(batchTextSafe('SMTP TLS Reporting (TLSRPT)','Отчёты SMTP TLS (TLSRPT)',32),true);
assert.equal(batchTextSafe('SMTP TLS Reporting (TLSRPT)','Отчёты SMTP TLS',32),false);
assert.equal(batchTextSafe('iTIP inbox and JMAP share notifications','Входящие iTIP и уведомления JMAP',32),true);
assert.equal(batchTextSafe('iTIP inbox and JMAP share notifications','Входящие и уведомления JMAP',32),false);
assert.equal(batchTextSafe("Domain name used by default in the sender address and organization name of DSNs and outbound reports, available in expressions as `system('report_domain')`. If left empty, the default domain is used.","Доменное имя, используемое по умолчанию в адресе отправителя и названии организации в уведомлениях о состоянии доставки (DSN) и исходящих отчётах; доступно в выражениях как `system('report_domain')`. Если оставить поле пустым, используется домен по умолчанию.",32),true);
assert.equal(batchTextSafe("Domain name used by default in the sender address and organization name of DSNs and outbound reports, available in expressions as `system('report_domain')`. If left empty, the default domain is used.","Доменное имя, используемое по умолчанию в адресе отправителя и названии организации в уведомлениях о состоянии доставки (DSN) и исходящих отчётах; доступно в выражениях как `system('domain')`. Если оставить поле пустым, используется домен по умолчанию.",32),false);
assert.equal(batchTextSafe("Domain name used by default in the sender address and organization name of DSNs and outbound reports, available in expressions as `system('report_domain')`. If left empty, the default domain is used.","Доменное имя, используемое по умолчанию в адресе отправителя и названии организации в уведомлениях о состоянии доставки (DSN) и исходящих отчётах; доступно в выражениях как `system('report_domain')`. Если оставить поле пустым, используется домен по умолчанию.",31),false);
assert.equal(batchTextSafe('DSN reports','Отчёты',32),false);
assert.equal(batchTextSafe('Changes','История изменений (Changes)',32),true);
assert.equal(batchTextSafe('Changes','История изменений',32),false);

const stage33=packets.find(p=>p.stage===33);
if(stage33){
  assert.equal(stage33.entries.length,165);
  assert.equal(new Set(stage33.entries.map(e=>e.original)).size,143);
  assert.equal(stage33.baseline,'1b08d357de8402bba99ad3a2e782e914607ce0a8');
  assert.equal(stage33.baselineCatalogSha256,'e7c139ffad9250fa69e4c1048db0f06451e8c826459b3f1a61fd50a8494ba793');
  assert.deepEqual(stage33.scope,[{"section":"Settings","screens":["x:Application","x:Asn","x:ClusterRole","x:Enterprise","x:HttpLookup","x:MemoryLookupKey","x:MemoryLookupKey/SpamBlockedDomain","x:MemoryLookupKey/SpamTrap","x:MemoryLookupKey/SpamTrustedDomain","x:MemoryLookupKey/SpamUrlRedirector","x:MemoryLookupKeyValue","x:MtaHook","x:StoreLookup","x:WebHook"]}]);
  assert.equal(digest(stage33.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'2949a4cb583ac4138b029de8b0c293e6c8a8c492e1a770c065a19cef35f459da');
}
assert.equal(batchTextSafe('ASN and Geo data','Данные ASN и Geo',33),true);
assert.equal(batchTextSafe('ASN and Geo data','Данные ASN',33),false);
assert.equal(batchTextSafe('OIDC and OAuth Client ID Metadata Documents','OIDC и документы OAuth Client ID Metadata Documents',33),true);
assert.equal(batchTextSafe('OIDC and OAuth Client ID Metadata Documents','Документы OAuth Client ID Metadata Documents',33),false);
assert.equal(batchTextSafe('Unpack to /tmp','Распаковать в /tmp',33),true);
assert.equal(batchTextSafe('Unpack to /tmp','Распаковать в /temp',33),false);
assert.equal(batchTextSafe('/admin','Например, /admin',33),true);
assert.equal(batchTextSafe('/admin','Например, /administrator',33),false);
assert.equal(batchTextSafe('API key at https://license.stalw.art.','Ключ API: https://license.stalw.art.',33),true);
assert.equal(batchTextSafe('API key at https://license.stalw.art.','Ключ API: https://license.example.invalid.',33),false);
assert.equal(batchTextSafe('HMAC key','Ключ HMAC',33),true);
assert.equal(batchTextSafe('HMAC key','Ключ',33),false);
assert.equal(batchTextSafe('Glob Pattern','Шаблон glob',33),true);
assert.equal(batchTextSafe('Glob Pattern','Шаблон glob',32),false);
assert.equal(batchTextSafe('Glob Pattern','Шаблон',33),false);

const stage34=packets.find(p=>p.stage===34);
if(stage34){
  assert.equal(stage34.entries.length,138);
  assert.equal(new Set(stage34.entries.map(e=>e.original)).size,125);
  assert.equal(stage34.baseline,'95babb84c828a119b547e3ab4ad62f2e87fc3da2');
  assert.equal(stage34.baselineCatalogSha256,'04a0fe6cb4f3b4f0ef57734d4b500060374f1910babdacad11ecd8f644c327ba');
  assert.deepEqual(stage34.scope,[{"section":"Account","screens":["Mailbox","VacationResponse","x:AccountSettings","x:ArchivedItem","x:PublicKey"]},{"section":"Management","screens":["@navigation","x:Account/User","x:ClusterNode","x:DkimSignature","x:Log"]},{"section":"Settings","screens":["@navigation","x:AiModel","x:Asn","x:BlobStore","x:Cache","x:Certificate","x:Coordinator","x:DataStore","x:Directory","x:DnsServer","x:Email/EmailDefaults","x:Encryption/EncryptionDiscovery","x:Encryption/EncryptionGateway","x:Encryption/EncryptionStorage","x:Encryption/EncryptionTrust","x:Enterprise","x:ExternalPublicKey","x:HttpLookup","x:InMemoryStore","x:Jmap/JmapPush","x:Metrics","x:Metrics/CollectorOtel","x:Metrics/CollectorPrometheus","x:MetricsStore","x:MtaHook","x:MtaRoute","x:OidcProvider","x:SearchStore","x:SenderAuth","x:Sharing","x:StoreLookup","x:SymmetricKey","x:TaskManager","x:Tracer","x:TracingStore","x:WebHook"]}]);
  assert.equal(digest(stage34.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'1fe8696abba1cd78ab8c75d7d27a106d39d42996fc92156662d6029e27c8b4fe');
}
assert.equal(batchTextSafe('HKP keyservers','Серверы ключей HKP',34),true);
assert.equal(batchTextSafe('HKP keyservers','Серверы ключей',34),false);
assert.equal(batchTextSafe('Bearer token for HTTP Bearer Authentication','Токен Bearer для аутентификации HTTP Bearer',34),true);
assert.equal(batchTextSafe('Bearer token for HTTP Bearer Authentication','Токен для аутентификации HTTP Bearer',34),false);
assert.equal(batchTextSafe('Protected, Subject hidden','Защищены, тема скрыта',34),true);
assert.equal(batchTextSafe('Protected, Subject hidden','Защищены, тема видима',34),false);
assert.equal(batchTextSafe('Protected, Subject hidden','Защищены, тема (Subject) скрыта',34),true);
assert.equal(batchTextSafe('Subject hidden','Тема скрыта',34),false);
assert.equal(batchTextSafe('SPF MAIL FROM and EHLO','SPF MAIL FROM и EHLO',34),true);
assert.equal(batchTextSafe('SPF MAIL FROM and EHLO','SPF MAIL FROM и HELO',34),false);
assert.equal(batchTextSafe('OpenPGP and S/MIME','OpenPGP и S/MIME',34),true);
assert.equal(batchTextSafe('OpenPGP and S/MIME','OpenPGP',34),false);

const stage35=packets.find(p=>p.stage===35);
if(stage35){
  assert.equal(stage35.entries.length,61);
  assert.equal(new Set(stage35.entries.map(e=>e.original)).size,13);
  assert.equal(new Set(stage35.entries.map(e=>e.review.groupId)).size,43);
  assert.equal(stage35.baseline,'af554d4bb3f3bf8b5c9cc1365ab82553fd5e8e72');
  assert.equal(stage35.baselineCatalogSha256,'03ca6f4bb8ec0f50ed82d095bbcee2117ceaf8ce8b6eb23713ee44115cf80b65');
  assert.deepEqual(stage35.scope,[{"section":"Account","screens":["x:AccountSettings","x:MaskedEmail","x:SpamTrainingSample"]},{"section":"Management","screens":["x:Account/User","x:Task","x:Task/TaskFailed"]},{"section":"Settings","screens":["x:Alert","x:Application","x:Asn","x:BlobStore","x:Cache","x:Coordinator","x:Directory","x:DkimReportSettings","x:DmarcReportSettings","x:DsnReportSettings","x:Email/EmailStorage","x:Encryption/EncryptionGateway","x:EventTracingLevel","x:FileStorage","x:InMemoryStore","x:Metrics/CollectorOtel","x:Metrics/CollectorPrometheus","x:MtaHook","x:MtaInboundThrottle","x:MtaMilter","x:MtaOutboundThrottle","x:MtaQueueQuota","x:MtaSts","x:MtaTlsStrategy","x:Search","x:SearchStore","x:SenderAuth","x:SmimeTrustAnchor","x:SpamAi","x:SpamClassifier","x:SpamDnsblServer","x:SpamRule","x:SpamSettings","x:SpfReportSettings","x:StoreLookup","x:TlsReportSettings","x:WebHook"]}]);
  assert.equal(digest(stage35.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),'ab1020f1f82d1932ec47866bcdd29d7da7fdee8827a6405f3e93d66428aabc5f');
}
assert.equal(batchTextSafe('From Address','Адрес отправителя (From)',35),true);
assert.equal(batchTextSafe('From Address','Адрес отправителя',35),false);
assert.equal(batchTextSafe('Subject','Тема письма (Subject)',35),true);
assert.equal(batchTextSafe('Subject','Тема письма',35),false);
assert.equal(batchTextSafe('Whether to allow invalid SSL certificates','Разрешать ли использование недействительных сертификатов SSL',35),true);
assert.equal(batchTextSafe('Whether to allow invalid SSL certificates','Разрешать ли использование недействительных сертификатов',35),false);
assert.equal(batchTextSafe('RCPT TO','Команда RCPT TO',35),true);
assert.equal(batchTextSafe('RCPT TO','Команда MAIL FROM',35),false);

const raw=fs.readFileSync(path.join(root,'src/i18n/schemaText.ts'),'utf8');
const makeSchema=catalog=>sourceModule(raw,'schemaText.ts',{'./schema/ru.json':catalog});
let after=undoFieldDescriptions(undoFormContext(undoVariants(undoTrace(undoRegional(inputs.catalog,loadRegionalPacket(root,inputs.policy)),loadTracePacket(root,inputs.policy)),loadVariantPacket(root,inputs.policy)),loadFormContextPacket(root,inputs.policy)),loadFieldDescriptionPacket(root,inputs.policy));
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
