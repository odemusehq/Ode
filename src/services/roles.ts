import type { OdeConfig, Role, RoleConfig } from "../shared/config";
import { Provider } from "./providers";

/** A role is usable once it has a provider and an endpoint, and a key unless it is a self-hosted server. */
export function isConfigured(role: RoleConfig): boolean {
  return Boolean(role.provider && role.baseUrl && (role.apiKey || role.provider === Provider.SelfHosted));
}

export function notConfiguredMessage(role: Role): string {
  const prefix = `ODE_${role.toUpperCase()}_`;
  return `not configured: set ${prefix}PROVIDER and ${prefix}BASE_URL (and ${prefix}API_KEY if the service needs one) in .env (see .env.example)`;
}

export function requireRole(config: OdeConfig, role: Role): RoleConfig {
  const settings = config.roles[role];
  if (!isConfigured(settings)) throw new Error(notConfiguredMessage(role));
  return settings;
}
