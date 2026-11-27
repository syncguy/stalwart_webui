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

export function schemaText(hash: string | null, language: string, slot: string, original: string): string {
  const prior = stage49SchemaText(hash, language, slot, original);
  if (!canTranslateSchema(hash, language) || prior === original || !Object.hasOwn(webuiRuStage50Editorial, slot)) return prior;
  const entry = webuiRuStage50Editorial[slot];
  return entry.before === prior ? entry.ru : prior;
}

export function schemaActionName(hash: string | null, language: string, slot: string, original: string): string | null {
  if (slot === 'list/x:NetworkListener/singular' && language.split(/[-_]/)[0].toLowerCase() === 'ru') {
    return schemaText(hash, language, slot, original) === 'прослушиватель' && original === 'listener'
      ? 'прослушиватель' : null;
  }
  return stage49SchemaActionName(hash, language, slot, original);
}
