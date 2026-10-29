import type { Role, RoleConfig } from "../shared/config";
import { Provider } from "./providers";

/** A role is usable once it has a provider and an endpoint, and a key unless it is a self-hosted server. */
export function isConfigured(role: RoleConfig): boolean {
  return Boolean(role.provider && role.baseUrl && (role.apiKey || role.provider === Provider.SelfHosted));
}

/** What the musician sets in Ode: Settings to make a role work. */
export function notConfiguredMessage(role: Role): string {
  switch (role) {
    case "main":
    case "subagent":
      return "Choose a provider and model, and add its key, in Ode: Settings";
    case "audio_understanding":
    case "transcription":
    case "image_generation":
      return "This uses Meta's models: add a Meta key in Ode: Settings";
    default:
      return `Add a ${role.replace("_", " ")} service in Ode: Settings, under More services`;
  }
}
