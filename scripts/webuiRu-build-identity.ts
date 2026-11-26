// Fork-owned build identity, no I/O and no runtime network access.
export type WebuiRuBuildIdentity = {
  version: string;
  edition: 'ru';
  timestampUtc: string;
} & (
  | { kind: 'ci'; runNumber: string; runAttempt: string; sourceSha: string }
  | { kind: 'local'; runNumber: null; runAttempt: null; sourceSha: null }
);

function canonicalUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) {
    throw new Error('WEBUI_RU_BUILD_TIMESTAMP must be a UTC ISO timestamp with seconds');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().replace('.000Z', 'Z') !== value) {
    throw new Error('Invalid WEBUI_RU_BUILD_TIMESTAMP');
  }
  return value;
}

function buildTimestamp(env: Readonly<Record<string, string | undefined>>, now: Date): string {
  if (env.WEBUI_RU_BUILD_TIMESTAMP !== undefined) return canonicalUtc(env.WEBUI_RU_BUILD_TIMESTAMP);
  if (env.SOURCE_DATE_EPOCH !== undefined) {
    const raw = env.SOURCE_DATE_EPOCH;
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
      throw new Error('Invalid SOURCE_DATE_EPOCH');
    }
    const date = new Date(Number(raw) * 1000);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid SOURCE_DATE_EPOCH');
    return canonicalUtc(date.toISOString().replace('.000Z', 'Z'));
  }
  return canonicalUtc(now.toISOString().replace(/\.\d{3}Z$/, 'Z'));
}

function positiveInteger(value: string | undefined, name: string): string {
  if (!value || !/^[1-9]\d*$/.test(value)) throw new Error('Invalid ' + name);
  return value;
}

export function webuiRuBuildIdentity(
  version: string,
  env: Readonly<Record<string, string | undefined>>,
  now = new Date(),
): WebuiRuBuildIdentity {
  const timestampUtc = buildTimestamp(env, now);
  const common = { version, edition: 'ru' as const, timestampUtc };
  if (env.GITHUB_ACTIONS !== 'true') {
    return { ...common, kind: 'local', runNumber: null, runAttempt: null, sourceSha: null };
  }
  const sourceSha = env.GITHUB_SHA;
  if (!sourceSha || !/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Invalid GITHUB_SHA');
  return {
    ...common,
    kind: 'ci',
    runNumber: positiveInteger(env.GITHUB_RUN_NUMBER, 'GITHUB_RUN_NUMBER'),
    runAttempt: positiveInteger(env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT'),
    sourceSha,
  };
}
