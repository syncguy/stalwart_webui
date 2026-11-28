// Version/edition-bound extension. The historical 1.1.1 catalogue stays immutable.
import * as historical from './schemaText';
import catalog from './schema/webuiRu-1.2.json';
import permissions from './schema/webuiRu-permission-1.2.json';

type Entry = { original: string; ru: string; hashes: string[] };
const additions: Record<string, Entry> = { ...catalog.entries, ...permissions.entries };
const baseHashes: Record<string, string> = catalog.meta.baseHashes;
const removed = new Set<string>(catalog.meta.removedSlots);

export function canTranslateSchema(hash: string | null, language: string): boolean {
  return (
    historical.canTranslateSchema(hash, language) ||
    (language.split(/[-_]/)[0].toLowerCase() === 'ru' && !!hash && Object.hasOwn(baseHashes, hash))
  );
}

export function stage49SchemaText(hash: string | null, language: string, slot: string, original: string): string {
  if (!hash || !Object.hasOwn(baseHashes, hash)) return historical.schemaText(hash, language, slot, original);
  if (!canTranslateSchema(hash, language) || removed.has(slot)) return original;
  const entry = additions[slot];
  if (entry) return entry.original === original && entry.hashes.includes(hash) ? entry.ru : original;
  // Reuse only source-reviewed unchanged pairs. Scoped historical entries use
  // the corresponding edition; changed originals are intercepted above.
  return historical.schemaText(baseHashes[hash], language, slot, original);
}

const actionForms: Readonly<Record<string, string>> = {
  'list/x:Account/Resource/singular': 'ресурс',
  'list/x:BlockedSender/singular': 'заблокированного отправителя',
  'list/x:SafeSender/singular': 'доверенного отправителя',
  'list/x:MailRule/singular': 'почтовое правило',
};

export function stage49SchemaActionName(hash: string | null, language: string, slot: string, original: string): string | null {
  if (!hash || !Object.hasOwn(baseHashes, hash)) return historical.schemaActionName(hash, language, slot, original);
  if (language.split(/[-_]/)[0].toLowerCase() !== 'ru') return original;
  if (Object.hasOwn(actionForms, slot))
    return stage49SchemaText(hash, language, slot, original) !== original ? actionForms[slot] : null;
  return historical.schemaActionName(baseHashes[hash], language, slot, original);
}

// Stage50 operator feedback. Each correction is bound to an exact schema slot
// AND its previously reviewed RU result. The Stage49 lookup above still checks
// the schema hash, language, edition and original text. Historical catalogues
// and their replay digests remain immutable.
export const webuiRuStage50Editorial: Readonly<Record<string, { before: string; ru: string }>> = {
  "enum/MtaInboundThrottleKey/listener/label": {
    "before": "Слушатель",
    "ru": "Прослушиватель"
  },
  "enum/Permission/sysNetworkListenerCreate/label": {
    "before": "Слушатели: Создание",
    "ru": "Прослушиватели: Создание"
  },
  "enum/Permission/sysNetworkListenerDestroy/label": {
    "before": "Слушатели: Удаление",
    "ru": "Прослушиватели: Удаление"
  },
  "enum/Permission/sysNetworkListenerGet/label": {
    "before": "Слушатели: Просмотр",
    "ru": "Прослушиватели: Просмотр"
  },
  "enum/Permission/sysNetworkListenerQuery/label": {
    "before": "Слушатели: Поиск",
    "ru": "Прослушиватели: Поиск"
  },
  "enum/Permission/sysNetworkListenerUpdate/label": {
    "before": "Слушатели: Изменение",
    "ru": "Прослушиватели: Изменение"
  },
  "field/x:ClusterListenerGroupProperties/listenerIds/description": {
    "before": "Список сетевых слушателей, включаемых или отключаемых для этой группы",
    "ru": "Список сетевых прослушивателей, включаемых или отключаемых для этой группы"
  },
  "field/x:ClusterRole/listeners/description": {
    "before": "Какие сетевые слушатели включены для этой роли кластера",
    "ru": "Какие сетевые прослушиватели включены для этой роли кластера"
  },
  "field/x:Http/clientIpSource/description": {
    "before": "Определяет источник IP-адреса клиента. При выборе заголовка переадресации слушатель должен быть доступен только через доверенные прокси-серверы, поскольку любой клиент при прямом подключении может указать произвольный адрес.",
    "ru": "Определяет источник IP-адреса клиента. При выборе заголовка переадресации прослушиватель должен быть доступен только через доверенные прокси-серверы, поскольку любой клиент при прямом подключении может указать произвольный адрес."
  },
  "field/x:NetworkListener/bind/description": {
    "before": "Адреса, к которым привязывается слушатель",
    "ru": "Адреса, к которым привязывается прослушиватель"
  },
  "field/x:NetworkListener/maxConnections/description": {
    "before": "Максимальное число одновременных соединений для этого слушателя, общее для всех его адресов привязки. Если не задано, применяется значение по умолчанию из системных настроек",
    "ru": "Максимальное число одновременных соединений для этого прослушивателя, общее для всех его адресов привязки. Если не задано, применяется значение по умолчанию из системных настроек"
  },
  "field/x:NetworkListener/name/description": {
    "before": "Уникальный идентификатор слушателя",
    "ru": "Уникальный идентификатор прослушивателя"
  },
  "field/x:NetworkListener/protocol/description": {
    "before": "Протокол, используемый слушателем",
    "ru": "Протокол, используемый прослушивателем"
  },
  "field/x:NetworkListener/useTls/description": {
    "before": "Включать ли TLS для этого слушателя",
    "ru": "Включать ли TLS для этого прослушивателя"
  },
  "field/x:Service/cleartext/description": {
    "before": "Объявлять ли службу доступной без шифрования TLS. Это не влияет на фактический приём незашифрованных соединений, который настраивается отдельно для каждого сетевого слушателя.",
    "ru": "Объявлять ли службу доступной без шифрования TLS. Это не влияет на фактический приём незашифрованных соединений, который настраивается отдельно для каждого сетевого прослушивателя."
  },
  "form/x:ClusterListenerGroupProperties/field/listenerIds": {
    "before": "Слушатели",
    "ru": "Прослушиватели"
  },
  "form/x:ClusterRole/field/listeners": {
    "before": "Включённые слушатели",
    "ru": "Включённые прослушиватели"
  },
  "form/x:ClusterRole/section/section-2": {
    "before": "Слушатели",
    "ru": "Прослушиватели"
  },
  "form/x:NetworkListener/field/name": {
    "before": "Идентификатор слушателя",
    "ru": "Идентификатор прослушивателя"
  },
  "form/x:NetworkListener/section/section-0": {
    "before": "Настройки слушателя",
    "ru": "Настройки прослушивателя"
  },
  "list/x:NetworkListener/plural": {
    "before": "слушатели",
    "ru": "прослушиватели"
  },
  "list/x:NetworkListener/singular": {
    "before": "слушатель",
    "ru": "прослушиватель"
  },
  "list/x:NetworkListener/subtitle": {
    "before": "Управление слушателями SMTP, IMAP, HTTP и других протоколов",
    "ru": "Управление прослушивателями SMTP, IMAP, HTTP и других протоколов"
  },
  "list/x:NetworkListener/title": {
    "before": "Слушатели",
    "ru": "Прослушиватели"
  },
  "nav/link/Settings/x:NetworkListener": {
    "before": "Слушатели",
    "ru": "Прослушиватели"
  },
  "object/x:ClusterRole/description": {
    "before": "Определяет роль узла кластера с включёнными заданиями и слушателями.",
    "ru": "Определяет роль узла кластера с включёнными заданиями и прослушивателями."
  },
  "object/x:NetworkListener/description": {
    "before": "Определяет сетевой слушатель для приёма входящих соединений.",
    "ru": "Определяет сетевой прослушиватель для приёма входящих соединений."
  },
  "variant/x:ClusterListenerGroup/DisableAll/label": {
    "before": "Отключить все сетевые слушатели",
    "ru": "Отключить все сетевые прослушиватели"
  },
  "variant/x:ClusterListenerGroup/DisableSome/label": {
    "before": "Отключить выбранные сетевые слушатели",
    "ru": "Отключить выбранные сетевые прослушиватели"
  },
  "variant/x:ClusterListenerGroup/EnableAll/label": {
    "before": "Включить все сетевые слушатели",
    "ru": "Включить все сетевые прослушиватели"
  },
  "variant/x:ClusterListenerGroup/EnableSome/label": {
    "before": "Включить выбранные сетевые слушатели",
    "ru": "Включить выбранные сетевые прослушиватели"
  },
  "field/x:SystemSettings/maxConnections/description": {
    "before": "Максимальное количество одновременных соединений на слушатель по умолчанию; применяется к слушателям, для которых не задан собственный лимит",
    "ru": "Максимальное количество одновременных соединений на прослушиватель по умолчанию; применяется к прослушивателям, для которых не задан собственный лимит"
  },
  "enum/Key/listenerId/label": {
    "before": "Идентификатор слушателя (ID)",
    "ru": "Идентификатор прослушивателя (ID)"
  },
  "enum/EventType/limit.concurrent-connection/explanation": {
    "before": "Количество одновременных подключений к этому слушателю достигло настроенного ограничения; новые подключения отклоняются.",
    "ru": "Количество одновременных подключений к этому прослушивателю достигло настроенного ограничения; новые подключения отклоняются."
  },
  "enum/EventType/network.listen-start/label": {
    "before": "Сетевой слушатель запущен",
    "ru": "Сетевой прослушиватель запущен"
  },
  "enum/EventType/network.listen-start/explanation": {
    "before": "Сетевой слушатель принимает подключения на настроенном адресе и порту.",
    "ru": "Сетевой прослушиватель принимает подключения на настроенном адресе и порту."
  },
  "enum/EventType/network.listen-stop/label": {
    "before": "Сетевой слушатель остановлен",
    "ru": "Сетевой прослушиватель остановлен"
  },
  "enum/EventType/network.listen-stop/explanation": {
    "before": "Сетевой слушатель остановлен и больше не принимает новые подключения.",
    "ru": "Сетевой прослушиватель остановлен и больше не принимает новые подключения."
  },
  "enum/EventType/network.listen-error/label": {
    "before": "Ошибка сетевого слушателя",
    "ru": "Ошибка сетевого прослушивателя"
  },
  "enum/EventType/network.listen-error/explanation": {
    "before": "В сетевом слушателе возникла критическая ошибка; возможно, приём подключений прекращён.",
    "ru": "В сетевом прослушивателе возникла критическая ошибка; возможно, приём подключений прекращён."
  },
  "enum/EventType/network.bind-error/explanation": {
    "before": "Не удалось привязать слушатель к настроенному адресу и порту; возможно, порт уже занят или недостаточно разрешений.",
    "ru": "Не удалось привязать прослушиватель к настроенному адресу и порту; возможно, порт уже занят или недостаточно разрешений."
  },
  "enum/EventType/network.accept-error/explanation": {
    "before": "При приёме нового входящего подключения возникла ошибка; часто она временная, и слушатель продолжает работу.",
    "ru": "При приёме нового входящего подключения возникла ошибка; часто она временная, и прослушиватель продолжает работу."
  },
  "enum/EventType/smtp.auth-not-allowed/explanation": {
    "before": "Аутентификация не разрешена для этого слушателя.",
    "ru": "Аутентификация не разрешена для этого прослушивателя."
  },
  "enum/EventType/tls.not-configured/explanation": {
    "before": "Запрошено соединение TLS, но для данного слушателя не настроен сертификат; установить соединение невозможно.",
    "ru": "Запрошено соединение TLS, но для данного прослушивателя не настроен сертификат; установить соединение невозможно."
  },
  "enum/EventType/tls.no-certificates-available/explanation": {
    "before": "Для данного слушателя нет действительных сертификатов TLS; соединения TLS будут завершаться ошибкой до предоставления сертификата.",
    "ru": "Для данного прослушивателя нет действительных сертификатов TLS; соединения TLS будут завершаться ошибкой до предоставления сертификата."
  },
  "variant/x:Account/User/label": {
    "before": "Учётная запись пользователя",
    "ru": "Пользователь"
  },
  "variant/x:Account/Group/label": {
    "before": "Групповая учётная запись",
    "ru": "Группа"
  },
  "variant/x:Account/Resource/label": {
    "before": "Учётная запись ресурса",
    "ru": "Ресурс"
  },
  "nav/container/Settings/MTA": {
    "before": "Почтовый транспорт MTA",
    "ru": "Почтовый транспорт"
  }
};

export function stage50SchemaText(hash: string | null, language: string, slot: string, original: string): string {
  const prior = stage49SchemaText(hash, language, slot, original);
  if (!canTranslateSchema(hash, language) || prior === original || !Object.hasOwn(webuiRuStage50Editorial, slot)) return prior;
  const entry = webuiRuStage50Editorial[slot];
  return entry.before === prior ? entry.ru : prior;
}

export function stage50SchemaActionName(hash: string | null, language: string, slot: string, original: string): string | null {
  if (slot === 'list/x:NetworkListener/singular' && language.split(/[-_]/)[0].toLowerCase() === 'ru') {
    return stage50SchemaText(hash, language, slot, original) === 'прослушиватель' && original === 'listener'
      ? 'прослушиватель' : null;
  }
  return stage49SchemaActionName(hash, language, slot, original);
}

// Stage50 second operator pass: exact slots, original and accepted previous translation.
export const webuiRuStage50Editorial2: Readonly<Record<string, { original: string; before: string; ru: string }>> = {
  "enum/EventType/mta-hook.action-accept/explanation": {
    "original": "The MTA hook requested to accept the message",
    "before": "Обработчик MTA запросил приём письма.",
    "ru": "Веб-хук MTA запросил приём письма."
  },
  "enum/EventType/mta-hook.action-accept/label": {
    "original": "MTA hook action: Accept",
    "before": "Действие обработчика MTA: принять",
    "ru": "Действие веб-хука MTA: принять"
  },
  "enum/EventType/mta-hook.action-discard/explanation": {
    "original": "The MTA hook requested to discard the message",
    "before": "Обработчик MTA запросил отбрасывание письма.",
    "ru": "Веб-хук MTA запросил отбрасывание письма."
  },
  "enum/EventType/mta-hook.action-discard/label": {
    "original": "MTA hook action: Discard",
    "before": "Действие обработчика MTA: отбросить",
    "ru": "Действие веб-хука MTA: отбросить"
  },
  "enum/EventType/mta-hook.action-quarantine/explanation": {
    "original": "The MTA hook requested to quarantine the message",
    "before": "Обработчик MTA запросил помещение письма в карантин.",
    "ru": "Веб-хук MTA запросил помещение письма в карантин."
  },
  "enum/EventType/mta-hook.action-quarantine/label": {
    "original": "MTA hook action: Quarantine",
    "before": "Действие обработчика MTA: карантин",
    "ru": "Действие веб-хука MTA: карантин"
  },
  "enum/EventType/mta-hook.action-reject/explanation": {
    "original": "The MTA hook requested to reject the message",
    "before": "Обработчик MTA запросил отклонение письма.",
    "ru": "Веб-хук MTA запросил отклонение письма."
  },
  "enum/EventType/mta-hook.action-reject/label": {
    "original": "MTA hook action: Reject",
    "before": "Действие обработчика MTA: отклонить",
    "ru": "Действие веб-хука MTA: отклонить"
  },
  "enum/EventType/mta-hook.error/explanation": {
    "original": "An error occurred with the MTA hook",
    "before": "При взаимодействии с обработчиком MTA возникла ошибка.",
    "ru": "При взаимодействии с веб-хуком MTA возникла ошибка."
  },
  "enum/EventType/mta-hook.error/label": {
    "original": "MTA hook error",
    "before": "Ошибка обработчика MTA",
    "ru": "Ошибка веб-хука MTA"
  },
  "enum/MetricType/mta-hook.action-accept/label": {
    "original": "MTA hook action: Accept",
    "before": "Действие обработчика MTA: принять",
    "ru": "Действие веб-хука MTA: принять"
  },
  "enum/MetricType/mta-hook.action-discard/label": {
    "original": "MTA hook action: Discard",
    "before": "Действие обработчика MTA: отбросить",
    "ru": "Действие веб-хука MTA: отбросить"
  },
  "enum/MetricType/mta-hook.action-quarantine/label": {
    "original": "MTA hook action: Quarantine",
    "before": "Действие обработчика MTA: поместить в карантин",
    "ru": "Действие веб-хука MTA: поместить в карантин"
  },
  "enum/MetricType/mta-hook.action-reject/label": {
    "original": "MTA hook action: Reject",
    "before": "Действие обработчика MTA: отклонить",
    "ru": "Действие веб-хука MTA: отклонить"
  },
  "enum/MetricType/mta-hook.error/label": {
    "original": "MTA hook error",
    "before": "Ошибка обработчика MTA",
    "ru": "Ошибка веб-хука MTA"
  },
  "enum/Permission/sysMtaHookCreate/label": {
    "original": "Hooks Management: Create hooks",
    "before": "Веб-хуки: Создание",
    "ru": "Веб-хуки MTA: Создание"
  },
  "enum/Permission/sysMtaHookDestroy/label": {
    "original": "Hooks Management: Destroy hooks",
    "before": "Веб-хуки: Удаление",
    "ru": "Веб-хуки MTA: Удаление"
  },
  "enum/Permission/sysMtaHookGet/label": {
    "original": "Hooks Management: Get hooks",
    "before": "Веб-хуки: Просмотр",
    "ru": "Веб-хуки MTA: Просмотр"
  },
  "enum/Permission/sysMtaHookQuery/label": {
    "original": "Hooks Management: Query hooks",
    "before": "Веб-хуки: Поиск",
    "ru": "Веб-хуки MTA: Поиск"
  },
  "enum/Permission/sysMtaHookUpdate/label": {
    "original": "Hooks Management: Update hooks",
    "before": "Веб-хуки: Изменение",
    "ru": "Веб-хуки MTA: Изменение"
  },
  "enum/Permission/sysMtaInboundThrottleCreate/label": {
    "original": "Throttles Management: Create throttles",
    "before": "Ограничения скорости: Создание",
    "ru": "Лимиты скорости приёма: Создание"
  },
  "enum/Permission/sysMtaInboundThrottleDestroy/label": {
    "original": "Throttles Management: Destroy throttles",
    "before": "Ограничения скорости: Удаление",
    "ru": "Лимиты скорости приёма: Удаление"
  },
  "enum/Permission/sysMtaInboundThrottleGet/label": {
    "original": "Throttles Management: Get throttles",
    "before": "Ограничения скорости: Просмотр",
    "ru": "Лимиты скорости приёма: Просмотр"
  },
  "enum/Permission/sysMtaInboundThrottleQuery/label": {
    "original": "Throttles Management: Query throttles",
    "before": "Ограничения скорости: Поиск",
    "ru": "Лимиты скорости приёма: Поиск"
  },
  "enum/Permission/sysMtaInboundThrottleUpdate/label": {
    "original": "Throttles Management: Update throttles",
    "before": "Ограничения скорости: Изменение",
    "ru": "Лимиты скорости приёма: Изменение"
  },
  "enum/Permission/sysMtaOutboundThrottleCreate/label": {
    "original": "Throttles Management: Create throttles",
    "before": "Ограничения скорости: Создание",
    "ru": "Лимиты скорости отправки: Создание"
  },
  "enum/Permission/sysMtaOutboundThrottleDestroy/label": {
    "original": "Throttles Management: Destroy throttles",
    "before": "Ограничения скорости: Удаление",
    "ru": "Лимиты скорости отправки: Удаление"
  },
  "enum/Permission/sysMtaOutboundThrottleGet/label": {
    "original": "Throttles Management: Get throttles",
    "before": "Ограничения скорости: Просмотр",
    "ru": "Лимиты скорости отправки: Просмотр"
  },
  "enum/Permission/sysMtaOutboundThrottleQuery/label": {
    "original": "Throttles Management: Query throttles",
    "before": "Ограничения скорости: Поиск",
    "ru": "Лимиты скорости отправки: Поиск"
  },
  "enum/Permission/sysMtaOutboundThrottleUpdate/label": {
    "original": "Throttles Management: Update throttles",
    "before": "Ограничения скорости: Изменение",
    "ru": "Лимиты скорости отправки: Изменение"
  },
  "field/x:Metrics/resourceAttributes/description": {
    "original": "Additional resource attributes reported to OpenTelemetry collectors by the metrics exporter and the OpenTelemetry tracers",
    "before": "Дополнительные атрибуты ресурса, передаваемые экспортёром метрик и средствами трассировки OpenTelemetry сборщикам OpenTelemetry",
    "ru": "Дополнительные атрибуты ресурса, передаваемые экспортёром метрик и средствами трассировки OpenTelemetry в OpenTelemetry"
  },
  "field/x:Metrics/serviceName/description": {
    "original": "Service name reported to OpenTelemetry collectors by the metrics exporter and the OpenTelemetry tracers",
    "before": "Имя службы, передаваемое экспортёром метрик и средствами трассировки OpenTelemetry сборщикам OpenTelemetry",
    "ru": "Имя службы, передаваемое экспортёром метрик и средствами трассировки OpenTelemetry в OpenTelemetry"
  },
  "field/x:Metrics/serviceNamespace/description": {
    "original": "Optional service namespace reported to OpenTelemetry collectors by the metrics exporter and the OpenTelemetry tracers",
    "before": "Необязательное пространство имён службы, передаваемое экспортёром метрик и средствами трассировки OpenTelemetry сборщикам OpenTelemetry",
    "ru": "Необязательное пространство имён службы, передаваемое экспортёром метрик и средствами трассировки OpenTelemetry в OpenTelemetry"
  },
  "field/x:MetricsOtelGrpc/interval/description": {
    "original": "How often metrics are exported to the OpenTelemetry collector",
    "before": "Периодичность экспорта метрик в сборщик OpenTelemetry",
    "ru": "Периодичность экспорта метрик в OpenTelemetry"
  },
  "field/x:MetricsOtelGrpc/timeout/description": {
    "original": "Maximum amount of time that Stalwart will wait for a response from the OpenTelemetry collector",
    "before": "Максимальное время ожидания ответа от сборщика OpenTelemetry сервером Stalwart",
    "ru": "Максимальное время ожидания сервером Stalwart ответа от конечной точки OpenTelemetry"
  },
  "field/x:MetricsOtelGrpc/url/description": {
    "original": "URL of the OpenTelemetry collector; when unset, the collector on localhost port 4317 is used",
    "before": "URL сборщика OpenTelemetry; если не задан, используется сборщик на localhost, порт 4317",
    "ru": "URL конечной точки OpenTelemetry; если не задан, используется localhost, порт 4317"
  },
  "field/x:MetricsOtelHttp/interval/description": {
    "original": "How often metrics are exported to the OpenTelemetry collector",
    "before": "Периодичность экспорта метрик в сборщик OpenTelemetry",
    "ru": "Периодичность экспорта метрик в OpenTelemetry"
  },
  "field/x:MetricsOtelHttp/timeout/description": {
    "original": "Maximum amount of time that Stalwart will wait for a response from the OpenTelemetry collector",
    "before": "Максимальное время ожидания ответа от сборщика OpenTelemetry сервером Stalwart",
    "ru": "Максимальное время ожидания сервером Stalwart ответа от конечной точки OpenTelemetry"
  },
  "field/x:MetricsOtelHttp/url/description": {
    "original": "Base URL of the OpenTelemetry collector; /v1/metrics is appended",
    "before": "Базовый URL сборщика OpenTelemetry; добавляется путь /v1/metrics",
    "ru": "Базовый URL конечной точки OpenTelemetry; добавляется путь /v1/metrics"
  },
  "field/x:MtaHook/enable/description": {
    "original": "Expression that determines whether to enable this hook",
    "before": "Выражение, определяющее, следует ли включить этот обработчик",
    "ru": "Выражение, определяющее, следует ли включить этот веб-хук"
  },
  "field/x:MtaHook/maxResponseSize/description": {
    "original": "Maximum size, in bytes, of a response that Stalwart will accept from this MTA Hook server",
    "before": "Максимальный размер ответа в байтах, который Stalwart примет от этого сервера MTA Hook",
    "ru": "Максимальный размер ответа в байтах, который Stalwart примет от этого сервера веб-хуков MTA"
  },
  "field/x:MtaHook/stages/description": {
    "original": "Which SMTP stages to run this hook on",
    "before": "Этапы SMTP, на которых выполняется этот обработчик",
    "ru": "Этапы SMTP, на которых выполняется этот веб-хук"
  },
  "field/x:MtaHook/tempFailOnError/description": {
    "original": "Whether to respond with a temporary failure (typically a 4xx SMTP status code) when Stalwart encounters an error while communicating with this MTA Hook server",
    "before": "Возвращать ли временный отказ (обычно код состояния SMTP 4xx), если при обмене Stalwart с этим сервером MTA Hook возникает ошибка",
    "ru": "Возвращать ли временный отказ (обычно код состояния SMTP 4xx), если при обмене Stalwart с этим сервером веб-хуков MTA возникает ошибка"
  },
  "field/x:MtaHook/url/description": {
    "original": "URL of the hook endpoint",
    "before": "URL конечной точки обработчика",
    "ru": "URL конечной точки веб-хука"
  },
  "field/x:MtaInboundThrottle/description/description": {
    "original": "Short description for the throttle",
    "before": "Краткое описание ограничения частоты",
    "ru": "Краткое описание лимита"
  },
  "field/x:MtaInboundThrottle/enable/description": {
    "original": "Whether to enable this throttle",
    "before": "Включать ли это ограничение частоты",
    "ru": "Включать ли этот лимит"
  },
  "field/x:MtaInboundThrottle/key/description": {
    "original": "Optional list of context variables that determine where this throttle should be applied",
    "before": "Необязательный список переменных контекста, определяющих область применения этого ограничения частоты",
    "ru": "Необязательный список переменных контекста, определяющих область применения этого лимита"
  },
  "field/x:MtaInboundThrottle/match/description": {
    "original": "Enable the imposition of concurrency and rate limits only when a specific condition is met",
    "before": "Применять ограничения числа одновременных операций и частоты только при выполнении заданного условия",
    "ru": "Применять лимиты числа одновременных операций и числа операций за заданный период только при выполнении условия"
  },
  "field/x:MtaInboundThrottle/rate/description": {
    "original": "Number of incoming requests over a period of time that the rate limiter will allow",
    "before": "Число входящих запросов за заданный период, разрешённое ограничителем частоты",
    "ru": "Допустимое число операций за заданный период"
  },
  "field/x:MtaMilter/enable/description": {
    "original": "Expression that determines whether to enable this milter",
    "before": "Выражение, определяющее, следует ли включить этот фильтр milter",
    "ru": "Выражение, определяющее, следует ли включить этот фильтр Milter"
  },
  "field/x:MtaMilter/stages/description": {
    "original": "Which SMTP stages to run the milter on",
    "before": "Этапы SMTP, на которых выполняется фильтр milter",
    "ru": "Этапы SMTP, на которых выполняется фильтр Milter"
  },
  "field/x:MtaOutboundThrottle/description/description": {
    "original": "Short description for the throttle",
    "before": "Краткое описание ограничения частоты",
    "ru": "Краткое описание лимита"
  },
  "field/x:MtaOutboundThrottle/enable/description": {
    "original": "Whether to enable this throttle",
    "before": "Включать ли это ограничение частоты",
    "ru": "Включать ли этот лимит"
  },
  "field/x:MtaOutboundThrottle/key/description": {
    "original": "Optional list of context variables that determine where this throttle should be applied",
    "before": "Необязательный список переменных контекста, определяющих область применения этого ограничения частоты",
    "ru": "Необязательный список переменных контекста, определяющих область применения этого лимита"
  },
  "field/x:MtaOutboundThrottle/match/description": {
    "original": "Enable the imposition of concurrency and rate limits only when a specific condition is met",
    "before": "Применять ограничения числа одновременных операций и частоты только при выполнении заданного условия",
    "ru": "Применять лимиты числа одновременных операций и числа операций за заданный период только при выполнении условия"
  },
  "field/x:MtaOutboundThrottle/rate/description": {
    "original": "Number of incoming requests over a period of time that the rate limiter will allow",
    "before": "Число входящих запросов за заданный период, разрешённое ограничителем частоты",
    "ru": "Допустимое число операций за заданный период"
  },
  "field/x:MtaQueueQuota/match/description": {
    "original": "Enable the imposition of concurrency and rate limits only when a specific condition is met",
    "before": "Применять ограничения числа одновременных операций и частоты только при выполнении заданного условия",
    "ru": "Применять лимиты числа одновременных операций и числа операций за заданный период только при выполнении условия"
  },
  "form/x:Metrics/CollectorOtel/field/openTelemetry": {
    "original": "Collector",
    "before": "Сборщик",
    "ru": "Сбор метрик"
  },
  "form/x:Metrics/CollectorOtel/title": {
    "original": "OpenTelemetry Collector",
    "before": "Сборщик OpenTelemetry",
    "ru": "Сбор метрик OpenTelemetry"
  },
  "form/x:Metrics/CollectorPrometheus/field/prometheus": {
    "original": "Collector",
    "before": "Сборщик",
    "ru": "Сбор метрик"
  },
  "form/x:Metrics/CollectorPrometheus/title": {
    "original": "Prometheus Collector",
    "before": "Сборщик Prometheus",
    "ru": "Сбор метрик Prometheus"
  },
  "form/x:MetricsOtelGrpc/field/url": {
    "original": "URL",
    "before": "URL сборщика",
    "ru": "URL конечной точки"
  },
  "form/x:MetricsOtelHttp/field/url": {
    "original": "URL",
    "before": "URL сборщика",
    "ru": "URL конечной точки"
  },
  "form/x:MtaHook/section/section-0": {
    "original": "MTA Hook settings",
    "before": "Настройки обработчика MTA Hook",
    "ru": "Настройки веб-хука MTA"
  },
  "form/x:MtaInboundThrottle/field/rate": {
    "original": "Rate limit",
    "before": "Ограничение частоты",
    "ru": "Лимит"
  },
  "form/x:MtaInboundThrottle/section/section-0": {
    "original": "Inbound Rate Limiter",
    "before": "Ограничение частоты входящих запросов",
    "ru": "Лимит скорости приёма"
  },
  "form/x:MtaOutboundThrottle/field/rate": {
    "original": "Rate limit",
    "before": "Ограничение частоты",
    "ru": "Лимит"
  },
  "form/x:MtaOutboundThrottle/section/section-0": {
    "original": "Outbound Rate Limiter",
    "before": "Ограничение частоты исходящих запросов",
    "ru": "Лимит скорости отправки"
  },
  "list/x:MemoryLookupKeyValue/plural": {
    "original": "keys",
    "before": "ключи",
    "ru": "пары"
  },
  "list/x:MemoryLookupKeyValue/singular": {
    "original": "key",
    "before": "ключ",
    "ru": "пара"
  },
  "list/x:MemoryLookupKeyValue/title": {
    "original": "Lookup Key-Values",
    "before": "Пары «ключ — значение»",
    "ru": "Пары «ключ — значение» в памяти"
  },
  "list/x:MtaHook/plural": {
    "original": "hooks",
    "before": "обработчики",
    "ru": "веб-хуки MTA"
  },
  "list/x:MtaHook/singular": {
    "original": "hook",
    "before": "обработчик",
    "ru": "веб-хук MTA"
  },
  "list/x:MtaHook/subtitle": {
    "original": "Manage MTA Hooks",
    "before": "Управление обработчиками MTA Hooks",
    "ru": "Управление веб-хуками MTA"
  },
  "list/x:MtaHook/title": {
    "original": "MTA Hooks",
    "before": "Обработчики MTA",
    "ru": "Веб-хуки MTA"
  },
  "list/x:MtaInboundThrottle/plural": {
    "original": "throttles",
    "before": "ограничения частоты",
    "ru": "лимиты скорости приёма"
  },
  "list/x:MtaInboundThrottle/singular": {
    "original": "throttle",
    "before": "ограничение частоты",
    "ru": "лимит скорости приёма"
  },
  "list/x:MtaInboundThrottle/subtitle": {
    "original": "Manage inbound rate limits",
    "before": "Управление ограничениями частоты входящих запросов",
    "ru": "Управление лимитами скорости приёма"
  },
  "list/x:MtaInboundThrottle/title": {
    "original": "Inbound Rate Limits",
    "before": "Ограничения скорости приёма",
    "ru": "Лимиты скорости приёма"
  },
  "list/x:MtaMilter/plural": {
    "original": "milters",
    "before": "фильтры milter",
    "ru": "фильтры Milter"
  },
  "list/x:MtaMilter/singular": {
    "original": "milter",
    "before": "фильтр milter",
    "ru": "фильтр Milter"
  },
  "list/x:MtaOutboundThrottle/plural": {
    "original": "throttles",
    "before": "ограничения частоты",
    "ru": "лимиты скорости отправки"
  },
  "list/x:MtaOutboundThrottle/singular": {
    "original": "throttle",
    "before": "ограничение частоты",
    "ru": "лимит скорости отправки"
  },
  "list/x:MtaOutboundThrottle/subtitle": {
    "original": "Manage outbound rate limits",
    "before": "Управление ограничениями частоты исходящих запросов",
    "ru": "Управление лимитами скорости отправки"
  },
  "list/x:MtaOutboundThrottle/title": {
    "original": "Outbound Rate Limits",
    "before": "Ограничения скорости отправки",
    "ru": "Лимиты скорости отправки"
  },
  "list/x:MtaQueueQuota/singular": {
    "original": "quota",
    "before": "квота",
    "ru": "квота очереди"
  },
  "nav/container/Settings/MTA/Rates & Quotas": {
    "original": "Rates & Quotas",
    "before": "Ограничения частоты и квоты",
    "ru": "Лимиты и квоты"
  },
  "nav/link/Settings/x:MemoryLookupKeyValue": {
    "original": "In-Memory Key-Values",
    "before": "Пары ключ–значение в памяти",
    "ru": "Пары ключ–значение"
  },
  "nav/link/Settings/x:Metrics/CollectorOtel": {
    "original": "OpenTelemetry",
    "before": "Сбор метрик OpenTelemetry",
    "ru": "OpenTelemetry"
  },
  "nav/link/Settings/x:Metrics/CollectorPrometheus": {
    "original": "Prometheus",
    "before": "Сбор метрик Prometheus",
    "ru": "Prometheus"
  },
  "nav/link/Settings/x:MtaHook": {
    "original": "MTA Hooks",
    "before": "Обработчики MTA",
    "ru": "Веб-хуки MTA"
  },
  "nav/link/Settings/x:MtaInboundThrottle": {
    "original": "Inbound Rate Limits",
    "before": "Ограничения скорости приёма",
    "ru": "Лимиты приёма"
  },
  "nav/link/Settings/x:MtaOutboundThrottle": {
    "original": "Outbound Rate Limits",
    "before": "Ограничения скорости отправки",
    "ru": "Лимиты отправки"
  },
  "object/x:MtaHook/description": {
    "original": "Defines an MTA hook endpoint for message processing.",
    "before": "Определяет конечную точку обработчика MTA Hook для обработки сообщений.",
    "ru": "Определяет конечную точку веб-хука MTA для обработки сообщений."
  },
  "object/x:MtaInboundThrottle/description": {
    "original": "Defines an inbound rate limit rule for SMTP connections.",
    "before": "Определяет правило ограничения частоты входящих подключений SMTP.",
    "ru": "Определяет правило ограничения скорости входящих подключений SMTP."
  },
  "object/x:MtaOutboundThrottle/description": {
    "original": "Defines an outbound rate limit rule for message delivery.",
    "before": "Определяет правило ограничения частоты исходящей доставки сообщений.",
    "ru": "Определяет правило ограничения скорости исходящей доставки сообщений."
  }
};

const webuiRuStage50Action2: Readonly<Record<string, string>> = {
  'list/x:MtaHook/singular': 'веб-хук MTA',
  'list/x:MtaMilter/singular': 'фильтр Milter',
  'list/x:MtaInboundThrottle/singular': 'лимит скорости приёма',
  'list/x:MtaOutboundThrottle/singular': 'лимит скорости отправки',
  'list/x:MtaQueueQuota/singular': 'квоту очереди',
  'list/x:MemoryLookupKeyValue/singular': 'пару',
};

export function stage50SecondSchemaText(hash: string | null, language: string, slot: string, original: string): string {
  const prior = stage50SchemaText(hash, language, slot, original);
  if (!canTranslateSchema(hash, language) || !Object.hasOwn(webuiRuStage50Editorial2, slot)) return prior;
  const entry = webuiRuStage50Editorial2[slot];
  return entry.original === original && entry.before === prior ? entry.ru : prior;
}

export function stage50SecondSchemaActionName(hash: string | null, language: string, slot: string, original: string): string | null {
  if (language.split(/[-_]/)[0].toLowerCase() === 'ru' && Object.hasOwn(webuiRuStage50Action2, slot)) {
    const entry = webuiRuStage50Editorial2[slot];
    return entry.original === original && stage50SecondSchemaText(hash, language, slot, original) === entry.ru
      ? webuiRuStage50Action2[slot] : null;
  }
  return stage50SchemaActionName(hash, language, slot, original);
}

// Stage50 third pass: exact operator-approved text changes, with original and
// previous-RU checks. Keep both earlier overlays and all source pins intact.
export const webuiRuStage50Editorial3: Readonly<Record<string, { original: string; before: string; ru: string }>> = {
  "field/x:MemoryLookupKey/isGlobPattern/description": {
    "original": "Whether the key is a glob pattern",
    "before": "Является ли ключ шаблоном glob",
    "ru": "Использовать ключ как маску с подстановочными символами * и ?"
  },
  "field/x:MemoryLookupKeyValue/isGlobPattern/description": {
    "original": "Whether the key is a glob pattern",
    "before": "Является ли ключ шаблоном glob",
    "ru": "Использовать ключ как маску с подстановочными символами * и ?"
  },
  "field/x:MtaConnectionStrategy/description/description": {
    "original": "Short description of the connection strategy",
    "before": "Краткое описание стратегии подключения",
    "ru": "Краткое описание профиля подключения"
  },
  "field/x:MtaConnectionStrategy/ehloHostname/description": {
    "original": "Overrides the EHLO hostname that will be used when connecting using this strategy",
    "before": "Переопределяет имя узла EHLO при подключении с использованием этой стратегии",
    "ru": "Переопределяет имя узла EHLO при подключении с использованием этого профиля"
  },
  "field/x:MtaConnectionStrategy/name/description": {
    "original": "Short identifier for the strategy",
    "before": "Краткий идентификатор стратегии",
    "ru": "Краткий идентификатор профиля"
  },
  "field/x:MtaOutboundStrategy/connection/description": {
    "original": "An expression that returns the connection strategy to use when delivering messages to remote SMTP servers",
    "before": "Выражение, возвращающее стратегию подключения для доставки сообщений на удалённые серверы SMTP",
    "ru": "Выражение, возвращающее профиль подключения для доставки сообщений на удалённые серверы SMTP"
  },
  "form/x:MemoryLookupKey/field/isGlobPattern": {
    "original": "Glob Pattern",
    "before": "Шаблон glob",
    "ru": "Маска ключа"
  },
  "form/x:MemoryLookupKeyValue/field/isGlobPattern": {
    "original": "Glob Pattern",
    "before": "Шаблон glob",
    "ru": "Маска ключа"
  },
  "form/x:MtaConnectionStrategy/section/section-0": {
    "original": "Connection Strategy",
    "before": "Стратегия подключения",
    "ru": "Профиль подключения"
  },
  "list/x:MemoryLookupKey/title": {
    "original": "Lookup Keys",
    "before": "Ключи поиска",
    "ru": "Ключи в памяти"
  },
  "list/x:MtaConnectionStrategy/plural": {
    "original": "strategies",
    "before": "стратегии",
    "ru": "профили"
  },
  "list/x:MtaConnectionStrategy/singular": {
    "original": "strategy",
    "before": "стратегия",
    "ru": "профиль"
  },
  "list/x:MtaConnectionStrategy/subtitle": {
    "original": "Manage connection strategies for message delivery",
    "before": "Управление стратегиями подключения для доставки сообщений",
    "ru": "Управление профилями исходящих подключений"
  },
  "list/x:MtaConnectionStrategy/title": {
    "original": "Connection Strategies",
    "before": "Стратегии подключений",
    "ru": "Профили исходящих подключений"
  },
  "nav/container/Settings/Files & Sharing": {
    "original": "Files & Sharing",
    "before": "Файлы и общий доступ",
    "ru": "Файлы и доступ"
  },
  "nav/container/Settings/Spam Filter/DNSBL": {
    "original": "DNSBL",
    "before": "Списки блокировки DNSBL",
    "ru": "DNSBL"
  },
  "nav/container/Settings/Storage": {
    "original": "Storage",
    "before": "Хранение",
    "ru": "Хранилища"
  },
  "nav/container/Settings/Storage/Data Retention": {
    "original": "Data Retention",
    "before": "Сроки хранения данных",
    "ru": "Сроки хранения"
  },
  "nav/link/Settings/x:AllowedIp": {
    "original": "Allowed IPs",
    "before": "Разрешённые IP-адреса",
    "ru": "Разрешённые IP"
  },
  "nav/link/Settings/x:BlockedIp": {
    "original": "Blocked IPs",
    "before": "Заблокированные IP-адреса",
    "ru": "Заблокированные IP"
  },
  "nav/link/Settings/x:DataRetention/DataExpunge": {
    "original": "Auto-Expunge",
    "before": "Автоматическое удаление",
    "ru": "Автоудаление"
  },
  "nav/link/Settings/x:Encryption/EncryptionStorage": {
    "original": "Encryption at Rest",
    "before": "Шифрование при хранении",
    "ru": "Хранение"
  },
  "nav/link/Settings/x:Enterprise": {
    "original": "Enterprise",
    "before": "Корпоративная лицензия",
    "ru": "Лицензия"
  },
  "nav/link/Settings/x:MemoryLookupKey": {
    "original": "In-Memory Keys",
    "before": "Ключи в памяти",
    "ru": "Ключи"
  },
  "nav/link/Settings/x:MtaConnectionStrategy": {
    "original": "Connection Strategies",
    "before": "Стратегии подключений",
    "ru": "Подключения"
  },
  "nav/link/Settings/x:SenderAuth": {
    "original": "Sender Authentication",
    "before": "Проверка отправителя",
    "ru": "Проверки"
  },
  "object/x:MtaConnectionStrategy/description": {
    "original": "Defines a connection strategy for outbound message delivery.",
    "before": "Определяет стратегию подключения для исходящей доставки сообщений.",
    "ru": "Определяет профиль подключения для исходящей доставки сообщений."
  }
};

// UI-50-03 local presentation labels, never keys in a server schema. These
// slots are emitted only by the exact-tree, known-schema sidebar overlay.
export const webuiRuSieveNavLabels: Readonly<Record<string, { original: string; ru: string }>> = {
  'webuiRu.sieveNav.interpreters': { original: 'Interpreters', ru: 'Интерпретаторы' },
  'webuiRu.sieveNav.scripts': { original: 'Scripts', ru: 'Сценарии' },
  'webuiRu.sieveNav.systemInterpreter': { original: 'System', ru: 'Системный' },
  'webuiRu.sieveNav.userInterpreter': { original: 'User', ru: 'Пользовательский' },
  'webuiRu.sieveNav.systemScripts': { original: 'System', ru: 'Системные' },
  'webuiRu.sieveNav.userScripts': { original: 'User', ru: 'Пользовательские' },
};

export function schemaText(hash: string | null, language: string, slot: string, original: string): string {
  const prior = stage50SecondSchemaText(hash, language, slot, original);
  if (!canTranslateSchema(hash, language)) return prior;
  if (Object.hasOwn(webuiRuSieveNavLabels, slot)) {
    const entry = webuiRuSieveNavLabels[slot];
    return entry.original === original ? entry.ru : prior;
  }
  if (!Object.hasOwn(webuiRuStage50Editorial3, slot)) return prior;
  const entry = webuiRuStage50Editorial3[slot];
  return entry.original === original && entry.before === prior ? entry.ru : prior;
}

export function schemaActionName(hash: string | null, language: string, slot: string, original: string): string | null {
  if (language.split(/[-_]/)[0].toLowerCase() === 'ru' && slot === 'list/x:MtaConnectionStrategy/singular') {
    return original === 'strategy' && schemaText(hash, language, slot, original) === 'профиль' ? 'профиль' : null;
  }
  return stage50SecondSchemaActionName(hash, language, slot, original);
}
