/**
 * Environment-derived application configuration.
 *
 * Loading configuration is intentionally pure: it reads the supplied environment, records problems,
 * and never throws. A missing OPENAI_API_KEY is a *degraded mode* signal rather than a crash so that
 * /health remains observable and the API can return a precise 503 to fix requests.
 */
export const DEFAULT_PORT = 3001;
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_AI_PROVIDER_TIMEOUT_MS = 25_000;
export const MAX_AI_PROVIDER_TIMEOUT_MS = 29_000;

export interface AppConfig {
  port: number;
  openAiApiKey?: string;
  openAiModel: string;
  openAiBaseUrl: string;
  aiProviderTimeoutMs: number;
  corsOrigins: string[];
  configurationErrors: string[];
  warnings: string[];
}

function parseInteger(value: string | undefined, fallback: number, name: string, warnings: string[]): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    warnings.push(`${name} must be a positive integer; using ${fallback}.`);
    return fallback;
  }
  return parsed;
}

function loadBaseUrl(value: string | undefined, warnings: string[]): string {
  const candidate = value?.trim() || DEFAULT_OPENAI_BASE_URL;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return candidate.replace(/\/+$/, '');
  } catch {
    warnings.push('OPENAI_BASE_URL is invalid; using the default OpenAI endpoint.');
    return DEFAULT_OPENAI_BASE_URL;
  }
}

function loadCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : ['*'];
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const warnings: string[] = [];
  const configurationErrors: string[] = [];

  const port = parseInteger(env.PORT, DEFAULT_PORT, 'PORT', warnings);
  const openAiApiKey = env.OPENAI_API_KEY?.trim() || undefined;
  if (!openAiApiKey) {
    // Deliberately names only the environment variable; never echo a supplied value.
    configurationErrors.push(
      'OPENAI_API_KEY is not set; starting in degraded mode (POST /api/fix will return 503 until it is configured).',
    );
  }

  const openAiModel = env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const openAiBaseUrl = loadBaseUrl(env.OPENAI_BASE_URL, warnings);

  let aiProviderTimeoutMs = parseInteger(
    env.AI_PROVIDER_TIMEOUT_MS,
    DEFAULT_AI_PROVIDER_TIMEOUT_MS,
    'AI_PROVIDER_TIMEOUT_MS',
    warnings,
  );
  if (aiProviderTimeoutMs > MAX_AI_PROVIDER_TIMEOUT_MS) {
    warnings.push(`AI_PROVIDER_TIMEOUT_MS above ${MAX_AI_PROVIDER_TIMEOUT_MS}ms was capped to ${MAX_AI_PROVIDER_TIMEOUT_MS}ms.`);
    aiProviderTimeoutMs = MAX_AI_PROVIDER_TIMEOUT_MS;
  }

  return {
    port,
    openAiApiKey,
    openAiModel,
    openAiBaseUrl,
    aiProviderTimeoutMs,
    corsOrigins: loadCorsOrigins(env.CORS_ORIGINS),
    configurationErrors,
    warnings,
  };
}
