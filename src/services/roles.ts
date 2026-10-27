import type { OdeConfig, Role, RoleConfig } from "../shared/config";

export function isConfigured(role: RoleConfig): boolean {
  return Boolean(role.provider && role.baseUrl && role.apiKey);
}

export function notConfiguredMessage(role: Role): string {
  const prefix = `ODE_${role.toUpperCase()}_`;
  return `not configured: set ${prefix}PROVIDER, ${prefix}BASE_URL and ${prefix}API_KEY in .env (see .env.example)`;
}

export function requireRole(config: OdeConfig, role: Role): RoleConfig {
  const settings = config.roles[role];
  if (!isConfigured(settings)) throw new Error(notConfiguredMessage(role));
  return settings;
}
