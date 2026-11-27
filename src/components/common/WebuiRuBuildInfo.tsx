import { useTranslation } from 'react-i18next';

export function WebuiRuBuildInfo() {
  const { t } = useTranslation();
  const build = __WEBUI_RU_BUILD_IDENTITY__;
  return (
    <div className="space-y-1">
      <div>{t('version.label', 'Stalwart WebUI v{{version}}', { version: build.version })}</div>
      <div>{t('webuiRu.build.edition', 'Russian edition · laboratory build')}</div>
      <div>
        {build.kind === 'ci'
          ? t('webuiRu.build.ci', 'Build #{{run}}.{{attempt}} · {{sha}}', {
              run: build.runNumber,
              attempt: build.runAttempt,
              sha: build.sourceSha.slice(0, 12),
            })
          : t('webuiRu.build.local', 'Local build')}
      </div>
      <div>{t('webuiRu.build.timestamp', 'Built: {{timestamp}} (UTC)', { timestamp: build.timestampUtc })}</div>
    </div>
  );
}
