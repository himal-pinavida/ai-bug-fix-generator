import { AppConfig } from './app-config';
import { StructuredLogger } from '../common/structured-logger';

/**
 * Emit one structured ERROR per configuration problem (and WARN per warning) during bootstrap.
 * The messages are crafted in loadAppConfig and contain only environment-variable names — never a
 * configuration object or a secret value.
 */
export function logConfigurationProblems(config: AppConfig, logger: StructuredLogger): void {
  for (const problem of config.configurationErrors) {
    logger.log('error', 'configuration_error', { problem });
  }
  for (const warning of config.warnings) {
    logger.warn('configuration_warning', { problem: warning });
  }
}
